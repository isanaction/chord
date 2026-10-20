import { describe, expect, it } from 'vitest';
import { isParsed, parseChord, type ParsedChord } from './chord';
import { chordMidi, midiToHz } from './voicing';

const chord = (s: string): ParsedChord => {
  const t = parseChord(s);
  if (!isParsed(t)) throw new Error(s);
  return t;
};

describe('コード音の音', () => {
  it('ギターは押さえ方の音を鳴らす', () => {
    expect(chordMidi(chord('C'), 0, 'guitar')).toEqual([48, 52, 55, 60, 64]);
  });

  it('移調すると実音が変わる', () => {
    const d = chordMidi(chord('C'), 2, 'guitar');
    expect(new Set(d.map((n) => n % 12))).toEqual(new Set([2, 6, 9]));
  });

  it('分数コードはベース音を一番下に足す', () => {
    const notes = chordMidi(chord('C/B'), 0, 'guitar');
    expect(notes[0] % 12).toBe(11);
    expect(notes[0]).toBeLessThan(notes[1]);
  });

  it('ピアノは左手に根音、右手に構成音', () => {
    expect(chordMidi(chord('Am7'), 0, 'piano')).toEqual([57, 60, 64, 67, 69]);
    expect(chordMidi(chord('C(onE)'), 0, 'piano')[0]).toBe(52);
  });

  it('A4 = 440Hz', () => {
    expect(midiToHz(69)).toBe(440);
    expect(midiToHz(81)).toBeCloseTo(880);
  });
});
