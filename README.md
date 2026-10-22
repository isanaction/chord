# hikeru（ヒケル）

自分用のコード譜・練習アプリ（MVP）。U-FRET・楽器.me の代わりに、広告なしで譜面を見て練習するための Web アプリです。

- 本番: https://hikeru.app
- 要求定義: [docs/requirements.md](docs/requirements.md)
- 基本設計: [docs/design.md](docs/design.md)
- 公開準備計画（歌詞の公開・曲数の拡充）: [docs/launch-plan.md](docs/launch-plan.md)

## できること（ステップ 1-1）

- コード譜テキストの貼り付け取り込み（「コード行＋歌詞行」と ChordPro を自動判別）
- Web ページからの取り込み（ブックマークレット。`/import` で登録方法を案内）
- 譜面の表示、移調、カポ、簡単コード（弾きやすいカポ位置の提案）、テンション省略表示
- ギター／ピアノのコード図、自動スクロール、演奏モード、画面スリープ防止
- ライブラリ（検索・絞り込み）、編集（版を積み上げて保存）、明るい／暗い配色

## できること（ステップ 1-2）

- メールのログインリンクでログインし、PC とスマホで譜面・個人設定を同期（Supabase）
- オフラインでも保存済みの譜面を開いて弾ける（PWA。ホーム画面に追加できる）
- 全データの書き出し・読み込み（JSON）、譜面ごとの ChordPro 書き出し

## できること（ステップ 1-3）

- 動画に合わせた練習: 譜面に参考動画（YouTube）を登録すると「動画で練習」が出る。再生位置に合わせて演奏中の行を強調し、自動でスクロールする
- 同期データの記録: 動画を流しながら、行の歌い出しで「記録」（またはスペースキー）を押す。行ごと・全体を 0.1 秒単位で直せる
- 区間ループ（A–B 点、またはセクション見出しを押す）、再生速度の変更
- コード図を押すとコードが鳴る（ギター／ピアノ）。メトロノーム（曲の BPM・拍子から始まる）

データはまず端末内（IndexedDB）に保存し、ログインしているときだけサーバーと同期します。同期先が未設定でも端末内だけで動きます。

## 同期の設定（Supabase）

1. Supabase のプロジェクトを作り、`supabase/migrations/` の SQL を古い順にすべて適用する（ステップ 1-3 で `20261020000000_practice.sql` を追加）
2. 自分のメールアドレスを許可リストに登録する: `insert into public.allowed_emails values ('you@example.com');`
3. Authentication → URL Configuration の Site URL / Redirect URLs に、アプリの URL（本番は `https://hikeru.app`。Redirect URLs には `https://hikeru.app/settings`）を登録する
4. `.env.example` を参考に `NEXT_PUBLIC_SUPABASE_URL` と `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` を設定する（Vercel では Environment Variables）
5. 無料プランの一時停止を防ぐため、GitHub の Secrets に `SUPABASE_URL` と `SUPABASE_PUBLISHABLE_KEY` を登録する（`.github/workflows/keepalive.yml` が3日おきにアクセスする）

## 有料プラン（準備中）

料金は月額 480円・年額 4,800円（税込）。無料プランでは区間ループ・速度変更を1日3曲まで使える（`src/domain/plan.ts` で判定）。
決済は Stripe。`NEXT_PUBLIC_BILLING_ENABLED` を `1` にするまでは、誰でもすべての機能を使え、料金ページは「準備中」と表示する。

始めるまでに必要なこと:

1. `supabase/migrations/20261021000000_billing.sql` を適用する（`subscriptions` テーブル）
2. 利用規約・プライバシーポリシー・特定商取引法に基づく表記（`/terms` `/privacy` `/legal`。事業者情報は `src/lib/seller.ts`）を確定する
3. Stripe でアカウントを作り、本人確認を済ませる。商品「hikeru 有料プラン」に価格を2つ作る（480円／月、4,800円／年。税込）
4. Stripe の Webhook に `https://hikeru.app/api/billing/webhook` を登録する。送るイベント: `checkout.session.completed`、`customer.subscription.created` `updated` `deleted` `paused` `resumed`
5. Stripe のカスタマーポータルを有効にする（支払い方法の変更・請求書・解約を許可）
6. Vercel の Environment Variables に次を設定する。`NEXT_PUBLIC_` 以外はサーバーだけで使う秘密の値

| 変数 | 値 |
|---|---|
| `STRIPE_SECRET_KEY` | Stripe のシークレットキー（`sk_live_…`。試すときは `sk_test_…`） |
| `STRIPE_WEBHOOK_SECRET` | Webhook の署名シークレット（`whsec_…`） |
| `STRIPE_PRICE_MONTH` / `STRIPE_PRICE_YEAR` | 価格の ID（`price_…`） |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase の secret key（購読の記録を書き込むため） |
| `NEXT_PUBLIC_BILLING_ENABLED` | `1`（申し込みを受け付ける） |

運営者が手動で有料プランを付けるときは、`subscriptions` に `status = 'active'` の行を入れる（Stripe の ID は空のまま）。

## 開発

```sh
npm install
npm run dev        # http://localhost:3000
npm test           # ロジックのテスト（Vitest）
npm run test:e2e   # 画面のテスト（Playwright。先に npm run build）
npm run lint
npm run typecheck
```

`src/domain/` は画面や DB に依存しない純粋なロジックで、テストの中心です。

## 取り込みについて

取り込みは「自分がブラウザで開いている1曲を、自分の操作で取り込む」形に限っています。サーバーからの自動取得・一括取得はしません（要求定義 2.2）。
取り込み元ページの保存ファイルは歌詞を含むため、`fixtures-local/`（コミット対象外）に置いてください。
