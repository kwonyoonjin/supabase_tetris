import { fetchLeaderboard, isSupabaseConfigured, type Period } from '../api/supabase';
import { byId, formatNumber, setStatus } from '../util/dom';
import { openDialog } from './dialogs';

let period: Period = 'all';
let requestId = 0;

const dateFmt = new Intl.DateTimeFormat('ko-KR', { month: 'numeric', day: 'numeric' });

export function initLeaderboard(): void {
  const tabs = document.querySelectorAll<HTMLButtonElement>('#leaderboard-dialog [data-period]');
  tabs.forEach((tab) =>
    tab.addEventListener('click', () => {
      period = tab.dataset.period === 'week' ? 'week' : 'all';
      tabs.forEach((t) => t.setAttribute('aria-selected', String(t === tab)));
      void load();
    }),
  );
}

export function openLeaderboard(): void {
  openDialog(byId<HTMLDialogElement>('leaderboard-dialog'));
  void load();
}

async function load(): Promise<void> {
  const body = byId<HTMLTableSectionElement>('lb-body');
  const status = byId('lb-status');
  body.replaceChildren();

  if (!isSupabaseConfigured) {
    setStatus(status, '온라인 기능이 설정되지 않아 리더보드를 볼 수 없습니다.', 'error');
    return;
  }

  const id = ++requestId;
  setStatus(status, '불러오는 중…');
  try {
    const rows = await fetchLeaderboard(period);
    if (id !== requestId) return;
    if (rows.length === 0) {
      setStatus(status, '아직 기록이 없습니다. 첫 기록의 주인공이 되어 보세요!');
      return;
    }
    setStatus(status, '');
    let prevScore: number | null = null;
    let rank = 0;
    rows.forEach((row, i) => {
      if (row.score !== prevScore) rank = i + 1;
      prevScore = row.score;
      const tr = document.createElement('tr');
      const cells = [
        String(rank),
        row.nickname,
        formatNumber(row.score),
        String(row.level),
        String(row.lines),
        dateFmt.format(new Date(row.created_at)),
      ];
      cells.forEach((text, k) => {
        const td = document.createElement('td');
        td.textContent = text; // 사용자 입력은 항상 텍스트로만 출력
        if (k === 1) td.className = 'nick';
        if (k === 2) td.className = 'num';
        tr.appendChild(td);
      });
      if (rank <= 3) tr.dataset.top = String(rank);
      body.appendChild(tr);
    });
  } catch (err) {
    if (id !== requestId) return;
    setStatus(status, err instanceof Error ? err.message : '리더보드를 불러오지 못했습니다.', 'error');
  }
}
