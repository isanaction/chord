/** ブックマークレットから送られてくるデータ（取り込み元ページの内容。信用しないデータとして扱う） */
export type ImportPayload = {
  type: 'chord-import';
  version: 1;
  url: string;
  title: string;
  /** ページ全体の HTML（サイト専用アダプタ用。画面には差し込まない） */
  html: string;
  /** 表示されている本文テキスト */
  text: string;
  /** 利用者が選択していた範囲のテキスト */
  selection: string;
};

export type ImportCandidate = {
  site: string;
  siteName: string;
  url: string;
  title?: string;
  artist?: string;
  /** 譜面テキスト（コード行＋歌詞行 または ChordPro） */
  text: string;
};

/** サイトごとの取り込みアダプタ（設計書 6.3） */
export interface ImportAdapter {
  site: string;
  siteName: string;
  origins: string[];
  /** ページタイトルから取り除くサイト名の表記 */
  titleNoise: string[];
  /** 読み取れなければ null（汎用の読み取りに回す） */
  parse(payload: ImportPayload, doc: Document | null): ImportCandidate | null;
}
