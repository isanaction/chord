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

/** 次に鳴らす拍（時刻は秒、index は鳴らし始めからの拍の通し番号） */
export type BeatClock = { time: number; index: number };

/**
 * メトロノームの拍を先読みして予約するための計算（設計書 7.4）。
 * until より前の拍を返し、その次の拍を next として返す。
 * テンポを変えても next から新しい間隔で続けるので、拍の位置（小節の何拍目か）はずれない。
 */
export function takeBeats(clock: BeatClock, bpm: number, perBar: number, until: number): { beats: { time: number; index: number; accent: boolean }[]; next: BeatClock } {
  const interval = 60 / bpm;
  const beats: { time: number; index: number; accent: boolean }[] = [];
  let { time, index } = clock;
  while (time < until) {
    beats.push({ time, index, accent: index % perBar === 0 });
    time += interval;
    index++;
  }
  return { beats, next: { time, index } };
}
