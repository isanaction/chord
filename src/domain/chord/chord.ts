import { mod12, noteToPc, pcToName } from './pitch';

/** 根音などの音。pc は音高クラス（0=C … 11=B）、spelling は元の表記。 */
export type Pitch = { pc: number; spelling: string };

export type ChordToken =
  | { raw: string; root: Pitch; quality: string; bass?: Pitch }
  | { raw: string; noChord: true }
  | { raw: string; unparsed: true };

export type ParsedChord = Extract<ChordToken, { root: Pitch }>;

export function isParsed(token: ChordToken): token is ParsedChord {
  return 'root' in token;
}

// コードの種類として受け付ける文字列（m, M7, maj7, sus4, add9, dim, aug, -5, (9) など）
const QUALITY_RE = /^(?:maj|min|dim|aug|sus|add|omit|[mM]|[0-9]|[#♯b♭+\-−△ø°o(),]|\/(?=[0-9])|\s)*$/;
const NO_CHORD_RE = /^(?:N\.?C\.?|NC|×|-|%)$/i;

function normalizeAccidentals(s: string): string {
  return s.replace(/♯/g, '#').replace(/♭/g, 'b');
}

/**
 * コード名を解釈する。分数コードは "G/B" のほか、日本でよく使う "C(onE)" "ConE" にも対応する。
 * 解釈できないときも元の文字列を残して返す。
 */
export function parseChord(input: string): ChordToken {
  const raw = input.trim();
  if (NO_CHORD_RE.test(raw)) return { raw, noChord: true };

  const s = normalizeAccidentals(raw).replace(/−/g, '-');
  const head = /^([A-G])([#b]?)/.exec(s);
  if (!head) return { raw, unparsed: true };

  const rootName = head[1] + head[2];
  let rest = s.slice(head[0].length);
  let bassName: string | undefined;

  const onMatch = /\(?on\s*([A-G][#b]?)\)?$/.exec(rest);
  const slashMatch = /\/([A-G][#b]?)$/.exec(rest);
  if (onMatch) {
    bassName = onMatch[1];
    rest = rest.slice(0, onMatch.index);
  } else if (slashMatch) {
    bassName = slashMatch[1];
    rest = rest.slice(0, slashMatch.index);
  }

  if (!QUALITY_RE.test(rest)) return { raw, unparsed: true };

  const root: Pitch = { pc: noteToPc(rootName)!, spelling: rootName };
  const token: ParsedChord = { raw, root, quality: rest };
  if (bassName) token.bass = { pc: noteToPc(bassName)!, spelling: bassName };
  return token;
}

/** 表記ゆれを吸収した、コードの種類の正規形（検索・押さえ方の検索用）。 */
export function normalizeQuality(quality: string): string {
  let q = quality.replace(/\s/g, '');
  q = q.replace(/^min/, 'm');
  q = q.replace(/△7?|Maj7|MAJ7|M7/g, 'maj7').replace(/M(9|11|13)/g, 'maj$1');
  if (q === 'M') q = '';
  q = q.replace(/ø7?/, 'm7b5');
  q = q.replace(/°7|^o7$/, 'dim7').replace(/°|^o$/, 'dim');
  q = q.replace(/-5/g, 'b5').replace(/\+5/g, '#5');
  // 7(9) → 9、m7(11) → m11、maj7(9) → maj9
  const tension = /^(m?)(7|maj7)\((9|11|13)\)$/.exec(q);
  if (tension) q = tension[1] + (tension[2] === 'maj7' ? 'maj' : '') + tension[3];
  q = q.replace(/[(),]/g, '');
  if (q === '+') q = 'aug';
  if (q === '7#5' || q === '+7' || q === 'aug7') q = 'aug7';
  if (q === 'sus') q = 'sus4';
  if (q === 'add2') q = 'add9';
  if (q === '6/9') q = '69';
  return q;
}

/** テンションを省いたシンプルな種類（F-PLAY-06）。 */
export function simplifyQuality(quality: string): string {
  const q = normalizeQuality(quality);
  if (q === 'm7b5' || q.startsWith('dim')) return q.startsWith('dim7') ? 'dim7' : q === 'm7b5' ? 'm7b5' : 'dim';
  if (q.startsWith('aug')) return 'aug';
  const minor = /^m(?!aj)/.test(q);
  const body = minor ? q.slice(1) : q;
  if (/sus4/.test(body) && !/7/.test(body)) return (minor ? 'm' : '') + 'sus4';
  if (/^maj/.test(body)) return (minor ? 'm' : '') + 'maj7';
  if (/^(7|9|11|13)/.test(body)) return (minor ? 'm' : '') + '7';
  if (/^6/.test(body)) return (minor ? 'm' : '') + '6';
  return minor ? 'm' : '';
}

export type FormatOptions = {
  /** 半音単位のずらし量（移調量 − カポ） */
  shift: number;
  /** ♭系で表記するか */
  preferFlats: boolean;
  /** テンションを省くか */
  simplify?: boolean;
};

/** 表示用のコード名を作る。ずらし量 0・シンプル化なしなら元の表記をそのまま返す。 */
export function formatChord(token: ChordToken, opts: FormatOptions): string {
  if (!isParsed(token)) return token.raw;
  const shift = mod12(opts.shift);
  if (shift === 0 && !opts.simplify) return token.raw;

  const name = (p: Pitch) => (shift === 0 ? p.spelling : pcToName(p.pc + shift, opts.preferFlats));
  const quality = opts.simplify ? simplifyQuality(token.quality) : token.quality;
  const bass = token.bass ? '/' + name(token.bass) : '';
  return name(token.root) + quality + bass;
}

/** 表示上の根音（押さえ方・構成音の計算用）。 */
export function shiftedRoot(token: ParsedChord, shift: number): number {
  return mod12(token.root.pc + shift);
}
