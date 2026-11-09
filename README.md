# Block Drop

브라우저에서 바로 즐기는 블록 낙하 퍼즐 게임입니다. 점수는 Supabase에 저장되어 리더보드로 겨룰 수 있고, 사용자는 피드백을 남길 수 있습니다. 요구사항은 [PRD.MD/PRD.md](PRD.MD/PRD.md)를 참고하세요.

- Vite + TypeScript + Canvas 2D (프레임워크 없음)
- Supabase: `scores`(점수), `feedback`(피드백) 테이블 + RLS
- Web Audio API로 합성한 배경음 / 효과음 (외부 음원 없음)
- 고스트 피스(착지 그림자) 없음

## 1. Supabase 준비

1. [supabase.com](https://supabase.com)에서 새 프로젝트를 만듭니다.
2. 대시보드 → **SQL Editor** → [supabase/schema.sql](supabase/schema.sql) 내용을 붙여넣고 **Run**.
3. **Project Settings → API**에서 `Project URL`과 `anon public` 키를 복사합니다.
   - ⚠️ `service_role` 키는 절대 프론트엔드나 저장소에 넣지 마세요.

피드백은 보안상 익명 사용자가 조회할 수 없습니다. 대시보드 **Table Editor → feedback**에서 확인하세요.

## 2. 로컬 실행

[Node.js](https://nodejs.org) 18 이상이 필요합니다.

```bash
npm install
cp .env.example .env.local   # Windows PowerShell: Copy-Item .env.example .env.local
# .env.local 에 VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY 입력
npm run dev                  # http://localhost:5173
```

환경 변수가 없어도 게임은 실행되며, 점수 저장·리더보드·피드백만 비활성화됩니다.

| 명령 | 설명 |
|---|---|
| `npm run dev` | 개발 서버 |
| `npm run build` | 배포용 빌드 (`dist/`) |
| `npm run preview` | 빌드 결과 미리보기 |
| `npm run typecheck` | TypeScript 타입 검사 |

## 3. GitHub에 올리기

[Git](https://git-scm.com)이 필요합니다.

```bash
git init
git add .
git commit -m "Block Drop 초기 구현"
git branch -M main
git remote add origin https://github.com/kwonyoonjin/supabase_tetris.git
git push -u origin main
```

`.env.local`은 `.gitignore`에 포함되어 올라가지 않습니다.

## 4. Vercel 배포

1. [vercel.com](https://vercel.com) → **Add New → Project** → GitHub 저장소 `supabase_tetris` Import
2. Framework Preset: **Vite** (자동 감지) / Build Command: `npm run build` / Output: `dist`
3. **Environment Variables**에 아래 두 개 추가
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
4. **Deploy**. 이후 `main`에 push하면 자동 배포, 다른 브랜치/PR은 미리보기 배포됩니다.

> 환경 변수는 빌드 시점에 코드에 들어갑니다. 값을 바꾼 뒤에는 Vercel에서 **Redeploy** 해야 반영됩니다.

## 조작법

| 키 | 동작 |
|---|---|
| ← / → | 좌우 이동 (누르고 있으면 반복) |
| ↓ | 빠르게 내리기 (칸당 1점) |
| Space | 바로 떨어뜨리기 (칸당 2점) |
| ↑ / X | 시계 방향 회전 |
| Z / Ctrl | 반시계 방향 회전 |
| C / Shift | 홀드 |
| P / Esc | 일시정지 |
| M | 소리 켜기/끄기 |

## 점수

| 동시에 지운 줄 | 점수 |
|---|---|
| 1줄 | 100 × 레벨 |
| 2줄 | 300 × 레벨 |
| 3줄 | 500 × 레벨 |
| 4줄 | 800 × 레벨 |

10줄마다 레벨이 오르고 낙하 속도와 배경음 템포가 빨라집니다.

## 폴더 구조

```
src/
├─ main.ts            진입점: 화면 전환, 게임 루프, 이벤트 연결
├─ style.css
├─ game/              보드·블록·회전·점수 로직 (DOM 의존 없음)
├─ render/            Canvas 그리기
├─ input/             키보드 입력 (DAS/반복 이동)
├─ audio/             배경음·효과음 합성
├─ api/supabase.ts    점수·리더보드·피드백 API
├─ ui/                게임 오버, 리더보드, 피드백, 설정 대화상자
└─ util/              DOM / localStorage 도우미
supabase/schema.sql   테이블 + RLS 정책
```

## 알려진 한계

점수를 브라우저에서 바로 저장하므로 개발자 도구로 가짜 점수를 넣을 수 있습니다. 현재는 DB 제약조건(범위 검사)으로만 막고 있으며, 필요하면 Supabase Edge Function으로 서버 검증을 추가할 수 있습니다. (PRD 7장 참고)
