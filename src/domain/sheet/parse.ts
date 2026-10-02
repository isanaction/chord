import { type ChordToken, isParsed, parseChord } from '../chord/chord';
import { type IdGen, randomId } from './ids';
import { DEFAULT_LABEL, parseSectionHeading, sectionKindOf } from './sections';
import type { Line, ParseResult, ParseWarning, Section, SectionKind, Segment, SheetBody, SheetMeta } from './types';

/** 譜面テキストを読み取る。ChordPro か「コード行＋歌詞行」かを自動で判別する（F-EDIT-01）。 */
export function parseSheetText(text: string, ids: IdGen = randomId): ParseResult {
  const lines = text.replace(/\r\n?/g, '\n').split('\n');
  return detectFormat(lines) === 'chordpro' ? parseChordPro(lines, ids) : parseChordsOverWords(lines, ids);
}

export function detectFormat(lines: string[]): ParseResult['format'] {
  let score = 0;
  for (const line of lines) {
    if (/^\s*\{[a-z_]+(?::.*)?\}\s*$/i.test(line)) score += 2;
    for (const m of line.matchAll(/\[([^\]\n]{1,16})\]/g)) {
      if (isParsed(parseChord(m[1]))) score += 1;
    }
  }
  return score >= 2 ? 'chordpro' : 'chords-over-words';
}

// ───────────────────────── 共通 ─────────────────────────

// 種類ごとに id を除いた行（Omit をそのまま使うと共用体がつぶれるため分配させる）
type LineInput = Line extends infer L ? (L extends Line ? Omit<L, 'id'> : never) : never;

class Builder {
  sections: Section[] = [];
  private current: Section | null = null;
  constructor(private ids: IdGen) {}

  startSection(label: string, fallbackKind: SectionKind = 'other') {
    const kind = sectionKindOf(label) ?? fallbackKind;
    this.current = { id: this.ids('s'), kind, label: label || DEFAULT_LABEL[kind], lines: [] };
    this.sections.push(this.current);
  }

  endSection() {
    this.current = null;
  }

  add(line: LineInput) {
    if (!this.current) this.startSection('');
    this.current!.lines.push({ ...line, id: this.ids('l') } as Line);
  }

  build(): SheetBody {
    return { formatVersion: 1, sections: this.sections.filter((s) => s.lines.length > 0) };
  }
}

function warnUnparsed(tokens: ChordToken[], lineNo: number, warnings: ParseWarning[]) {
  for (const t of tokens) {
    if ('unparsed' in t) warnings.push({ line: lineNo, raw: t.raw, message: `「${t.raw}」をコードとして解釈できませんでした` });
  }
}

const BAR_SEPARATOR = /^[|｜]+$/;

/** 「| C G | Am F |」のような小節区切りの行を読む。小節区切りでなければ null。 */
function parseBarsLine(line: string): ChordToken[][] | null {
  if (!/[|｜]/.test(line)) return null;
  const bars = line
    .split(/[|｜]/)
    .map((b) => b.trim())
    .filter((b) => b.length > 0)
    .map((b) => b.split(/\s+/).map(parseChord));
  if (bars.length === 0) return null;
  const all = bars.flat();
  const ok = all.filter((t) => !('unparsed' in t)).length;
  return ok / all.length >= 0.6 ? bars : null;
}

