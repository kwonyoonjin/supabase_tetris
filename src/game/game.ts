import { Bag } from './bag';
import { SHAPES, getKicks, rotateMatrix, type Matrix, type PieceType } from './pieces';

export const COLS = 10;
export const VISIBLE_ROWS = 20;
export const HIDDEN_ROWS = 2;
export const ROWS = VISIBLE_ROWS + HIDDEN_ROWS;
export const NEXT_COUNT = 3;
export const MAX_LEVEL = 99;

const LINE_SCORES = [0, 100, 300, 500, 800];
const LOCK_DELAY_MS = 500;
const MAX_LOCK_RESETS = 15;
const SOFT_DROP_INTERVAL_MS = 35;

export type Cell = PieceType | null;
export type GameStatus = 'idle' | 'playing' | 'paused' | 'over';
export type GameEvent =
  | 'move'
  | 'rotate'
  | 'hold'
  | 'harddrop'
  | 'lock'
  | 'clear'
  | 'levelup'
  | 'gameover';

export interface GameEventDetail {
  lines?: number;
  level?: number;
}

export type GameListener = (event: GameEvent, detail: GameEventDetail) => void;

export interface ActivePiece {
  type: PieceType;
  matrix: Matrix;
  rotation: number;
  x: number;
  y: number;
}

export interface GameStats {
  score: number;
  level: number;
  lines: number;
  durationS: number;
}

/** 레벨별 한 칸 낙하 간격(ms) */
export function gravityIntervalMs(level: number): number {
  const seconds = Math.pow(0.8 - (level - 1) * 0.007, level - 1);
  return Math.max(16, seconds * 1000);
}

function emptyBoard(): Cell[][] {
  return Array.from({ length: ROWS }, () => Array<Cell>(COLS).fill(null));
}

export class Game {
  board: Cell[][] = emptyBoard();
  active: ActivePiece | null = null;
  hold: PieceType | null = null;
  holdUsed = false;
  queue: PieceType[] = [];
  score = 0;
  level = 1;
  lines = 0;
  elapsedMs = 0;
  status: GameStatus = 'idle';
  softDrop = false;

  private bag = new Bag();
  private gravityAcc = 0;
  private lockTimer = 0;
  private lockResets = 0;
  private lowestY = 0;
  private listeners: GameListener[] = [];

  on(listener: GameListener): void {
    this.listeners.push(listener);
  }

  private emit(event: GameEvent, detail: GameEventDetail = {}): void {
    for (const l of this.listeners) l(event, detail);
  }

  reset(): void {
    this.board = emptyBoard();
    this.active = null;
    this.hold = null;
    this.holdUsed = false;
    this.bag = new Bag();
    this.queue = [];
    this.score = 0;
    this.level = 1;
    this.lines = 0;
    this.elapsedMs = 0;
    this.softDrop = false;
    this.gravityAcc = 0;
    this.lockTimer = 0;
    this.lockResets = 0;
    this.status = 'idle';
  }

  start(): void {
    this.reset();
    this.fillQueue();
    this.status = 'playing';
    this.spawn();
  }

  pause(): void {
    if (this.status !== 'playing') return;
    this.status = 'paused';
    this.softDrop = false;
  }

  resume(): void {
    if (this.status === 'paused') this.status = 'playing';
  }

  getStats(): GameStats {
    return {
      score: this.score,
      level: this.level,
      lines: this.lines,
      durationS: Math.floor(this.elapsedMs / 1000),
    };
  }

  // ───────────── 조작 ─────────────

  move(dx: -1 | 1): boolean {
    const a = this.active;
    if (!a || this.status !== 'playing') return false;
    if (this.collides(a.matrix, a.x + dx, a.y)) return false;
    a.x += dx;
    this.onManipulated();
    this.emit('move');
    return true;
  }

  rotate(dir: 1 | -1): boolean {
    const a = this.active;
    if (!a || this.status !== 'playing') return false;
    if (a.type === 'O') return false;
    const to = (a.rotation + dir + 4) % 4;
    const matrix = rotateMatrix(a.matrix, dir);
    for (const [kx, ky] of getKicks(a.type, a.rotation, to)) {
      if (!this.collides(matrix, a.x + kx, a.y + ky)) {
        a.matrix = matrix;
        a.rotation = to;
        a.x += kx;
        a.y += ky;
        this.onManipulated();
        this.emit('rotate');
        return true;
      }
    }
    return false;
  }

  holdPiece(): boolean {
    const a = this.active;
    if (!a || this.status !== 'playing' || this.holdUsed) return false;
    const current = a.type;
    const held = this.hold;
    this.hold = current;
    if (held) this.spawn(held);
    else this.spawn();
    this.holdUsed = true;
    this.emit('hold');
    return true;
  }

