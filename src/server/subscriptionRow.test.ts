import type Stripe from 'stripe';
import { describe, expect, it } from 'vitest';
import { shouldReplace, subscriptionRow } from './subscriptionRow';

const NOW = new Date('2026-10-21T03:00:00Z');

function stripeSub(s: Partial<Stripe.Subscription> & { interval?: string; periodEnd?: number }): Stripe.Subscription {
  const { interval = 'month', periodEnd = 1_795_000_000, ...rest } = s;
  return {
    id: 'sub_1',
    status: 'active',
    customer: 'cus_1',
    cancel_at_period_end: false,
    cancel_at: null,
    metadata: { user_id: 'u1' },
    items: { data: [{ current_period_end: periodEnd, price: { recurring: { interval } } }] },
    ...rest,
  } as unknown as Stripe.Subscription;
}

describe('Stripe の購読 → subscriptions の行', () => {
  it('状態・間隔・期間の終わり・顧客を写す', () => {
    expect(subscriptionRow(stripeSub({ interval: 'year' }), 'u1', NOW)).toEqual({
      user_id: 'u1',
      status: 'active',
      billing_interval: 'year',
      current_period_end: new Date(1_795_000_000 * 1000).toISOString(),
      cancel_at_period_end: false,
      stripe_customer_id: 'cus_1',
      stripe_subscription_id: 'sub_1',
      updated_at: NOW.toISOString(),
    });
  });

  it('解約日時（cancel_at）で予約された解約も「解約予約中」にする', () => {
    expect(subscriptionRow(stripeSub({ cancel_at: 1_795_000_000 }), 'u1', NOW).cancel_at_period_end).toBe(true);
    expect(subscriptionRow(stripeSub({ cancel_at_period_end: true }), 'u1', NOW).cancel_at_period_end).toBe(true);
  });

  it('顧客が展開されていても ID を取る', () => {
    const row = subscriptionRow(stripeSub({ customer: { id: 'cus_2' } as Stripe.Customer }), 'u1', NOW);
    expect(row.stripe_customer_id).toBe('cus_2');
  });
});

describe('保存済みの行を置き換えるか', () => {
  const incoming = (status: string, id = 'sub_old') => subscriptionRow(stripeSub({ id, status: status as Stripe.Subscription.Status }), 'u1', NOW);

  it('同じ購読、またはまだ行がなければ置き換える', () => {
    expect(shouldReplace(null, incoming('canceled'))).toBe(true);
    expect(shouldReplace({ status: 'active', stripe_subscription_id: 'sub_old' }, incoming('canceled'))).toBe(true);
  });

  it('申し込み直した有効な購読を、古い購読の解約で上書きしない', () => {
    expect(shouldReplace({ status: 'active', stripe_subscription_id: 'sub_new' }, incoming('canceled'))).toBe(false);
    // 新しい購読が有効なら置き換える
    expect(shouldReplace({ status: 'canceled', stripe_subscription_id: 'sub_old' }, incoming('active', 'sub_new'))).toBe(true);
  });
});
