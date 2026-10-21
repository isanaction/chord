import type Stripe from 'stripe';

/** subscriptions テーブルの1行（supabase/migrations/20261021000000_billing.sql） */
export type SubscriptionRow = {
  user_id: string;
  status: string;
  billing_interval: 'month' | 'year' | null;
  current_period_end: string | null;
  cancel_at_period_end: boolean;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  updated_at: string;
};

const ACTIVE = new Set(['active', 'trialing', 'past_due']);

/** Stripe の購読を、subscriptions テーブルの行にする */
export function subscriptionRow(sub: Stripe.Subscription, userId: string, now: Date): SubscriptionRow {
  // 期間と料金は購読の明細（item）に付く。hikeru の購読は明細が1つだけ
  const item = sub.items.data[0];
  const interval = item?.price.recurring?.interval;
  return {
    user_id: userId,
    status: sub.status,
    billing_interval: interval === 'month' ? 'month' : interval === 'year' ? 'year' : null,
    current_period_end: item ? new Date(item.current_period_end * 1000).toISOString() : null,
    // カスタマーポータルからの解約は、cancel_at（解約日時）で予約されることがある
    cancel_at_period_end: sub.cancel_at_period_end || sub.cancel_at !== null,
    stripe_customer_id: typeof sub.customer === 'string' ? sub.customer : sub.customer.id,
    stripe_subscription_id: sub.id,
    updated_at: now.toISOString(),
  };
}

/**
 * 通知で受け取った購読で、保存済みの行を置き換えてよいか。
 * 同じ人が解約後に申し込み直したとき、古い購読の通知が後から届いて有効な購読を上書きしないようにする
 */
export function shouldReplace(existing: Pick<SubscriptionRow, 'status' | 'stripe_subscription_id'> | null, incoming: SubscriptionRow): boolean {
  if (!existing || existing.stripe_subscription_id === incoming.stripe_subscription_id) return true;
  return !(ACTIVE.has(existing.status) && !ACTIVE.has(incoming.status));
}
