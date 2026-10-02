import type { ChordToken } from '../chord/chord';
import type { Section, SheetBody, SheetMeta } from './types';

const ENV: Partial<Record<Section['kind'], string>> = { chorus: 'chorus', bridge: 'bridge' };

/** 譜面を ChordPro テキストに書き出す（エクスポート・エディタ表示用）。 */
export function toChordPro(meta: SheetMeta, body: SheetBody): string {
  const out: string[] = [];
  if (meta.title) out.push(`{title: ${meta.title}}`);
  if (meta.artist) out.push(`{artist: ${meta.artist}}`);
  if (meta.key) out.push(`{key: ${meta.key}}`);
  if (meta.capo) out.push(`{capo: ${meta.capo}}`);
  if (meta.bpm) out.push(`{tempo: ${meta.bpm}}`);
  if (meta.timeSignature && meta.timeSignature !== '4/4') out.push(`{time: ${meta.timeSignature}}`);

  for (const section of body.sections) {
    if (out.length > 0) out.push('');
    const env = ENV[section.kind] ?? 'verse';
    const labeled = section.label !== '';
    if (labeled) out.push(`{start_of_${env}: ${section.label}}`);
    for (const line of section.lines) {
      if (line.kind === 'comment') out.push(`{comment: ${line.text}}`);
      else if (line.kind === 'bars') out.push('| ' + line.bars.map((b) => b.chords.map(raw).join(' ')).join(' | ') + ' |');
      else out.push(line.segments.map((s) => (s.chord ? `[${s.chord.raw}]` : '') + s.text).join(''));
    }
    if (labeled) out.push(`{end_of_${env}}`);
  }
  return out.join('\n') + '\n';
}

function raw(t: ChordToken): string {
  return t.raw;
}

/** 譜面に出てくるコードを出現順にすべて返す（重複あり）。 */
export function collectChords(body: SheetBody): ChordToken[] {
  const result: ChordToken[] = [];
  for (const section of body.sections) {
    for (const line of section.lines) {
      if (line.kind === 'lyric') for (const s of line.segments) if (s.chord) result.push(s.chord);
      if (line.kind === 'bars') for (const b of line.bars) result.push(...b.chords);
    }
  }
  return result;
}
