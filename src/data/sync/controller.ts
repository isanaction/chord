'use client';

import type { Session } from '@supabase/supabase-js';
import { useSyncExternalStore } from 'react';
import { getSupabase, syncConfigured } from '@/lib/supabase';
import { getDB } from '../db';
import { adoptLocalData, onLocalChange, setCurrentUserId } from '../repository';
import { syncOnce } from './engine';
import { SupabaseRemote, SyncError } from './supabaseRemote';

export type SyncStatus =
  | { kind: 'unconfigured' }
  | { kind: 'signedOut' }
  | { kind: 'syncing'; email: string; lastSyncedAt?: number }
  | { kind: 'synced'; email: string; lastSyncedAt: number }
  | { kind: 'offline'; email: string; lastSyncedAt?: number }
  | { kind: 'error'; email: string; message: string; lastSyncedAt?: number };

let status: SyncStatus = syncConfigured ? { kind: 'signedOut' } : { kind: 'unconfigured' };
const listeners = new Set<() => void>();

function setStatus(next: SyncStatus) {
  status = next;
  listeners.forEach((l) => l());
}

export function useSyncStatus(): SyncStatus {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => status,
    () => status,
  );
}

let session: Session | null = null;
let running: Promise<void> | null = null;
let again = false;
let lastSyncedAt: number | undefined;

/** 同期を1回行う。実行中に呼ばれたら、終わってからもう一度行う */
export function requestSync(): Promise<void> {
  if (running) {
    again = true;
    return running;
  }
  running = (async () => {
    do {
      again = false;
      await runOnce();
    } while (again);
  })().finally(() => {
    running = null;
  });
  return running;
}

async function runOnce() {
  const client = getSupabase();
  if (!client || !session) return;
  const email = session.user.email ?? '';
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    setStatus({ kind: 'offline', email, lastSyncedAt });
    return;
  }
  setStatus({ kind: 'syncing', email, lastSyncedAt });
  try {
    await syncOnce(getDB(), new SupabaseRemote(client));
    lastSyncedAt = Date.now();
    setStatus({ kind: 'synced', email, lastSyncedAt });
  } catch (e) {
    const message =
      e instanceof SyncError && e.code === '42501'
        ? 'このアカウントは同期を許可されていません（許可リストに登録してください）'
        : typeof navigator !== 'undefined' && !navigator.onLine
          ? 'オフラインです'
          : '同期できませんでした。時間をおいて再度お試しください';
    setStatus({ kind: 'error', email, message, lastSyncedAt });
  }
}

async function applySession(next: Session | null) {
  const changedUser = next?.user.id !== session?.user.id;
  session = next;
  if (!next) {
    setCurrentUserId(null);
    setStatus({ kind: 'signedOut' });
    return;
  }
  setCurrentUserId(next.user.id);
  if (changedUser) {
    // 未ログインの間に作ったデータを自分のものにしてから同期する
    await adoptLocalData(next.user.id);
  }
  await requestSync();
}

let started = false;

/** アプリ起動時に1回だけ呼ぶ。ログイン状態を監視し、変更・復帰・オンライン時に同期する */
export function startSync(): () => void {
  const client = getSupabase();
  if (!client || started) return () => {};
  started = true;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const soon = () => {
    clearTimeout(timer);
    timer = setTimeout(() => void requestSync(), 1500);
  };
  void client.auth.getSession().then(({ data }) => applySession(data.session));
  const { data: sub } = client.auth.onAuthStateChange((_event, s) => {
    // コールバック内で Supabase を待たない（公式の注意に従い、次のタスクで処理する）
    setTimeout(() => void applySession(s), 0);
  });
  const offChange = onLocalChange(soon);
  const onVisible = () => document.visibilityState === 'visible' && void requestSync();
  const onOnline = () => void requestSync();
  const onOffline = () => session && setStatus({ kind: 'offline', email: session.user.email ?? '', lastSyncedAt });
  document.addEventListener('visibilitychange', onVisible);
  window.addEventListener('online', onOnline);
  window.addEventListener('offline', onOffline);
  const interval = setInterval(() => document.visibilityState === 'visible' && void requestSync(), 5 * 60_000);
  return () => {
    started = false;
    sub.subscription.unsubscribe();
    offChange();
    clearTimeout(timer);
    clearInterval(interval);
    document.removeEventListener('visibilitychange', onVisible);
    window.removeEventListener('online', onOnline);
    window.removeEventListener('offline', onOffline);
  };
}

/** メールにログイン用のリンクを送る */
export async function sendLoginLink(email: string): Promise<void> {
  const client = getSupabase();
  if (!client) throw new Error('同期が設定されていません');
  const { error } = await client.auth.signInWithOtp({
    email,
    options: { emailRedirectTo: `${window.location.origin}/settings`, shouldCreateUser: true },
  });
  if (error) throw new Error(error.message);
}

export async function signOut(): Promise<void> {
  await getSupabase()?.auth.signOut();
}
