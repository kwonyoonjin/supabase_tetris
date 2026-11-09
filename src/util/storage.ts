/** localStorage 래퍼. 사생활 보호 모드 등에서 실패해도 앱이 멈추지 않도록 한다. */
export function getItem(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

export function setItem(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* 무시 */
  }
}

export function getJSON<T extends object>(key: string, fallback: T): T {
  const raw = getItem(key);
  if (!raw) return { ...fallback };
  try {
    const parsed: unknown = JSON.parse(raw);
    if (parsed && typeof parsed === 'object') return { ...fallback, ...(parsed as Partial<T>) };
  } catch {
    /* 무시 */
  }
  return { ...fallback };
}

export function setJSON(key: string, value: unknown): void {
  setItem(key, JSON.stringify(value));
}

export const KEYS = {
  nickname: 'blockdrop.nickname',
  sound: 'blockdrop.sound',
  feedbackAt: 'blockdrop.feedbackAt',
} as const;
