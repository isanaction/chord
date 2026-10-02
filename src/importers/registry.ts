import { genericText, splitPageTitle } from './generic';
import { extractSheetFromDom } from './structural';
import type { ImportAdapter, ImportCandidate, ImportPayload } from './types';

/** ページの HTML 構造から譜面を読むアダプタを作る。読めなければ本文テキストからの読み取りに回る */
function structuralAdapter(site: string, siteName: string, origins: string[], titleNoise: string[]): ImportAdapter {
  return {
    site,
    siteName,
    origins,
    titleNoise,
    parse(payload, doc) {
      const text = doc ? extractSheetFromDom(doc) : null;
      if (!text) return null;
      return { site, siteName, url: payload.url, ...splitPageTitle(payload.title, titleNoise), text };
    },
  };
}

/**
 * 対応サイトの一覧。この一覧から外せば、そのサイトからの取り込みは止まる（EX-14）。
 */
export const ADAPTERS: ImportAdapter[] = [
  structuralAdapter('ufret', 'U-FRET', ['https://www.ufret.jp', 'https://ufret.jp'], ['U-FRET', 'U-フレット', 'Uフレット']),
  structuralAdapter('gakkime', '楽器.me', ['https://gakufu.gakki.me', 'https://gakki.me'], ['楽器.me', '楽器ミー']),
];

export function findAdapter(origin: string): ImportAdapter | null {
  return ADAPTERS.find((a) => a.origins.includes(origin)) ?? null;
}

export type ImportOutcome =
  | { ok: true; candidate: ImportCandidate; usedSelection: boolean }
  | { ok: false; reason: string };

const MAX_HTML = 5_000_000;

/**
 * 受け取ったデータを譜面の候補にする。
 * - 対応サイト: 専用の読み取り → だめなら汎用の読み取り
 * - それ以外のサイト: 選択範囲がある場合だけ受け付ける（コピー＆ペーストと同じ扱い）
 */
export function interpretPayload(origin: string, payload: ImportPayload, parseHtml: (html: string) => Document | null): ImportOutcome {
  const adapter = findAdapter(origin);
  const usedSelection = payload.selection.trim().length > 0;
  if (!adapter) {
    if (!usedSelection) {
      return { ok: false, reason: 'このサイトには対応していません。譜面の部分を選択してから、もう一度ブックマークレットを押してください。' };
    }
    const host = safeHost(payload.url) ?? origin;
    return {
      ok: true,
      usedSelection,
      candidate: { site: host, siteName: host, url: payload.url, ...splitPageTitle(payload.title), text: genericText(payload) },
    };
  }
  const doc = payload.html.length <= MAX_HTML ? parseHtml(payload.html) : null;
  const special = usedSelection ? null : adapter.parse(payload, doc);
  const candidate: ImportCandidate = special ?? {
    site: adapter.site,
    siteName: adapter.siteName,
    url: payload.url,
    ...splitPageTitle(payload.title, adapter.titleNoise),
    text: genericText(payload),
  };
  if (!candidate.text.trim()) return { ok: false, reason: '譜面を読み取れませんでした。譜面の部分を選択してから、もう一度押してください。' };
  return { ok: true, candidate, usedSelection };
}

function safeHost(url: string): string | null {
  try {
    return new URL(url).host;
  } catch {
    return null;
  }
}

/** 受け取ったデータの形を確かめる */
export function isImportPayload(data: unknown): data is ImportPayload {
  if (!data || typeof data !== 'object') return false;
  const d = data as Record<string, unknown>;
  return (
    d.type === 'chord-import' &&
    d.version === 1 &&
    typeof d.url === 'string' &&
    typeof d.title === 'string' &&
    typeof d.html === 'string' &&
    typeof d.text === 'string' &&
    typeof d.selection === 'string'
  );
}
