import type { ParsedChord } from './chord';
import { findGuitarShape } from './guitar';
import { chordPitchClasses } from './notes';
import { mod12 } from './pitch';

/** 画面やデータ層に依存しないよう、楽器の種類はここで定義する */
export type Instrument = 'guitar' | 'piano';

const C3 = 48;
const C4 = 60;

/**
 * コード音として鳴らす音（MIDI ノート番号、低い順）。F-PRAC-05。
 * 鳴るのは移調後の実音（カポの有無にかかわらず同じ高さ）。
 * ギターは押さえ方（chords-db）の音、ピアノは左手に根音（分数コードはベース音）、右手に構成音。
 */
export function chordMidi(token: ParsedChord, transpose: number, instrument: Instrument): number[] {
  const rootPc = mod12(token.root.pc + transpose);
  const bassPc = token.bass ? mod12(token.bass.pc + transpose) : null;
  if (instrument === 'guitar') {
    const shape = findGuitarShape(rootPc, token.quality);
    if (shape && shape.midi.length > 0) {
      const notes = [...shape.midi].sort((a, b) => a - b);
      if (bassPc === null || mod12(notes[0]) === bassPc) return notes;
      // 分数コードは、いちばん低い音の下にベース音を足す
      let bass = notes[0] - 1;
      while (mod12(bass) !== bassPc) bass--;
      return [bass, ...notes];
    }
  }
  const left = C3 + (bassPc ?? rootPc);
  const right = chordPitchClasses(rootPc, token.quality)
    .map((pc) => C4 + pc)
    .sort((a, b) => a - b);
  return [left, ...right];
}

/** MIDI ノート番号 → 周波数（Hz） */
export function midiToHz(midi: number): number {
  return 440 * 2 ** ((midi - 69) / 12);
}
