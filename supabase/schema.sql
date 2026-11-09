-- Block Drop — Supabase 스키마
-- Supabase 대시보드 → SQL Editor 에 붙여넣고 실행하세요.

-- ───────────── 점수 ─────────────
create table if not exists public.scores (
  id          bigint generated always as identity primary key,
  nickname    text not null check (char_length(nickname) between 2 and 12),
  score       integer not null check (score >= 0 and score <= 10000000),
  level       integer not null check (level between 1 and 99),
  lines       integer not null check (lines >= 0 and lines <= 100000),
  duration_s  integer not null check (duration_s >= 0),
  created_at  timestamptz not null default now()
);

create index if not exists scores_rank_idx on public.scores (score desc, created_at asc);
create index if not exists scores_created_idx on public.scores (created_at);

-- ───────────── 피드백 ─────────────
create table if not exists public.feedback (
  id          bigint generated always as identity primary key,
  nickname    text check (nickname is null or char_length(nickname) <= 12),
  rating      smallint check (rating is null or rating between 1 and 5),
  message     text not null check (char_length(message) between 5 and 1000),
  user_agent  text check (user_agent is null or char_length(user_agent) <= 300),
  created_at  timestamptz not null default now()
);

-- ───────────── RLS ─────────────
alter table public.scores   enable row level security;
alter table public.feedback enable row level security;

-- scores: 누구나 조회·추가 가능, 수정·삭제는 정책이 없으므로 거부됨
drop policy if exists "scores_select" on public.scores;
create policy "scores_select" on public.scores
  for select to anon, authenticated using (true);

drop policy if exists "scores_insert" on public.scores;
create policy "scores_insert" on public.scores
  for insert to anon, authenticated with check (true);

-- feedback: 추가만 가능, 조회 불가 (운영자는 대시보드 Table Editor에서 확인)
drop policy if exists "feedback_insert" on public.feedback;
create policy "feedback_insert" on public.feedback
  for insert to anon, authenticated with check (true);

-- 권한 (최소 권한만 부여)
revoke all on public.scores   from anon, authenticated;
revoke all on public.feedback from anon, authenticated;
grant select, insert on public.scores   to anon, authenticated;
grant insert         on public.feedback to anon, authenticated;
