import type { AudioManager } from '../audio/audio';
import { byId } from '../util/dom';
import { openDialog } from './dialogs';

export function initSettings(audio: AudioManager): void {
  const bgmOn = byId<HTMLInputElement>('set-bgm-on');
  const sfxOn = byId<HTMLInputElement>('set-sfx-on');
  const bgmVol = byId<HTMLInputElement>('set-bgm-vol');
  const sfxVol = byId<HTMLInputElement>('set-sfx-vol');
  const bgmOut = byId<HTMLOutputElement>('set-bgm-out');
  const sfxOut = byId<HTMLOutputElement>('set-sfx-out');

  const sync = (): void => {
    const s = audio.settings;
    bgmOn.checked = s.bgmOn;
    sfxOn.checked = s.sfxOn;
    bgmVol.value = String(Math.round(s.bgmVolume * 100));
    sfxVol.value = String(Math.round(s.sfxVolume * 100));
    bgmOut.textContent = bgmVol.value;
    sfxOut.textContent = sfxVol.value;
  };

  bgmOn.addEventListener('change', () => audio.setSettings({ bgmOn: bgmOn.checked }));
  sfxOn.addEventListener('change', () => audio.setSettings({ sfxOn: sfxOn.checked }));
  bgmVol.addEventListener('input', () => audio.setSettings({ bgmVolume: Number(bgmVol.value) / 100 }));
  sfxVol.addEventListener('input', () => audio.setSettings({ sfxVolume: Number(sfxVol.value) / 100 }));
  // 효과음 볼륨을 놓으면 미리 들려준다
  sfxVol.addEventListener('change', () => {
    audio.unlock();
    audio.sfx('rotate');
  });

  audio.onChange(sync);
  sync();
}

export function openSettings(audio: AudioManager): void {
  audio.unlock();
  openDialog(byId<HTMLDialogElement>('settings-dialog'));
}
