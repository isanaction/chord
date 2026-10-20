'use client';

import { useEffect, useRef, useState } from 'react';
import { Metronome } from '@/audio/engine';
import { beatsPerBar, clampBpm, MAX_BPM, MIN_BPM } from '@/domain/sync/meter';
import { IconClose, IconMinus, IconPlus } from '../icons';

/** メトロノーム（F-PRAC-06）。曲の BPM と拍子を初期値にする */
export function MetronomeBar({ initialBpm, timeSignature, onClose }: { initialBpm?: number; timeSignature: string; onClose: () => void }) {
  const [bpm, setBpm] = useState(() => clampBpm(initialBpm ?? 100));
  const [running, setRunning] = useState(false);
  const [beat, setBeat] = useState<number | null>(null);
  const perBar = beatsPerBar(timeSignature);
  const metronome = useRef<Metronome | null>(null);

  useEffect(() => {
    const m = new Metronome((index) => setBeat(index % perBar));
    metronome.current = m;
    return () => m.stop();
  }, [perBar]);

  useEffect(() => {
    metronome.current?.update(bpm, perBar);
  }, [bpm, perBar]);

  const toggle = () => {
    const m = metronome.current;
    if (!m) return;
    if (m.running) {
      m.stop();
      setRunning(false);
      setBeat(null);
    } else {
      // iOS では利用者の操作の中で音を有効にする必要がある
      m.play(bpm, perBar);
      setRunning(true);
    }
  };

  const change = (delta: number) => setBpm((b) => clampBpm(b + delta));

  return (
    <div role="group" aria-label="メトロノーム" className="flex shrink-0 items-center gap-2 border-t border-line bg-surface px-4 py-2">
      <button aria-label="テンポを下げる" disabled={bpm <= MIN_BPM} onClick={() => change(-1)} className="flex h-10 w-10 items-center justify-center rounded-xl border border-line disabled:opacity-35">
        <IconMinus size={18} />
      </button>
      <div className="flex min-w-16 flex-col items-center">
        <span className="font-chord text-lg leading-5 font-semibold" aria-live="polite">
          {bpm}
        </span>
        <span className="text-[10px] text-text-2">BPM・{perBar}拍子</span>
      </div>
      <button aria-label="テンポを上げる" disabled={bpm >= MAX_BPM} onClick={() => change(1)} className="flex h-10 w-10 items-center justify-center rounded-xl border border-line disabled:opacity-35">
        <IconPlus size={18} />
      </button>
      <div aria-hidden="true" className="flex grow justify-center gap-1.5">
        {Array.from({ length: perBar }, (_, i) => (
          <span
            key={i}
            className={`h-2.5 w-2.5 rounded-full ${beat === i ? (i === 0 ? 'bg-accent-fill' : 'bg-text') : 'bg-line-strong'}`}
          />
        ))}
      </div>
      <button
        onClick={toggle}
        className={`h-10 rounded-xl px-4 text-sm font-semibold ${running ? 'border border-line' : 'bg-accent-fill text-on-accent'}`}
      >
        {running ? '止める' : '鳴らす'}
      </button>
      <button aria-label="メトロノームを閉じる" onClick={onClose} className="flex h-10 w-10 items-center justify-center text-text-2">
        <IconClose size={18} />
      </button>
    </div>
  );
}
