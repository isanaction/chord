'use client';

import { useEffect } from 'react';
import { startSync } from '@/data/sync/controller';

/** 画面には何も出さず、同期とオフライン用の Service Worker を起動する */
export function AppRuntime() {
  useEffect(() => startSync(), []);

  useEffect(() => {
    if (process.env.NODE_ENV !== 'production' || !('serviceWorker' in navigator)) return;
    navigator.serviceWorker.register('/sw.js', { scope: '/' }).catch(() => {
      // 登録できなくてもオンラインでは使えるので、利用者には知らせない
    });
  }, []);

  return null;
}
