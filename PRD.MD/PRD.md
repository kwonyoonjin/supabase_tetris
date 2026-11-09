# PRD — 웹 블록 낙하 퍼즐 게임 (가칭: Block Drop)

| 항목 | 내용 |
|---|---|
| 문서 버전 | v1.0 |
| 작성일 | 2026-11-09 |
| 저장소 | https://github.com/kwonyoonjin/supabase_tetris.git |
| 배포 | Vercel |
| 백엔드 | Supabase (PostgreSQL + REST/JS SDK) |

> 이름 관련: "Tetris"는 등록 상표이므로 서비스명·화면 표기·메타 태그에는 쓰지 않고 가칭 **Block Drop**을 사용한다. 저장소 이름은 그대로 둬도 된다. 게임 방식(4칸 블록 낙하, 줄 지우기)은 장르 공통 규칙이라 사용해도 되지만, 색상·UI·음악은 직접 만든다.

---

## 1. 개요

브라우저에서 바로 즐길 수 있는 블록 낙하 퍼즐 게임. 게임이 끝나면 점수가 Supabase에 저장되고 리더보드로 다른 사용자와 비교할 수 있다. 사용자는 게임에 대한 피드백도 남길 수 있다. 배경음과 효과음이 있고, 고스트 피스(착지 위치 미리보기, "그림자")는 넣지 않는다.

## 2. 목표 / 비목표

### 목표
- G1. 설치 없이 데스크톱 브라우저에서 바로 플레이할 수 있다.
- G2. 게임 종료 시 닉네임과 점수를 Supabase에 저장하고, 상위 점수를 리더보드로 보여준다.
- G3. 사용자가 피드백(내용, 선택 평점)을 작성·제출할 수 있다.
- G4. 배경음(BGM)과 효과음(SFX)을 제공하고, 사용자가 켜고 끌 수 있다.
- G5. GitHub에 push하면 Vercel에 자동 배포된다.

### 비목표 (이번 버전 제외)
- 고스트 피스 / 착지 그림자 표시 — **요구사항에 따라 제외**
- 회원가입·로그인(OAuth 등) — 닉네임만 입력
- 실시간 멀티플레이 대전
- 네이티브 모바일 앱
- 관리자 대시보드 (피드백 확인은 Supabase 콘솔에서)

## 3. 대상 사용자
- 가볍게 퍼즐 게임을 즐기려는 일반 사용자
- 점수 경쟁을 즐기는 사용자 (리더보드)
- 개발자/운영자 (피드백 수집 → 개선)

## 4. 기능 요구사항

### 4.1 게임 플레이 (FR-G)

| ID | 요구사항 | 우선순위 |
|---|---|---|
| FR-G1 | 10열 × 20행 보드 (위쪽 2행은 보이지 않는 생성 영역) | 필수 |
| FR-G2 | 4칸짜리 블록 7종 (I, O, T, S, Z, J, L 모양), 종류마다 다른 색 (직접 정한 팔레트) | 필수 |
| FR-G3 | 7-bag 무작위 생성 (7종을 한 묶음으로 섞어 차례로 내보냄) | 필수 |
| FR-G4 | 좌우 이동, 소프트 드롭(빠르게 내리기), 하드 드롭(즉시 떨어뜨리기) | 필수 |
| FR-G5 | 시계/반시계 회전, 벽·바닥에 막히면 옆으로 밀어서 회전 시도(wall kick) | 필수 |
| FR-G6 | 홀드(블록 1개 보관, 블록당 1번) | 권장 |
| FR-G7 | 다음 블록 미리보기 (최소 1개, 권장 3개) | 필수 |
| FR-G8 | 바닥에 닿은 뒤 고정까지 짧은 유예 시간 (약 0.5초) | 권장 |
| FR-G9 | 가득 찬 줄 삭제, 동시 1~4줄 삭제 지원 | 필수 |
| FR-G10 | 레벨: 10줄마다 1 레벨 상승, 레벨이 오를수록 낙하 속도 증가 | 필수 |
| FR-G11 | 일시정지 / 재개 (P 또는 Esc), 탭 전환 시 자동 일시정지 | 필수 |
| FR-G12 | 새 블록이 생성 위치에 놓일 수 없으면 게임 오버 | 필수 |
| FR-G13 | **고스트 피스 미표시** | 필수(제외 확인) |

