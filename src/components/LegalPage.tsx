import Link from 'next/link';
import { SELLER } from '@/lib/seller';
import { IconBack } from './icons';

/** 利用規約・プライバシーポリシー・特定商取引法に基づく表記の共通の枠 */
export function LegalPage({ title, children }: { title: string; children: React.ReactNode }) {
  const draft = Object.values(SELLER).some((v) => v.includes('【'));
  return (
    <main className="mx-auto flex min-h-dvh max-w-2xl flex-col gap-6 bg-bg px-5 pt-[max(16px,env(safe-area-inset-top))] pb-12">
      <header className="flex items-center gap-1">
        <Link href="/settings" aria-label="設定に戻る" className="-ml-3 flex h-11 w-11 items-center justify-center">
          <IconBack />
        </Link>
        <h1 className="text-xl font-bold">{title}</h1>
      </header>
      {draft && (
        <p role="note" className="rounded-xl border border-accent-border bg-accent-soft px-4 py-3 text-sm leading-6">
          準備中の内容です。有料プランの提供を始める前に確定します。
        </p>
      )}
      <div className="flex flex-col gap-6 text-sm leading-7 [&_h2]:mb-1 [&_h2]:text-base [&_h2]:font-bold [&_li]:ml-5 [&_li]:list-disc [&_ol>li]:list-decimal">
        {children}
      </div>
      <nav aria-label="規約類" className="flex flex-wrap gap-x-4 gap-y-1 border-t border-line pt-4 text-xs text-text-2">
        <Link href="/terms" className="underline">
          利用規約
        </Link>
        <Link href="/privacy" className="underline">
          プライバシーポリシー
        </Link>
        <Link href="/legal" className="underline">
          特定商取引法に基づく表記
        </Link>
        <Link href="/pricing" className="underline">
          料金プラン
        </Link>
      </nav>
    </main>
  );
}

/** 見出しと本文の組 */
export function Clause({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2>{title}</h2>
      {children}
    </section>
  );
}
