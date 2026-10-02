import type { SyncTable } from '../db';

/** サーバー側のテーブル名（snake_case） */
export const REMOTE_TABLE: Record<SyncTable, string> = {
  songs: 'songs',
  sheets: 'sheets',
  sheetRevisions: 'sheet_revisions',
  userSheetSettings: 'user_sheet_settings',
};

/** サーバーの行。server_updated_at はサーバーが付ける更新時刻（取得の目印） */
export type RemoteRow = Record<string, unknown> & { server_updated_at?: string };

/** 同期先のサーバー。テストでは偽物に差し替える */
export interface RemoteStore {
  /** since より後に更新された行を、server_updated_at の昇順で最大 limit 件返す */
  pull(table: SyncTable, since: string | null, limit: number): Promise<RemoteRow[]>;
  /** 行を追加または更新する。updated_at が古い更新はサーバー側で無視される */
  upsert(table: SyncTable, rows: RemoteRow[]): Promise<void>;
}

const toSnake = (k: string) => k.replace(/[A-Z]/g, (c) => '_' + c.toLowerCase());
const toCamel = (k: string) => k.replace(/_([a-z])/g, (_, c: string) => c.toUpperCase());

// null に意味がある項目（未設定 = 譜面の既定値を使う）
const KEEP_NULL: Partial<Record<SyncTable, string[]>> = { userSheetSettings: ['capo'] };

/** 端末内のレコード → サーバーの行 */
export function toRemote(table: SyncTable, record: object): RemoteRow {
  const row: RemoteRow = {};
  for (const [k, v] of Object.entries(record)) row[toSnake(k)] = v === undefined ? null : v;
  // 版は作成後に変わらないので、更新時刻 = 作成時刻とする
  if (table === 'sheetRevisions') row.updated_at = row.created_at;
  return row;
}

/** サーバーの行 → 端末内のレコード */
export function fromRemote<T>(table: SyncTable, row: RemoteRow): T {
  const record: Record<string, unknown> = {};
  const keepNull = KEEP_NULL[table] ?? [];
  for (const [k, v] of Object.entries(row)) {
    if (k === 'server_updated_at') continue;
    if (table === 'sheetRevisions' && k === 'updated_at') continue;
    const key = toCamel(k);
    if (v === null && !keepNull.includes(key)) continue;
    record[key] = v;
  }
  return record as T;
}
