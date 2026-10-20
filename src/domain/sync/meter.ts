/** 「3/4」「6/8」などの拍子から、1小節の拍数を読む。読めなければ 4 */
export function beatsPerBar(timeSignature: string | undefined): number {
  const m = /^\s*(\d{1,2})\s*\/\s*(\d{1,2})\s*$/.exec(timeSignature ?? '');
  const n = m ? Number(m[1]) : 4;
  return n >= 1 && n <= 16 ? n : 4;
}

export const MIN_BPM = 30;
export const MAX_BPM = 300;

export function clampBpm(bpm: number): number {
  return Math.min(MAX_BPM, Math.max(MIN_BPM, Math.round(bpm)));
}

/**
 * メトロノームの次の拍を予約するための計算（設計書 7.4: 先読みして予約する）。
 * start からの経過で、[from, until) に入る拍の時刻と、小節の頭かどうかを返す。
 */
export function beatsBetween(start: number, bpm: number, perBar: number, from: number, until: number): { time: number; index: number; accent: boolean }[] {
  const interval = 60 / bpm;
  const first = Math.max(0, Math.ceil((from - start) / interval - 1e-9));
  const out: { time: number; index: number; accent: boolean }[] = [];
  for (let i = first; ; i++) {
    const time = start + i * interval;
    if (time >= until) break;
    out.push({ time, index: i, accent: i % perBar === 0 });
  }
  return out;
}
