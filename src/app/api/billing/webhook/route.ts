import type Stripe from 'stripe';
import { billingConfig, jsonError, syncSubscription } from '@/server/billing';

const SUBSCRIPTION_EVENTS = new Set<Stripe.Event['type']>([
  'customer.subscription.created',
  'customer.subscription.updated',
  'customer.subscription.deleted',
  'customer.subscription.paused',
  'customer.subscription.resumed',
]);

/** Stripe からの通知。購読が変わるたびに subscriptions テーブルを更新する */
export async function POST(request: Request) {
  const config = billingConfig();
  if (!config) return jsonError(503, '有料プランは準備中です');

  let event: Stripe.Event;
  try {
    // 署名の確認には、受け取ったままの本文が必要
    event = await config.stripe.webhooks.constructEventAsync(
      await request.text(),
      request.headers.get('stripe-signature') ?? '',
      config.webhookSecret,
    );
  } catch {
    return jsonError(400, '署名を確認できませんでした');
  }

  let subscriptionId: string | null = null;
  if (event.type === 'checkout.session.completed') {
    const s = event.data.object;
    subscriptionId = typeof s.subscription === 'string' ? s.subscription : (s.subscription?.id ?? null);
  } else if (SUBSCRIPTION_EVENTS.has(event.type)) {
    subscriptionId = (event.data.object as Stripe.Subscription).id;
  }
  // 保存に失敗したら 500 を返し、Stripe に再送してもらう
  if (subscriptionId) await syncSubscription(config, subscriptionId);
  return Response.json({ received: true });
}
