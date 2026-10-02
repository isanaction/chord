import { isParsed, parseChord } from '@/domain/chord/chord';

/**
 * ページの HTML 構造から譜面を読み取る（サイト固有の部品名に頼らない）。
 *
 * 1. 「中身がコード名だけ」の要素を探す
 * 2. コードをほぼ全部含むいちばん内側の要素を譜面の本体とみなす（メニューや曲一覧にはコードが無いので外れる）
 * 3. 本体の中を、「直下の子がそれぞれコードを1つ以下しか含まない要素」＝1行として読む
 * 4. 行の中は、コードを1つ含む部品ごとに「コード＋その下の歌詞」の区切りにする（ruby 表記も同じ扱い）
 *
 * 読み取った譜面は ChordPro のテキストで返す。読み取れなければ null。
 */
export function extractSheetFromDom(doc: Document): string | null {
  const root = doc.body;
  if (!root) return null;

  const chordEls = findChordElements(root);
  if (chordEls.length < MIN_CHORDS) return null;
  const chordSet = new Set(chordEls);

  const counts = new Map<Element, number>();
  for (const el of chordEls) {
    for (let a: Element | null = el; a && a !== root.parentElement; a = a.parentElement) {
      counts.set(a, (counts.get(a) ?? 0) + 1);
    }
  }
  const count = (el: Element) => counts.get(el) ?? 0;

  const container = pickContainer(counts);
  if (!container) return null;

  const lines: string[] = [];
  walkRows(container, count, chordSet, lines);
  const chordTotal = lines.reduce((n, l) => n + (l.match(/\[[^\]]+\]/g)?.length ?? 0), 0);
  return chordTotal >= MIN_CHORDS ? lines.join('\n') : null;
}

const MIN_CHORDS = 4;
const SKIP = new Set(['SCRIPT', 'STYLE', 'NOSCRIPT', 'TEMPLATE', 'SVG', 'svg', 'BUTTON', 'SELECT', 'OPTION', 'INPUT', 'TEXTAREA']);
const MAX_CHORD_TEXT = 16;
const MAX_LINE_TEXT = 200;

/** 画面に出る文字だけをつなげる（script や style の中身は除く） */
function textOf(node: Node): string {
  if (node.nodeType === 3) return node.nodeValue ?? '';
  if (node.nodeType !== 1) return '';
  const el = node as Element;
  if (SKIP.has(el.tagName)) return '';
  let s = '';
  for (const child of Array.from(el.childNodes)) s += textOf(child);
  return s;
}

function isChordText(s: string): boolean {
  const t = s.trim();
  if (!t || t.length > MAX_CHORD_TEXT || /\s/.test(t)) return false;
  return isParsed(parseChord(t));
}

/** 中身がコード名だけの要素のうち、いちばん外側のもの */
function findChordElements(root: Element): Element[] {
  const result: Element[] = [];
  for (const el of Array.from(root.querySelectorAll('*'))) {
    if (SKIP.has(el.tagName) || el.closest('script,style,noscript,template,button,select')) continue;
    const raw = el.textContent ?? '';
    if (raw.length > 64) continue;
    if (!isChordText(textOf(el))) continue;
    const parent = el.parentElement;
    if (parent && parent !== root && isChordText(textOf(parent))) continue;
    result.push(el);
  }
  return result;
}

function depthOf(el: Element): number {
  let d = 0;
  for (let a: Element | null = el; a; a = a.parentElement) d++;
  return d;
}

/** 直下の子がそれぞれコードを1つ以下しか含まない要素＝1行 */
function isRowLike(el: Element, count: (e: Element) => number): boolean {
  return Array.from(el.children).every((c) => count(c) <= 1);
}

