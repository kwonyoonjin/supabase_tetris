import { KEYS, getJSON, setJSON } from '../util/storage';

/**
 * 모든 소리는 Web Audio API로 코드에서 직접 합성한다. (외부 음원 파일 없음)
 * 배경음 멜로디도 이 프로젝트를 위해 새로 작곡한 것이다.
 */

export type SfxName = 'move' | 'rotate' | 'hold' | 'lock' | 'harddrop' | 'clear' | 'levelup' | 'gameover';

export interface SoundSettings {
  bgmOn: boolean;
  sfxOn: boolean;
  bgmVolume: number; // 0~1
  sfxVolume: number; // 0~1
}

const DEFAULTS: SoundSettings = { bgmOn: true, sfxOn: true, bgmVolume: 0.5, sfxVolume: 0.7 };

const BASE_TEMPO = 124;
const MAX_TEMPO = 176;
const STEPS_PER_BAR = 8; // 8분음표
const LOOKAHEAD_S = 0.12;
const SCHEDULER_MS = 25;

// 8마디 멜로디 (MIDI 번호, 0 = 쉼표). 코드 진행: Am – F – C – G (×2)
const MELODY: number[][] = [
  [69, 0, 72, 71, 69, 67, 69, 0],
  [65, 0, 69, 67, 65, 64, 65, 0],
  [64, 67, 72, 0, 71, 72, 74, 0],
  [71, 0, 67, 0, 69, 71, 67, 0],
  [76, 0, 74, 72, 71, 72, 74, 0],
  [72, 0, 69, 72, 77, 76, 74, 0],
  [72, 71, 72, 74, 76, 0, 72, 0],
  [74, 0, 71, 67, 69, 71, 69, 0],
];
const BASS_ROOTS = [45, 41, 48, 43]; // A2, F2, C3, G2
const TOTAL_STEPS = MELODY.length * STEPS_PER_BAR;

const midiToFreq = (m: number): number => 440 * Math.pow(2, (m - 69) / 12);
const clamp01 = (v: number): number => Math.min(1, Math.max(0, Number.isFinite(v) ? v : 0));

function loadSettings(): SoundSettings {
  const s = getJSON<SoundSettings>(KEYS.sound, DEFAULTS);
  return {
    bgmOn: Boolean(s.bgmOn),
    sfxOn: Boolean(s.sfxOn),
    bgmVolume: clamp01(Number(s.bgmVolume)),
    sfxVolume: clamp01(Number(s.sfxVolume)),
  };
}

export class AudioManager {
  settings: SoundSettings = loadSettings();

  private ctx: AudioContext | null = null;
  private bgmBus: GainNode | null = null;
  private sfxBus: GainNode | null = null;
  private noiseBuffer: AudioBuffer | null = null;

  private bgmTimer: number | null = null;
  private nextTime = 0;
  private step = 0;
  private tempo = BASE_TEMPO;
  private listeners: Array<(s: SoundSettings) => void> = [];

  onChange(fn: (s: SoundSettings) => void): void {
    this.listeners.push(fn);
  }

  /** 브라우저 자동재생 정책 때문에 사용자 입력(클릭 등) 안에서 호출해야 한다. */
  unlock(): void {
    if (!this.ctx) {
      const w = window as unknown as { webkitAudioContext?: typeof AudioContext };
      const Ctor = window.AudioContext ?? w.webkitAudioContext;
      if (!Ctor) return;
      const ctx = new Ctor();
      this.ctx = ctx;
      this.bgmBus = ctx.createGain();
      this.sfxBus = ctx.createGain();
      this.bgmBus.connect(ctx.destination);
      this.sfxBus.connect(ctx.destination);
      this.noiseBuffer = this.createNoise(ctx);
      this.applyVolumes(true);
    }
    if (this.ctx.state === 'suspended') void this.ctx.resume();
  }

  setSettings(patch: Partial<SoundSettings>): void {
    this.settings = { ...this.settings, ...patch };
    this.settings.bgmVolume = clamp01(this.settings.bgmVolume);
    this.settings.sfxVolume = clamp01(this.settings.sfxVolume);
    setJSON(KEYS.sound, this.settings);
    this.applyVolumes(false);
    for (const l of this.listeners) l(this.settings);
  }

  get muted(): boolean {
    return !this.settings.bgmOn && !this.settings.sfxOn;
  }

  toggleMute(): void {
    const on = this.muted;
    this.setSettings({ bgmOn: on, sfxOn: on });
  }

  private applyVolumes(immediate: boolean): void {
    if (!this.ctx || !this.bgmBus || !this.sfxBus) return;
    const bgm = this.settings.bgmOn ? this.settings.bgmVolume * 0.45 : 0;
    const sfx = this.settings.sfxOn ? this.settings.sfxVolume * 0.8 : 0;
    const t = this.ctx.currentTime;
    if (immediate) {
      this.bgmBus.gain.setValueAtTime(bgm, t);
      this.sfxBus.gain.setValueAtTime(sfx, t);
    } else {
      this.bgmBus.gain.setTargetAtTime(bgm, t, 0.03);
      this.sfxBus.gain.setTargetAtTime(sfx, t, 0.03);
    }
  }

  // ───────────── 배경음 ─────────────

  setLevel(level: number): void {
    this.tempo = Math.min(MAX_TEMPO, BASE_TEMPO + (level - 1) * 4);
  }

