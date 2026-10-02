import { type ChordToken, formatChord, isParsed, type ParsedChord } from '../chord/chord';
import { type Key, keyPrefersFlats, keyToName, mod12, parseKey, transposeKey } from '../chord/pitch';
import { collectChords } from './serialize';
import type { SheetBody } from './types';

export type DisplayOptions = {
  originalKey?: string;
  transpose: number;
  capo: number;
  simplify: boolean;
};

export type DisplayContext = {
  /** 半音単位の表示上のずらし量（移調 − カポ） */
  shift: number;
  preferFlats: boolean;
  /** 実際に鳴る（移調後の）キー */
  soundingKey: Key | null;
  /** カポを付けて押さえる形のキー */
  shapeKey: Key | null;
  format: (token: ChordToken) => string;
};

/** 移調・カポ・シンプル表記の設定から、表示用のコード名の作り方を決める（3.3）。 */
export function displayContext(body: SheetBody, opts: DisplayOptions): DisplayContext {
  const shift = opts.transpose - opts.capo;
  const original = parseKey(opts.originalKey);
  const soundingKey = original ? transposeKey(original, opts.transpose) : null;
  const shapeKey = soundingKey ? transposeKey(soundingKey, -opts.capo) : null;
  const preferFlats = shapeKey ? keyPrefersFlats(shapeKey) : guessPrefersFlats(collectChords(body), shift);
  return {
    shift,
    preferFlats,
    soundingKey,
    shapeKey,
    format: (token) => formatChord(token, { shift, preferFlats, simplify: opts.simplify }),
  };
}

/** キーが分からないときは、元の表記で ♭ と ♯ のどちらが多いかで決める。 */
function guessPrefersFlats(tokens: ChordToken[], shift: number): boolean {
  if (mod12(shift) === 0) {
    let flats = 0;
    let sharps = 0;
    for (const t of tokens.filter(isParsed)) {
      if (/b|♭/.test(t.root.spelling.slice(1))) flats++;
      if (/#|♯/.test(t.root.spelling.slice(1))) sharps++;
    }
    return flats > sharps;
  }
  // 最初のコードを主音の目安にする
  const first = tokens.find(isParsed);
  if (!first) return false;
  return keyPrefersFlats({ tonic: mod12(first.root.pc + shift), minor: /^m(?!aj)/.test(first.quality) });
}

export function keyLabel(key: Key | null): string | null {
  return key ? keyToName(key).replace('b', '♭').replace('#', '♯') : null;
}

/** 表示上の名前ごとに重複を除いたコード（出現順）。コード図の一覧に使う。 */
export function uniqueDisplayChords(body: SheetBody, ctx: DisplayContext): { name: string; token: ParsedChord; rootPc: number }[] {
  const seen = new Map<string, { name: string; token: ParsedChord; rootPc: number }>();
  for (const t of collectChords(body)) {
    if (!isParsed(t)) continue;
    const name = ctx.format(t);
    if (!seen.has(name)) seen.set(name, { name, token: t, rootPc: mod12(t.root.pc + ctx.shift) });
  }
  return [...seen.values()];
}
