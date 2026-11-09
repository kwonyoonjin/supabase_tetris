/** 공통 대화상자 동작: 닫기 버튼, 바깥(배경) 클릭으로 닫기 */
export function initDialogs(): void {
  document.querySelectorAll<HTMLDialogElement>('dialog').forEach((dlg) => {
    dlg.addEventListener('click', (e) => {
      if (e.target === dlg) dlg.close();
    });
    dlg.querySelectorAll<HTMLElement>('[data-close]').forEach((btn) =>
      btn.addEventListener('click', () => dlg.close()),
    );
  });
}

export function openDialog(dlg: HTMLDialogElement): void {
  if (!dlg.open) dlg.showModal();
}
