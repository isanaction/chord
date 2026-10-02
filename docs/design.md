# コード譜・練習サービス 基本設計書（v0.1 ドラフト）

最終更新: 2026-10-02（実装に合わせて 1章・2章を更新）
対象: Phase 1（MVP・個人用）。ただし要求定義書 5章の拡張設計要件（EX-01〜14）を満たす
関連: [要求定義書](./requirements.md)

---

## 1. 技術スタック

### 1.1 採用案
| 領域 | 採用 | 選定理由 |
|---|---|---|
| 言語 | TypeScript | フロント・サーバー・取り込みアダプタ・音楽理論ロジックを1言語で書ける |
| フレームワーク | Next.js（App Router） | サーバー側描画ができ、Phase 2 の公開ページの SEO にそのまま使える（EX-11）。情報量が多く個人開発で詰まりにくい |
| ホスティング | Vercel | Next.js との相性。MVP は無料の Hobby プランで足りる |
| DB・認証 | Supabase（Postgres＋Auth） | 行単位のアクセス制御（RLS）で「本人しか見られない」を DB で保証できる。認証を一般登録に広げやすい（EX-10） |
| 端末内の保存 | IndexedDB（Dexie） | オフラインで閲覧・編集し、あとで同期する（F-DATA-02） |
| PWA | Serwist | Service Worker の生成。ホーム画面追加・オフライン起動 |
| UI | Tailwind CSS ＋ Radix UI 系のヘッドレス部品 | 演奏用の大きな操作部品を自前で組みやすい |
| 音楽理論 | 自前（`src/domain/chord`） | コード名の解釈・移調・構成音の計算。日本の表記（`C(onE)`、`m7-5` など）に合わせるため自前で実装した（tonal 6.5.0 は配布物の参照先が壊れていて読み込めなかったことも理由） |
| 譜面テキストの解釈 | 自前（`src/domain/sheet`） | 「コード行＋歌詞行」は全角文字の幅（2桁）を考慮して位置合わせする必要があり、既存ライブラリでは日本語の歌詞がずれるため自前で実装した |
| ギターのコードフォーム | chords-db（JSON） | コードごとの押さえ方データ。簡単コード判定にも使う |
| ダイアグラム描画 | 自前 SVG（ギター・鍵盤） | デザインの見た目に合わせるため |
| 音 | Tone.js ＋ 自前ホストの音源サンプル | コード音・メトロノーム・伴奏の再生タイミング管理 |
| 動画 | YouTube IFrame Player API | 公式埋め込みのみ（要求定義 2.2） |
| テスト | Vitest（ロジック）／Playwright（画面） | |
| CI | GitHub Actions（lint・型チェック・テスト） | |

### 1.2 運用コストと注意点
| サービス | MVP のプラン | 注意点 | 対策 |
|---|---|---|---|
| Vercel | Hobby（無料） | **非商用の個人利用に限られる**。広告・課金を始める Phase 3 では Pro（有料）が必要 | Phase 2 の判断ポイントで移行を計画する |
| Supabase | Free（無料） | DB 500MB まで。**7日間 DB へのアクセスが少ないと一時停止される** | 練習しない週があっても止まらないよう、GitHub Actions の定期実行で数日おきに軽いクエリを投げる。停止しても1年以内なら復元でき、端末内にデータが残るので演奏は続けられる |

譜面1曲は数 KB〜十数 KB なので、500MB は個人利用では当面足りる。

### 1.3 検討した代替案
| 案 | 見送った理由 |
|---|---|
| SvelteKit | 軽くて魅力的だが、周辺ライブラリと情報量で Next.js を優先 |
| Cloudflare（Pages＋Workers＋D1） | 大規模時のコストは有利だが、認証・行単位のアクセス制御を自前で組む量が増える。Phase 3 でコストが問題になったら再検討 |
| Firebase | オフライン同期は強いが、SQL で集計しにくい（Phase 2 のランキング・利用実績の報告で不利） |

---

## 2. 全体構成

