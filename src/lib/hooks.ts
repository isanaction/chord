'use client';

import { type RefObject, useEffect, useRef } from 'react';

/** 画面を開いている間、スリープさせない（F-PLAY-05）。対応していないブラウザでは何もしない。 */
export function useWakeLock(enabled: boolean) {
  useEffect(() => {
    if (!enabled || !('wakeLock' in navigator)) return;
    let sentinel: WakeLockSentinel | null = null;
    let cancelled = false;
    const request = async () => {
      try {
        const s = await navigator.wakeLock.request('screen');
        if (cancelled) await s.release();
        else sentinel = s;
      } catch {
        // 省電力モードなどで拒否されることがある。演奏の妨げにはならないので無視する
      }
    };
    const onVisible = () => {
      if (document.visibilityState === 'visible') void request();
    };
    void request();
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      cancelled = true;
      document.removeEventListener('visibilitychange', onVisible);
      void sentinel?.release();
    };
  }, [enabled]);
}

/**
 * 要素を一定の速さでスクロールし続ける（F-PLAY-01）。
 * 末尾に着いたら onEnd を呼ぶ。
 */
export function useAutoScroll(ref: RefObject<HTMLElement | null>, playing: boolean, pxPerSecond: number, onEnd: () => void) {
  const speedRef = useRef(pxPerSecond);
  const onEndRef = useRef(onEnd);
  useEffect(() => {
    speedRef.current = pxPerSecond;
    onEndRef.current = onEnd;
  });

  useEffect(() => {
    const el = ref.current;
    if (!playing || !el) return;
    let frame = 0;
    let last = performance.now();
    // scrollTop は整数に丸められるので、端数をためておく
    let carry = 0;
    const tick = (now: number) => {
      const dt = Math.min(now - last, 100) / 1000;
      last = now;
      carry += speedRef.current * dt;
      const step = Math.floor(carry);
      if (step > 0) {
        el.scrollTop += step;
        carry -= step;
      }
      if (el.scrollTop + el.clientHeight >= el.scrollHeight - 1) {
        onEndRef.current();
        return;
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [ref, playing]);
}
