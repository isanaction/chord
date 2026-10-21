import { planOf, type BillingInterval } from '@/domain/plan';
import { adminClient, billingConfig, jsonError, requestUser, savedSubscription } from '@/server/billing';

/** 有料プランの申し込み。Stripe の決済画面（Checkout）の URL を返す */
export async function POST(request: Request) {
  const config = billingConfig();
  if (!config) return jsonError(503, '有料プランの申し込みは準備中です');
  const user = await requestUser(config, request);
  if (!user) return jsonError(401, 'ログインしてください');

  const body = (await request.json().catch(() => null)) as { interval?: string } | null;
  const interval = body?.interval;
  if (interval !== 'month' && interval !== 'year') return jsonError(400, '支払いの間隔を選んでください');

  const saved = await savedSubscription(adminClient(config), user.id);
  if (
    saved &&
    planOf(
      {
        status: saved.status,
        interval: saved.billing_interval,
        currentPeriodEnd: saved.current_period_end ? Date.parse(saved.current_period_end) : null,
        cancelAtPeriodEnd: saved.cancel_at_period_end,
      },
      Date.now(),
    ) === 'premium'
  ) {
    return jsonError(409, 'すでに有料プランです。変更・解約は「プランを管理」から行えます');
  }

  const origin = new URL(request.url).origin;
  const session = await config.stripe.checkout.sessions.create({
    mode: 'subscription',
    line_items: [{ price: config.prices[interval as BillingInterval], quantity: 1 }],
    // 以前に申し込んだことがあれば同じ顧客にまとめる（支払い方法・請求書の履歴を引き継ぐ）
    ...(saved?.stripe_customer_id ? { customer: saved.stripe_customer_id } : { customer_email: user.email }),
    client_reference_id: user.id,
    metadata: { user_id: user.id },
    subscription_data: { metadata: { user_id: user.id } },
    locale: 'ja',
    success_url: `${origin}/settings?billing=success`,
    cancel_url: `${origin}/pricing`,
  });
  if (!session.url) return jsonError(502, '決済画面を開けませんでした');
  return Response.json({ url: session.url });
}
