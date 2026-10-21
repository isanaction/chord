'use client';

import type { Session } from '@supabase/supabase-js';
import { useSyncExternalStore } from 'react';
import { type BillingInterval, claimPracticeTools, type Plan, planOf, type PracticeQuota, type Subscription } from '@/domain/plan';
import { getSupabase, syncConfigured } from '@/lib/supabase';

/**
 * 有料プランの状態（要求定義 F-DATA-06）。
 * 決済の準備ができるまで（NEXT_PUBLIC_BILLING_ENABLED が '1' でない間）は、誰でもすべての機能を使える
 */
export const billingEnabled = syncConfigured && process.env.NEXT_PUBLIC_BILLING_ENABLED === '1';

export type PlanState = {
  billingEnabled: boolean;
  signedIn: boolean;
  /** 購読をまだ読み込んでいない（ログイン直後など） */
  loading: boolean;
  subscription: Subscription | null;
  plan: Plan;
};

const CACHE_KEY = 'hikeru-subscription';
const QUOTA_KEY = 'hikeru-practice-quota';

let state: PlanState = {
  billingEnabled,
  signedIn: false,
  loading: billingEnabled,
  subscription: null,
  plan: billingEnabled ? 'free' : 'premium',
};
const listeners = new Set<() => void>();

function setState(next: Omit<PlanState, 'billingEnabled' | 'plan'>) {
  const plan = billingEnabled ? planOf(next.subscription, Date.now()) : 'premium';
  state = { ...next, billingEnabled, plan };
  listeners.forEach((l) => l());
}

export function usePlan(): PlanState {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => state,
    () => state,
  );
}

function storage(): Storage | null {
  try {
    return typeof window === 'undefined' ? null : window.localStorage;
  } catch {
    return null;
  }
}

type Cached = { userId: string; subscription: Subscription | null };

/** オフラインでも有料プランを使えるよう、最後に読んだ購読を端末に残す */
function readCache(userId: string): Subscription | null {
  try {
    const c = JSON.parse(storage()?.getItem(CACHE_KEY) ?? 'null') as Cached | null;
    return c?.userId === userId ? c.subscription : null;
  } catch {
    return null;
  }
}

let session: Session | null = null;

async function load(next: Session | null) {
  session = next;
  if (!next) {
    storage()?.removeItem(CACHE_KEY);
    setState({ signedIn: false, loading: false, subscription: null });
    return;
  }
  const userId = next.user.id;
  setState({ signedIn: true, loading: true, subscription: readCache(userId) });
  const { data, error } = await getSupabase()!
    .from('subscriptions')
    .select('status, billing_interval, current_period_end, cancel_at_period_end')
    .eq('user_id', userId)
    .maybeSingle();
  if (session?.user.id !== userId) return;
  if (error) {
    // 読めなければ（オフラインなど）端末に残した状態を使う
    setState({ signedIn: true, loading: false, subscription: readCache(userId) });
    return;
  }
  const row = data as { status: string; billing_interval: BillingInterval | null; current_period_end: string | null; cancel_at_period_end: boolean } | null;
  const subscription: Subscription | null = row && {
    status: row.status,
    interval: row.billing_interval,
    currentPeriodEnd: row.current_period_end ? Date.parse(row.current_period_end) : null,
    cancelAtPeriodEnd: row.cancel_at_period_end,
  };
  storage()?.setItem(CACHE_KEY, JSON.stringify({ userId, subscription } satisfies Cached));
  setState({ signedIn: true, loading: false, subscription });
}

/** 申し込み・解約のあとに購読を読み直す */
export function refreshPlan(): Promise<void> {
  return load(session);
}

let started = false;

/** アプリ起動時に1回だけ呼ぶ。ログイン状態に合わせて購読を読み込む */
export function startBilling(): () => void {
  const client = getSupabase();
  if (!billingEnabled || !client || started) return () => {};
  started = true;
  void client.auth.getSession().then(({ data }) => load(data.session));
  const { data: sub } = client.auth.onAuthStateChange((event, s) => {
    // トークンの更新では読み直さない
    if (event === 'TOKEN_REFRESHED') {
      session = s;
      return;
    }
    setTimeout(() => void load(s), 0);
  });
  const onVisible = () => document.visibilityState === 'visible' && session && void load(session);
  document.addEventListener('visibilitychange', onVisible);
  return () => {
    started = false;
    sub.subscription.unsubscribe();
    document.removeEventListener('visibilitychange', onVisible);
  };
}

async function callBilling(path: string, body?: unknown): Promise<string> {
  const { data } = (await getSupabase()?.auth.getSession()) ?? { data: { session: null } };
  if (!data.session) throw new Error('ログインしてください');
  const res = await fetch(path, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${data.session.access_token}` },
    body: JSON.stringify(body ?? {}),
  });
  const json = (await res.json().catch(() => ({}))) as { url?: string; error?: string };
  if (!res.ok || !json.url) throw new Error(json.error ?? '通信できませんでした。時間をおいて再度お試しください');
  return json.url;
}

/** Stripe の決済画面へ移る */
export async function startCheckout(interval: BillingInterval): Promise<void> {
  window.location.href = await callBilling('/api/billing/checkout', { interval });
}

/** 支払い方法の変更・解約の画面（Stripe のカスタマーポータル）へ移る */
export async function openBillingPortal(): Promise<void> {
  window.location.href = await callBilling('/api/billing/portal');
}

/**
 * 区間ループ・速度変更を使う前に呼ぶ。無料プランで1日の曲数を超えていれば false。
 * 数は端末ごと（ログインしていない人も数える）
 */
export function claimPracticeToolsFor(sheetId: string): boolean {
  // 購読を読み込み中は、有料プランの人を止めないよう数えずに許可する
  if (state.plan === 'premium' || (state.signedIn && state.loading)) return true;
  let quota: PracticeQuota | null = null;
  try {
    quota = JSON.parse(storage()?.getItem(QUOTA_KEY) ?? 'null') as PracticeQuota | null;
  } catch {
    quota = null;
  }
  const r = claimPracticeTools(state.plan, quota, sheetId, new Date());
  try {
    storage()?.setItem(QUOTA_KEY, JSON.stringify(r.quota));
  } catch {
    // 保存できなくても、この操作は許可する（数えられないだけ）
  }
  return r.allowed;
}
