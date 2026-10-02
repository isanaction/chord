import type { ChordToken } from '../chord/chord';

/** 譜面本体（設計書 3章）。DB には JSON として保存する。 */
export type SheetBody = {
  formatVersion: 1;
  sections: Section[];
};

export type SectionKind = 'intro' | 'verse' | 'prechorus' | 'chorus' | 'bridge' | 'interlude' | 'outro' | 'other';

export type Section = {
  id: string;
  kind: SectionKind;
  label: string;
  lines: Line[];
};

export type Line =
  | { id: string; kind: 'lyric'; segments: Segment[] }
  | { id: string; kind: 'bars'; bars: Bar[] }
  | { id: string; kind: 'comment'; text: string };

/** chord は text の先頭位置に乗る */
export type Segment = { chord?: ChordToken; text: string };

export type Bar = { chords: ChordToken[] };

/** 譜面テキストから読み取れる曲情報 */
export type SheetMeta = {
  title?: string;
  artist?: string;
  key?: string;
  capo?: number;
  bpm?: number;
  timeSignature?: string;
};

export type ParseWarning = { line: number; message: string; raw?: string };

export type ParseResult = {
  format: 'chordpro' | 'chords-over-words';
  meta: SheetMeta;
  body: SheetBody;
  warnings: ParseWarning[];
};
