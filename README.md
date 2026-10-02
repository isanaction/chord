# Chord

自分用のコード譜・練習アプリ（MVP）。U-FRET・楽器.me の代わりに、広告なしで譜面を見て練習するための Web アプリです。

- 要求定義: [docs/requirements.md](docs/requirements.md)
- 基本設計: [docs/design.md](docs/design.md)

## できること（ステップ 1-1）

- コード譜テキストの貼り付け取り込み（「コード行＋歌詞行」と ChordPro を自動判別）
- Web ページからの取り込み（ブックマークレット。`/import` で登録方法を案内）
- 譜面の表示、移調、カポ、簡単コード（弾きやすいカポ位置の提案）、テンション省略表示
- ギター／ピアノのコード図、自動スクロール、演奏モード、画面スリープ防止
- ライブラリ（検索・絞り込み）、編集（版を積み上げて保存）、明るい／暗い配色

データは端末内（IndexedDB）に保存します。端末間の同期はステップ 1-2 で追加します。

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
