'use client';

import { useEffect, useRef } from 'react';
import type { Instrument } from '@/data/db';
import type { CapoOption } from '@/domain/chord/guitar';
import { pcToName } from '@/domain/chord/pitch';
import { useTheme } from '@/lib/theme';
import { IconCheck, IconClose, IconMinus, IconPlus } from './icons';

type Props = {
  open: boolean;
  onClose: () => void;
  transpose: number;
  capo: number;
  instrument: Instrument;
  simplify: boolean;
  fontScale: number;
  soundingKeyLabel: string | null;
  originalKeyLabel: string | null;
  shapeKeyLabel: string | null;
  capoOptions: CapoOption[];
  suggestion: CapoOption;
  preferFlats: boolean;
  onChange: (patch: Partial<{ transpose: number; capo: number; instrument: Instrument; simplify: boolean; fontScale: number }>) => void;
};

/** キーと表示の設定（下から出るパネル） */
export function SettingsSheet(p: Props) {
  const [theme, setTheme] = useTheme();
  const closeRef = useRef<HTMLButtonElement>(null);

  const { open, onClose } = p;
  useEffect(() => {
    if (!open) return;
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!p.open) return null;

  const transposeText = p.transpose === 0 ? '±0' : p.transpose > 0 ? `+${p.transpose}` : String(p.transpose);
  const hardAt = (capo: number) => p.capoOptions[capo]?.hardChords ?? [];
  const current = hardAt(p.capo);
  const atZero = hardAt(0);
  const hardNames = (o: CapoOption['hardChords']) => o.map((c) => pcToName(c.rootPc, p.preferFlats) + c.quality).join('・');

  return (
    <div className="fixed inset-0 z-40 flex flex-col justify-end">
      {/* 背景のタップでも閉じられる（キーボードでは Esc と閉じるボタン） */}
      <div aria-hidden="true" className="absolute inset-0 bg-scrim" onClick={p.onClose} />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="settings-title"
        className="relative mx-auto flex max-h-[88dvh] w-full max-w-lg flex-col gap-5 overflow-y-auto rounded-t-[22px] border-t border-line bg-surface px-5 pt-2 pb-[max(24px,env(safe-area-inset-bottom))]"
      >
        <div className="mx-auto h-1 w-10 rounded-full bg-line-strong" />
        <div className="flex items-center justify-between">
          <h2 id="settings-title" className="text-lg font-bold">
            キーと表示
          </h2>
          <button ref={closeRef} aria-label="閉じる" onClick={p.onClose} className="-mr-2.5 flex h-11 w-11 items-center justify-center text-text-2">
            <IconClose size={20} />
          </button>
        </div>

        <div className="flex items-center justify-between">
          <div className="flex flex-col gap-0.5">
            <span className="text-sm font-medium">移調</span>
            <span className="text-xs text-text-2">
              {p.transpose === 0
                ? p.originalKeyLabel
                  ? `原曲キー ${p.originalKeyLabel} のまま`
                  : '原曲のまま'
                : p.originalKeyLabel
                  ? `キー ${p.originalKeyLabel} → ${p.soundingKeyLabel}`
                  : `${transposeText} 半音`}
            </span>
          </div>
          <div className="flex items-center gap-1 rounded-[14px] border border-line bg-bg p-[3px]">
            <button
              aria-label="半音下げる"
              onClick={() => p.onChange({ transpose: Math.max(-11, p.transpose - 1) })}
              className="flex h-10 w-11 items-center justify-center rounded-[11px] bg-surface-2"
            >
              <IconMinus size={18} />
            </button>
            <output aria-live="polite" className="w-12 text-center font-chord text-xl font-semibold">
              {transposeText}
            </output>
            <button
              aria-label="半音上げる"
              onClick={() => p.onChange({ transpose: Math.min(11, p.transpose + 1) })}
              className="flex h-10 w-11 items-center justify-center rounded-[11px] bg-surface-2"
            >
              <IconPlus size={18} />
            </button>
          </div>
        </div>

        <fieldset className="flex flex-col gap-2.5">
          <div className="flex items-baseline justify-between">
            <legend className="text-sm font-medium">カポ</legend>
            {p.capo > 0 && p.shapeKeyLabel && p.soundingKeyLabel && (
              <span className="text-xs text-text-2">
                {p.shapeKeyLabel} の形で弾く（音はキー {p.soundingKeyLabel}）
              </span>
            )}
          </div>
          <div className="grid grid-cols-8 gap-1">
            {Array.from({ length: 8 }, (_, i) => (
              <button
                key={i}
                aria-label={`カポ ${i}`}
                aria-pressed={p.capo === i}
                onClick={() => p.onChange({ capo: i })}
                className={`h-11 rounded-[10px] border font-chord text-[17px] font-semibold ${
                  p.capo === i ? 'border-accent-fill bg-accent-fill text-on-accent' : 'border-line bg-bg'
                }`}
              >
                {i}
              </button>
            ))}
          </div>
        </fieldset>

        <div className="flex flex-col gap-2.5 rounded-[14px] border border-accent-border bg-accent-soft px-4 py-3.5">
          {p.suggestion.capo === p.capo ? (
            <>
              <div className="flex items-center gap-2 text-[13px] font-bold text-accent">
                <IconCheck size={16} />
                {p.capo === 0 ? '簡単コード：カポなしが最も弾きやすい形です' : `簡単コード：カポ ${p.capo} を適用中`}
              </div>
              {p.capo !== 0 && (
                <p className="text-[13px] leading-5">
                  押さえにくいコードが <Num>{atZero.length}</Num> → <Num>{current.length}</Num> に減ります。
                </p>
              )}
            </>
          ) : (
            <>
              <div className="text-[13px] font-bold text-accent">簡単コードの提案</div>
              <p className="text-[13px] leading-5">
                カポ {p.suggestion.capo} にすると、押さえにくいコードが <Num>{current.length}</Num> →{' '}
                <Num>{p.suggestion.hardChords.length}</Num> に減ります。
              </p>
              <button
                onClick={() => p.onChange({ capo: p.suggestion.capo })}
                className="h-10 self-start rounded-[10px] bg-accent-fill px-4 text-sm font-bold text-on-accent"
              >
                カポ {p.suggestion.capo} にする
              </button>
            </>
          )}
          {current.length > 0 && <p className="text-xs text-text-2">いまの押さえにくいコード：{hardNames(current)}</p>}
        </div>

        <fieldset className="flex flex-col gap-2.5">
          <legend className="pb-2.5 text-sm font-medium">コード図</legend>
          <div className="grid grid-cols-2 gap-1 rounded-[14px] border border-line bg-bg p-[3px]">
            {(['guitar', 'piano'] as const).map((inst) => (
              <button
                key={inst}
                aria-pressed={p.instrument === inst}
                onClick={() => p.onChange({ instrument: inst })}
                className={`h-10 rounded-[11px] text-sm ${p.instrument === inst ? 'bg-text font-medium text-bg' : 'text-text-2'}`}
              >
                {inst === 'guitar' ? 'ギター' : 'ピアノ'}
              </button>
            ))}
          </div>
        </fieldset>

        <div className="flex flex-col">
          <Toggle label="テンションを省いて表示" checked={p.simplify} onChange={(v) => p.onChange({ simplify: v })} />
          <Toggle label="明るい配色" checked={theme === 'light'} onChange={(v) => setTheme(v ? 'light' : 'dark')} />
          <div className="flex min-h-12 items-center justify-between gap-4 border-t border-line">
            <label htmlFor="font-scale" className="text-sm whitespace-nowrap">
              文字サイズ
            </label>
            <div className="flex grow items-center gap-2.5 text-text-2">
              <span className="text-xs">A</span>
              <input
                id="font-scale"
                type="range"
                min={80}
                max={180}
                step={5}
                value={Math.round(p.fontScale * 100)}
                onChange={(e) => p.onChange({ fontScale: Number(e.target.value) / 100 })}
                className="grow accent-[var(--accent-fill)]"
              />
              <span className="text-lg">A</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Num({ children }: { children: React.ReactNode }) {
  return <span className="font-chord text-base font-semibold">{children}</span>;
}

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex min-h-12 items-center justify-between border-t border-line">
      <span className="text-sm">{label}</span>
      <button
        role="switch"
        aria-checked={checked}
        aria-label={label}
        onClick={() => onChange(!checked)}
        className={`relative h-8 w-[52px] rounded-full transition-colors ${checked ? 'bg-accent-fill' : 'bg-line-strong'}`}
      >
        <span
          className={`absolute top-[3px] h-[26px] w-[26px] rounded-full transition-all ${checked ? 'left-[23px] bg-on-accent' : 'left-[3px] bg-text'}`}
        />
      </button>
    </div>
  );
}
