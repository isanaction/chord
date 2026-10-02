import { describe, expect, it } from 'vitest';
import { buildBookmarklet } from './bookmarklet';
import { extractChordRegion, splitPageTitle } from './generic';
import { interpretPayload, isImportPayload } from './registry';
import type { ImportPayload } from './types';

const payload = (over: Partial<ImportPayload>): ImportPayload => ({
  type: 'chord-import',
  version: 1,
  url: 'https://www.ufret.jp/song.php?data=1',
  title: '夜明けのバス停 / サンプルアーティスト ギターコード - U-FRET',
  html: '<html><body></body></html>',
  text: '',
  selection: '',
  ...over,
});

const PAGE_TEXT = ['ホーム ランキング 検索', 'ログイン', '', '【サビ】', 'C   D', '夜が明けたら', 'G   Em', 'きっと', '', 'この曲を評価する', 'シェア'].join('\n');

describe('汎用の読み取り', () => {
  it('本文からコード譜らしい範囲だけを切り出す', () => {
    expect(extractChordRegion(PAGE_TEXT)).toBe(['【サビ】', 'C   D', '夜が明けたら', 'G   Em', 'きっと'].join('\n'));
  });

  it('ページタイトルから曲名とアーティストを推定する', () => {
    expect(splitPageTitle('夜明けのバス停 / サンプルアーティスト ギターコード - U-FRET', 'U-FRET')).toEqual({
      title: '夜明けのバス停',
      artist: 'サンプルアーティスト',
    });
  });
});

describe('受け取ったデータの解釈', () => {
  const parseHtml = () => null;

  it('対応サイトは本文から読み取る', () => {
    const r = interpretPayload('https://www.ufret.jp', payload({ text: PAGE_TEXT }), parseHtml);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.candidate).toMatchObject({ site: 'ufret', siteName: 'U-FRET', title: '夜明けのバス停', artist: 'サンプルアーティスト' });
    expect(r.candidate.text).toContain('夜が明けたら');
  });

  it('選択範囲があればそれを使う', () => {
    const r = interpretPayload('https://www.ufret.jp', payload({ text: PAGE_TEXT, selection: 'G  C\nあいう' }), parseHtml);
    expect(r.ok && r.candidate.text).toBe('G  C\nあいう');
  });

  it('対応外のサイトは選択範囲がないと受け付けない', () => {
    expect(interpretPayload('https://example.com', payload({ url: 'https://example.com/a', text: PAGE_TEXT }), parseHtml).ok).toBe(false);
    const r = interpretPayload('https://example.com', payload({ url: 'https://example.com/a', selection: 'G  C\nあいう' }), parseHtml);
    expect(r.ok && r.candidate.site).toBe('example.com');
  });

  it('形の違うデータは受け付けない', () => {
    expect(isImportPayload({ type: 'chord-import', version: 1 })).toBe(false);
    expect(isImportPayload(payload({}))).toBe(true);
  });
});

describe('ブックマークレット', () => {
  it('送り先を自アプリのオリジンに限定する', () => {
    const code = decodeURIComponent(buildBookmarklet('https://chord.example.app').slice('javascript:'.length));
    expect(code).toContain('var A="https://chord.example.app"');
    expect(code).toContain('w.postMessage(p,A)');
    expect(code).toContain('e.origin===A');
  });
});
