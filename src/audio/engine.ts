'use client';

import { midiToHz } from '@/domain/chord/voicing';
import { type BeatClock, takeBeats } from '@/domain/sync/meter';

/**
 * 音の再生（設計書 7.4）。Web Audio API で合成する。
 * iOS は利用者が画面を触るまで音が出ないので、最初の操作の中で audio() を呼んで有効にする。
 */
let ctx: AudioContext | null = null;

export function audio(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (!ctx) {
    const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return null;
    ctx = new Ctor();
  }
  if (ctx.state === 'suspended') void ctx.resume();
  return ctx;
}

type Timbre = 'guitar' | 'piano';

/** コードを鳴らす（F-PRAC-05）。ギターは低い弦から少しずつずらして弾く */
export function playChord(midi: number[], timbre: Timbre) {
  const c = audio();
  if (!c || midi.length === 0) return;
  const now = c.currentTime + 0.01;
  const bus = c.createGain();
  bus.gain.value = 0.5 / Math.sqrt(midi.length);
  bus.connect(c.destination);
  midi.forEach((note, i) => tone(c, bus, midiToHz(note), timbre === 'guitar' ? now + i * 0.028 : now, timbre));
}

function tone(c: AudioContext, dest: AudioNode, hz: number, at: number, timbre: Timbre) {
  const length = timbre === 'guitar' ? 1.8 : 2.4;
  const env = c.createGain();
  env.gain.setValueAtTime(0.0001, at);
  env.gain.exponentialRampToValueAtTime(1, at + 0.006);
  env.gain.exponentialRampToValueAtTime(0.0001, at + length);
  const filter = c.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.setValueAtTime(timbre === 'guitar' ? 3200 : 2400, at);
  filter.frequency.exponentialRampToValueAtTime(timbre === 'guitar' ? 700 : 900, at + length);
  env.connect(filter).connect(dest);
  // 基音と倍音を少し混ぜて、弦・鍵盤らしい響きにする
  const partials: [number, OscillatorType, number][] =
    timbre === 'guitar'
      ? [
          [1, 'triangle', 0.8],
          [2, 'sine', 0.25],
          [3, 'sine', 0.08],
        ]
      : [
          [1, 'sine', 0.8],
          [2, 'sine', 0.3],
          [4, 'triangle', 0.05],
        ];
  for (const [ratio, type, level] of partials) {
    const osc = c.createOscillator();
    osc.type = type;
    osc.frequency.value = hz * ratio;
    const g = c.createGain();
    g.gain.value = level;
    osc.connect(g).connect(env);
    osc.start(at);
    osc.stop(at + length + 0.05);
  }
}

function click(c: AudioContext, at: number, accent: boolean) {
  const osc = c.createOscillator();
  osc.type = 'square';
  osc.frequency.value = accent ? 1760 : 1175;
  const g = c.createGain();
  g.gain.setValueAtTime(0.0001, at);
  g.gain.exponentialRampToValueAtTime(accent ? 0.35 : 0.22, at + 0.002);
  g.gain.exponentialRampToValueAtTime(0.0001, at + 0.05);
  osc.connect(g).connect(c.destination);
  osc.start(at);
  osc.stop(at + 0.06);
}

const LOOKAHEAD_S = 0.15;
/** これより近い時刻には予約しない（予約が音の処理に届くまでの余裕） */
const MARGIN_S = 0.05;
const TICK_MS = 25;

/**
 * メトロノーム（F-PRAC-06）。画面の処理が重くてもリズムが崩れないよう、
 * 少し先までの拍を AudioContext の時計で予約する。
 */
export class Metronome {
  private timer: ReturnType<typeof setInterval> | null = null;
  private clock: BeatClock = { last: null, index: 0 };
  private bpm = 120;
  private perBar = 4;

  constructor(private onBeat?: (index: number, accent: boolean) => void) {}

  get running() {
    return this.timer !== null;
  }

  play(bpm: number, perBar: number) {
    const c = audio();
    if (!c) return;
    this.stop();
    this.bpm = bpm;
    this.perBar = perBar;
    this.clock = { last: null, index: 0 };
    this.tick(c);
    this.timer = setInterval(() => this.tick(c), TICK_MS);
  }

  /**
   * 鳴らしている途中のテンポ・拍子の変更。まだ予約していない次の拍から反映する。
   * 鳴らし直さないので、余分なクリックが入ったり小節の頭に戻ったりしない
   */
  update(bpm: number, perBar: number) {
    this.bpm = bpm;
    this.perBar = perBar;
  }

  stop() {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  private tick(c: AudioContext) {
    const { beats, next } = takeBeats(this.clock, this.bpm, this.perBar, c.currentTime + MARGIN_S, c.currentTime + LOOKAHEAD_S);
    this.clock = next;
    for (const beat of beats) {
      click(c, beat.time, beat.accent);
      if (this.onBeat) {
        const delay = Math.max(0, (beat.time - c.currentTime) * 1000);
        setTimeout(() => this.onBeat?.(beat.index, beat.accent), delay);
      }
    }
  }
}