/** 曲情報の行（Key: A / カポ 2 / BPM 92 など）を読む。 */
function readMetaLine(line: string, meta: SheetMeta): boolean {
  const s = line.trim();
  let m: RegExpExecArray | null;
  if ((m = /^(?:original\s*key|key|原曲キー|キー)\s*[:：=]?\s*([A-G][#♯b♭]?m?)\b/i.exec(s))) {
    meta.key ??= m[1];
    return true;
  }
  if ((m = /^(?:capo|カポ)\s*[:：=]?\s*([0-9０-９]+)/i.exec(s))) {
    meta.capo ??= toInt(m[1]);
    return true;
  }
  if ((m = /^(?:bpm|tempo|テンポ)\s*[:：=]?\s*([0-9０-９]+)/i.exec(s))) {
    meta.bpm ??= toInt(m[1]);
    return true;
  }
  if (/^(?:capo|カポ)\s*(?:なし|無し|none|0)$/i.test(s)) {
    meta.capo ??= 0;
    return true;
  }
  return false;
}

function toInt(s: string): number {
  return parseInt(s.replace(/[０-９]/g, (d) => String(d.charCodeAt(0) - 0xff10)), 10);
}

// ───────────────────────── ChordPro ─────────────────────────

const DIRECTIVE_RE = /^\s*\{\s*([a-z_]+)\s*(?::\s*(.*?))?\s*\}\s*$/i;

const ENV_KIND: Record<string, SectionKind> = {
  verse: 'verse', v: 'verse', chorus: 'chorus', c: 'chorus', bridge: 'bridge', b: 'bridge',
};

function parseChordPro(lines: string[], ids: IdGen): ParseResult {
  const b = new Builder(ids);
  const meta: SheetMeta = {};
  const warnings: ParseWarning[] = [];

  lines.forEach((line, i) => {
    const lineNo = i + 1;
    if (!line.trim()) return;

    const d = DIRECTIVE_RE.exec(line);
    if (d) {
      const name = d[1].toLowerCase();
      const value = d[2] ?? '';
      const start = /^(?:start_of_([a-z]+)|so([a-z]))$/.exec(name);
      if (name === 'title' || name === 't') meta.title = value;
      else if (name === 'artist' || name === 'subtitle' || name === 'st') meta.artist ??= value;
      else if (name === 'key') meta.key = value;
      else if (name === 'capo') meta.capo = toInt(value);
      else if (name === 'tempo' || name === 'bpm') meta.bpm = toInt(value);
      else if (name === 'time') meta.timeSignature = value;
      else if (name === 'comment' || name === 'c' || name === 'ci' || name === 'comment_italic') b.add({ kind: 'comment', text: value });
      else if (start) b.startSection(value, ENV_KIND[start[1] ?? start[2]] ?? 'other');
      else if (/^(?:end_of_[a-z]+|eo[a-z])$/.test(name)) b.endSection();
      return;
    }

    const heading = parseSectionHeading(line);
    if (heading) {
      b.startSection(heading);
      return;
    }
    if (b.sections.length === 0 && readMetaLine(line, meta)) return;

    const bars = parseBarsLine(line.replace(/\[([^\]]*)\]/g, ' $1 '));
    if (bars && !/[^\s|｜[\]A-Za-z0-9#♯b♭+\-−()/.△ø°%]/.test(line)) {
      warnUnparsed(bars.flat(), lineNo, warnings);
      b.add({ kind: 'bars', bars: bars.map((chords) => ({ chords })) });
      return;
    }

    const segments: Segment[] = [];
    const parts = line.split(/\[([^\]]*)\]/);
    if (parts[0]) segments.push({ text: parts[0] });
    for (let k = 1; k < parts.length; k += 2) {
      const chord = parseChord(parts[k]);
      segments.push({ chord, text: parts[k + 1] ?? '' });
    }
    warnUnparsed(segments.flatMap((s) => (s.chord ? [s.chord] : [])), lineNo, warnings);
    b.add({ kind: 'lyric', segments: trimSegments(segments) });
  });

  return { format: 'chordpro', meta, body: b.build(), warnings };
}

function trimSegments(segments: Segment[]): Segment[] {
  if (segments.length > 0) {
    const last = segments[segments.length - 1];
    last.text = last.text.replace(/\s+$/, '');
  }
  return segments;
}

// ───────────────────────── コード行＋歌詞行 ─────────────────────────

/** 等幅表示での文字幅（全角 = 2） */
export function charWidth(ch: string): number {
  const cp = ch.codePointAt(0) ?? 0;
  if (
    (cp >= 0x1100 && cp <= 0x115f) ||
    (cp >= 0x2e80 && cp <= 0xa4cf) ||
    (cp >= 0xac00 && cp <= 0xd7a3) ||
    (cp >= 0xf900 && cp <= 0xfaff) ||
    (cp >= 0xfe30 && cp <= 0xfe4f) ||
    (cp >= 0xff00 && cp <= 0xff60) ||
    (cp >= 0xffe0 && cp <= 0xffe6) ||
    cp >= 0x20000
  ) {
    return 2;
  }
  return 1;
}

type PlacedChord = { col: number; token: ChordToken };

/** コード行なら、各コードの位置（桁）を返す。コード行でなければ null。 */
export function readChordLine(line: string): PlacedChord[] | null {
  if (!line.trim()) return null;
  const placed: PlacedChord[] = [];
  let col = 0;
  let word = '';
  let wordCol = 0;
  const flush = () => {
    if (word && !BAR_SEPARATOR.test(word)) {
      const cleaned = /^\((.+)\)$/.exec(word)?.[1] ?? word;
      placed.push({ col: wordCol, token: parseChord(cleaned) });
    }
    word = '';
  };
  for (const ch of line) {
    if (/\s/.test(ch)) {
      flush();
    } else {
      if (!word) wordCol = col;
      word += ch;
    }
    col += charWidth(ch);
  }
  flush();
  if (placed.length === 0) return null;
  const ok = placed.filter((p) => !('unparsed' in p.token)).length;
  const hasJapanese = /[぀-ヿ一-鿿]/.test(line);
  return !hasJapanese && ok / placed.length >= 0.6 && ok > 0 ? placed : null;
}

/** コード行の位置に合わせて歌詞を区切る。 */
export function alignChords(chords: PlacedChord[], lyric: string): Segment[] {
  const chars = Array.from(lyric.replace(/\s+$/, ''));
  const starts: number[] = [];
  let col = 0;
  for (const ch of chars) {
    starts.push(col);
    col += charWidth(ch);
  }
  const totalWidth = col;

  // 各コードが乗る文字の位置（そのコードの桁を含む文字）
  const cuts = chords.map((c) => {
    if (c.col >= totalWidth) return chars.length;
    let idx = 0;
    while (idx + 1 < chars.length && starts[idx + 1] <= c.col) idx++;
    return idx;
  });

  const segments: Segment[] = [];
  if (cuts.length === 0 || cuts[0] > 0) {
    segments.push({ text: chars.slice(0, cuts[0] ?? chars.length).join('') });
  }
  let prev = -1;
  chords.forEach((c, i) => {
    const from = Math.max(cuts[i], prev);
    const to = i + 1 < cuts.length ? Math.max(cuts[i + 1], from) : chars.length;
    segments.push({ chord: c.token, text: chars.slice(from, to).join('') });
    prev = to;
  });
  return segments.filter((s, i) => i > 0 || s.chord || s.text.length > 0);
}

function parseChordsOverWords(lines: string[], ids: IdGen): ParseResult {
  const b = new Builder(ids);
  const meta: SheetMeta = {};
  const warnings: ParseWarning[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lineNo = i + 1;
    if (!line.trim()) continue;

    const heading = parseSectionHeading(line);
    if (heading) {
      b.startSection(heading);
      continue;
    }
    if (readMetaLine(line, meta)) continue;

    const bars = parseBarsLine(line);
    if (bars) {
      warnUnparsed(bars.flat(), lineNo, warnings);
      b.add({ kind: 'bars', bars: bars.map((chords) => ({ chords })) });
      continue;
    }

    const chords = readChordLine(line);
    if (chords) {
      warnUnparsed(chords.map((c) => c.token), lineNo, warnings);
      const next = lines[i + 1];
      const nextIsLyric =
        next !== undefined && next.trim() !== '' && !readChordLine(next) && !parseSectionHeading(next) && !parseBarsLine(next);
      if (nextIsLyric) {
        b.add({ kind: 'lyric', segments: alignChords(chords, next) });
        i++;
      } else {
        b.add({ kind: 'bars', bars: [{ chords: chords.map((c) => c.token) }] });
      }
      continue;
    }

    b.add({ kind: 'lyric', segments: [{ text: line.replace(/\s+$/, '') }] });
  }

  return { format: 'chords-over-words', meta, body: b.build(), warnings };
}