```
┌──────────────────────── ブラウザ（PWA） ────────────────────────┐
│  画面（Next.js）                                                 │
│   ├ 譜面ビュー：移調・カポ・スクロール・同期再生・コード音         │
│   ├ エディタ／取り込みプレビュー                                  │
│   └ ライブラリ・セットリスト・練習記録                            │
│  ドメインロジック（純粋な TS。画面・DB から独立）                 │
│   ├ chord：コードの解釈・移調・カポ・簡単コード判定                │
│   ├ sheet：譜面形式・テキスト⇔譜面の変換                          │
│   └ importers：サイトごとの取り込みアダプタ（EX-14）              │
│  端末内ストア（IndexedDB）＋同期キュー                            │
└───────────────▲──────────────────────────────▲──────────────────┘
                │ 同期（差分の取得・送信）       │ postMessage
                ▼                              │（取り込みデータ）
┌──────── Supabase ────────┐        ┌──────── 取り込み元のページ ────────┐
│ Auth（許可リスト）        │        │ U-FRET／楽器.me を自分で開き、      │
│ Postgres ＋ RLS          │        │ ブックマークレットを押す             │
└──────────────────────────┘        └─────────────────────────────────────┘
```

- **移調・カポ・簡単コードはすべて端末内で計算する**（NF-02）。サーバーは保存と同期だけを受け持つ
- 端末内のデータを表示するページは静的に生成し、譜面の指定は `/sheet?id=…` のようにクエリで渡す。アプリ本体を丸ごと Service Worker でキャッシュでき、オフライン対応（5.3）が簡単になる
- ドメインロジックは画面や DB に依存しない純粋な関数にし、テストを厚くする。ここがアプリの価値の中心

---

## 3. 譜面データ形式

### 3.1 方針
- 譜面本体は JSON で保存する（`sheet_revisions.body`）。HTML は保存しない（XSS 対策 NF-11）
- コードは文字列のままではなく、**根音を音高（0〜11）として解釈した構造**で持つ。移調は数値の足し算で済み、表記（♯／♭）は表示時に決める（EX-08）
- 解釈できなかったコードも元の文字列を残して捨てない（F-EDIT-05 で警告）
- 行・セクションに ID を振り、同期データ（4.4）や将来の修正提案から参照できるようにする
- ChordPro との相互変換を保証する（エクスポート・乗り換え用）

### 3.2 構造
```ts
type SheetBody = {
  formatVersion: 1;
  sections: Section[];
};

type Section = {
  id: string;            // 例 "s_k3f9"
  kind: 'intro' | 'verse' | 'prechorus' | 'chorus' | 'bridge' | 'interlude' | 'outro' | 'other';
  label: string;         // 表示名 例 "Aメロ"
  lines: Line[];
};

type Line =
  | { id: string; kind: 'lyric'; segments: Segment[] }   // 歌詞＋コード
  | { id: string; kind: 'bars'; bars: Bar[] }            // 歌詞なし（小節区切り）F-EDIT-06
  | { id: string; kind: 'comment'; text: string };       // 「×2」などの注記

type Segment = { chord?: ChordToken; text: string };      // chord は text の先頭位置に乗る
type Bar = { chords: ChordToken[] };

type ChordToken =
  | { raw: string; root: Pitch; quality: string; bass?: Pitch }   // 例 F#m7/C#
  | { raw: string; unparsed: true };                               // 解釈できなかったもの

type Pitch = { pc: number; spelling: string };  // pc: 0=C … 11=B、spelling: 元の表記 "F#"
```

例: `[C]春の[G/B]風が` →
`segments: [{chord:{raw:"C",root:{pc:0,spelling:"C"},quality:""}, text:"春の"}, {chord:{raw:"G/B",root:{pc:7,…},quality:"",bass:{pc:11,…}}, text:"風が"}]`

### 3.3 表示時の変換
```
表示コード = 表記を決める( 元のコード の pc + 移調量 − カポ位置 , 移調後のキー )
```
- 移調後のキーから ♯系／♭系を決め、表記をそろえる（例: キーが E♭ なら D# ではなく E♭）
- **簡単コード判定（F-PLAY-04）**: カポ 0〜7 の各位置について、登場するコードの押さえにくさ（chords-db のフォームから、バレーの有無・フレット幅・指の数で点数化）を出現回数で重み付けして合計し、最小の位置を提案する

---

## 4. データベース設計（Postgres）

