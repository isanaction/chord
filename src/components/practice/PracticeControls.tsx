'use client';

import type { RefObject } from 'react';
import { formatTime } from '@/domain/sync/cues';
import { IconFaster, IconPause, IconPlay, IconSlower } from '../icons';
import type { VideoPractice } from './useVideoPractice';
import type { PlayerControl } from './useYouTubePlayer';

/** 動画（公式の埋め込みプレーヤー）。読み込めないときは理由を出す */
export function VideoPanel({ videoRef, player }: { videoRef: RefObject<HTMLDivElement | null>; player: PlayerControl }) {
  return (
    <div className="shrink-0 px-4 pb-2">
      <div className="relative mx-auto aspect-video max-h-[32dvh] w-full max-w-[calc(32dvh*16/9)] overflow-hidden rounded-xl border border-line bg-black">
        <div ref={videoRef} className="absolute inset-0" />
        {(!player.ready || player.error) && (
          <p className="absolute inset-0 flex items-center justify-center p-4 text-center text-sm text-white/80">
            {player.error ?? '動画を読み込んでいます…'}
          </p>
        )}
      </div>
    </div>
  );
}

/** 動画練習の操作（再生・速度・ループ・同期データの記録） */
export function PracticeBar({ practice, onClose }: { practice: VideoPractice; onClose: () => void }) {
  const p = practice;
  const { player } = p;
  const disabled = !player.ready;

  if (p.mode === 'record') {
    return (
      <nav aria-label="同期データの記録" className="shrink-0 border-t border-line bg-surface px-3 pt-2 pb-[max(16px,env(safe-area-inset-bottom))]">
        <div className="flex min-h-8 flex-wrap items-center gap-x-3 gap-y-1 px-1 pb-1.5 text-xs text-text-2">
          <span className="font-chord">{formatTime(p.nowMs)}</span>
          {p.selectedLineId ? (
            <>
              <span>選んだ行 {p.selectedTime ?? '未記録'}</span>
              {p.selectedTime && (
                <button onClick={p.removeSelected} className="text-accent underline">
                  時刻を消す
                </button>
              )}
            </>
          ) : (
            <span>再生しながら、行の歌い出しで「記録」を押す（スペースキーでも可）</span>
          )}
          <span className="ml-auto flex items-center gap-1">
            全体
            <SmallButton label="全体を0.1秒早める" disabled={!p.hasCues} onClick={() => p.nudgeOffset(-100)}>
              −0.1
            </SmallButton>
            <span className="font-chord">{(p.offsetMs / 1000).toFixed(1)}秒</span>
            <SmallButton label="全体を0.1秒遅らせる" disabled={!p.hasCues} onClick={() => p.nudgeOffset(100)}>
              +0.1
            </SmallButton>
          </span>
        </div>
        <div className="flex items-center justify-between">
          <BarButton label="−0.1秒" disabled={!p.selectedTime} onClick={() => p.nudgeSelected(-100)}>
            <span className="font-chord text-base font-semibold">−</span>
          </BarButton>
          <BarButton label="+0.1秒" disabled={!p.selectedTime} onClick={() => p.nudgeSelected(100)}>
            <span className="font-chord text-base font-semibold">+</span>
          </BarButton>
          <button
            aria-label="今の位置を次の行の時刻として記録する"
            disabled={disabled}
            onClick={p.recordNow}
            className="flex h-16 w-16 flex-col items-center justify-center rounded-full bg-accent-fill text-[11px] font-bold text-on-accent disabled:opacity-35"
          >
            <span className="text-xl leading-5">●</span>
            記録
          </button>
          <BarButton label={player.playing ? '止める' : '再生'} disabled={disabled} onClick={p.togglePlay}>
            {player.playing ? <IconPause size={22} /> : <IconPlay size={22} />}
          </BarButton>
          <BarButton label="完了" onClick={() => p.setMode('play')}>
            <span className="text-base font-semibold">✓</span>
          </BarButton>
        </div>
      </nav>
    );
  }

  const loopLabel = p.loop ? `ループ ${p.loop.label}` : p.loopDraftA !== null ? `A ${formatTime(p.loopDraftA)} → B を押す` : null;
  return (
    <nav aria-label="動画練習の操作" className="shrink-0 border-t border-line bg-surface px-3 pt-2 pb-[max(16px,env(safe-area-inset-bottom))]">
      <div className="flex min-h-8 flex-wrap items-center gap-x-3 gap-y-1 px-1 pb-1.5 text-xs text-text-2">
        <span className="font-chord">
          {formatTime(p.nowMs)}
          {player.durationMs ? ` / ${formatTime(player.durationMs)}` : ''}
        </span>
        <span className="font-chord">速度 ×{p.rate}</span>
        {loopLabel && (
          <button onClick={p.clearLoop} className="rounded-full border border-accent-border bg-accent-soft px-2 py-0.5 text-accent" aria-label={`${loopLabel}（押すと解除）`}>
            {loopLabel} ×
          </button>
        )}
        {!p.hasCues && <span>「同期を記録」で、動画に合わせて譜面が進むようになります</span>}
        {p.hasCues && p.untimed > 0 && <span>時刻のない行 {p.untimed}</span>}
        <span className="ml-auto flex gap-3">
          <button onClick={() => p.setMode('record')} disabled={disabled} className="text-accent underline disabled:opacity-35">
            同期を記録
          </button>
          <button onClick={onClose} className="underline">
            動画を閉じる
          </button>
        </span>
      </div>
      <div className="flex items-center justify-between">
        <BarButton label="遅く" disabled={disabled || p.rate <= Math.min(...player.rates)} onClick={() => p.changeRate(-1)}>
          <IconSlower />
        </BarButton>
        <BarButton label="5秒戻る" disabled={disabled} onClick={() => p.skip(-5000)}>
          <span className="font-chord text-lg leading-[22px] font-semibold">↺</span>
        </BarButton>
        <button
          aria-label={player.playing ? '動画を止める' : '動画を再生する'}
          disabled={disabled}
          onClick={p.togglePlay}
          className="flex h-16 w-16 items-center justify-center rounded-full bg-accent-fill text-on-accent disabled:opacity-35"
        >
          {player.playing ? <IconPause /> : <IconPlay />}
        </button>
        <BarButton
          label={p.loop ? 'ループ解除' : p.loopDraftA !== null ? 'B 点' : 'A 点'}
          disabled={disabled}
          onClick={p.stepLoop}
        >
          <span className="font-chord text-base font-semibold">{p.loop ? '×' : p.loopDraftA !== null ? 'B' : 'A'}</span>
        </BarButton>
        <BarButton label="速く" disabled={disabled || p.rate >= Math.max(...player.rates)} onClick={() => p.changeRate(1)}>
          <IconFaster />
        </BarButton>
      </div>
    </nav>
  );
}

export function BarButton({
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

function SmallButton({ label, children, onClick, disabled }: { label: string; children: React.ReactNode; onClick: () => void; disabled?: boolean }) {
  return (
    <button
      aria-label={label}
      onClick={onClick}
      disabled={disabled}
      className="h-7 min-w-9 rounded-lg border border-line px-1.5 font-chord text-text disabled:opacity-35"
    >
      {children}
    </button>
  );
}
