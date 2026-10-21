/**
 * 料金プランと、プランで使える機能の判定（要求定義 4.9、EX-12）。
 * 機能の出し分けはここだけで決め、画面はこの結果に従う。
 */

export type Plan = 'free' | 'premium';

/** 有料プランの料金（税込・円） */
export const PRICES = { month: 480, year: 4800 } as const;
export type BillingInterval = keyof typeof PRICES;

/** 無料プランで、区間ループ・速度変更を使える曲数（1日あたり） */
export const FREE_PRACTICE_SHEETS_PER_DAY = 3;

/** 支払いが遅れても、期間の終わりからこの日数は有料プランのまま使える（カードの再請求を待つ） */
const GRACE_DAYS = 3;

/** 決済サービスから受け取った購読の状態（Stripe の subscription.status） */
export type Subscription = {
  status: string;
  interval: BillingInterval | null;
  /** 今の期間の終わり（ミリ秒）。運営が手動で付けた場合などは null */
  currentPeriodEnd: number | null;
  cancelAtPeriodEnd: boolean;
};

const ACTIVE = new Set(['active', 'trialing', 'past_due']);

export function planOf(sub: Subscription | null, now: number): Plan {
  if (!sub || !ACTIVE.has(sub.status)) return 'free';
  if (sub.currentPeriodEnd !== null && sub.currentPeriodEnd + GRACE_DAYS * 86_400_000 < now) return 'free';
  return 'premium';
}

/** 区間ループ・速度変更を使った曲（端末の日付ごと） */
export type PracticeQuota = { day: string; sheetIds: string[] };

/** 端末の時刻での日付（YYYY-MM-DD） */
export function localDay(now: Date): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${now.getFullYear()}-${p(now.getMonth() + 1)}-${p(now.getDate())}`;
}

/**
 * 区間ループ・速度変更を使えるか。無料プランでは1日に使える曲数を数える。
 * 同じ曲なら、その日のうちは何度でも使える。
 */
export function claimPracticeTools(
  plan: Plan,
  quota: PracticeQuota | null,
  sheetId: string,
  now: Date,
): { allowed: boolean; quota: PracticeQuota; remaining: number | null } {
  const day = localDay(now);
  const used = quota?.day === day ? quota.sheetIds : [];
  if (plan === 'premium') return { allowed: true, quota: { day, sheetIds: used }, remaining: null };
  if (used.includes(sheetId)) return { allowed: true, quota: { day, sheetIds: used }, remaining: FREE_PRACTICE_SHEETS_PER_DAY - used.length };
  if (used.length >= FREE_PRACTICE_SHEETS_PER_DAY) return { allowed: false, quota: { day, sheetIds: used }, remaining: 0 };
  const sheetIds = [...used, sheetId];
  return { allowed: true, quota: { day, sheetIds }, remaining: FREE_PRACTICE_SHEETS_PER_DAY - sheetIds.length };
}