### 4.1 テーブル一覧
| テーブル | 内容 | 対応する要件 |
|---|---|---|
| `profiles` | ユーザー（auth.users と 1:1）。表示名・役割・プラン | EX-01, EX-12 |
| `songs` | 楽曲（曲名・アーティスト・読み・外部 ID） | EX-02, EX-03 |
| `sheets` | 譜面（楽曲に対するアレンジ）。所有者・公開範囲・取り込み元・最新版 | EX-02, EX-04, EX-13 |
| `sheet_revisions` | 譜面の版（本体 JSON） | EX-06 |
| `sync_tracks` | 同期データ（動画 ID ＋行ごとの時刻） | EX-07 |
| `user_sheet_settings` | ユーザー × 譜面の個人設定（移調・カポ・ループなど） | EX-05, F-LIB-04 |
| `favorites` | お気に入り | F-LIB-02 |
| `setlists` / `setlist_items` | セットリストと曲順 | F-LIB-03 |
| `tags` / `sheet_tags` | タグ（ユーザーごと） | F-LIB-05 |
| `practice_sessions` | 練習記録（楽曲単位でも集計できる） | F-LIB-06, EX-09 |
| `allowed_emails` | MVP の登録許可リスト | EX-10 |

### 4.2 主要テーブル
```sql
create type visibility as enum ('private', 'unlisted', 'public');
create type source_kind as enum ('manual', 'paste', 'web_import');

create table songs (
  id            uuid primary key default gen_random_uuid(),
  title         text not null,
  title_reading text,              -- 読み（ひらがな）。検索の表記揺れ対策
  artist        text not null,
  artist_reading text,
  external_ids  jsonb not null default '{}',  -- 例 {"jasrac": "..."}（Phase 2）
  created_by    uuid not null references profiles(id),
  created_at    timestamptz not null default now()
);

create table sheets (
  id                  uuid primary key default gen_random_uuid(),
  song_id             uuid not null references songs(id),
  owner_id            uuid not null references profiles(id),
  visibility          visibility not null default 'private',
  source_kind         source_kind not null,
  source_url          text,
  source_site         text,         -- 'ufret' / 'gakkime'
  imported_at         timestamptz,
  original_key        text,         -- 例 'E♭'
  capo                smallint not null default 0,
  bpm                 smallint,
  time_signature      text not null default '4/4',
  current_revision_id uuid,         -- sheet_revisions(id)
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  deleted_at          timestamptz,  -- 論理削除（同期で削除を伝えるため）
  -- EX-13: 外部取り込みの譜面は非公開以外にできない（DB で保証する）
  constraint web_import_must_be_private
    check (source_kind <> 'web_import' or visibility = 'private')
);

create table sheet_revisions (
  id             uuid primary key default gen_random_uuid(),
  sheet_id       uuid not null references sheets(id),
  revision_no    integer not null,
  body           jsonb not null,    -- 3章の SheetBody
  created_by     uuid not null references profiles(id),
  created_at     timestamptz not null default now(),
  unique (sheet_id, revision_no)
);

create table sync_tracks (
  id          uuid primary key default gen_random_uuid(),
  sheet_id    uuid not null references sheets(id),
  owner_id    uuid not null references profiles(id),
  provider    text not null default 'youtube',
  video_id    text not null,
  revision_id uuid not null references sheet_revisions(id), -- どの版の行 ID に対する時刻か
  cues        jsonb not null,  -- [{ "lineId": "l_x1", "t": 12340 }]（ミリ秒）
  updated_at  timestamptz not null default now()
);

create table user_sheet_settings (
  user_id       uuid not null references profiles(id),
  sheet_id      uuid not null references sheets(id),
  transpose     smallint not null default 0,
  capo          smallint,                 -- null なら譜面の既定値
  scroll_speed  real,
  instrument    text not null default 'guitar',  -- 'guitar' / 'piano'
  font_scale    real not null default 1.0,
  loop          jsonb,                    -- {"a": 30000, "b": 52000} または {"sectionId": "..."}
  sync_track_id uuid references sync_tracks(id),
  updated_at    timestamptz not null default now(),
  primary key (user_id, sheet_id)
);

create table practice_sessions (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references profiles(id),
  sheet_id     uuid not null references sheets(id),
  song_id      uuid not null references songs(id),  -- 楽曲単位の集計用（EX-09）
  started_at   timestamptz not null,
  duration_sec integer not null,
  used_features text[] not null default '{}'        -- 'sync','loop','metronome' など
);
```
（favorites・setlists・tags は所有者 ID を持つ単純な構造のため省略）

### 4.3 アクセス制御（RLS）
- すべてのテーブルで RLS を有効にする
- MVP のポリシーは「`owner_id`（または `user_id`）が自分のものだけ読み書きできる」のみ
- Phase 2 で `sheets.visibility = 'public'` の行を誰でも読めるポリシーを足す。テーブル構造は変えない
- 登録の制限: Supabase Auth の「ユーザー作成前フック」で `allowed_emails` にないメールアドレスを拒否する。Phase 2 ではこのフックを外すだけで一般登録になる

