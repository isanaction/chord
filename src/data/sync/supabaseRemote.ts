import type { SupabaseClient } from '@supabase/supabase-js';
import type { SyncTable } from '../db';
import { REMOTE_TABLE, type RemoteRow, type RemoteStore } from './remote';

const CONFLICT_KEY: Record<SyncTable, string> = {
  songs: 'id',
  sheets: 'id',
  sheetRevisions: 'id',
  userSheetSettings: 'user_id,sheet_id',
};

export class SyncError extends Error {
  constructor(
    message: string,
    readonly code?: string,
  ) {
    super(message);
  }
}

/** Supabase を同期先にする。行の読み書きは RLS で本人の行に限られる */
export class SupabaseRemote implements RemoteStore {
  constructor(private client: SupabaseClient) {}

  async pull(table: SyncTable, since: string | null, limit: number): Promise<RemoteRow[]> {
    let q = this.client.from(REMOTE_TABLE[table]).select('*').order('server_updated_at', { ascending: true }).limit(limit);
    if (since) q = q.gt('server_updated_at', since);
    const { data, error } = await q;
    if (error) throw new SyncError(error.message, error.code);
    return (data ?? []) as RemoteRow[];
  }

  async upsert(table: SyncTable, rows: RemoteRow[]): Promise<void> {
    const { error } = await this.client.from(REMOTE_TABLE[table]).upsert(rows, { onConflict: CONFLICT_KEY[table] });
    if (error) throw new SyncError(error.message, error.code);
  }
}
