import { isSupabaseConfigured, submitFeedback } from '../api/supabase';
import { byId, charLength, setStatus } from '../util/dom';
import { KEYS, getItem, setItem } from '../util/storage';
import { openDialog } from './dialogs';

const COOLDOWN_MS = 30_000;
const MIN_LEN = 5;
const MAX_LEN = 1000;

let cooldownTimer: number | null = null;

function cooldownLeftMs(): number {
  const last = Number(getItem(KEYS.feedbackAt) ?? 0);
  return Math.max(0, last + COOLDOWN_MS - Date.now());
}

export function initFeedback(): void {
  const form = byId<HTMLFormElement>('feedback-form');
  const message = byId<HTMLTextAreaElement>('fb-message');
  const nickname = byId<HTMLInputElement>('fb-nickname');
  const counter = byId('fb-count');
  const status = byId('fb-status');
  const submit = byId<HTMLButtonElement>('fb-submit');
  const clearRating = byId<HTMLButtonElement>('fb-rating-clear');

  const updateCount = (): void => {
    counter.textContent = `${charLength(message.value)} / ${MAX_LEN}`;
  };
  message.addEventListener('input', updateCount);

  clearRating.addEventListener('click', () => {
    form.querySelectorAll<HTMLInputElement>('input[name="rating"]').forEach((r) => (r.checked = false));
  });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!isSupabaseConfigured) {
      setStatus(status, '온라인 기능이 설정되지 않아 피드백을 보낼 수 없습니다.', 'error');
      return;
    }
    const text = message.value.trim();
    const len = charLength(text);
    if (len < MIN_LEN || len > MAX_LEN) {
      setStatus(status, `내용을 ${MIN_LEN}~${MAX_LEN}자로 입력해 주세요.`, 'error');
      message.focus();
      return;
    }
    const nick = nickname.value.trim();
    if (charLength(nick) > 12) {
      setStatus(status, '닉네임은 12자 이하로 입력해 주세요.', 'error');
      return;
    }
    const left = cooldownLeftMs();
    if (left > 0) {
      setStatus(status, `잠시 후 다시 보내 주세요. (${Math.ceil(left / 1000)}초)`, 'error');
      return;
    }
    const checked = form.querySelector<HTMLInputElement>('input[name="rating"]:checked');

    submit.disabled = true;
    setStatus(status, '보내는 중…');
    try {
      await submitFeedback({
        nickname: nick || null,
        rating: checked ? Number(checked.value) : null,
        message: text,
        user_agent: navigator.userAgent.slice(0, 300),
      });
      setItem(KEYS.feedbackAt, String(Date.now()));
      if (nick) setItem(KEYS.nickname, nick);
      form.reset();
      nickname.value = nick;
      updateCount();
      setStatus(status, '소중한 의견 감사합니다!', 'ok');
      startCooldown(submit);
    } catch (err) {
      setStatus(status, err instanceof Error ? err.message : '피드백을 보내지 못했습니다.', 'error');
      submit.disabled = false;
    }
  });

  updateCount();
}

function startCooldown(btn: HTMLButtonElement): void {
  if (cooldownTimer !== null) window.clearInterval(cooldownTimer);
  const tick = (): void => {
    const left = cooldownLeftMs();
    if (left <= 0) {
      btn.disabled = false;
      btn.textContent = '보내기';
      if (cooldownTimer !== null) window.clearInterval(cooldownTimer);
      cooldownTimer = null;
      return;
    }
    btn.disabled = true;
    btn.textContent = `보내기 (${Math.ceil(left / 1000)})`;
  };
  tick();
  cooldownTimer = window.setInterval(tick, 500);
}

export function openFeedback(): void {
  const nickname = byId<HTMLInputElement>('fb-nickname');
  if (!nickname.value) nickname.value = getItem(KEYS.nickname) ?? '';
  setStatus(byId('fb-status'), '');
  if (cooldownLeftMs() > 0) startCooldown(byId<HTMLButtonElement>('fb-submit'));
  openDialog(byId<HTMLDialogElement>('feedback-dialog'));
  byId<HTMLTextAreaElement>('fb-message').focus();
}
