import { describe, expect, it } from 'vitest';
import { formatChord, isParsed, normalizeQuality, parseChord, simplifyQuality } from './chord';
import { evaluateCapos, findGuitarShape, suggestCapo } from './guitar';
import { chordPitchClasses } from './notes';
import { keyPrefersFlats, keyToName, parseKey, transposeKey } from './pitch';

describe('parseChord', () => {
  it.each([
    ['C', 0, '', undefined],
    ['F#m7', 6, 'm7', undefined],
    ['B♭maj7', 10, 'maj7', undefined],
    ['G/B', 7, '', 11],
    ['C(onE)', 0, '', 4],
    ['ConE', 0, '', 4],
    ['Cadd9(onE)', 0, 'add9', 4],
    ['C#m7-5', 1, 'm7-5', undefined],
    ['E7(9)', 4, '7(9)', undefined],
    ['C6/9', 0, '6/9', undefined],
    ['Dsus4', 2, 'sus4', undefined],
  ])('%s', (raw, root, quality, bass) => {
    const t = parseChord(raw);
    expect(isParsed(t)).toBe(true);
    if (!isParsed(t)) return;
    expect(t.root.pc).toBe(root);
    expect(t.quality).toBe(quality);
    expect(t.bass?.pc).toBe(bass);
    expect(t.raw).toBe(raw);
  });

  it('N.C. は「コードなし」として扱う', () => {
    expect(parseChord('N.C.')).toEqual({ raw: 'N.C.', noChord: true });
  });

  it('解釈できない文字列は元の表記を残す', () => {
    expect(parseChord('サビ')).toEqual({ raw: 'サビ', unparsed: true });
    expect(parseChord('Cxyz')).toEqual({ raw: 'Cxyz', unparsed: true });
  });
});

describe('normalizeQuality / simplifyQuality', () => {
  it.each([
    ['M7', 'maj7'],
    ['△7', 'maj7'],
    ['mM7', 'mmaj7'],
    ['m7-5', 'm7b5'],
    ['7(9)', '9'],
    ['m7(11)', 'm11'],
    ['+', 'aug'],
    ['min', 'm'],
  ])('%s → %s', (q, expected) => expect(normalizeQuality(q)).toBe(expected));

  it.each([
    ['add9', ''],
    ['m9', 'm7'],
    ['7(13)', '7'],
    ['M7', 'maj7'],
    ['sus4', 'sus4'],
    ['m7-5', 'm7b5'],
  ])('simplify %s → %s', (q, expected) => expect(simplifyQuality(q)).toBe(expected));
});

describe('formatChord', () => {
  it('ずらし量 0 なら元の表記のまま', () => {
    expect(formatChord(parseChord('C(onE)'), { shift: 0, preferFlats: false })).toBe('C(onE)');
  });

  it('移調すると表記をキーに合わせる', () => {
    expect(formatChord(parseChord('G/B'), { shift: 1, preferFlats: true })).toBe('Ab/C');
    expect(formatChord(parseChord('G/B'), { shift: 1, preferFlats: false })).toBe('G#/C');
    expect(formatChord(parseChord('C(onE)'), { shift: 2, preferFlats: false })).toBe('D/F#');
  });

  it('カポ分は下にずらす（キー A・カポ 2 → G の形）', () => {
    expect(formatChord(parseChord('A'), { shift: -2, preferFlats: false })).toBe('G');
    expect(formatChord(parseChord('C#m'), { shift: -2, preferFlats: false })).toBe('Bm');
  });

  it('テンションを省いて表示できる', () => {
    expect(formatChord(parseChord('Cadd9'), { shift: 0, preferFlats: false, simplify: true })).toBe('C');
  });
});

describe('キー', () => {
  it('♭系のキーを判定する', () => {
    expect(keyPrefersFlats(parseKey('F')!)).toBe(true);
    expect(keyPrefersFlats(parseKey('Dm')!)).toBe(true);
    expect(keyPrefersFlats(parseKey('E')!)).toBe(false);
    expect(keyPrefersFlats(parseKey('C#m')!)).toBe(false);
  });

  it('移調したキー名', () => {
    expect(keyToName(transposeKey(parseKey('A')!, -2))).toBe('G');
    expect(keyToName(transposeKey(parseKey('A')!, 1))).toBe('Bb');
    expect(keyToName(transposeKey(parseKey('Em')!, 1))).toBe('Fm');
  });
});

describe('ギターの押さえ方と簡単コード', () => {
  it('押さえ方を見つける', () => {
    expect(findGuitarShape(0, '')?.frets).toEqual([-1, 3, 2, 0, 1, 0]);
    expect(findGuitarShape(5, '')?.barres.length).toBeGreaterThan(0);
    expect(findGuitarShape(0, 'add9')).not.toBeNull();
  });

  it('キー A の曲はカポ 2（G の形）が弾きやすい', () => {
    const tokens = ['A', 'E/G#', 'F#m', 'D', 'A', 'E', 'Bm', 'C#m', 'D', 'E', 'A'].map(parseChord);
    const best = suggestCapo(tokens, 0);
    expect(best.capo).toBe(2);
    const capo0 = evaluateCapos(tokens, 0)[0];
    expect(capo0.hardChords.length).toBeGreaterThan(best.hardChords.length);
  });

  it('開放弦で弾ける曲はカポなしを提案する', () => {
    const tokens = ['G', 'C', 'D', 'Em', 'G'].map(parseChord);
    expect(suggestCapo(tokens, 0).capo).toBe(0);
  });
});

describe('構成音', () => {
  it.each([
    [0, '', [0, 4, 7]],
    [9, 'm7', [9, 0, 4, 7]],
    [7, '7', [7, 11, 2, 5]],
    [1, 'm7-5', [1, 4, 7, 11]],
    [0, 'M7', [0, 4, 7, 11]],
  ])('%i %s', (root, q, expected) => expect(chordPitchClasses(root, q)).toEqual(expected));
});
