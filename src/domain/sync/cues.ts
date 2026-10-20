import type { SheetBody } from '../sheet/types';

/** 行の始まる時刻（動画上のミリ秒） */
export type Cue = { lineId: string; t: number };

/** ループ区間の指定。時刻（ミリ秒）か、セクションか */
export type LoopSpec = { a: number; b: number } | { sectionId: string };

/** 同期の対象になる行（注記の行は除く）。譜面の上から順 */
export type TimedLine = { lineId: string; sectionId: string; index: number };

export function timedLines(body: SheetBody): TimedLine[] {
  const out: TimedLine[] = [];
  for (const section of body.sections) {
    for (const line of section.lines) {
      if (line.kind === 'comment') continue;
      out.push({ lineId: line.id, sectionId: section.id, index: out.length });
    }
  }
  return out;
}

/**
 * 譜面に今もある行の時刻だけを、譜面の順に並べて返す。
 * 編集で消えた行の時刻は捨てる（設計書 4.4）。
 */
export function usableCues(body: SheetBody, cues: Cue[]): Cue[] {
  const order = new Map(timedLines(body).map((l) => [l.lineId, l.index]));
  return cues.filter((c) => order.has(c.lineId)).sort((a, b) => a.t - b.t || order.get(a.lineId)! - order.get(b.lineId)!);
}

/** 譜面の行のうち、時刻が付いていないものの数（「要調整」の表示に使う） */
export function untimedCount(body: SheetBody, cues: Cue[]): number {
  const timed = new Set(cues.map((c) => c.lineId));
  return timedLines(body).filter((l) => !timed.has(l.lineId)).length;
}

/**
 * 再生位置 t（ミリ秒）で演奏中の行。時刻が t 以前で最も新しい行（設計書 7.1）。
 * offset は同期データ全体の補正（正なら行を遅らせる）。
 */
export function currentLineId(cues: Cue[], t: number, offsetMs = 0): string | null {
  // cues は時刻順（usableCues の結果）を前提に二分探索する
  let lo = 0;
  let hi = cues.length - 1;
  let found = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (cues[mid].t + offsetMs <= t) {
      found = mid;
      lo = mid + 1;
    } else hi = mid - 1;
  }
  return found >= 0 ? cues[found].lineId : null;
}

/** 行の時刻を記録する（同じ行の時刻は置き換える）。時刻順に並べて返す */
export function recordCue(cues: Cue[], lineId: string, t: number): Cue[] {
  return [...cues.filter((c) => c.lineId !== lineId), { lineId, t: Math.max(0, Math.round(t)) }].sort((a, b) => a.t - b.t);
}

/** 行の時刻を前後に動かす（F-PRAC-02 の微調整） */
export function nudgeCue(cues: Cue[], lineId: string, deltaMs: number): Cue[] {
  return cues
    .map((c) => (c.lineId === lineId ? { ...c, t: Math.max(0, Math.round(c.t + deltaMs)) } : c))
    .sort((a, b) => a.t - b.t);
}

export function removeCue(cues: Cue[], lineId: string): Cue[] {
  return cues.filter((c) => c.lineId !== lineId);
}

/** 記録モードで、ある行の次に記録する行（最後の行の次は null） */
export function nextLineId(body: SheetBody, lineId: string | null): string | null {
  const lines = timedLines(body);
  if (lineId === null) return lines[0]?.lineId ?? null;
  const i = lines.findIndex((l) => l.lineId === lineId);
  return i >= 0 ? (lines[i + 1]?.lineId ?? null) : (lines[0]?.lineId ?? null);
}

/**
 * セクションの開始・終了時刻（ミリ秒、補正込み）。
 * 開始 = セクション内で最も早い行の時刻、終了 = セクションより後の行で最も早い時刻（なければ動画の終わり = null）。
 * セクション内に時刻がひとつもなければ null。
 */
export function sectionRange(body: SheetBody, cues: Cue[], sectionId: string, offsetMs = 0): { a: number; b: number | null } | null {
  const lines = timedLines(body);
  const inSection = lines.filter((l) => l.sectionId === sectionId);
  if (inSection.length === 0) return null;
  const lastIndex = inSection[inSection.length - 1].index;
  const byLine = new Map(cues.map((c) => [c.lineId, c.t]));
  const starts = inSection.map((l) => byLine.get(l.lineId)).filter((t): t is number => t !== undefined);
  if (starts.length === 0) return null;
  const a = Math.min(...starts);
  const after = lines
    .filter((l) => l.index > lastIndex)
    .map((l) => byLine.get(l.lineId))
    .filter((t): t is number => t !== undefined && t > a);
  return { a: a + offsetMs, b: after.length > 0 ? Math.min(...after) + offsetMs : null };
}

/**
 * ループの指定を、動画上の区間（ミリ秒）にする。
 * セクション指定で終わりが分からないときは、動画の長さ durationMs を使う。
 */
export function resolveLoop(
  loop: LoopSpec | undefined,
  body: SheetBody,
  cues: Cue[],
  offsetMs: number,
  durationMs: number | null,
): { a: number; b: number } | null {
  if (!loop) return null;
  if ('a' in loop) return loop.b > loop.a ? { a: loop.a, b: loop.b } : null;
  const range = sectionRange(body, cues, loop.sectionId, offsetMs);
  if (!range) return null;
  const b = range.b ?? durationMs;
  return b !== null && b > range.a ? { a: range.a, b } : null;
}

/** ループ区間の終わりを過ぎたら、戻る先の時刻を返す（戻らなくてよければ null） */
export function loopSeekTarget(t: number, range: { a: number; b: number } | null): number | null {
  if (!range) return null;
  return t >= range.b ? range.a : null;
}

/** 秒数を「1:05.3」の形で表示する */
export function formatTime(ms: number): string {
  const total = Math.max(0, ms) / 1000;
  const m = Math.floor(total / 60);
  const s = total - m * 60;
  return `${m}:${s.toFixed(1).padStart(4, '0')}`;
}