  startBgm(): void {
    this.step = 0;
    this.resumeBgm();
  }

  resumeBgm(): void {
    if (!this.ctx || this.bgmTimer !== null) return;
    this.nextTime = this.ctx.currentTime + 0.06;
    this.bgmTimer = window.setInterval(() => this.schedule(), SCHEDULER_MS);
    this.schedule();
  }

  pauseBgm(): void {
    if (this.bgmTimer !== null) {
      window.clearInterval(this.bgmTimer);
      this.bgmTimer = null;
    }
  }

  stopBgm(): void {
    this.pauseBgm();
    this.step = 0;
  }

  private schedule(): void {
    const ctx = this.ctx;
    if (!ctx) return;
    // 탭이 오래 멈췄다 돌아오면 밀린 음을 한꺼번에 재생하지 않도록 시간을 맞춘다
    if (this.nextTime < ctx.currentTime - 0.2) this.nextTime = ctx.currentTime + 0.02;
    const stepDur = 60 / this.tempo / 2;
    while (this.nextTime < ctx.currentTime + LOOKAHEAD_S) {
      this.playStep(this.step, this.nextTime, stepDur);
      this.nextTime += stepDur;
      this.step = (this.step + 1) % TOTAL_STEPS;
    }
  }

  private playStep(step: number, t: number, stepDur: number): void {
    const bus = this.bgmBus;
    if (!bus) return;
    const bar = Math.floor(step / STEPS_PER_BAR);
    const i = step % STEPS_PER_BAR;

    const note = MELODY[bar][i];
    if (note) this.tone(midiToFreq(note), t, stepDur * 0.85, 'square', 0.1, bus);

    const root = BASS_ROOTS[bar % BASS_ROOTS.length];
    this.tone(midiToFreq(i % 2 === 0 ? root : root + 12), t, stepDur * 0.9, 'triangle', 0.32, bus);

    if (i % 4 === 0) this.tone(110, t, 0.12, 'sine', 0.35, bus, 40);
    if (i % 2 === 1) this.noise(t, 0.03, 0.05, bus, 7000, 'highpass');
  }

  // ───────────── 효과음 ─────────────

  sfx(name: SfxName, lines = 1): void {
    const ctx = this.ctx;
    const bus = this.sfxBus;
    if (!ctx || !bus || !this.settings.sfxOn) return;
    const t = ctx.currentTime + 0.005;

    switch (name) {
      case 'move':
        this.tone(240, t, 0.035, 'square', 0.12, bus);
        break;
      case 'rotate':
        this.tone(520, t, 0.06, 'square', 0.12, bus, 820);
        break;
      case 'hold':
        this.tone(440, t, 0.09, 'triangle', 0.3, bus, 260);
        break;
      case 'lock':
        this.tone(150, t, 0.08, 'sine', 0.45, bus, 70);
        break;
      case 'harddrop':
        this.tone(200, t, 0.14, 'sine', 0.6, bus, 45);
        this.noise(t, 0.09, 0.25, bus, 900, 'lowpass');
        break;
      case 'clear': {
        if (lines >= 4) {
          [72, 76, 79, 84, 88].forEach((n, k) =>
            this.tone(midiToFreq(n), t + k * 0.05, 0.16, 'square', 0.16, bus),
          );
          this.noise(t, 0.3, 0.12, bus, 3000, 'highpass');
        } else {
          [72, 76, 79].slice(0, Math.max(1, lines)).forEach((n, k) =>
            this.tone(midiToFreq(n), t + k * 0.06, 0.12, 'triangle', 0.4, bus),
          );
        }
        break;
      }
      case 'levelup':
        [67, 72, 76, 79].forEach((n, k) =>
          this.tone(midiToFreq(n), t + k * 0.08, 0.14, 'square', 0.14, bus),
        );
        break;
      case 'gameover':
        [67, 63, 60, 55].forEach((n, k) =>
          this.tone(midiToFreq(n), t + k * 0.2, 0.28, 'triangle', 0.45, bus),
        );
        break;
    }
  }

  // ───────────── 합성 도구 ─────────────

  private tone(
    freq: number,
    start: number,
    dur: number,
    type: OscillatorType,
    vol: number,
    dest: AudioNode,
    freqEnd?: number,
  ): void {
    const ctx = this.ctx;
    if (!ctx) return;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, start);
    if (freqEnd) osc.frequency.exponentialRampToValueAtTime(freqEnd, start + dur);
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.linearRampToValueAtTime(vol, start + 0.005);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + dur);
    osc.connect(gain).connect(dest);
    osc.start(start);
    osc.stop(start + dur + 0.02);
  }

  private noise(
    start: number,
    dur: number,
    vol: number,
    dest: AudioNode,
    filterFreq: number,
    filterType: BiquadFilterType,
  ): void {
    const ctx = this.ctx;
    if (!ctx || !this.noiseBuffer) return;
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    const filter = ctx.createBiquadFilter();
    filter.type = filterType;
    filter.frequency.value = filterFreq;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(vol, start);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + dur);
    src.connect(filter).connect(gain).connect(dest);
    src.start(start);
    src.stop(start + dur + 0.02);
  }

  private createNoise(ctx: AudioContext): AudioBuffer {
    const len = Math.floor(ctx.sampleRate * 0.5);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    return buf;
  }
}
