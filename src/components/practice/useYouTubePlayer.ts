'use client';

import { type RefObject, useCallback, useEffect, useRef, useState } from 'react';

/**
 * YouTube IFrame Player API（公式の埋め込みプレーヤー。要求定義 2.2）を使う。
 * 必要な部分だけ型を書く。
 */
type YTPlayer = {
  playVideo(): void;
  pauseVideo(): void;
  seekTo(seconds: number, allowSeekAhead: boolean): void;
  getCurrentTime(): number;
  getDuration(): number;
  getPlayerState(): number;
  setPlaybackRate(rate: number): void;
  getAvailablePlaybackRates(): number[];
  destroy(): void;
};

type YTNamespace = {
  Player: new (
    el: HTMLElement,
    opts: {
      videoId: string;
      width?: string;
      height?: string;
      playerVars?: Record<string, number | string>;
      events?: {
        onReady?: () => void;
        onStateChange?: (e: { data: number }) => void;
        onError?: (e: { data: number }) => void;
      };
    },
  ) => YTPlayer;
};

declare global {
  interface Window {
    YT?: YTNamespace;
    onYouTubeIframeAPIReady?: () => void;
  }
}

const PLAYING = 1;
const BUFFERING = 3;
const FALLBACK_RATES = [0.5, 0.75, 1];

let apiPromise: Promise<YTNamespace> | null = null;

function loadApi(): Promise<YTNamespace> {
  if (window.YT?.Player) return Promise.resolve(window.YT);
  apiPromise ??= new Promise<YTNamespace>((resolve, reject) => {
    const prev = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      prev?.();
      if (window.YT) resolve(window.YT);
    };
    const script = document.createElement('script');
    script.src = 'https://www.youtube.com/iframe_api';
    script.async = true;
    script.onerror = () => {
      apiPromise = null;
      reject(new Error('YouTube のプレーヤーを読み込めませんでした'));
    };
    document.head.appendChild(script);
  });
  return apiPromise;
}

const ERRORS: Record<number, string> = {
  2: '動画の指定が正しくありません',
  5: 'この動画はブラウザで再生できません',
  100: '動画が見つかりません（削除・非公開の可能性）',
  101: 'この動画は埋め込みでの再生が許可されていません',
  150: 'この動画は埋め込みでの再生が許可されていません',
};

export type PlayerControl = {
  ready: boolean;
  playing: boolean;
  error: string | null;
  rates: number[];
  /** 実際に使っている再生速度。保存した速度にこの動画が対応していなければ、近い速度になる */
  rate: number;
  /** 動画の長さ（ミリ秒）。分からなければ null */
  durationMs: number | null;
  /** 今の再生位置（ミリ秒）。間はこちらの時計で補う（設計書 7.1） */
  currentMs(): number;
  seek(ms: number): void;
  play(): void;
  pause(): void;
  setRate(rate: number): void;
};

/** 対応している速度のうち、指定に最も近いもの */
export function nearestRate(available: number[], rate: number): number {
  if (available.length === 0) return rate;
  return available.reduce((best, r) => (Math.abs(r - rate) < Math.abs(best - rate) ? r : best), available[0]);
}

/**
 * container の中に YouTube プレーヤーを作る。videoId が変わると作り直す。
 * startSeconds は参考動画の URL に書かれた開始位置（t= / start=）
 */
export function useYouTubePlayer(
  container: RefObject<HTMLDivElement | null>,
  videoId: string | null,
  rate: number,
  startSeconds: number | null = null,
): PlayerControl {
  const player = useRef<YTPlayer | null>(null);
  const [ready, setReady] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rates, setRates] = useState<number[]>(FALLBACK_RATES);
  const [durationMs, setDurationMs] = useState<number | null>(null);
  const [appliedRate, setAppliedRate] = useState(rate);
  // getCurrentTime は細かく更新されないことがあるので、最後に読んだ値と時刻から補う
  const clock = useRef({ reported: 0, at: 0, rate: 1, playing: false });
  const rateRef = useRef(rate);
  const startRef = useRef(startSeconds);
  useEffect(() => {
    rateRef.current = rate;
    startRef.current = startSeconds;
  });

  useEffect(() => {
    const el = container.current;
    if (!el || !videoId) return;
    let cancelled = false;
    const mount = document.createElement('div');
    el.appendChild(mount);
    loadApi()
      .then((YT) => {
        if (cancelled) return;
        player.current = new YT.Player(mount, {
          videoId,
          width: '100%',
          height: '100%',
          playerVars: { playsinline: 1, rel: 0, modestbranding: 1, ...(startRef.current ? { start: startRef.current } : {}) },
          events: {
            onReady: () => {
              if (cancelled) return;
              const p = player.current!;
              const available = p.getAvailablePlaybackRates();
              const list = available.length > 0 ? available : FALLBACK_RATES;
              setRates(list);
              // 対応していない速度を指定しても YouTube は無視するので、対応している速度に合わせる
              const r = nearestRate(list, rateRef.current);
              p.setPlaybackRate(r);
              clock.current.rate = r;
              setAppliedRate(r);
              const d = p.getDuration();
              setDurationMs(d > 0 ? d * 1000 : null);
              setReady(true);
            },
            onStateChange: (e) => {
              const p = player.current;
              if (!p) return;
              const isPlaying = e.data === PLAYING;
              clock.current = { ...clock.current, reported: p.getCurrentTime() * 1000, at: performance.now(), playing: isPlaying };
              setPlaying(isPlaying || e.data === BUFFERING);
              const d = p.getDuration();
              if (d > 0) setDurationMs(d * 1000);
            },
            onError: (e) => setError(ERRORS[e.data] ?? '動画を再生できませんでした'),
          },
        });
      })
      .catch((e: Error) => !cancelled && setError(e.message));
    return () => {
      cancelled = true;
      player.current?.destroy();
      player.current = null;
      el.replaceChildren();
      setReady(false);
      setPlaying(false);
      setError(null);
    };
  }, [container, videoId]);

  const currentMs = useCallback(() => {
    const p = player.current;
    if (!p) return 0;
    const now = performance.now();
    const reported = p.getCurrentTime() * 1000;
    const c = clock.current;
    if (reported !== c.reported) {
      clock.current = { ...c, reported, at: now };
      return reported;
    }
    return c.playing ? reported + (now - c.at) * c.rate : reported;
  }, []);

  const seek = useCallback((ms: number) => {
    const p = player.current;
    if (!p) return;
    p.seekTo(Math.max(0, ms) / 1000, true);
    clock.current = { ...clock.current, reported: Math.max(0, ms), at: performance.now() };
  }, []);

  const play = useCallback(() => player.current?.playVideo(), []);
  const pause = useCallback(() => player.current?.pauseVideo(), []);
  const setRate = useCallback((r: number) => {
    player.current?.setPlaybackRate(r);
    clock.current = { ...clock.current, rate: r };
    setAppliedRate(r);
  }, []);

  return { ready, playing, error, rates, rate: appliedRate, durationMs, currentMs, seek, play, pause, setRate };
}
