import './style.css';
import { isSupabaseConfigured } from './api/supabase';
import { AudioManager } from './audio/audio';
import { COLS, Game, NEXT_COUNT, VISIBLE_ROWS } from './game/game';
import { KeyboardInput } from './input/keyboard';
import { BoardRenderer, PreviewRenderer } from './render/renderer';
import { initDialogs, openDialog } from './ui/dialogs';
import { initFeedback, openFeedback } from './ui/feedback';
import { initGameOver, showGameOver } from './ui/gameover';
import { initLeaderboard, openLeaderboard } from './ui/leaderboard';
import { initSettings, openSettings } from './ui/settings';
import { byId, formatNumber, formatTime } from './util/dom';

const game = new Game();
const audio = new AudioManager();

const boardRenderer = new BoardRenderer(byId<HTMLCanvasElement>('board-canvas'));
const holdRenderer = new PreviewRenderer(byId<HTMLCanvasElement>('hold-canvas'), 1);
const nextRenderer = new PreviewRenderer(byId<HTMLCanvasElement>('next-canvas'), NEXT_COUNT);

// ───────────── 화면 전환 ─────────────

const overlays = {
  menu: byId('overlay-menu'),
  pause: byId('overlay-pause'),
  over: byId('overlay-over'),
};
type OverlayName = keyof typeof overlays;

function showOverlay(name: OverlayName | null): void {
  (Object.keys(overlays) as OverlayName[]).forEach((k) => {
    overlays[k].hidden = k !== name;
  });
  if (name) overlays[name].querySelector<HTMLElement>('[data-autofocus]')?.focus();
}

function blurActive(): void {
  const el = document.activeElement;
  if (el instanceof HTMLElement) el.blur();
}

function startGame(): void {
  audio.unlock();
  blurActive();
  input.releaseAll();
  game.start();
  audio.setLevel(1);
  audio.stopBgm();
  audio.startBgm();
  showOverlay(null);
}

function pauseGame(): void {
  if (game.status !== 'playing') return;
  game.pause();
  input.releaseAll();
  audio.pauseBgm();
  showOverlay('pause');
}

function resumeGame(): void {
  if (game.status !== 'paused') return;
  audio.unlock();
  blurActive();
  game.resume();
  audio.resumeBgm();
  showOverlay(null);
}

function togglePause(): void {
  if (game.status === 'playing') pauseGame();
  else if (game.status === 'paused') resumeGame();
}

function goToMenu(): void {
  game.reset();
  audio.stopBgm();
  showOverlay('menu');
}

/** 게임 중에 대화상자를 열면 먼저 일시정지한다 */
function withPause(open: () => void): () => void {
  return () => {
    pauseGame();
    open();
  };
}

// ───────────── 입력 ─────────────

const input = new KeyboardInput({
  isPlaying: () => game.status === 'playing',
  move: (dx) => game.move(dx),
  rotate: (dir) => {
    game.rotate(dir);
  },
  hardDrop: () => game.hardDrop(),
  hold: () => {
    game.holdPiece();
  },
  setSoftDrop: (on) => {
    game.softDrop = on && game.status === 'playing';
  },
  togglePause,
  toggleMute: () => {
    audio.unlock();
    audio.toggleMute();
  },
});

// ───────────── 게임 이벤트 → 소리/화면 ─────────────

game.on((event, detail) => {
  switch (event) {
    case 'move':
    case 'rotate':
    case 'hold':
    case 'lock':
    case 'harddrop':
      audio.sfx(event);
      break;
    case 'clear':
      audio.sfx('clear', detail.lines ?? 1);
      break;
    case 'levelup':
      audio.sfx('levelup');
      audio.setLevel(detail.level ?? game.level);
      break;
    case 'gameover':
      audio.stopBgm();
      audio.sfx('gameover');
      input.releaseAll();
      showGameOver(game.getStats());
      showOverlay('over');
      break;
  }
});

// ───────────── 버튼 연결 ─────────────

byId('menu-start').addEventListener('click', startGame);
byId('menu-leaderboard').addEventListener('click', openLeaderboard);
byId('menu-feedback').addEventListener('click', openFeedback);
byId('menu-help').addEventListener('click', () => openDialog(byId<HTMLDialogElement>('help-dialog')));

