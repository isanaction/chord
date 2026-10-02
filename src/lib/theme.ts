'use client';

import { useCallback, useSyncExternalStore } from 'react';
import { THEME_STORAGE_KEY as STORAGE_KEY } from './theme-script';

export type Theme = 'dark' | 'light';

function read(): Theme {
  return document.documentElement.dataset.theme === 'light' ? 'light' : 'dark';
}

const listeners = new Set<() => void>();

function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

export function useTheme(): [Theme, (t: Theme) => void] {
  const theme = useSyncExternalStore(subscribe, read, () => 'dark' as Theme);
  const setTheme = useCallback((t: Theme) => {
    document.documentElement.dataset.theme = t;
    try {
      localStorage.setItem(STORAGE_KEY, t);
    } catch {
      // 保存できない環境（プライベートモードなど）でも表示は切り替える
    }
    listeners.forEach((l) => l());
  }, []);
  return [theme, setTheme];
}
