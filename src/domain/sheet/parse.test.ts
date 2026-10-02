import { describe, expect, it } from 'vitest';
import { sequentialIds } from './ids';
import { alignChords, charWidth, detectFormat, parseSheetText, readChordLine } from './parse';
import { collectChords, toChordPro } from './serialize';
import type { Line, SheetBody } from './types';

// テスト用の歌詞はすべて架空のもの
const CHORDPRO = `{title: 夜明けのバス停}
{artist: サンプルアーティスト}
{key: A}
{capo: 2}

{start_of_verse: Aメロ}
[G]まだ眠る[D/F#]街の 角を[Em]曲がって
[C]白い息が [G]ひとつ[D]ゆれた
{end_of_verse}

{start_of_chorus: サビ}
[C]夜が[D]明けたら [Bm]きっと[Em]
{comment: ×2}
{end_of_chorus}
`;

function lyricText(line: Line): string {
  if (line.kind !== 'lyric') throw new Error('not lyric');
  return line.segments.map((s) => (s.chord ? `[${s.chord.raw}]` : '') + s.text).join('');
}

describe('形式の判別', () => {
  it('ChordPro を判別する', () => {
    expect(detectFormat(CHORDPRO.split('\n'))).toBe('chordpro');
  });
  it('コード行＋歌詞行を判別する', () => {
    expect(detectFormat(['C     G', 'まだ眠る街の'])).toBe('chords-over-words');
  });
  it('[サビ] のような見出しだけでは ChordPro と判定しない', () => {
    expect(detectFormat(['[サビ]', 'C   G', 'あいう'])).toBe('chords-over-words');
  });
});

describe('ChordPro の読み取り', () => {
  const result = parseSheetText(CHORDPRO, sequentialIds());

  it('曲情報を読む', () => {
    expect(result.meta).toEqual({ title: '夜明けのバス停', artist: 'サンプルアーティスト', key: 'A', capo: 2 });
  });

  it('セクションと行を読む', () => {
    const [verse, chorus] = result.body.sections;
    expect(verse.kind).toBe('verse');
    expect(verse.label).toBe('Aメロ');
    expect(lyricText(verse.lines[0])).toBe('[G]まだ眠る[D/F#]街の 角を[Em]曲がって');
    expect(chorus.kind).toBe('chorus');
    expect(chorus.lines[1]).toMatchObject({ kind: 'comment', text: '×2' });
  });

  it('警告なし', () => {
    expect(result.warnings).toEqual([]);
  });

  it('解釈できないコードは警告する', () => {
    const r = parseSheetText('[C]あ[Hmm7]い[G]う');
    expect(r.warnings).toHaveLength(1);
    expect(r.warnings[0]).toMatchObject({ line: 1, raw: 'Hmm7' });
  });
});

describe('コード行＋歌詞行の読み取り', () => {
  it('全角文字の幅を 2 として数える', () => {
    expect(charWidth('あ')).toBe(2);
    expect(charWidth('Ａ')).toBe(2);
    expect(charWidth('a')).toBe(1);
  });

  it('コード行を判定する', () => {
    expect(readChordLine('G       D/F#     Em')?.map((c) => c.col)).toEqual([0, 8, 17]);
    expect(readChordLine('まだ眠る街の')).toBeNull();
    expect(readChordLine('A day in the life')).toBeNull();
  });

  it('全角の歌詞にコードの位置を合わせる', () => {
    // 「まだ眠る」= 8 桁、「街の 角を」は 8+2+2+1+2+2
    const chords = readChordLine('G       D/F#     Em')!;
    const segs = alignChords(chords, 'まだ眠る街の 角を曲がって');
    expect(segs.map((s) => [s.chord?.raw, s.text])).toEqual([
      ['G', 'まだ眠る'],
      ['D/F#', '街の 角を'],
      ['Em', '曲がって'],
    ]);
  });

  it('歌詞より後ろのコードは末尾に付ける', () => {
    const segs = alignChords(readChordLine('C       G          D')!, 'ゆれた');
    expect(segs.map((s) => [s.chord?.raw, s.text])).toEqual([
      ['C', 'ゆれた'],
      ['G', ''],
      ['D', ''],
    ]);
  });

  it('見出し・曲情報・小節行を含むテキストを読む', () => {
    const text = [
      'Key: A',
      'カポ 2',
      '',
      '【イントロ】',
      '| G  D | Em C |',
      '',
      '【Aメロ】',
      'G       D/F#     Em',
      'まだ眠る街の 角を曲がって',
      '',
      '[サビ]',
      'C   D',
      '夜が明けたら',
    ].join('\n');
    const r = parseSheetText(text, sequentialIds());
    expect(r.format).toBe('chords-over-words');
    expect(r.meta).toEqual({ key: 'A', capo: 2 });
    expect(r.body.sections.map((s) => [s.kind, s.label])).toEqual([
      ['intro', 'イントロ'],
      ['verse', 'Aメロ'],
      ['chorus', 'サビ'],
    ]);
    expect(r.body.sections[0].lines[0]).toMatchObject({ kind: 'bars' });
    expect(lyricText(r.body.sections[1].lines[0])).toBe('[G]まだ眠る[D/F#]街の 角を[Em]曲がって');
    expect(lyricText(r.body.sections[2].lines[0])).toBe('[C]夜が[D]明けたら');
    expect(r.warnings).toEqual([]);
  });

  it('歌詞のない行は小節行として扱う', () => {
    const r = parseSheetText('C  G  Am  F\n\nC  G\nあいうえお');
    expect(r.body.sections[0].lines[0]).toMatchObject({ kind: 'bars' });
    expect(r.body.sections[0].lines[1]).toMatchObject({ kind: 'lyric' });
  });
});

describe('ChordPro への書き出し', () => {
  it('読み取り → 書き出し → 読み取りで内容が変わらない', () => {
    const first = parseSheetText(CHORDPRO, sequentialIds());
    const text = toChordPro(first.meta, first.body);
    const second = parseSheetText(text, sequentialIds());
    expect(second.meta).toEqual(first.meta);
    expect(stripIds(second.body)).toEqual(stripIds(first.body));
  });

  it('コードを出現順に集める', () => {
    const r = parseSheetText(CHORDPRO);
    expect(collectChords(r.body).map((c) => c.raw)).toEqual(['G', 'D/F#', 'Em', 'C', 'G', 'D', 'C', 'D', 'Bm', 'Em']);
  });
});

function stripIds(body: SheetBody) {
  return body.sections.map((s) => ({ ...s, id: undefined, lines: s.lines.map((l) => ({ ...l, id: undefined })) }));
}
