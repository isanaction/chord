'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { interpretPayload, isImportPayload } from '@/importers/registry';
import type { ImportCandidate } from '@/importers/types';
import { EditorScreen } from './EditorScreen';

type State = { kind: 'waiting' } | { kind: 'error'; message: string } | { kind: 'ready'; candidate: ImportCandidate; at: number };

/** ブックマークレットから開かれ、取り込み元ページの内容を受け取る（設計書 6.1 ③④） */
export function ImportReceiver() {
  const [state, setState] = useState<State>({ kind: 'waiting' });

  useEffect(() => {
    const opener = window.opener as Window | null;
    let done = false;
    const fail = (message: string) => {
      done = true;
      setState({ kind: 'error', message });
    };
    const onMessage = (e: MessageEvent) => {
      if (done || e.source !== opener || !isImportPayload(e.data)) return;
      // HTML は DOMParser で解析するだけ（スクリプトは実行されず、画面にも差し込まない）
      const outcome = interpretPayload(e.origin, e.data, (html) => new DOMParser().parseFromString(html, 'text/html'));
      done = true;
      if (outcome.ok) setState({ kind: 'ready', candidate: outcome.candidate, at: Date.now() });
      else setState({ kind: 'error', message: outcome.reason });
    };
    window.addEventListener('message', onMessage);
    const timer = window.setTimeout(() => {
      if (!done) fail('取り込み元のページからデータが届きませんでした。ブックマークレットから開き直してください。');
    }, 10_000);
    if (opener) {
      // 準備ができたことだけを伝える（データは含まない）
      opener.postMessage({ type: 'chord-import-ready' }, '*');
    } else {
      window.setTimeout(() => fail('このページはブックマークレットから開いてください。'), 0);
    }
    return () => {
      window.removeEventListener('message', onMessage);
      window.clearTimeout(timer);
    };
  }, []);

  if (state.kind === 'ready') {
    const c = state.candidate;
    return (
      <EditorScreen
        initial={{
          text: c.text,
          meta: { title: c.title, artist: c.artist },
          source: { url: c.url, site: c.site, siteName: c.siteName, importedAt: state.at },
        }}
      />
    );
  }

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-4 p-6 text-center">
      {state.kind === 'waiting' ? (
        <p aria-live="polite" className="text-text-2">
          取り込み元のページから読み込んでいます…
        </p>
      ) : (
        <>
          <p role="alert" className="max-w-md leading-7">
            {state.message}
          </p>
          <Link href="/import" className="text-accent underline">
            取り込み方を見る
          </Link>
        </>
      )}
    </main>
  );
}
