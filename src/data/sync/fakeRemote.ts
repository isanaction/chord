import type { SyncTable } from '../db';
import type { RemoteRow, RemoteStore } from './remote';

/**
 * テスト用のメモリ上のサーバー。本物（Supabase）と同じく
 * - server_updated_at を付ける
 * - updated_at が古い更新は無視する
 */
export class FakeRemote implements RemoteStore {
  private tables = new Map<SyncTable, Map<string, RemoteRow>>();
  private clock = Date.parse('2026-01-01T00:00:00Z');

  private table(t: SyncTable) {
    if (!this.tables.has(t)) this.tables.set(t, new Map());
    return this.tables.get(t)!;
  }

  private key(t: SyncTable, row: RemoteRow) {
    return t === 'userSheetSettings' ? `${row.user_id}|${row.sheet_id}` : String(row.id);
  }

  async upsert(t: SyncTable, rows: RemoteRow[]) {
    const table = this.table(t);
    for (const row of rows) {
      const k = this.key(t, row);
      const old = table.get(k);
      if (old && Number(old.updated_at) > Number(row.updated_at)) continue;
      this.clock += 1000;
      table.set(k, { ...row, server_updated_at: new Date(this.clock).toISOString() });
    }
  }

  async pull(t: SyncTable, since: string | null, limit: number) {
    return [...this.table(t).values()]
      .filter((r) => !since || r.server_updated_at! > since)
      .sort((a, b) => a.server_updated_at!.localeCompare(b.server_updated_at!))
      .slice(0, limit)
      .map((r) => ({ ...r }));
  }

  rows(t: SyncTable) {
    return [...this.table(t).values()];
  }
}
