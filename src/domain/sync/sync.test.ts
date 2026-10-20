import { describe, expect, it } from 'vitest';
import type { SheetBody } from '../sheet/types';
import {
  currentLineId,
  formatTime,
  loopSeekTarget,
  nextLineId,
  nudgeCue,
  recordCue,
  resolveLoop,
  sectionRange,
  timedLines,
  untimedCount,
  usableCues,
} from './cues';
import { beatsBetween, beatsPerBar, clampBpm } from './meter';
import { parseStartSeconds, parseYouTubeId } from './youtube';

const lyric = (id: string, text: string) => ({ id, kind: 'lyric' as const, segments: [{ text }] });
const body: SheetBody = {
  formatVersion: 1,
  sections: [
    { id: 's_a', kind: 'verse', label: 'Aメロ', lines: [lyric('l_1', 'いち'), lyric('l_2', 'に'), { id: 'c_1', kind: 'comment', text: '×2' }] },
    { id: 's_b', kind: 'chorus', label: 'サビ', lines: [lyric('l_3', 'さん'), lyric('l_4', 'よん')] },
  ],
};
const lines = timedLines(body);
const [l1, l2, l3, l4] = lines.map((l) => l.lineId);

describe('YouTube の URL', () => {
  it.each([
    ['https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=30s', 'dQw4w9WgXcQ'],
    ['https://youtu.be/dQw4w9WgXcQ?si=abc', 'dQw4w9WgXcQ'],
    ['https://m.youtube.com/watch?v=dQw4w9WgXcQ', 'dQw4w9WgXcQ'],
    ['https://www.youtube.com/shorts/dQw4w9WgXcQ', 'dQw4w9WgXcQ'],
    ['https://www.youtube.com/embed/dQw4w9WgXcQ', 'dQw4w9WgXcQ'],
    ['youtube.com/live/dQw4w9WgXcQ', 'dQw4w9WgXcQ'],
    ['dQw4w9WgXcQ', 'dQw4w9WgXcQ'],
  ])('%s → %s', (url, id) => {
    expect(parseYouTubeId(url)).toBe(id);
  });

  it.each(['https://example.com/watch?v=dQw4w9WgXcQ', 'https://www.youtube.com/watch?v=short', '', undefined])('%s は動画ではない', (url) => {
    expect(parseYouTubeId(url)).toBeNull();
  });

  it('開始秒を読む', () => {
    expect(parseStartSeconds('https://youtu.be/dQw4w9WgXcQ?t=95')).toBe(95);
    expect(parseStartSeconds('https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=1m5s')).toBe(65);
    expect(parseStartSeconds('https://youtu.be/dQw4w9WgXcQ')).toBeNull();
  });
});

describe('同期データ', () => {
  it('注記の行は同期の対象にしない', () => {
    expect(lines).toHaveLength(4);
    expect(lines.map((l) => l.sectionId)).toEqual(['s_a', 's_a', 's_b', 's_b']);
  });

  it('再生位置から今の行を求める（補正込み）', () => {
    const cues = usableCues(body, [
      { lineId: l1, t: 1000 },
      { lineId: l2, t: 5000 },
      { lineId: l3, t: 9000 },
    ]);
    expect(currentLineId(cues, 500)).toBeNull();
    expect(currentLineId(cues, 1000)).toBe(l1);
    expect(currentLineId(cues, 8999)).toBe(l2);
    expect(currentLineId(cues, 60_000)).toBe(l3);
    expect(currentLineId(cues, 5000, 200)).toBe(l1);
  });

  it('記録・微調整すると時刻順に並ぶ。同じ行は置き換える', () => {
    let cues = recordCue([], l2, 5000);
    cues = recordCue(cues, l1, 1000);
    cues = recordCue(cues, l2, 4800.4);
    expect(cues).toEqual([
      { lineId: l1, t: 1000 },
      { lineId: l2, t: 4800 },
    ]);
    expect(nudgeCue(cues, l1, -1500)).toEqual([
      { lineId: l1, t: 0 },
      { lineId: l2, t: 4800 },
    ]);
  });

  it('編集で消えた行の時刻は使わず、時刻のない行を数える', () => {
    const cues = [
      { lineId: 'l_gone', t: 0 },
      { lineId: l1, t: 1000 },
    ];
    expect(usableCues(body, cues)).toEqual([{ lineId: l1, t: 1000 }]);
    expect(untimedCount(body, cues)).toBe(3);
  });

  it('記録モードの次の行', () => {
    expect(nextLineId(body, null)).toBe(l1);
    expect(nextLineId(body, l2)).toBe(l3);
    expect(nextLineId(body, l4)).toBeNull();
  });
});

describe('ループ', () => {
  const cues = [
    { lineId: l1, t: 1000 },
    { lineId: l2, t: 5000 },
    { lineId: l3, t: 9000 },
    { lineId: l4, t: 13_000 },
  ];
  const [aMelo, sabi] = ['s_a', 's_b'];

  it('セクションの区間 = 最初の行から次のセクションの最初の行まで', () => {
    expect(sectionRange(body, cues, aMelo)).toEqual({ a: 1000, b: 9000 });
    expect(sectionRange(body, cues, sabi, 100)).toEqual({ a: 9100, b: null });
    expect(sectionRange(body, [], sabi)).toBeNull();
  });

  it('最後のセクションの終わりは動画の長さを使う', () => {
    expect(resolveLoop({ sectionId: sabi }, body, cues, 0, 20_000)).toEqual({ a: 9000, b: 20_000 });
    expect(resolveLoop({ sectionId: sabi }, body, cues, 0, null)).toBeNull();
    expect(resolveLoop({ a: 3000, b: 2000 }, body, cues, 0, null)).toBeNull();
  });

  it('終わりを過ぎたら始めに戻る', () => {
    const range = { a: 1000, b: 9000 };
    expect(loopSeekTarget(8999, range)).toBeNull();
    expect(loopSeekTarget(9000, range)).toBe(1000);
    expect(loopSeekTarget(9000, null)).toBeNull();
  });

  it('時刻の表示', () => {
    expect(formatTime(65_300)).toBe('1:05.3');
    expect(formatTime(0)).toBe('0:00.0');
  });
});

describe('メトロノーム', () => {
  it('拍子から1小節の拍数を読む', () => {
    expect(beatsPerBar('3/4')).toBe(3);
    expect(beatsPerBar('6/8')).toBe(6);
    expect(beatsPerBar('ワルツ')).toBe(4);
    expect(beatsPerBar(undefined)).toBe(4);
  });

  it('BPM は範囲に収める', () => {
    expect(clampBpm(10)).toBe(30);
    expect(clampBpm(120.4)).toBe(120);
    expect(clampBpm(999)).toBe(300);
  });

  it('先読みの範囲に入る拍と、小節の頭', () => {
    // 120 BPM = 0.5 秒ごと。3拍子
    const beats = beatsBetween(10, 120, 3, 10.9, 12.1);
    expect(beats.map((b) => [b.time, b.accent])).toEqual([
      [11, false],
      [11.5, true],
      [12, false],
    ]);
    expect(beatsBetween(10, 120, 4, 10, 10.1)).toEqual([{ time: 10, index: 0, accent: true }]);
  });
});
