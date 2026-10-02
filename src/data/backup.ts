import { getDB, type Sheet, type SheetRevision, type Song, type SyncTable, type UserSheetSettings } from './db';
import { settingsKey } from './repository';

/** 全データの書き出し形式（F-DATA-03）。バックアップと、将来の乗り換え用 */
export type Backup = {
  app: 'chord';
  version: 1;
  exportedAt: string;
  songs: Song[];
  sheets: Sheet[];
  sheetRevisions: SheetRevision[];
  userSheetSettings: UserSheetSettings[];
};

export async function exportAll(): Promise<Backup> {
  const db = getDB();
  const [songs, sheets, sheetRevisions, userSheetSettings] = await Promise.all([
    db.songs.toArray(),
    db.sheets.toArray(),
    db.sheetRevisions.toArray(),
    db.userSheetSettings.toArray(),
  ]);
  return { app: 'chord', version: 1, exportedAt: new Date().toISOString(), songs, sheets, sheetRevisions, userSheetSettings };
}

export class BackupFormatError extends Error {}

function isArrayOf(value: unknown, key: string): value is Record<string, unknown>[] {
  return Array.isArray(value) && value.every((v) => v && typeof v === 'object' && key in v);
}

export function parseBackup(json: string): Backup {
  let data: unknown;
  try {
    data = JSON.parse(json);
  } catch {
    throw new BackupFormatError('JSON として読み取れませんでした');
  }
  const d = data as Partial<Backup>;
  if (d?.app !== 'chord' || d.version !== 1) throw new BackupFormatError('このアプリの書き出しファイルではありません');
  if (
    !isArrayOf(d.songs, 'id') ||
    !isArrayOf(d.sheets, 'id') ||
    !isArrayOf(d.sheetRevisions, 'id') ||
    !isArrayOf(d.userSheetSettings, 'sheetId')
  ) {
    throw new BackupFormatError('ファイルの中身が足りません');
  }
  return d as Backup;
}

export type ImportResult = { added: number; updated: number; skipped: number };

/**
 * 書き出したデータを読み込む。同じ ID のものは更新時刻が新しいときだけ上書きする。
 * 読み込んだものは同期の送信待ちに積む。
 */
export async function importAll(backup: Backup, userId: string): Promise<ImportResult> {
  const db = getDB();
  const result: ImportResult = { added: 0, updated: 0, skipped: 0 };
  const now = Date.now();
  await db.transaction('rw', [db.songs, db.sheets, db.sheetRevisions, db.userSheetSettings, db.outbox], async () => {
    const put = async <T extends object>(
      table: SyncTable,
      record: T,
      key: string,
      existing: (T & { updatedAt?: number; createdAt?: number }) | undefined,
      write: () => Promise<unknown>,
    ) => {
      const incoming = record as T & { updatedAt?: number; createdAt?: number };
      const version = (r?: { updatedAt?: number; createdAt?: number }) => r?.updatedAt ?? r?.createdAt ?? 0;
      if (existing && version(existing) >= version(incoming)) {
        result.skipped++;
        return;
      }
      await write();
      await db.outbox.put({ table, key, queuedAt: now });
      if (existing) result.updated++;
      else result.added++;
    };
    // 書き出した人と読み込む人が違っても、自分のデータとして取り込む
    for (const s of backup.songs) {
      const r = { ...s, createdBy: userId };
      await put('songs', r, s.id, await db.songs.get(s.id), () => db.songs.put(r));
    }
    for (const s of backup.sheets) {
      const r = { ...s, ownerId: userId };
      await put('sheets', r, s.id, await db.sheets.get(s.id), () => db.sheets.put(r));
    }
    for (const s of backup.sheetRevisions) {
      const r = { ...s, createdBy: userId };
      await put('sheetRevisions', r, s.id, await db.sheetRevisions.get(s.id), () => db.sheetRevisions.put(r));
    }
    for (const s of backup.userSheetSettings) {
      const r = { ...s, userId };
      await put('userSheetSettings', r, settingsKey(userId, s.sheetId), await db.userSheetSettings.get([userId, s.sheetId]), () =>
        db.userSheetSettings.put(r),
      );
    }
  });
  return result;
}
