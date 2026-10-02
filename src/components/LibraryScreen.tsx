'use client';

import { useLiveQuery } from 'dexie-react-hooks';
import Link from 'next/link';
import { useMemo, useState } from 'react';
import { type LibraryItem, listLibrary } from '@/data/repository';
import { IconDownload, IconPlus, IconSearch } from './icons';
import { SyncBadge } from './SyncBadge';

type Filter = 'all' | 'imported' | 'own';

const FILTERS: { id: Filter; label: string }[] = [
  { id: 'all', label: 'すべて' },
  { id: 'imported', label: '取り込み' },
  { id: 'own', label: '自分で入力' },
];

/** カタカナ→ひらがな・全角英数→半角・小文字にそろえて検索の表記ゆれを吸収する */
export function normalizeForSearch(s: string): string {
  return s
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[ァ-ヶ]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0x60))
    .replace(/\s+/g, '');
}

export function LibraryScreen() {
  const items = useLiveQuery(listLibrary, []);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<Filter>('all');

  const visible = useMemo(() => {
    const q = normalizeForSearch(query);
    return (items ?? []).filter((i) => {
      if (filter === 'imported' && i.sourceKind !== 'web_import') return false;
      if (filter === 'own' && i.sourceKind === 'web_import') return false;
      return !q || normalizeForSearch(i.title + i.artist).includes(q);
    });
  }, [items, query, filter]);

  return (
    <main className="mx-auto flex min-h-dvh max-w-2xl flex-col bg-bg">
      <header className="flex items-center justify-between px-5 pt-[max(20px,env(safe-area-inset-top))] pb-2">
        <h1 className="text-[26px] leading-[34px] font-bold">ライブラリ</h1>
        <div className="flex gap-2">
          <SyncBadge />
          <Link
            href="/new"
            aria-label="曲を追加"
            className="flex h-11 w-11 items-center justify-center rounded-full bg-accent-fill text-on-accent"
          >
            <IconPlus strokeWidth={2.4} />
          </Link>
        </div>
      </header>

      <div className="px-4 pt-2">
        <label className="flex h-[46px] items-center gap-2 rounded-xl border border-line bg-surface px-3.5 text-text-3">
          <IconSearch size={18} />
          <span className="sr-only">曲を検索</span>
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="曲名・アーティストで検索"
            className="min-w-0 grow bg-transparent text-[15px] text-text outline-none placeholder:text-text-3"
          />
        </label>
      </div>

      <div className="flex gap-2 overflow-x-auto px-4 pt-3 pb-1">
        {FILTERS.map((f) => (
          <button
            key={f.id}
            aria-pressed={filter === f.id}
            onClick={() => setFilter(f.id)}
            className={`h-[34px] shrink-0 rounded-full border px-3.5 text-[13px] whitespace-nowrap ${
              filter === f.id ? 'border-accent bg-accent-soft text-accent' : 'border-line bg-surface'
            }`}
          >
            {f.label}
            {f.id === 'all' && items ? ` ${items.length}` : ''}
          </button>
        ))}
      </div>

      {items && items.length === 0 ? (
        <EmptyState />
      ) : (
        <>
          <h2 className="px-5 pt-3.5 pb-1 text-xs font-bold tracking-wider text-text-2">最近弾いた曲</h2>
          <ul className="flex flex-col pb-10">
            {visible.map((item) => (
              <li key={item.sheetId}>
                <SongRow item={item} />
              </li>
            ))}
            {items && visible.length === 0 && <li className="px-5 py-8 text-center text-sm text-text-2">見つかりませんでした</li>}
          </ul>
        </>
      )}
    </main>
  );
}

function SongRow({ item }: { item: LibraryItem }) {
  return (
    <Link href={`/sheet?id=${item.sheetId}`} className="flex items-center gap-3.5 border-b border-surface-2 py-3 pr-4 pl-5">
      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[10px] border border-line bg-surface font-chord text-lg font-bold text-accent">
        {item.key ?? '–'}
      </span>
      <span className="flex min-w-0 grow flex-col gap-[3px]">
        <span className="truncate text-[15px] leading-5 font-medium">{item.title}</span>
        <span className="flex items-center gap-1.5 text-xs leading-4 text-text-2">
          {item.artist && (
            <>
              <span className="truncate">{item.artist}</span>
              <span className="text-text-3">·</span>
            </>
          )}
          <span className="shrink-0">{item.capo > 0 ? `カポ ${item.capo}` : 'カポなし'}</span>
        </span>
        {item.sourceKind === 'web_import' && (
          <span className="self-start rounded bg-surface-2 px-1.5 text-[10px] leading-4 text-text-2">取り込み</span>
        )}
      </span>
      <span className="text-[11px] whitespace-nowrap text-text-3">{relativeDate(item.lastOpenedAt ?? item.updatedAt)}</span>
    </Link>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center gap-4 px-8 pt-16 text-center">
      <p className="text-base font-bold">まだ曲がありません</p>
      <p className="text-sm leading-6 text-text-2">
        コード譜のテキストを貼り付けるか、
        <br />
        開いているコード譜ページから取り込めます。
      </p>
      <div className="flex flex-col gap-2 pt-2">
        <Link href="/new" className="flex h-11 items-center justify-center gap-2 rounded-xl bg-accent-fill px-5 text-sm font-bold text-on-accent">
          <IconPlus size={18} />
          テキストを貼り付けて追加
        </Link>
        <Link href="/import" className="flex h-11 items-center justify-center gap-2 rounded-xl border border-line bg-surface px-5 text-sm">
          <IconDownload size={18} />
          Web ページから取り込む方法
        </Link>
      </div>
    </div>
  );
}

const WEEKDAYS = ['日', '月', '火', '水', '木', '金', '土'];

export function relativeDate(time: number, now = Date.now()): string {
  const d = new Date(time);
  const today = new Date(now);
  const startOf = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const days = Math.round((startOf(today) - startOf(d)) / 86_400_000);
  if (days <= 0) return '今日';
  if (days === 1) return '昨日';
  if (days < 7) return WEEKDAYS[d.getDay()];
  if (days < 14) return '先週';
  return `${d.getMonth() + 1}月${d.getDate()}日`;
}
