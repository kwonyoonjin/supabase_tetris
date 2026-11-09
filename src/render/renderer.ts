import { COLS, HIDDEN_ROWS, ROWS, VISIBLE_ROWS, type Game } from '../game/game';
import { COLORS, SHAPES, type PieceType } from '../game/pieces';

const BOARD_BG = '#14152b';
const GRID_COLOR = 'rgba(255, 255, 255, 0.06)';

function setupCanvas(canvas: HTMLCanvasElement, w: number, h: number): CanvasRenderingContext2D {
  const dpr = window.devicePixelRatio || 1;
  canvas.style.width = `${w}px`;
  canvas.style.height = `${h}px`;
  canvas.width = Math.round(w * dpr);
  canvas.height = Math.round(h * dpr);
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D를 사용할 수 없습니다.');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  return ctx;
}

/** 단색 블록 + 테두리 하이라이트(그림자/고스트 없음) */
function drawCell(ctx: CanvasRenderingContext2D, px: number, py: number, size: number, color: string): void {
  const inset = size >= 16 ? 1 : 0;
  const x = px + inset;
  const y = py + inset;
  const s = size - inset * 2;
  const b = Math.max(2, Math.round(s * 0.14));
  ctx.fillStyle = color;
  ctx.fillRect(x, y, s, s);
  ctx.fillStyle = 'rgba(255, 255, 255, 0.28)';
  ctx.fillRect(x, y, s, b);
  ctx.fillRect(x, y, b, s);
  ctx.fillStyle = 'rgba(0, 0, 0, 0.22)';
  ctx.fillRect(x, y + s - b, s, b);
  ctx.fillRect(x + s - b, y, b, s);
}

export class BoardRenderer {
  private ctx: CanvasRenderingContext2D;
  private cell = 30;

  constructor(private canvas: HTMLCanvasElement) {
    this.ctx = setupCanvas(canvas, this.cell * COLS, this.cell * VISIBLE_ROWS);
  }

  resize(cell: number): void {
    this.cell = cell;
    this.ctx = setupCanvas(this.canvas, cell * COLS, cell * VISIBLE_ROWS);
  }

  /** hideBlocks: 일시정지 중에는 블록을 가린다 */
  draw(game: Game, hideBlocks: boolean): void {
    const { ctx, cell } = this;
    const w = cell * COLS;
    const h = cell * VISIBLE_ROWS;

    ctx.fillStyle = BOARD_BG;
    ctx.fillRect(0, 0, w, h);

    ctx.strokeStyle = GRID_COLOR;
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let c = 1; c < COLS; c++) {
      ctx.moveTo(c * cell + 0.5, 0);
      ctx.lineTo(c * cell + 0.5, h);
    }
    for (let r = 1; r < VISIBLE_ROWS; r++) {
      ctx.moveTo(0, r * cell + 0.5);
      ctx.lineTo(w, r * cell + 0.5);
    }
    ctx.stroke();

    if (hideBlocks) return;

    for (let r = HIDDEN_ROWS; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const t = game.board[r][c];
        if (t) drawCell(ctx, c * cell, (r - HIDDEN_ROWS) * cell, cell, COLORS[t]);
      }
    }

    const a = game.active;
    if (a) {
      const color = COLORS[a.type];
      for (let r = 0; r < a.matrix.length; r++) {
        for (let c = 0; c < a.matrix[r].length; c++) {
          if (!a.matrix[r][c]) continue;
          const by = a.y + r;
          if (by < HIDDEN_ROWS) continue;
          drawCell(ctx, (a.x + c) * cell, (by - HIDDEN_ROWS) * cell, cell, color);
        }
      }
    }
  }
}

/** HOLD / NEXT 미리보기 */
export class PreviewRenderer {
  private ctx: CanvasRenderingContext2D;
  private cell = 20;

  constructor(private canvas: HTMLCanvasElement, private slots: number) {
    this.ctx = setupCanvas(canvas, this.width, this.height);
  }

  private get width(): number {
    return this.cell * 5;
  }

  private get slotHeight(): number {
    return this.cell * 3;
  }

  private get height(): number {
    return this.slotHeight * this.slots;
  }

  resize(cell: number): void {
    this.cell = cell;
    this.ctx = setupCanvas(this.canvas, this.width, this.height);
  }

  draw(types: ReadonlyArray<PieceType | null>, dim = false): void {
    const { ctx, cell } = this;
    ctx.globalAlpha = 1;
    ctx.fillStyle = BOARD_BG;
    ctx.fillRect(0, 0, this.width, this.height);
    ctx.globalAlpha = dim ? 0.35 : 1;

    types.slice(0, this.slots).forEach((t, i) => {
      if (!t) return;
      const color = COLORS[t];
      const m = SHAPES[t];
      let minR = Infinity, maxR = -1, minC = Infinity, maxC = -1;
      m.forEach((row, r) =>
        row.forEach((v, c) => {
          if (!v) return;
          minR = Math.min(minR, r);
          maxR = Math.max(maxR, r);
          minC = Math.min(minC, c);
          maxC = Math.max(maxC, c);
        }),
      );
      const pw = (maxC - minC + 1) * cell;
      const ph = (maxR - minR + 1) * cell;
      const ox = (this.width - pw) / 2;
      const oy = i * this.slotHeight + (this.slotHeight - ph) / 2;
      m.forEach((row, r) =>
        row.forEach((v, c) => {
          if (v) drawCell(ctx, ox + (c - minC) * cell, oy + (r - minR) * cell, cell, color);
        }),
      );
    });
    ctx.globalAlpha = 1;
  }
}