### 4.4 同期データと版の関係
同期データは行 ID に時刻を結び付けるため、譜面を編集して行 ID が変わると壊れる。対策は次のとおり。
- エディタは、編集前後で内容が近い行の ID を引き継ぐ（行単位の差分で対応付ける）
- `sync_tracks.revision_id` で、どの版に対する時刻かを記録する。版が変わったら、行 ID が一致しない時刻だけ「要調整」として表示する

---

## 5. 端末間同期・オフライン

### 5.1 方式
- **端末内の IndexedDB を正とする**（ローカルファースト）。画面は常に端末内のデータを読み書きし、通信を待たない
- 変更は「送信待ちキュー」に積み、オンラインのときに Supabase へ送る
- 取得は、前回同期以降に更新された行（`updated_at` が新しいもの）だけを取る
- 削除は論理削除（`deleted_at`）にして、他の端末に削除を伝える

### 5.2 競合の扱い
- 利用者が1人なので、基本は**後から書いたほうを優先**（レコード単位）
- 譜面本体は版を積み上げるので、競合しても古いほうも版履歴に残り、失われない（NF-08）
- Phase 2 の共同編集は「修正提案」として別の流れで扱うため、ここでは複雑な競合解決をしない

### 5.3 PWA
- アプリ本体（画面・JS・音源サンプル）は Service Worker でキャッシュする
- 開いたことのある譜面は IndexedDB にあるので、オフラインでも開ける
- YouTube はオフラインでは使えない。メトロノーム・コード音・伴奏はオフラインでも使える

---

## 6. 外部サイトからの取り込み

### 6.1 流れ
```
① 取り込み元のページ（U-FRET 等）でブックマークレットを押す
② ブックマークレットが、自アプリの受け取りページ /import/receive を別ウィンドウで開く
③ 受け取りページが準備完了を知らせたら、ブックマークレットがページの
   URL・タイトル・HTML を postMessage で送る（送り先は自アプリのオリジンに限定）
④ 受け取りページで:
   - 送信元のオリジンが対応サイトの一覧にあるか確認する
   - HTML を DOMParser で解析する（スクリプトは実行されず、画面にも差し込まない）
   - サイトに対応するアダプタで譜面形式に変換する
   - 失敗したら本文テキストを抜き出し、テキスト取り込み（F-EDIT-01）に回す
⑤ プレビューで確認・修正して保存（source_kind = 'web_import'）
```

### 6.2 この方式にした理由
- **相手サイトへの通信は、自分が普通にページを開いたときの1回だけ**。サーバーからの自動取得はしない（要求定義 2.2）
- 相手のページは表示済みなので、JavaScript で描画されるコード譜でも読み取れる
- **ブックマークレットは「HTML を渡すだけ」にし、解析は自アプリ側のアダプタで行う**。サイトの構造が変わっても、アプリ側を直せばブックマークレットの再登録は不要。アダプタは機能ごと無効化できる（EX-14）

### 6.3 アダプタの形
```ts
interface ImportAdapter {
  site: 'ufret' | 'gakkime';
  origins: string[];                        // 受け付ける送信元
  match(url: URL): boolean;                 // 曲ページか
  parse(doc: Document, url: URL): ImportResult;
}

type ImportResult =
  | { ok: true; song: { title: string; artist: string };
      meta: { key?: string; capo?: number; bpm?: number };
      body: SheetBody; warnings: string[] }
  | { ok: false; reason: string; fallbackText: string };
```

### 6.4 制約・リスク
- 取り込み元のページが厳しい CSP（セキュリティ設定）を持つと、ブラウザによってはブックマークレットが動かない。その場合は次の手段に回す
  1. Chrome 拡張版（同じアダプタを使う）を用意する
  2. ページのテキストをコピーし、貼り付けで取り込む
- アダプタを作るには、各サイトの実際のページ構造が必要。この開発環境からは両サイトにアクセスできないため、**開発時に手元のブラウザで保存したページの HTML を参考にする**
- 保存した HTML には歌詞が含まれるため、**リポジトリにはコミットしない**（`.gitignore` 対象のフォルダに置く）。自動テストには、構造だけ残して歌詞を置き換えたダミー HTML を使う

