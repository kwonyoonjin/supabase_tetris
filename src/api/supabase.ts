import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase: SupabaseClient | null =
  url && anonKey
    ? createClient(url, anonKey, { auth: { persistSession: false, autoRefreshToken: false } })
    : null;

export const isSupabaseConfigured = supabase !== null;

export interface NewScore {
  nickname: string;
  score: number;
  level: number;
  lines: number;
  duration_s: number;
}

export interface ScoreRow extends NewScore {
  id: number;
  created_at: string;
}

export type Period = 'all' | 'week';

export interface NewFeedback {
  nickname: string | null;
  rating: number | null;
  message: string;
  user_agent: string | null;
}

function requireClient(): SupabaseClient {
  if (!supabase) {
    throw new Error('온라인 기능이 설정되지 않았습니다. (Supabase 환경 변수 없음)');
  }
  return supabase;
}

function toError(err: { message: string }): Error {
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    return new Error('인터넷 연결을 확인해 주세요.');
  }
  return new Error(`서버 오류가 발생했습니다. (${err.message})`);
}

/** 이번 주 월요일 00:00 (사용자 로컬 시간) */
function startOfWeek(): Date {
  const d = new Date();
  const day = (d.getDay() + 6) % 7;
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - day);
  return d;
}

/** 점수 저장 후 순위(동점은 같은 순위)를 돌려준다. 순위 조회에 실패하면 rank = null */
export async function submitScore(entry: NewScore): Promise<{ rank: number | null }> {
  const db = requireClient();
  const { error } = await db.from('scores').insert(entry);
  if (error) throw toError(error);

  const { count, error: rankError } = await db
    .from('scores')
    .select('id', { count: 'exact', head: true })
    .gt('score', entry.score);
  if (rankError || count === null) return { rank: null };
  return { rank: count + 1 };
}

export async function fetchLeaderboard(period: Period, limit = 10): Promise<ScoreRow[]> {
  const db = requireClient();
  let query = db.from('scores').select('id, nickname, score, level, lines, duration_s, created_at');
  if (period === 'week') query = query.gte('created_at', startOfWeek().toISOString());
  const { data, error } = await query
    .order('score', { ascending: false })
    .order('created_at', { ascending: true })
    .limit(limit);
  if (error) throw toError(error);
  return (data ?? []) as ScoreRow[];
}

export async function submitFeedback(entry: NewFeedback): Promise<void> {
  const db = requireClient();
  const { error } = await db.from('feedback').insert(entry);
  if (error) throw toError(error);
}
