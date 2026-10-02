import type { Line, Section, SheetBody } from './types';

function lineKey(line: Line): string {
  if (line.kind === 'comment') return 'c:' + line.text;
  if (line.kind === 'bars') return 'b:' + line.bars.map((b) => b.chords.map((c) => c.raw).join(' ')).join('|');
  return 'l:' + line.segments.map((s) => (s.chord ? `[${s.chord.raw}]` : '') + s.text).join('');
}

/**
 * 編集後の譜面で、内容が同じ行・同じ見出しのセクションには編集前の ID を引き継ぐ（設計書 4.4）。
 * 同期データや将来の修正提案が行 ID を参照するため、編集で ID が変わらないようにする。
 */
export function preserveIds(before: SheetBody, after: SheetBody): SheetBody {
  const oldLines = new Map<string, string[]>();
  for (const s of before.sections) {
    for (const l of s.lines) {
      const k = lineKey(l);
      oldLines.set(k, [...(oldLines.get(k) ?? []), l.id]);
    }
  }
  const oldSections = new Map<string, string[]>();
  for (const s of before.sections) oldSections.set(s.label, [...(oldSections.get(s.label) ?? []), s.id]);

  const take = (map: Map<string, string[]>, key: string) => {
    const ids = map.get(key);
    return ids && ids.length > 0 ? ids.shift() : undefined;
  };

  return {
    ...after,
    sections: after.sections.map(
      (s): Section => ({
        ...s,
        id: take(oldSections, s.label) ?? s.id,
        lines: s.lines.map((l) => ({ ...l, id: take(oldLines, lineKey(l)) ?? l.id })),
      }),
    ),
  };
}
