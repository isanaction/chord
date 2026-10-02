// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest';
import { extractSheetFromDom } from './structural';

// 歌詞はすべて架空のもの。構造は「部品ごとにコードと歌詞が縦に並ぶ」コード譜サイトを想定している
const parse = (html: string) => new DOMParser().parseFromString(html, 'text/html');

const seg = (chord: string | null, lyric: string) =>
  `<p class="seg">${chord ? `<span class="chord">${chord}</span>` : ''}<span class="lyric">${lyric}</span></p>`;

const NOISY_PAGE = `<!doctype html><html><head><title>夜明けのバス停</title><style>.chord{color:red}</style>
<script>var C = "G";</script></head><body>
<nav><a href="#">人気</a><a href="#">定番</a><a href="#">初心者向け</a>
  <div>アーティスト名頭文字から検索</div><div>あ</div><div>い</div><div>う</div><button>閉じる</button></nav>
<div class="premium">プレミアム「全ての機能」を「広告なし」で <table><tr><td>曲のキーを変更</td><td>×</td></tr></table></div>
<h1>夜明けのバス停</h1><h2>サンプルアーティスト</h2>
<div class="settings"><span>Capo 0 ★簡単弾き</span><button>ー</button><button>+</button><span>キー 0 原曲キー</span></div>
<div id="sheet">
  <div class="row">${seg('C', '')}${seg('G', '')}${seg('Am', '')}${seg('F', '')}</div>
  <div class="row">${seg('C', 'まだ眠る')}${seg('G', '街の 角を')}${seg('Am', '曲がって')}${seg('Em', 'く')}</div>
  <div class="row">${seg(null, '産ま')}${seg('F', 'れたての')}${seg('C', '光と')}</div>
  <div class="row">${seg('B♭add9', '')}</div>
  <div class="row">${seg(null, 'コードのない行')}</div>
</div>
<div class="related"><h3>人気曲</h3><a href="#">空飛ぶ車 <span>サンプルアーティスト</span></a><a href="#">海沿いのラジオ</a></div>
<footer><span>C</span> 2026</footer>
</body></html>`;

describe('HTML 構造からの読み取り', () => {
  it('メニュー・広告・曲一覧を除き、譜面の行だけを読む', () => {
    expect(extractSheetFromDom(parse(NOISY_PAGE))?.split('\n')).toEqual([
      '[C] [G] [Am] [F]',
      '[C]まだ眠る[G]街の 角を[Am]曲がって[Em]く',
      '産ま[F]れたての[C]光と',
      '[B♭add9]',
      'コードのない行',
    ]);
  });

  it('ruby 表記（歌詞の後ろにコードが書かれている）とセクションの入れ子を読む', () => {
    const ruby = (lyric: string, chord: string) => `<ruby>${lyric}<rt>${chord}</rt></ruby>`;
    const html = `<body><main>
      <section><h4>Aメロ</h4>
        <div>${ruby('白い息が', 'D')}${ruby('ひとつ', 'A')}${ruby('ゆれた', 'E')}</div>
        <div>${ruby('始発を', 'A')}${ruby('待つ', 'E/G#')}</div>
      </section>
      <section><h4>サビ</h4>
        <div>${ruby('夜が', 'D')}${ruby('明けたら', 'E')}</div>
      </section>
    </main></body>`;
    expect(extractSheetFromDom(parse(html))?.split('\n')).toEqual([
      'Aメロ',
      '[D]白い息が[A]ひとつ[E]ゆれた',
      '[A]始発を[E/G#]待つ',
      'サビ',
      '[D]夜が[E]明けたら',
    ]);
  });

  it('コードと歌詞が同じ階層に平たく並んでいても読む', () => {
    const line = (...parts: string[]) =>
      `<div class="line">${parts.map((p, i) => (i % 2 === 0 ? `<span class="c">${p}</span>` : p)).join('')}</div>`;
    const html = `<body><div id="score">${line('C', 'まだ眠る', 'G', '街の')}${line('Am', '角を', 'F', '曲がって')}</div></body>`;
    expect(extractSheetFromDom(parse(html))?.split('\n')).toEqual(['[C]まだ眠る[G]街の', '[Am]角を[F]曲がって']);
  });

  it('コードがほとんど無いページは読み取らない', () => {
    expect(extractSheetFromDom(parse('<body><p>C 言語の入門</p><span>G</span></body>'))).toBeNull();
  });
});
