'use client';

import { useLiveQuery } from 'dexie-react-hooks';
import Link from 'next/link';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { UserSheetSettings } from '@/data/db';
import { getSettings, getSheetDetail, saveSettings } from '@/data/repository';
import { evaluateCapos, suggestCapo } from '@/domain/chord/guitar';
import { parseKey } from '@/domain/chord/pitch';
import { displayContext, keyLabel, uniqueDisplayChords } from '@/domain/sheet/display';
import { collectChords } from '@/domain/sheet/serialize';
import { useAutoScroll, useWakeLock } from '@/lib/hooks';
import { ChordStrip } from './ChordStrip';
import { IconBack, IconEdit, IconExpand, IconFaster, IconPause, IconPlay, IconSliders, IconSlower } from './icons';
import { SettingsSheet } from './SettingsSheet';
import { SheetView } from './SheetView';

// 自動スクロールの速さ（px/秒）の段階
const SPEEDS = [6, 9, 12, 16, 20, 24, 30, 36, 44, 54, 66, 80];
const BASE_SPEED = 24;

type Patch = Partial<Omit<UserSheetSettings, 'userId' | 'sheetId'>>;

export function SheetScreen({ id }: { id: string }) {
  const detail = useLiveQuery(() => getSheetDetail(id), [id]);
  const [settings, setSettings] = useState<UserSheetSettings | null>(null);
  const [playing, setPlaying] = useState(false);
  const [started, setStarted] = useState(false);
  const [stageMode, setStageMode] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let alive = true;
    getSettings(id).then((s) => alive && setSettings(s));
    void saveSettings(id, { lastOpenedAt: Date.now() });
    return () => {
      alive = false;
    };
  }, [id]);

  const update = useCallback(
    (patch: Patch) => {
      setSettings((s) => (s ? { ...s, ...patch } : s));
      void saveSettings(id, patch);
    },
    [id],
  );

  useWakeLock(Boolean(detail));
  useAutoScroll(scrollRef, playing, settings?.scrollSpeed ?? BASE_SPEED, () => setPlaying(false));

  const view = useMemo(() => {
    if (!detail || !settings) return null;
    const body = detail.revision.body;
    const capo = settings.capo ?? detail.sheet.capo;
    const ctx = displayContext(body, {
      originalKey: detail.sheet.originalKey,
      transpose: settings.transpose,
      capo,
      simplify: settings.simplify,
    });
    const tokens = collectChords(body);
    return {
      body,
      capo,
      ctx,
      chords: uniqueDisplayChords(body, ctx),
      capoOptions: evaluateCapos(tokens, settings.transpose),
      suggestion: suggestCapo(tokens, settings.transpose),
    };
  }, [detail, settings]);

  const closeSettings = useCallback(() => setSettingsOpen(false), []);

  if (detail === null) {
    return (
      <main className="flex h-dvh flex-col items-center justify-center gap-4 p-6 text-center">
        <p>この譜面は見つかりませんでした。</p>
        <Link href="/" className="text-accent underline">
          ライブラリに戻る
        </Link>
      </main>
    );
  }
  if (!detail || !settings || !view) return <main className="h-dvh bg-bg" aria-busy="true" />;

  const speed = settings.scrollSpeed;
  const speedIndex = nearestIndex(SPEEDS, speed);
  const togglePlay = () => {
    setStarted(true);
    setPlaying((p) => !p);
  };
  const soundingKey = keyLabel(view.ctx.soundingKey);
  const shapeKey = keyLabel(view.ctx.shapeKey);
  const originalKey = keyLabel(parseKey(detail.sheet.originalKey));

  return (
    <main className="flex h-dvh flex-col overflow-hidden bg-bg">
      {!stageMode && (
        <>
          <header className="flex h-14 shrink-0 items-center gap-1 px-1.5 pt-[env(safe-area-inset-top)]">
            <Link href="/" aria-label="ライブラリに戻る" className="flex h-11 w-11 items-center justify-center rounded-xl">
              <IconBack />
            </Link>
            <div className="flex min-w-0 grow flex-col">
              <h1 className="truncate text-base leading-[22px] font-bold">{detail.song.title}</h1>
              {detail.song.artist && <p className="truncate text-xs leading-4 text-text-2">{detail.song.artist}</p>}
            </div>
            <Link href={`/edit?id=${id}`} aria-label="譜面を編集" className="flex h-11 w-11 items-center justify-center rounded-xl">
              <IconEdit size={20} />
            </Link>
            <button aria-label="キーと表示の設定" onClick={() => setSettingsOpen(true)} className="flex h-11 w-11 items-center justify-center rounded-xl">
              <IconSliders />
            </button>
          </header>

          <div className="flex shrink-0 flex-wrap gap-2 px-4 pt-1 pb-2.5">
            <Chip onClick={() => setSettingsOpen(true)}>
              {soundingKey ? `キー ${soundingKey}` : 'キー未設定'}
              {settings.transpose !== 0 && originalKey ? `（原曲 ${originalKey}）` : ''}
            </Chip>
            <Chip accent={view.capo > 0} onClick={() => setSettingsOpen(true)}>
              {view.capo === 0 ? 'カポなし' : `カポ ${view.capo}${shapeKey ? `（${shapeKey} の形）` : ''}`}
            </Chip>
            <Chip onClick={() => setSettingsOpen(true)}>{settings.instrument === 'guitar' ? 'ギター' : 'ピアノ'}</Chip>
            {started && <Chip>スクロール ×{(speed / BASE_SPEED).toFixed(1)}</Chip>}
          </div>
        </>
      )}

      <div
        ref={scrollRef}
        onClick={() => started && togglePlay()}
        className={`min-h-0 grow overflow-y-auto px-2.5 ${stageMode ? 'pt-[max(16px,env(safe-area-inset-top))]' : 'pt-1'} pb-[40dvh]`}
      >
        <SheetView body={view.body} format={view.ctx.format} scale={settings.fontScale} />
      </div>

      {stageMode ? (
        <button
          onClick={() => setStageMode(false)}
          className="fixed top-[max(12px,env(safe-area-inset-top))] right-3 h-11 rounded-full border border-line bg-surface/90 px-4 text-sm"
        >
          演奏モードを終了
        </button>
      ) : (
        <>
          <ChordStrip chords={view.chords} instrument={settings.instrument} shift={view.ctx.shift} />
          <nav
            aria-label="演奏の操作"
            className="flex shrink-0 items-center justify-between border-t border-line bg-surface px-3 pt-2 pb-[max(16px,env(safe-area-inset-bottom))]"
          >
            <BarButton label="遅く" disabled={speedIndex === 0} onClick={() => update({ scrollSpeed: SPEEDS[Math.max(0, speedIndex - 1)] })}>
              <IconSlower />
            </BarButton>
            <BarButton
              label="先頭へ"
              onClick={() => {
                scrollRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
              }}
            >
              <span className="font-chord text-lg leading-[22px] font-semibold">↑</span>
            </BarButton>
            <button
              aria-label={playing ? '自動スクロールを止める' : '自動スクロールを始める'}
              onClick={togglePlay}
              className="flex h-16 w-16 items-center justify-center rounded-full bg-accent-fill text-on-accent"
            >
              {playing ? <IconPause /> : <IconPlay />}
            </button>
            <BarButton
              label="速く"
              disabled={speedIndex === SPEEDS.length - 1}
              onClick={() => update({ scrollSpeed: SPEEDS[Math.min(SPEEDS.length - 1, speedIndex + 1)] })}
            >
              <IconFaster />
            </BarButton>
            <BarButton label="演奏モード" onClick={() => setStageMode(true)}>
              <IconExpand />
            </BarButton>
          </nav>
        </>
      )}

      <SettingsSheet
        open={settingsOpen}
        onClose={closeSettings}
        transpose={settings.transpose}
        capo={view.capo}
        instrument={settings.instrument}
        simplify={settings.simplify}
        fontScale={settings.fontScale}
        originalKeyLabel={originalKey}
        soundingKeyLabel={soundingKey}
        shapeKeyLabel={shapeKey}
        capoOptions={view.capoOptions}
        suggestion={view.suggestion}
        preferFlats={view.ctx.preferFlats}
        onChange={update}
      />
    </main>
  );
}

function nearestIndex(list: number[], value: number): number {
  let best = 0;
  list.forEach((v, i) => {
    if (Math.abs(v - value) < Math.abs(list[best] - value)) best = i;
  });
  return best;
}

function Chip({ children, accent = false, onClick }: { children: React.ReactNode; accent?: boolean; onClick?: () => void }) {
  const cls = `rounded-full border px-2.5 py-[5px] text-xs ${
    accent ? 'border-accent-border bg-accent-soft text-accent' : 'border-line bg-surface'
  }`;
  return onClick ? (
    <button onClick={onClick} className={cls}>
      {children}
    </button>
  ) : (
    <span className={cls}>{children}</span>
  );
}

function BarButton({
  label,
  children,
  onClick,
  disabled,
}: {
  label: string;
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="flex h-14 w-16 flex-col items-center justify-center gap-[3px] rounded-[14px] text-[11px] text-text disabled:opacity-35"
    >
      {children}
      {label}
    </button>
  );
}