**점수 규칙**

| 동작 | 점수 |
|---|---|
| 1줄 삭제 | 100 × 레벨 |
| 2줄 삭제 | 300 × 레벨 |
| 3줄 삭제 | 500 × 레벨 |
| 4줄 삭제 | 800 × 레벨 |
| 소프트 드롭 | 1칸당 1점 |
| 하드 드롭 | 1칸당 2점 |

**기본 조작키**

| 키 | 동작 |
|---|---|
| ← / → | 좌우 이동 (누르고 있으면 반복) |
| ↓ | 소프트 드롭 |
| Space | 하드 드롭 |
| ↑ / X | 시계 방향 회전 |
| Z / Ctrl | 반시계 방향 회전 |
| C / Shift | 홀드 |
| P / Esc | 일시정지 |
| M | 소리 켜기/끄기 |

### 4.2 점수 저장 & 리더보드 (FR-S)

| ID | 요구사항 | 우선순위 |
|---|---|---|
| FR-S1 | 게임 오버 화면에서 닉네임(2~12자) 입력 후 점수 저장 | 필수 |
| FR-S2 | 저장 항목: 닉네임, 점수, 레벨, 삭제한 줄 수, 플레이 시간, 생성 시각 | 필수 |
| FR-S3 | 마지막으로 쓴 닉네임은 브라우저(localStorage)에 기억해 다음에 자동 입력 | 권장 |
| FR-S4 | 리더보드: 상위 10개 (점수 내림차순, 같으면 먼저 기록한 순) | 필수 |
| FR-S5 | 저장 직후 내 순위 표시 | 권장 |
| FR-S6 | 네트워크 오류 시 오류 메시지 + "다시 시도" 버튼, 게임 결과는 유지 | 필수 |
| FR-S7 | 리더보드 기간 필터 (전체 / 이번 주) | 선택 |

### 4.3 피드백 (FR-F)

| ID | 요구사항 | 우선순위 |
|---|---|---|
| FR-F1 | 메인 화면/게임 오버 화면에서 피드백 창 열기 | 필수 |
| FR-F2 | 입력 항목: 닉네임(선택), 평점 1~5(선택), 내용(필수, 5~1000자) | 필수 |
| FR-F3 | 제출 성공/실패 안내 메시지 | 필수 |
| FR-F4 | 연속 제출 방지: 제출 후 30초 동안 버튼 비활성화 (클라이언트) | 권장 |
| FR-F5 | 다른 사용자의 피드백은 **공개하지 않음** (운영자만 Supabase에서 확인) | 필수 (미해결 질문 Q2 참조) |

### 4.4 사운드 (FR-A)

| ID | 요구사항 | 우선순위 |
|---|---|---|
| FR-A1 | 배경음: 게임 중 반복 재생, 일시정지 시 멈춤, 게임 오버 시 정지 | 필수 |
| FR-A2 | 효과음: 이동, 회전, 하드 드롭/고정, 줄 삭제(1~3줄), 4줄 삭제, 레벨 업, 게임 오버 | 필수 |
| FR-A3 | BGM / 효과음 각각 켜기/끄기 + 볼륨 조절, 설정은 localStorage에 저장 | 필수 |
| FR-A4 | 브라우저 자동재생 정책에 맞춰 첫 사용자 입력(시작 버튼 클릭) 이후에 오디오 시작 | 필수 |
| FR-A5 | 음원은 직접 제작하거나 CC0 등 상업적 사용 가능한 라이선스만 사용, 출처를 `CREDITS.md`에 기록 | 필수 |

- 구현: Web Audio API. 효과음은 짧은 파일(.ogg/.mp3)을 미리 불러두거나 오실레이터로 합성(파일 0개 가능).
- 기존 게임의 유명 테마곡이나 그 편곡은 사용하지 않는다. BGM은 직접 만든 곡 또는 CC0 곡을 쓴다.

### 4.5 화면 구성 (UI)

