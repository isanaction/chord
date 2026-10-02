'use client';

import Link from 'next/link';
import { type SyncStatus, useSyncStatus } from '@/data/sync/controller';
import { IconSettings } from './icons';

export function syncLabel(s: SyncStatus): string {
  switch (s.kind) {
    case 'unconfigured':
      return 'この端末だけに保存';
    case 'signedOut':
      return '未ログイン（この端末だけに保存）';
    case 'syncing':
      return '同期中…';
    case 'synced':
      return '同期済み';
    case 'offline':
      return 'オフライン（あとで同期）';
    case 'error':
      return s.message;
  }
}

/** ライブラリ右上の設定ボタン。同期の状態を点の色で示す */
export function SyncBadge() {
  const status = useSyncStatus();
  const dot =
    status.kind === 'synced'
      ? 'bg-accent-fill'
      : status.kind === 'error'
        ? 'bg-text'
        : status.kind === 'syncing'
          ? 'bg-accent-fill animate-pulse'
          : 'bg-text-3';
  return (
    <Link
      href="/settings"
      aria-label={`設定（${syncLabel(status)}）`}
      title={syncLabel(status)}
      className="relative flex h-11 w-11 items-center justify-center rounded-full border border-line bg-surface"
    >
      <IconSettings size={20} />
      {status.kind !== 'unconfigured' && (
        <span aria-hidden="true" className={`absolute top-1.5 right-1.5 h-2.5 w-2.5 rounded-full border-2 border-bg ${dot}`} />
      )}
    </Link>
  );
}
