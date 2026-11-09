export function byId<T extends HTMLElement = HTMLElement>(id: string): T {
  const el = document.getElementById(id);
  if (!el) throw new Error(`#${id} 요소를 찾을 수 없습니다.`);
  return el as T;
}

export function formatTime(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

export function formatNumber(n: number): string {
  return n.toLocaleString('ko-KR');
}

/** 코드 포인트 기준 글자 수 (DB의 char_length와 동일) */
export function charLength(s: string): number {
  return Array.from(s).length;
}

// eslint-disable-next-line no-control-regex
const CONTROL_CHARS = /[\u0000-\u001F\u007F]/;

export function validateNickname(raw: string): { ok: true; value: string } | { ok: false; message: string } {
  const value = raw.trim();
  const len = charLength(value);
  if (len < 2 || len > 12) return { ok: false, message: '닉네임은 2~12자로 입력해 주세요.' };
  if (CONTROL_CHARS.test(value)) return { ok: false, message: '닉네임에 사용할 수 없는 문자가 있습니다.' };
  return { ok: true, value };
}

export function setStatus(el: HTMLElement, text: string, kind: 'info' | 'ok' | 'error' = 'info'): void {
  el.textContent = text;
  el.dataset.kind = kind;
}