1. **메인 화면**: 시작, 리더보드, 피드백, 소리 설정, 조작법 안내
2. **게임 화면**: 보드(가운데), 홀드(왼쪽), 다음 블록(오른쪽), 점수/레벨/줄 수, 일시정지 버튼
3. **일시정지 화면**: 계속하기, 다시 시작, 메인으로
4. **게임 오버 화면**: 최종 점수, 닉네임 입력 → 저장, 다시 하기, 리더보드 보기, 피드백 남기기
5. **리더보드 창**, **피드백 창** (모달)

## 5. 비기능 요구사항

| 구분 | 요구사항 |
|---|---|
| 성능 | 60fps 목표, `requestAnimationFrame` 기반, 첫 화면 로딩 2초 이내 (일반 광대역 기준) |
| 호환성 | 최신 Chrome, Edge, Firefox, Safari (데스크톱) |
| 반응형 | 화면 크기에 맞춰 보드 크기 조절. 모바일 터치 조작은 선택 사항(P2) |
| 접근성 | 키보드만으로 모든 메뉴 조작 가능, 블록 색 대비 확보 |
| 보안 | Supabase **anon key만** 프론트엔드에 사용, service_role 키는 절대 포함 금지. 모든 테이블에 RLS 적용 |
| 입력 검증 | 닉네임·피드백 길이를 클라이언트와 DB 제약조건 양쪽에서 검사. 화면에 출력할 때는 텍스트로만 렌더링(HTML 삽입 금지) |
| 오류 처리 | Supabase 연결이 안 돼도 게임 자체는 플레이 가능 |

## 6. 기술 스택

| 영역 | 선택 | 이유 |
|---|---|---|
| 빌드 도구 | Vite + TypeScript | 빠른 개발, Vercel 기본 지원 |
| 렌더링 | HTML5 Canvas 2D | 게임 보드 그리기에 충분하고 가벼움 |
| UI | 순수 HTML/CSS (프레임워크 없음) | 화면 수가 적어 프레임워크 불필요 |
| 백엔드 | Supabase (`@supabase/supabase-js`) | DB + REST API + RLS |
| 오디오 | Web Audio API | 지연 적고 볼륨 제어 쉬움 |
| 배포 | Vercel (GitHub 연동) | push 시 자동 배포, PR마다 미리보기 URL |

### 프로젝트 구조 (예정)
```
supabase_tetris/
├─ index.html
├─ src/
│  ├─ main.ts            # 진입점, 화면 전환
│  ├─ game/              # 보드, 블록, 회전, 점수, 게임 루프
│  ├─ render/            # Canvas 그리기
│  ├─ input/             # 키보드 입력
│  ├─ audio/             # BGM/효과음 관리
│  ├─ api/supabase.ts    # 클라이언트 생성, 점수·피드백 API
│  └─ ui/                # 메뉴, 모달, 리더보드
├─ public/sounds/
├─ supabase/schema.sql   # 테이블 + RLS 정책
├─ .env.example
└─ CREDITS.md
```

## 7. 데이터 모델 (Supabase)

```sql
-- 점수
create table public.scores (
  id          bigint generated always as identity primary key,
  nickname    text not null check (char_length(nickname) between 2 and 12),
  score       integer not null check (score >= 0 and score <= 10000000),
  level       integer not null check (level between 1 and 99),
  lines       integer not null check (lines >= 0),
  duration_s  integer not null check (duration_s >= 0),
  created_at  timestamptz not null default now()
);
create index scores_rank_idx on public.scores (score desc, created_at asc);

-- 피드백
create table public.feedback (
  id          bigint generated always as identity primary key,
  nickname    text check (nickname is null or char_length(nickname) <= 12),
  rating      smallint check (rating is null or rating between 1 and 5),
  message     text not null check (char_length(message) between 5 and 1000),
  user_agent  text,
  created_at  timestamptz not null default now()
);

-- RLS
alter table public.scores   enable row level security;
alter table public.feedback enable row level security;

-- scores: 누구나 조회·추가 가능, 수정·삭제 불가
create policy "scores_select" on public.scores   for select to anon using (true);
create policy "scores_insert" on public.scores   for insert to anon with check (true);

-- feedback: 추가만 가능, 조회 불가 (운영자는 대시보드에서 확인)
create policy "feedback_insert" on public.feedback for insert to anon with check (true);
```

