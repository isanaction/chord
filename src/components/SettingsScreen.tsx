'use client';

import Link from 'next/link';
import { useRef, useState } from 'react';
import { BackupFormatError, exportAll, importAll, parseBackup } from '@/data/backup';
import { currentUserId } from '@/data/repository';
import { requestSync, sendLoginLink, signOut, useSyncStatus } from '@/data/sync/controller';
import { useTheme } from '@/lib/theme';
import { IconBack } from './icons';
import { syncLabel } from './SyncBadge';

export function SettingsScreen() {
  const status = useSyncStatus();
  const [theme, setTheme] = useTheme();
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const login = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setMessage(null);
    try {
      await sendLoginLink(email.trim());
      setMessage(`${email.trim()} にログイン用のリンクを送りました。メールを開いてリンクを押してください。`);
    } catch (err) {
      setMessage(`送信できませんでした：${(err as Error).message}`);
    } finally {
      setBusy(false);
    }
  };

  const download = async () => {
    const backup = await exportAll();
    const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `chord-backup-${backup.exportedAt.slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const upload = async (file: File) => {
    setMessage(null);
    try {
      const result = await importAll(parseBackup(await file.text()), currentUserId());
      setMessage(`読み込みました（追加 ${result.added} 件・更新 ${result.updated} 件・変更なし ${result.skipped} 件）`);
    } catch (err) {
      setMessage(err instanceof BackupFormatError ? err.message : '読み込めませんでした');
    } finally {
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const signedIn = status.kind === 'syncing' || status.kind === 'synced' || status.kind === 'offline' || status.kind === 'error';
  const lastSynced = signedIn && status.lastSyncedAt ? new Date(status.lastSyncedAt).toLocaleString('ja-JP') : null;

  return (
    <main className="mx-auto flex min-h-dvh max-w-2xl flex-col gap-6 bg-bg px-5 pt-[max(16px,env(safe-area-inset-top))] pb-12">
      <header className="flex items-center gap-1">
        <Link href="/" aria-label="ライブラリに戻る" className="-ml-3 flex h-11 w-11 items-center justify-center">
          <IconBack />
        </Link>
        <h1 className="text-xl font-bold">設定</h1>
      </header>

      {message && (
        <p role="status" className="rounded-xl border border-accent-border bg-accent-soft px-4 py-3 text-sm leading-6">
          {message}
        </p>
      )}

      <Section title="同期">
        {status.kind === 'unconfigured' ? (
          <p className="text-sm leading-7 text-text-2">同期先が設定されていないため、譜面はこの端末だけに保存されます。</p>
        ) : signedIn ? (
          <>
            <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
              <dt className="text-text-2">アカウント</dt>
              <dd className="truncate">{status.email}</dd>
              <dt className="text-text-2">状態</dt>
              <dd>{syncLabel(status)}</dd>
              {lastSynced && (
                <>
                  <dt className="text-text-2">最終同期</dt>
                  <dd>{lastSynced}</dd>
                </>
              )}
            </dl>
            <div className="flex gap-2">
              <button
                onClick={() => void requestSync()}
                disabled={status.kind === 'syncing'}
                className="h-10 rounded-[10px] bg-accent-fill px-4 text-sm font-bold text-on-accent disabled:opacity-60"
              >
                今すぐ同期
              </button>
              <button onClick={() => void signOut()} className="h-10 rounded-[10px] border border-line-strong bg-surface-2 px-4 text-sm">
                ログアウト
              </button>
            </div>
          </>
        ) : (
          <form onSubmit={login} className="flex flex-col gap-3">
            <p className="text-sm leading-7 text-text-2">
              ログインすると、PC とスマホで譜面と設定が同期されます。メールに届くリンクを押すとログインできます。
              この端末に保存済みの譜面も、ログインしたアカウントに引き継がれます。
            </p>
            <label htmlFor="login-email" className="text-xs text-text-2">
              メールアドレス
            </label>
            <input
              id="login-email"
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="h-11 rounded-lg border border-line-strong bg-bg px-3 text-[15px] outline-none focus:border-accent"
            />
            <button
              type="submit"
              disabled={busy}
              className="h-11 self-start rounded-[10px] bg-accent-fill px-5 text-sm font-bold text-on-accent disabled:opacity-60"
            >
              ログイン用のリンクを送る
            </button>
          </form>
        )}
      </Section>

      <Section title="データ">
        <p className="text-sm leading-7 text-text-2">すべての譜面と設定を JSON で書き出せます。バックアップや別の端末への移動に使えます。</p>
        <div className="flex flex-wrap gap-2">
          <button onClick={() => void download()} className="h-10 rounded-[10px] border border-line-strong bg-surface-2 px-4 text-sm">
            すべて書き出す
          </button>
          <label className="flex h-10 cursor-pointer items-center rounded-[10px] border border-line-strong bg-surface-2 px-4 text-sm">
            書き出したファイルを読み込む
            <input
              ref={fileRef}
              type="file"
              accept="application/json,.json"
              className="sr-only"
              onChange={(e) => e.target.files?.[0] && void upload(e.target.files[0])}
            />
          </label>
        </div>
      </Section>

      <Section title="表示">
        <div className="flex items-center justify-between">
          <span className="text-sm">明るい配色</span>
          <button
            role="switch"
            aria-checked={theme === 'light'}
            aria-label="明るい配色"
            onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}
            className={`relative h-8 w-[52px] rounded-full ${theme === 'light' ? 'bg-accent-fill' : 'bg-line-strong'}`}
          >
            <span
              className={`absolute top-[3px] h-[26px] w-[26px] rounded-full ${theme === 'light' ? 'left-[23px] bg-on-accent' : 'left-[3px] bg-text'}`}
            />
          </button>
        </div>
      </Section>

      <Section title="取り込み">
        <Link href="/import" className="text-sm text-accent underline">
          Web ページから取り込む方法（ブックマークレット）
        </Link>
      </Section>
    </main>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section aria-label={title} className="flex flex-col gap-3 rounded-[14px] border border-line bg-surface p-5">
      <h2 className="font-bold">{title}</h2>
      {children}
    </section>
  );
}
