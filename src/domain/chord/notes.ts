import { normalizeQuality, simplifyQuality } from './chord';
import { mod12 } from './pitch';

// コードの種類（正規形）→ 根音からの半音数
const INTERVALS: Record<string, number[]> = {
  '': [0, 4, 7],
  '5': [0, 7],
  m: [0, 3, 7],
  dim: [0, 3, 6],
  aug: [0, 4, 8],
  sus2: [0, 2, 7],
  sus4: [0, 5, 7],
  '6': [0, 4, 7, 9],
  m6: [0, 3, 7, 9],
  '69': [0, 4, 7, 9, 2],
  m69: [0, 3, 7, 9, 2],
  '7': [0, 4, 7, 10],
  '7sus4': [0, 5, 7, 10],
  '7b5': [0, 4, 6, 10],
  aug7: [0, 4, 8, 10],
  '7b9': [0, 4, 7, 10, 1],
  '7#9': [0, 4, 7, 10, 3],
  '9': [0, 4, 7, 10, 2],
  '11': [0, 4, 7, 10, 2, 5],
  '13': [0, 4, 7, 10, 2, 9],
  maj7: [0, 4, 7, 11],
  maj9: [0, 4, 7, 11, 2],
  maj7b5: [0, 4, 6, 11],
  'maj7#5': [0, 4, 8, 11],
  m7: [0, 3, 7, 10],
  m7b5: [0, 3, 6, 10],
  m9: [0, 3, 7, 10, 2],
  m11: [0, 3, 7, 10, 2, 5],
  mmaj7: [0, 3, 7, 11],
  dim7: [0, 3, 6, 9],
  add9: [0, 4, 7, 2],
  madd9: [0, 3, 7, 2],
};

/** コードの構成音を音高クラスで返す（根音から順）。鍵盤表示・コード音の再生に使う。 */
export function chordPitchClasses(rootPc: number, quality: string): number[] {
  const intervals = INTERVALS[normalizeQuality(quality)] ?? INTERVALS[simplifyQuality(quality)] ?? INTERVALS[''];
  return intervals.map((i) => mod12(rootPc + i));
}
