import { describe, expect, it } from 'vitest';
import { parseChord } from '../chord/chord';
import { displayContext, keyLabel, uniqueDisplayChords } from './display';
import { parseSheetText } from './parse';

const body = parseSheetText('[A]あ[E/G#]い[F#m]う[D]え[A]お').body;

describe('displayContext', () => {
  it('キー A・カポ 2 なら G の形で表示する', () => {
    const ctx = displayContext(body, { originalKey: 'A', transpose: 0, capo: 2, simplify: false });
    expect(keyLabel(ctx.soundingKey)).toBe('A');
    expect(keyLabel(ctx.shapeKey)).toBe('G');
    expect(uniqueDisplayChords(body, ctx).map((c) => c.name)).toEqual(['G', 'D/F#', 'Em', 'C']);
  });

  it('移調すると鳴るキーも変わる', () => {
    const ctx = displayContext(body, { originalKey: 'A', transpose: 1, capo: 0, simplify: false });
    expect(keyLabel(ctx.soundingKey)).toBe('B♭');
    expect(ctx.format(parseChord('E/G#'))).toBe('F/A');
  });

  it('キーが分からなくても元の表記から ♭/♯ を推定する', () => {
    const flatBody = parseSheetText('[Bb]あ[Eb]い[F]う').body;
    const ctx = displayContext(flatBody, { transpose: 0, capo: 0, simplify: false });
    expect(ctx.preferFlats).toBe(true);
    expect(ctx.soundingKey).toBeNull();
  });
});