  hardDrop(): void {
    const a = this.active;
    if (!a || this.status !== 'playing') return;
    let dist = 0;
    while (!this.collides(a.matrix, a.x, a.y + 1)) {
      a.y++;
      dist++;
    }
    this.score += dist * 2;
    this.emit('harddrop');
    this.lockPiece(true);
  }

  // ───────────── 진행 ─────────────

  update(dtMs: number): void {
    const a = this.active;
    if (this.status !== 'playing' || !a) return;
    this.elapsedMs += dtMs;

    const normal = gravityIntervalMs(this.level);
    const interval = this.softDrop ? Math.min(SOFT_DROP_INTERVAL_MS, normal) : normal;

    if (!this.collides(a.matrix, a.x, a.y + 1)) {
      this.gravityAcc += dtMs;
      while (this.gravityAcc >= interval) {
        this.gravityAcc -= interval;
        if (this.collides(a.matrix, a.x, a.y + 1)) {
          this.gravityAcc = 0;
          break;
        }
        a.y++;
        if (this.softDrop) this.score += 1;
        this.lockTimer = 0;
        if (a.y > this.lowestY) {
          this.lowestY = a.y;
          this.lockResets = 0;
        }
      }
    } else {
      this.gravityAcc = 0;
      this.lockTimer += dtMs;
      if (this.lockTimer >= LOCK_DELAY_MS) this.lockPiece(false);
    }
  }

  // ───────────── 내부 ─────────────

  private fillQueue(): void {
    while (this.queue.length < NEXT_COUNT) this.queue.push(this.bag.next());
  }

  private takeNext(): PieceType {
    this.fillQueue();
    const t = this.queue.shift() as PieceType;
    this.fillQueue();
    return t;
  }

  private spawn(type?: PieceType): void {
    const t = type ?? this.takeNext();
    const matrix = SHAPES[t].map((r) => r.slice());
    const x = Math.floor((COLS - matrix[0].length) / 2);
    const y = HIDDEN_ROWS - 1;
    this.active = { type: t, matrix, rotation: 0, x, y };
    this.gravityAcc = 0;
    this.lockTimer = 0;
    this.lockResets = 0;
    this.lowestY = y;
    if (this.collides(matrix, x, y)) this.gameOver();
  }

  private onManipulated(): void {
    const a = this.active;
    if (!a) return;
    if (this.collides(a.matrix, a.x, a.y + 1) && this.lockResets < MAX_LOCK_RESETS) {
      this.lockTimer = 0;
      this.lockResets++;
    }
  }

  collides(matrix: Matrix, x: number, y: number): boolean {
    for (let r = 0; r < matrix.length; r++) {
      for (let c = 0; c < matrix[r].length; c++) {
        if (!matrix[r][c]) continue;
        const bx = x + c;
        const by = y + r;
        if (bx < 0 || bx >= COLS || by >= ROWS) return true;
        if (by >= 0 && this.board[by][bx]) return true;
      }
    }
    return false;
  }

  private lockPiece(fromHardDrop: boolean): void {
    const a = this.active;
    if (!a) return;
    let allHidden = true;
    for (let r = 0; r < a.matrix.length; r++) {
      for (let c = 0; c < a.matrix[r].length; c++) {
        if (!a.matrix[r][c]) continue;
        const by = a.y + r;
        const bx = a.x + c;
        if (by >= 0) this.board[by][bx] = a.type;
        if (by >= HIDDEN_ROWS) allHidden = false;
      }
    }
    this.active = null;
    if (!fromHardDrop) this.emit('lock');

    // 블록이 전부 보이지 않는 영역에 고정되면 게임 오버
    if (allHidden) {
      this.gameOver();
      return;
    }

    const cleared = this.clearLines();
    if (cleared > 0) {
      this.score += LINE_SCORES[cleared] * this.level;
      this.lines += cleared;
      this.emit('clear', { lines: cleared });
      const newLevel = Math.min(MAX_LEVEL, Math.floor(this.lines / 10) + 1);
      if (newLevel > this.level) {
        this.level = newLevel;
        this.emit('levelup', { level: newLevel });
      }
    }

    this.holdUsed = false;
    this.spawn();
  }

  private clearLines(): number {
    const remaining = this.board.filter((row) => row.some((cell) => cell === null));
    const cleared = ROWS - remaining.length;
    for (let i = 0; i < cleared; i++) remaining.unshift(Array<Cell>(COLS).fill(null));
    this.board = remaining;
    return cleared;
  }

  private gameOver(): void {
    this.status = 'over';
    this.softDrop = false;
    this.active = null;
    this.emit('gameover');
  }
}
