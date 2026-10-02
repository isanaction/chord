import type { SectionKind } from './types';

const PATTERNS: [RegExp, SectionKind][] = [
  [/^(イントロ|前奏|intro)/i, 'intro'],
  [/^(アウトロ|後奏|エンディング|outro|ending)/i, 'outro'],
  [/^(間奏|interlude|solo|ソロ)/i, 'interlude'],
  [/^(大サビ|落ちサビ|ラスサビ|サビ|chorus|hook)/i, 'chorus'],
  [/^(Bメロ|pre-?chorus)/i, 'prechorus'],
  [/^(Cメロ|Dメロ|bridge|ブリッジ)/i, 'bridge'],
  [/^(Aメロ|verse|[0-9０-９]+番)/i, 'verse'],
];

/** 見出し文字列からセクションの種類を推定する。当てはまらなければ null。 */
export function sectionKindOf(label: string): SectionKind | null {
  const s = label.trim();
  for (const [re, kind] of PATTERNS) if (re.test(s)) return kind;
  return null;
}

/**
 * 「【サビ】」「[Aメロ]」「Intro:」「＜間奏＞」のような見出し行なら、その見出し名を返す。
 * 見出しとして認識できなければ null。
 */
export function parseSectionHeading(line: string): string | null {
  const s = line.trim();
  if (!s || s.length > 24) return null;
  const bracketed = /^[【\[［<＜(（]\s*(.+?)\s*[】\]］>＞)）]\s*[:：]?$/.exec(s);
  const candidate = bracketed ? bracketed[1] : s.replace(/[:：]$/, '');
  return sectionKindOf(candidate) ? candidate : null;
}

export const DEFAULT_LABEL: Record<SectionKind, string> = {
  intro: 'イントロ',
  verse: 'Aメロ',
  prechorus: 'Bメロ',
  chorus: 'サビ',
  bridge: 'Cメロ',
  interlude: '間奏',
  outro: 'アウトロ',
  other: '',
};
