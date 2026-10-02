import { readChordLine } from '@/domain/sheet/parse';
import type { ImportPayload } from './types';

const MAX_TEXT = 200_000;

/**
 * ページ本文から、コード譜らしい範囲だけを切り出す。
 * 最初と最後のコード行の前後（見出し・最後の歌詞のため）を少し含める。
 */
export function extractChordRegion(text: string): string {
  const lines = text.slice(0, MAX_TEXT).replace(/\r\n?/g, '\n').split('\n');
  const chordLines = lines.map((l, i) => (readChordLine(l) ? i : -1)).filter((i) => i >= 0);
  if (chordLines.length === 0) return lines.join('\n').trim();
  const start = Math.max(0, chordLines[0] - 2);
  const end = Math.min(lines.length, chordLines[chordLines.length - 1] + 2);
  return lines.slice(start, end).join('\n').trim();
}

const NOISE = /(ギター|ウクレレ|ピアノ|ベース)?\s*(コード譜?|歌詞|chords?|tab|楽譜)\s*(付き|あり)?/gi;

/** 「曲名 / アーティスト ギターコード/ウクレレコード - サイト名」のようなページタイトルから曲名とアーティストを推定する */
export function splitPageTitle(pageTitle: string, siteNames: string[] = []): { title?: string; artist?: string } {
  let t = pageTitle;
  for (const name of siteNames) t = t.split(name).join('');
  const parts = t
    .split(/\s+[/／|｜\-–—]\s+|[|｜]/)
    .map((p) =>
      p
        .replace(NOISE, '')
        .replace(/[「」『』]/g, '')
        .replace(/^[\s/／・,、-]+|[\s/／・,、-]+$/g, '')
        .trim(),
    )
    .filter((p) => p.length > 0);
  return { title: parts[0], artist: parts[1] };
}

/** 選択範囲があればそれを、なければ本文からコード譜らしい範囲を使う */
export function genericText(payload: ImportPayload): string {
  const selected = payload.selection.trim();
  return selected ? selected.slice(0, MAX_TEXT) : extractChordRegion(payload.text);
}