/** 1行ではない要素のうち、コードをほぼ全部（9割以上）含むいちばん内側のもの */
function pickContainer(counts: Map<Element, number>): Element | null {
  const count = (e: Element) => counts.get(e) ?? 0;
  let max = 0;
  for (const [el, n] of counts) if (!isRowLike(el, count)) max = Math.max(max, n);
  let best: Element | null = null;
  let bestDepth = -1;
  for (const [el, n] of counts) {
    if (n < max * 0.9 || isRowLike(el, count)) continue;
    const d = depthOf(el);
    if (d > bestDepth || (d === bestDepth && best && best.compareDocumentPosition(el) & 2)) {
      best = el;
      bestDepth = d;
    }
  }
  return best;
}

function normalize(s: string): string {
  return s.replace(/[\s ]+/g, ' ');
}

/** 本体の中を行に分ける */
function walkRows(el: Element, count: (e: Element) => number, chordSet: Set<Element>, out: string[]) {
  for (const child of Array.from(el.childNodes)) {
    if (child.nodeType === 3) {
      pushText(normalize(child.nodeValue ?? '').trim(), out);
      continue;
    }
    if (child.nodeType !== 1) continue;
    const c = child as Element;
    if (SKIP.has(c.tagName)) continue;
    const n = count(c);
    if (n === 0) {
      pushText(normalize(textOf(c)).trim(), out);
    } else if (chordSet.has(c) || isRowLike(c, count)) {
      out.push(rowToChordPro(c, count, chordSet));
    } else {
      walkRows(c, count, chordSet, out);
    }
  }
}

function pushText(text: string, out: string[]) {
  if (text && text.length <= MAX_LINE_TEXT) out.push(text);
}

type Seg = { chord?: string; text: string };

/** 1行分の要素を「コード＋歌詞」の区切りにして ChordPro の1行にする */
function rowToChordPro(row: Element, count: (e: Element) => number, chordSet: Set<Element>): string {
  const segs: Seg[] = [];
  const append = (t: string) => {
    if (!t) return;
    if (segs.length === 0) segs.push({ text: '' });
    segs[segs.length - 1].text += t;
  };
  const visit = (node: Node) => {
    if (node.nodeType === 3) return append(node.nodeValue ?? '');
    if (node.nodeType !== 1) return;
    const el = node as Element;
    if (SKIP.has(el.tagName)) return;
    if (chordSet.has(el)) {
      segs.push({ chord: textOf(el).trim(), text: '' });
      return;
    }
    const n = count(el);
    if (n === 0) return append(textOf(el));
    if (n === 1) {
      // コードを1つだけ含む部品は「そのコード＋残りの文字」とする。
      // ruby（<ruby>歌詞<rt>C</rt></ruby>）のようにコードが後ろに書かれていても同じ扱い
      const chordEl = Array.from(el.querySelectorAll('*')).find((d) => chordSet.has(d))!;
      if (el.tagName === 'RUBY' || !textBefore(el, chordEl).trim()) {
        segs.push({ chord: textOf(chordEl).trim(), text: textExcept(el, chordEl) });
        return;
      }
    }
    for (const child of Array.from(el.childNodes)) visit(child);
  };
  // 行そのものではなく中身から読む（行の先頭にコードの無い歌詞があることがあるため）
  if (chordSet.has(row)) visit(row);
  else for (const child of Array.from(row.childNodes)) visit(child);

  const cleaned = segs
    .map((s) => ({ chord: s.chord, text: normalize(s.text).trim() }))
    .filter((s) => s.chord || s.text);
  return cleaned
    .map((s, i) => (s.chord ? `[${s.chord}]` : '') + (s.text || (s.chord && i < cleaned.length - 1 ? ' ' : '')))
    .join('');
}

/** el の中で、target より前にある文字 */
function textBefore(el: Element, target: Element): string {
  let s = '';
  for (const child of Array.from(el.childNodes)) {
    if (child === target) return s;
    if (child.nodeType === 1 && (child as Element).contains(target)) return s + textBefore(child as Element, target);
    s += textOf(child);
  }
  return s;
}

function textExcept(el: Element, skip: Element): string {
  let s = '';
  for (const child of Array.from(el.childNodes)) {
    if (child === skip) continue;
    if (child.nodeType === 1 && (child as Element).contains(skip)) s += textExcept(child as Element, skip);
    else s += textOf(child);
  }
  return s;
}
