import 'server-only';

import { createClient, type SupabaseClient, type User } from '@supabase/supabase-js';
import Stripe from 'stripe';
import type { BillingInterval } from '@/domain/plan';
import { shouldReplace, subscriptionRow, type SubscriptionRow } from './subscriptionRow';

/**
 * 決済（Stripe）のサーバー側の処理。環境変数がそろっていなければ、決済の API は 503 を返す。
 * 鍵はサーバーだけに置き、ブラウザには渡さない（README「有料プラン」）
 */
type Config = {
  stripe: Stripe;
  webhookSecret: string;
  prices: Record<BillingInterval, string>;
  supabaseUrl: string;
  publishableKey: string;
  serviceRoleKey: string;
};

let cached: Config | null | undefined;

export function billingConfig(): Config | null {
  if (cached !== undefined) return cached;
  const env = process.env;
  const values = {
    secretKey: env.STRIPE_SECRET_KEY,
    webhookSecret: env.STRIPE_WEBHOOK_SECRET,
    month: env.STRIPE_PRICE_MONTH,
    year: env.STRIPE_PRICE_YEAR,
    supabaseUrl: env.NEXT_PUBLIC_SUPABASE_URL,
    publishableKey: env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    serviceRoleKey: env.SUPABASE_SERVICE_ROLE_KEY,
  };
  if (Object.values(values).some((v) => !v)) return (cached = null);
  cached = {
    stripe: new Stripe(values.secretKey!),
    webhookSecret: values.webhookSecret!,
    prices: { month: values.month!, year: values.year! },
    supabaseUrl: values.supabaseUrl!,
    publishableKey: values.publishableKey!,
    serviceRoleKey: values.serviceRoleKey!,
  };
  return cached;
}

export function jsonError(status: number, message: string): Response {
  return Response.json({ error: message }, { status });
}

/** ブラウザから送られたアクセストークン（Authorization: Bearer）で、ログイン中の利用者を確かめる */
export async function requestUser(config: Config, request: Request): Promise<User | null> {
  const token = /^Bearer (.+)$/.exec(request.headers.get('authorization') ?? '')?.[1];
  if (!token) return null;
  const client = createClient(config.supabaseUrl, config.publishableKey, { auth: { persistSession: false } });
  const { data, error } = await client.auth.getUser(token);
  return error ? null : data.user;
}

/** RLS を通さずに subscriptions を書くための接続。サーバーの中だけで使う */
export function adminClient(config: Config): SupabaseClient {
  return createClient(config.supabaseUrl, config.serviceRoleKey, { auth: { persistSession: false } });
}

export async function savedSubscription(admin: SupabaseClient, userId: string): Promise<SubscriptionRow | null> {
  const { data, error } = await admin.from('subscriptions').select('*').eq('user_id', userId).maybeSingle();
  if (error) throw new Error(error.message);
  return data as SubscriptionRow | null;
}

/**
 * Stripe から購読の最新の状態を取り直して保存する。
 * 通知は順番どおりに届くとは限らないので、通知の中身ではなく取り直した値を使う
 */
export async function syncSubscription(config: Config, subscriptionId: string): Promise<void> {
  const sub = await config.stripe.subscriptions.retrieve(subscriptionId);
  const admin = adminClient(config);
  let userId = sub.metadata.user_id;
  if (!userId) {
    // ダッシュボードで作った購読など。顧客 ID から利用者を探す
    const customerId = typeof sub.customer === 'string' ? sub.customer : sub.customer.id;
    const { data } = await admin.from('subscriptions').select('user_id').eq('stripe_customer_id', customerId).maybeSingle();
    userId = (data as { user_id: string } | null)?.user_id ?? '';
  }
  if (!userId) {
    console.warn(`購読 ${sub.id} の利用者が分かりません（metadata.user_id がありません）`);
    return;
  }
  const row = subscriptionRow(sub, userId, new Date());
  if (!shouldReplace(await savedSubscription(admin, userId), row)) return;
  const { error } = await admin.from('subscriptions').upsert(row, { onConflict: 'user_id' });
  if (error) throw new Error(error.message);
}
