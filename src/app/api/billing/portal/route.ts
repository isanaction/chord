import { adminClient, billingConfig, jsonError, requestUser, savedSubscription } from '@/server/billing';

/** 支払い方法の変更・領収書・解約（Stripe のカスタマーポータル）の URL を返す */
export async function POST(request: Request) {
  const config = billingConfig();
  if (!config) return jsonError(503, '有料プランは準備中です');
  const user = await requestUser(config, request);
  if (!user) return jsonError(401, 'ログインしてください');

  const saved = await savedSubscription(adminClient(config), user.id);
  if (!saved?.stripe_customer_id) return jsonError(404, 'お支払いの記録がありません');

  const session = await config.stripe.billingPortal.sessions.create({
    customer: saved.stripe_customer_id,
    return_url: `${new URL(request.url).origin}/settings`,
    locale: 'ja',
  });
  return Response.json({ url: session.url });
}