---

## 7. 練習機能の実装方針

### 7.1 音源同期スクロール（F-PRAC-01）
- YouTube プレーヤーは再生位置を細かく通知しないので、`getCurrentTime()` を定期的に読み、間は端末の時計で補間する
- 現在行 = 時刻が現在位置以前で最も新しい行。その行をハイライトし、画面の上から 1/3 あたりに来るようスクロールする
- 目標のずれは ±100ms（NF-03）。ずれる動画のために、同期データ全体を前後にずらす補正値を持つ

### 7.2 同期データの作成（F-PRAC-02）
- 動画を再生しながら「次の行」ボタン（またはスペースキー）を押すと、現在の行に時刻を記録して次の行へ進む
- 記録後は、行ごとに ±0.1 秒ずつ微調整できる。速度を落として記録した場合も、時刻は動画上の位置で記録するので問題ない

### 7.3 ループ・速度変更（F-PRAC-03, 04）
- A–B ループ: 再生位置が B を超えたら A に戻す。セクションを指定した場合は、同期データからセクションの開始・終了時刻を求める
- 速度変更: YouTube プレーヤーの再生速度機能を使い、プレーヤーが対応する速度だけを選べるようにする

### 7.4 音（F-PRAC-05〜08）
- コード音: tonal で構成音を求め、ギターは chords-db のフォームに沿った音、ピアノは押さえやすい転回形で鳴らす
- メトロノーム・伴奏: Tone.js の時間管理で先読みして予約する（画面の処理が重くてもリズムが崩れない）
- iOS では、ユーザーが画面を一度タップするまで音が出ないので、演奏開始ボタンで音を有効にする

---

## 8. ディレクトリ構成（案）

```
chord/
├ docs/                     要求定義・設計書
├ src/
│ ├ app/                    Next.js の画面とルート
│ │ ├ page.tsx              ライブラリ（曲一覧）
│ │ ├ sheet/ edit/ new/     譜面ビュー・編集・新規（?id= で指定）
│ │ └ import/ import/receive/  取り込みの案内・受け取りページ
│ ├ domain/                 画面・DB から独立したロジック（テストの中心）
│ │ ├ chord/                解釈・移調・カポ・簡単コード
│ │ ├ sheet/                譜面形式・テキスト変換・ChordPro 入出力
│ │ └ sync/                 同期データの照合
│ ├ importers/              取り込みアダプタ（ufret/、gakkime/、generic/）
│ ├ data/                   IndexedDB・同期キュー・Supabase クライアント
│ ├ audio/                  コード音・メトロノーム・伴奏
│ └ components/             UI 部品（ダイアグラム・プレーヤー等）
├ bookmarklet/              ブックマークレットのソース（ビルドして1行にする）
├ supabase/migrations/      DB の定義（SQL）
├ tests/                    Playwright の画面テスト
└ fixtures-local/           保存した取り込み元 HTML（.gitignore 対象）
```

---

## 9. 実装の順番（要求定義 7章のステップ 1-1 の分解）

1. プロジェクト作成（Next.js・TypeScript・Tailwind・Vitest・lint・CI）
2. `domain/chord`: コードの解釈・移調・カポ・表記の決定（テスト先行）
3. `domain/sheet`: 譜面形式、「コード行＋歌詞行」と ChordPro からの変換、ChordPro への書き出し
4. 譜面ビュー: 表示・移調・カポ・文字サイズ・ダーク・演奏モード・自動スクロール・Wake Lock
5. ダイアグラム（ギター・鍵盤）と簡単コード提案
6. 貼り付け取り込みとエディタ（プレビュー付き）
7. 曲一覧（ここまでは端末内保存のみ。同期はステップ 1-2）
8. ブックマークレットと取り込みアダプタ（U-FRET → 楽器.me の順）

---

## 10. 決めておきたいこと

1. **スタックの承認**: 1章の採用案（Next.js ＋ Vercel ＋ Supabase）で進めて良いか
2. **ログイン方法**: Google ログインを想定（Supabase Auth で設定が簡単）。ほかを希望するか
3. **アダプタ開発用の HTML**: 実装のときに、U-FRET と楽器.me の曲ページを手元のブラウザで「ページを保存」したファイルを1〜2曲ぶん用意してもらう必要がある
4. **リポジトリの公開範囲**: 公開リポジトリなら、取り込み元の HTML や歌詞入りのテストデータを置かない運用を徹底する（6.4）