**알려진 한계 — 점수 조작**: 점수를 브라우저에서 바로 보내므로 개발자 도구로 가짜 점수를 넣을 수 있다. v1에서는 DB 제약조건(범위 검사)으로만 막고, 필요해지면 v2에서 Supabase Edge Function을 통한 검증(점수와 줄 수·플레이 시간의 정합성 확인, 요청 횟수 제한)을 추가한다.

## 8. 환경 변수 & 배포

| 변수 | 설명 | 설정 위치 |
|---|---|---|
| `VITE_SUPABASE_URL` | Supabase 프로젝트 URL | `.env.local`, Vercel 환경 변수 |
| `VITE_SUPABASE_ANON_KEY` | Supabase anon(공개) 키 | `.env.local`, Vercel 환경 변수 |

**배포 절차**
1. Supabase 프로젝트 생성 → SQL Editor에서 `supabase/schema.sql` 실행
2. 코드를 GitHub `kwonyoonjin/supabase_tetris`에 push (`.env.local`은 `.gitignore`에 포함)
3. Vercel에서 저장소 Import → Framework: **Vite**, Build: `npm run build`, Output: `dist`
4. Vercel 프로젝트 설정에 위 환경 변수 2개 등록 → 배포
5. `main` 브랜치 push → 운영 배포, 다른 브랜치/PR → 미리보기 배포

## 9. 마일스톤

| 단계 | 내용 | 완료 기준 |
|---|---|---|
| M1 | 프로젝트 세팅 (Vite+TS), GitHub 연결, Vercel 첫 배포 | 빈 페이지가 Vercel URL에서 열림 |
| M2 | 게임 핵심 로직 (보드, 블록, 이동/회전, 줄 삭제, 점수, 레벨) | 혼자서 끝까지 플레이 가능 |
| M3 | UI 화면 (메인, 일시정지, 게임 오버, 홀드/다음 블록) | 모든 화면 전환 동작 |
| M4 | Supabase 연동 (점수 저장, 리더보드, 피드백) | 저장·조회가 실제 DB에 반영 |
| M5 | 사운드 (BGM, 효과음, 설정) | 모든 효과음 재생, 설정 유지 |
| M6 | 마무리 (오류 처리, 반응형, 테스트, 문서) | 아래 수용 기준 전부 통과 |

## 10. 수용 기준

- [ ] Vercel URL에서 게임을 시작해 게임 오버까지 오류 없이 플레이된다.
- [ ] 줄을 지우면 점수 규칙대로 점수가 오르고, 10줄마다 레벨과 속도가 오른다.
- [ ] 착지 위치 미리보기(고스트 피스)가 화면에 나타나지 않는다.
- [ ] 게임 오버 후 닉네임을 입력해 저장하면 Supabase `scores` 테이블에 행이 생기고 리더보드에 반영된다.
- [ ] 피드백을 제출하면 `feedback` 테이블에 행이 생기고, anon 키로는 피드백을 조회할 수 없다.
- [ ] anon 키로 `scores` 행을 수정·삭제하려 하면 거부된다.
- [ ] 게임 시작 후 BGM이 나오고, 각 동작에 효과음이 나며, 켜기/끄기·볼륨 설정이 새로고침 후에도 유지된다.
- [ ] 네트워크를 끊어도 게임은 계속되고, 저장 실패 시 다시 시도할 수 있다.
- [ ] 저장소와 빌드 결과물에 service_role 키가 없다.

## 11. 미해결 질문

| # | 질문 | 기본 가정 |
|---|---|---|
| Q1 | 같은 닉네임이 여러 번 기록돼도 되나, 닉네임당 최고 점수만 보여줄까? | 모든 기록 저장, 리더보드는 기록 단위로 표시 |
| Q2 | 피드백을 다른 사용자에게도 공개할까? | 비공개 (운영자만 확인) |
| Q3 | 모바일 터치 조작이 이번 버전에 필요한가? | 아니오 (P2) |
| Q4 | 최종 서비스명은? | 가칭 "Block Drop" |
