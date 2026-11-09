export interface InputActions {
  isPlaying(): boolean;
  move(dx: -1 | 1): boolean;
  rotate(dir: -1 | 1): void;
  hardDrop(): void;
  hold(): void;
  setSoftDrop(on: boolean): void;
  togglePause(): void;
  toggleMute(): void;
}

/** 누르고 있을 때 반복 이동이 시작되기까지의 지연 */
const DAS_MS = 160;
/** 반복 이동 간격 */
const ARR_MS = 45;

const GAME_KEYS = new Set([
  'ArrowLeft',
  'ArrowRight',
  'ArrowDown',
  'ArrowUp',
  'Space',
  'KeyX',
  'KeyZ',
  'KeyC',
  'ControlLeft',
  'ControlRight',
  'ShiftLeft',
  'ShiftRight',
]);

export class KeyboardInput {
  private held = new Set<string>();
  private dir: -1 | 0 | 1 = 0;
  private das = 0;
  private arr = 0;

  constructor(private actions: InputActions) {
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
    window.addEventListener('blur', this.releaseAll);
  }

  releaseAll = (): void => {
    this.held.clear();
    this.dir = 0;
    this.actions.setSoftDrop(false);
  };

  update(dtMs: number): void {
    if (this.dir === 0 || !this.actions.isPlaying()) return;
    this.das += dtMs;
    if (this.das < DAS_MS) return;
    this.arr += dtMs;
    while (this.arr >= ARR_MS) {
      this.arr -= ARR_MS;
      if (!this.actions.move(this.dir)) {
        this.arr = 0;
        break;
      }
    }
  }

  private shouldIgnore(e: KeyboardEvent): boolean {
    const t = e.target;
    if (
      t instanceof HTMLElement &&
      (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable)
    ) {
      return true;
    }
    return document.querySelector('dialog[open]') !== null;
  }

  private onKeyDown = (e: KeyboardEvent): void => {
    if (this.shouldIgnore(e)) return;
    const a = this.actions;
    const { code } = e;

    if (code === 'KeyM') {
      if (!e.repeat) a.toggleMute();
      return;
    }
    if (code === 'KeyP' || code === 'Escape') {
      e.preventDefault();
      if (!e.repeat) a.togglePause();
      return;
    }
    if (!a.isPlaying() || !GAME_KEYS.has(code)) return;

    e.preventDefault();
    if (e.repeat) return;
    this.held.add(code);

    switch (code) {
      case 'ArrowLeft':
        this.startShift(-1);
        break;
      case 'ArrowRight':
        this.startShift(1);
        break;
      case 'ArrowDown':
        a.setSoftDrop(true);
        break;
      case 'Space':
        a.hardDrop();
        break;
      case 'ArrowUp':
      case 'KeyX':
        a.rotate(1);
        break;
      case 'KeyZ':
      case 'ControlLeft':
      case 'ControlRight':
        a.rotate(-1);
        break;
      case 'KeyC':
      case 'ShiftLeft':
      case 'ShiftRight':
        a.hold();
        break;
    }
  };

  private onKeyUp = (e: KeyboardEvent): void => {
    const { code } = e;
    this.held.delete(code);
    if (code === 'Space' && this.actions.isPlaying()) e.preventDefault();
    if (code === 'ArrowDown') this.actions.setSoftDrop(false);
    if (code === 'ArrowLeft' || code === 'ArrowRight') {
      const released: -1 | 1 = code === 'ArrowLeft' ? -1 : 1;
      if (this.dir !== released) return;
      const other = released === -1 ? 'ArrowRight' : 'ArrowLeft';
      if (this.held.has(other)) {
        this.dir = released === -1 ? 1 : -1;
        this.das = 0;
        this.arr = 0;
      } else {
        this.dir = 0;
      }
    }
  };

  private startShift(d: -1 | 1): void {
    this.dir = d;
    this.das = 0;
    this.arr = 0;
    this.actions.move(d);
  }
}
