import { genericText, splitPageTitle } from './generic';
import type { ImportAdapter, ImportCandidate, ImportPayload } from './types';

/**
 * 対応サイトの一覧。専用の読み取り（HTML 構造を使う）は、実際のページを元に作る（設計書 6.4）。
 * それまでは本文テキストからの汎用の読み取りを使う。
 * この一覧から外せば、そのサイトからの取り込みは止まる（EX-14）。
 */
export const ADAPTERS: ImportAdapter[] = [
  {
    site: 'ufret',
    siteName: 'U-FRET',
    origins: ['https://www.ufret.jp', 'https://ufret.jp'],
    parse: () => null,
  },
  {
    site: 'gakkime',
    siteName: '楽器.me',
    origins: ['https://gakufu.gakki.me', 'https://gakki.me'],
    parse: () => null,
  },
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
    ...splitPageTitle(payload.title, adapter.siteName),
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
