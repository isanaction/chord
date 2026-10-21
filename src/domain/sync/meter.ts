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

/** 最後に予約した拍の時刻（まだなければ null）と、次の拍の通し番号（鳴らし始めから数える） */
export type BeatClock = { last: number | null; index: number };

/**
 * メトロノームの拍を先読みして予約するための計算（設計書 7.4）。
 * from 以降 until より前の拍を返す。次の拍の時刻は、最後に予約した拍から今のテンポで決める。
 * テンポを変えると次の拍から新しい間隔になり、拍の位置（小節の何拍目か）はずれない。
 * 次の拍が from より前になるとき（テンポを大きく上げた、画面が裏に回って予約が遅れた）は from から鳴らす。
 */
export function takeBeats(
  clock: BeatClock,
  bpm: number,
  perBar: number,
  from: number,
  until: number,
): { beats: { time: number; index: number; accent: boolean }[]; next: BeatClock } {
  const interval = 60 / bpm;
  const beats: { time: number; index: number; accent: boolean }[] = [];
  let { last, index } = clock;
  let time = last === null ? from : Math.max(from, last + interval);
  while (time < until) {
    beats.push({ time, index, accent: index % perBar === 0 });
    last = time;
    time += interval;
    index++;
  }
  return { beats, next: { last, index } };
}
