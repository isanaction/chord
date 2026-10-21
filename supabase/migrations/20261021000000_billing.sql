-- 有料プランの購読（要求定義 F-DATA-06・F-REV-03、EX-12）。
-- 書き込むのは決済サービス（Stripe）の通知を受けるサーバーだけ（service_role）。利用者は自分の行を読むだけ。

create table public.subscriptions (
  user_id uuid primary key references auth.users (id) on delete cascade,
  -- Stripe の subscription.status（active / trialing / past_due / canceled など）。
  -- 運営が手動で有料プランを付けるときは 'active' にして、Stripe の ID は空のままにする
  status text not null,
  -- 'month' / 'year'。手動で付けた場合は null
  billing_interval text check (billing_interval in ('month', 'year')),
  current_period_end timestamptz,
  cancel_at_period_end boolean not null default false,
  stripe_customer_id text unique,
  stripe_subscription_id text unique,
  updated_at timestamptz not null default now()
);

alter table public.subscriptions enable row level security;

-- 許可リストに関係なく、自分の購読は読める（一般登録を開いたあとも同じ）
create policy subscriptions_select on public.subscriptions for select to authenticated
  using (user_id = (select auth.uid()));
-- insert / update / delete のポリシーは作らない（service_role だけが書ける）
