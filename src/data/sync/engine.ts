import type { ChordDB, OutboxEntry, SyncTable } from '../db';
import { settingsKey } from '../repository';
import { fromRemote, type RemoteStore, toRemote } from './remote';

/** 参照される側から順に送る（曲 → 譜面 → 版 → 個人設定） */
const ORDER: SyncTable[] = ['songs', 'sheets', 'sheetRevisions', 'userSheetSettings'];
const PAGE = 500;
const CHUNK = 200;
/** 取得の取りこぼしを防ぐため、前回の目印より少し前から取り直す（取り直した分は重複として無視される） */
const OVERLAP_MS = 5_000;

type LocalRecord = { updatedAt?: number; createdAt?: number };

function tableOf(db: ChordDB, table: SyncTable) {
  return db[table] as unknown as {
    get(key: unknown): Promise<LocalRecord | undefined>;
    bulkGet(keys: unknown[]): Promise<(LocalRecord | undefined)[]>;
    put(record: unknown): Promise<unknown>;
  };
}

function parseKey(table: SyncTable, key: string): unknown {
  return table === 'userSheetSettings' ? JSON.parse(key) : key;
}

function keyOfRemote(table: SyncTable, row: Record<string, unknown>): string {
  return table === 'userSheetSettings' ? settingsKey(String(row.user_id), String(row.sheet_id)) : String(row.id);
}

function versionOf(r: LocalRecord | undefined): number {
  return r?.updatedAt ?? r?.createdAt ?? 0;
}

export type SyncResult = { pushed: number; pulled: number };

/** 送信待ちを送り、サーバーの変更を取り込む（設計書 5章）。 */
export async function syncOnce(db: ChordDB, remote: RemoteStore): Promise<SyncResult> {
  const pushed = await push(db, remote);
  const pulled = await pull(db, remote);
  return { pushed, pulled };
}

async function push(db: ChordDB, remote: RemoteStore): Promise<number> {
  const entries = await db.outbox.toArray();
  let count = 0;
  for (const table of ORDER) {
    const mine = entries.filter((e) => e.table === table);
    for (let i = 0; i < mine.length; i += CHUNK) {
      const chunk = mine.slice(i, i + CHUNK);
      const records = await tableOf(db, table).bulkGet(chunk.map((e) => parseKey(table, e.key)));
      const rows = records.filter((r): r is LocalRecord => Boolean(r)).map((r) => toRemote(table, r));
      if (rows.length > 0) await remote.upsert(table, rows);
      await removeSent(db, chunk);
      count += rows.length;
    }
  }
  return count;
}

/** 送った後に再び変更されたものは残す */
async function removeSent(db: ChordDB, sent: OutboxEntry[]) {
  await db.transaction('rw', db.outbox, async () => {
    for (const e of sent) {
      const now = await db.outbox.get([e.table, e.key]);
      if (now && now.queuedAt === e.queuedAt) await db.outbox.delete([e.table, e.key]);
    }
  });
}

async function pull(db: ChordDB, remote: RemoteStore): Promise<number> {
  let count = 0;
  for (const table of ORDER) {
    const state = await db.syncState.get(table);
    let since: string | null = state ? new Date(new Date(state.cursor).getTime() - OVERLAP_MS).toISOString() : null;
    let cursor = state?.cursor ?? null;
    for (;;) {
      const rows = await remote.pull(table, since, PAGE);
      for (const row of rows) {
        if (await applyRow(db, table, row)) count++;
        if (row.server_updated_at && (!cursor || row.server_updated_at > cursor)) cursor = row.server_updated_at;
      }
      if (cursor) await db.syncState.put({ table, cursor });
      if (rows.length < PAGE) break;
      since = rows[rows.length - 1].server_updated_at ?? cursor;
    }
  }
  return count;
}

/** サーバーの行を端末に反映する。端末側のほうが新しければ反映しない（新しいほうを優先） */
async function applyRow(db: ChordDB, table: SyncTable, row: Record<string, unknown>): Promise<boolean> {
  const key = keyOfRemote(table, row);
  const incoming = fromRemote<LocalRecord>(table, row);
  return db.transaction('rw', db[table], db.outbox, async () => {
    const local = await tableOf(db, table).get(parseKey(table, key));
    if (table === 'sheetRevisions' && local) return false; // 版は変わらない
    if (local && versionOf(local) >= versionOf(incoming)) return false;
    await tableOf(db, table).put(incoming);
    // サーバーのほうが新しかったので、古い送信待ちは捨てる
    await db.outbox.delete([table, key]);
    return true;
  });
}