byId('pause-resume').addEventListener('click', resumeGame);
byId('pause-restart').addEventListener('click', startGame);
byId('pause-menu').addEventListener('click', goToMenu);

byId('over-again').addEventListener('click', startGame);
byId('over-leaderboard').addEventListener('click', openLeaderboard);
byId('over-feedback').addEventListener('click', openFeedback);
byId('over-menu').addEventListener('click', goToMenu);

byId('pause-btn').addEventListener('click', () => {
  togglePause();
  if (game.status === 'playing') blurActive();
});
byId('settings-btn').addEventListener('click', withPause(() => openSettings(audio)));

const muteBtn = byId<HTMLButtonElement>('mute-btn');
muteBtn.addEventListener('click', () => {
  audio.unlock();
  audio.toggleMute();
  blurActive();
});
function syncMuteButton(): void {
  const muted = audio.muted;
  muteBtn.textContent = muted ? '🔇' : '🔊';
  muteBtn.setAttribute('aria-label', muted ? '소리 켜기' : '소리 끄기');
}
audio.onChange(syncMuteButton);
syncMuteButton();

// 탭을 떠나거나 창 포커스를 잃으면 자동 일시정지
document.addEventListener('visibilitychange', () => {
  if (document.hidden) pauseGame();
});
window.addEventListener('blur', pauseGame);

initDialogs();
initLeaderboard();
initFeedback();
initSettings(audio);
initGameOver();

byId('online-notice').hidden = isSupabaseConfigured;

// ───────────── 레이아웃 ─────────────

function layout(): void {
  const narrow = window.innerWidth < 720;
  const panelW = narrow ? 84 : 150;
  const gap = narrow ? 8 : 20;
  const header = narrow ? 48 : 56;
  const availH = window.innerHeight - header - (narrow ? 16 : 28);
  const availW = window.innerWidth - (narrow ? 16 : 32) - 2 * (panelW + gap);
  const cell = Math.max(12, Math.min(34, Math.floor(Math.min(availH / VISIBLE_ROWS, availW / COLS))));
  const root = document.documentElement;
  root.style.setProperty('--panel-w', `${panelW}px`);
  root.style.setProperty('--gap', `${gap}px`);
  boardRenderer.resize(cell);
  const boxInner = panelW - (narrow ? 14 : 22);
  const mini = Math.max(8, Math.min(22, Math.floor(boxInner / 5)));
  holdRenderer.resize(mini);
  nextRenderer.resize(mini);
}

let resizeRaf = 0;
window.addEventListener('resize', () => {
  cancelAnimationFrame(resizeRaf);
  resizeRaf = requestAnimationFrame(layout);
});
layout();

// ───────────── HUD ─────────────

const hud = {
  score: byId('stat-score'),
  level: byId('stat-level'),
  lines: byId('stat-lines'),
  time: byId('stat-time'),
};
const lastHud = { score: -1, level: -1, lines: -1, time: -1 };

function updateHud(): void {
  const t = Math.floor(game.elapsedMs / 1000);
  if (game.score !== lastHud.score) hud.score.textContent = formatNumber((lastHud.score = game.score));
  if (game.level !== lastHud.level) hud.level.textContent = String((lastHud.level = game.level));
  if (game.lines !== lastHud.lines) hud.lines.textContent = String((lastHud.lines = game.lines));
  if (t !== lastHud.time) hud.time.textContent = formatTime((lastHud.time = t));
}

// ───────────── 메인 루프 ─────────────

let last = performance.now();
function frame(now: number): void {
  const dt = Math.min(100, now - last);
  last = now;
  input.update(dt);
  game.update(dt);

  const paused = game.status === 'paused';
  boardRenderer.draw(game, paused);
  holdRenderer.draw(paused ? [] : [game.hold], game.holdUsed);
  nextRenderer.draw(paused ? [] : game.queue);
  updateHud();

  requestAnimationFrame(frame);
}

showOverlay('menu');
requestAnimationFrame(frame);
