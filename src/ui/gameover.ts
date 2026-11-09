import { isSupabaseConfigured, submitScore } from '../api/supabase';
import type { GameStats } from '../game/game';
import { byId, formatNumber, formatTime, setStatus, validateNickname } from '../util/dom';
import { KEYS, getItem, setItem } from '../util/storage';

let currentStats: GameStats | null = null;
let saved = false;
let saving = false;

export function initGameOver(): void {
  const form = byId<HTMLFormElement>('score-form');
  const input = byId<HTMLInputElement>('nickname');
  const btn = byId<HTMLButtonElement>('save-btn');
  const status = byId('save-status');

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const stats = currentStats;
    if (!stats || saved || saving) return;

    if (!isSupabaseConfigured) {
      setStatus(status, '온라인 기능이 설정되지 않아 점수를 저장할 수 없습니다.', 'error');
      return;
    }
    const check = validateNickname(input.value);
    if (!check.ok) {
      setStatus(status, check.message, 'error');
      input.focus();
      return;
    }

    saving = true;
    btn.disabled = true;
    btn.textContent = '저장 중…';
    setStatus(status, '');
    try {
      const { rank } = await submitScore({
        nickname: check.value,
        score: stats.score,
        level: stats.level,
        lines: stats.lines,
        duration_s: stats.durationS,
      });
      saved = true;
      setItem(KEYS.nickname, check.value);
      input.disabled = true;
      btn.textContent = '저장됨';
      setStatus(status, rank ? `저장 완료! 현재 ${rank}위입니다.` : '저장 완료!', 'ok');
    } catch (err) {
      btn.disabled = false;
      btn.textContent = '다시 시도';
      setStatus(status, err instanceof Error ? err.message : '저장에 실패했습니다.', 'error');
    } finally {
      saving = false;
    }
  });
}

export function showGameOver(stats: GameStats): void {
  currentStats = stats;
  saved = false;
  saving = false;

  byId('over-score').textContent = formatNumber(stats.score);
  byId('over-level').textContent = String(stats.level);
  byId('over-lines').textContent = String(stats.lines);
  byId('over-time').textContent = formatTime(stats.durationS);

  const input = byId<HTMLInputElement>('nickname');
  const btn = byId<HTMLButtonElement>('save-btn');
  input.disabled = false;
  input.value = getItem(KEYS.nickname) ?? '';
  btn.disabled = false;
  btn.textContent = '점수 저장';
  setStatus(
    byId('save-status'),
    isSupabaseConfigured ? '' : '온라인 기능이 꺼져 있어 점수는 저장되지 않습니다.',
    isSupabaseConfigured ? 'info' : 'error',
  );
}
