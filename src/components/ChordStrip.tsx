import type { Instrument } from '@/data/db';
import type { ParsedChord } from '@/domain/chord/chord';
import { mod12 } from '@/domain/chord/pitch';
import { GuitarDiagram, PianoDiagram } from './ChordDiagram';

type Item = { name: string; token: ParsedChord; rootPc: number };

/** 曲に出てくるコードの図を横に並べる（F-VIEW-02） */
export function ChordStrip({
  chords,
  instrument,
  shift,
  onPlay,
}: {
  chords: Item[];
  instrument: Instrument;
  shift: number;
  /** 押すとコードを鳴らす（F-PRAC-05） */
  onPlay?: (token: ParsedChord) => void;
}) {
  if (chords.length === 0) return null;
  return (
    <ul aria-label="この曲のコード" className="flex shrink-0 gap-2 overflow-x-auto border-t border-line bg-bg px-4 py-2.5 [scrollbar-width:none]">
      {chords.map((c) => (
        <li key={c.name} className="shrink-0">
          <button
            aria-label={`${c.name} を鳴らす`}
            onClick={() => onPlay?.(c.token)}
            className="flex flex-col items-center gap-1 rounded-xl border border-line bg-surface px-1.5 pt-1.5 pb-1.5 active:bg-surface-2"
          >
          <span className="font-chord text-sm leading-4 font-semibold">{c.name}</span>
          {instrument === 'guitar' ? (
            <GuitarDiagram rootPc={c.rootPc} quality={c.token.quality} />
          ) : (
            <PianoDiagram
              rootPc={c.rootPc}
              quality={c.token.quality}
              bassPc={c.token.bass ? mod12(c.token.bass.pc + shift) : undefined}
            />
          )}
          </button>
        </li>
      ))}
    </ul>
  );
}
