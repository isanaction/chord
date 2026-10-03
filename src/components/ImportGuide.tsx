'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { buildBookmarklet } from '@/importers/bookmarklet';
import { ADAPTERS } from '@/importers/registry';
import { IconBack, IconDownload } from './icons';

/** ブックマークレットの登録方法（F-EDIT-09） */
export function ImportGuide() {
  const linkRef = useRef<HTMLAnchorElement>(null);
  const [code, setCode] = useState('');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const c = buildBookmarklet(window.location.origin);
    // React は javascript: の href を描画しないため、DOM に直接設定する
    linkRef.current?.setAttribute('href', c);
    const id = window.setTimeout(() => setCode(c), 0);
    return () => window.clearTimeout(id);
  }, []);

  const copy = async () => {
    await navigator.clipboard.writeText(code);
    setCopied(true);
  };

  return (
    <main className="mx-auto flex min-h-dvh max-w-2xl flex-col gap-6 bg-bg px-5 pt-[max(16px,env(safe-area-inset-top))] pb-12">
      <header className="flex items-center gap-1">
        <Link href="/" aria-label="ライブラリに戻る" className="-ml-3 flex h-11 w-11 items-center justify-center">
          <IconBack />
        </Link>
        <h1 className="text-xl font-bold">Web ページから取り込む</h1>
      </header>

      <p className="text-sm leading-7 text-text-2">
        コード譜のページを開いた状態でブックマークレットを押すと、その1曲を読み取って確認画面を開きます。
        取り込んだ譜面は自分のライブラリにだけ保存され、公開はできません。
      </p>

      <section aria-labelledby="pc-title" className="flex flex-col gap-3 rounded-[14px] border border-line bg-surface p-5">
        <h2 id="pc-title" className="font-bold">
          PC での登録
        </h2>
        <p className="text-sm leading-7 text-text-2">下のボタンをブックマークバーへドラッグしてください。</p>
        <a
          ref={linkRef}
          onClick={(e) => e.preventDefault()}
          className="flex h-11 items-center gap-2 self-start rounded-xl bg-accent-fill px-5 text-sm font-bold text-on-accent"
        >
          <IconDownload size={18} />
          hikeru に取り込む
        </a>
      </section>

      <section aria-labelledby="sp-title" className="flex flex-col gap-3 rounded-[14px] border border-line bg-surface p-5">
        <h2 id="sp-title" className="font-bold">
          スマホでの登録
        </h2>
        <ol className="list-decimal pl-5 text-sm leading-7 text-text-2">
          <li>このページをブックマークに追加する</li>
          <li>下のボタンでコードをコピーする</li>
          <li>追加したブックマークを編集し、URL をコピーしたコードに置き換える</li>
        </ol>
        <button
          onClick={copy}
          disabled={!code}
          className="h-11 self-start rounded-xl border border-line-strong bg-surface-2 px-5 text-sm disabled:opacity-50"
        >
          {copied ? 'コピーしました' : 'コードをコピー'}
        </button>
      </section>

      <section aria-labelledby="tips-title" className="flex flex-col gap-2">
        <h2 id="tips-title" className="text-sm font-bold">
          うまく読み取れないとき
        </h2>
        <ul className="list-disc pl-5 text-sm leading-7 text-text-2">
          <li>譜面の部分を選択してからブックマークレットを押すと、選んだ範囲だけを読み取ります。</li>
          <li>対応サイト（{ADAPTERS.map((a) => a.siteName).join('・')}）以外では、範囲を選択したときだけ取り込めます。</li>
          <li>対応サイトでは、ページの構造から譜面の部分だけを読み取ります（メニューやおすすめ曲は入りません）。</li>
          <li>ポップアップがブロックされた場合は、そのサイトのポップアップを許可してください。</li>
        </ul>
      </section>
    </main>
  );
}
