import Dexie, { type EntityTable } from 'dexie';
import type { SheetBody } from '@/domain/sheet/types';

/**
 * 端末内の保存先（設計書 4章・5章）。テーブル構成はサーバー側（Supabase）と揃え、
 * ステップ 1-2 で同期を足しても形が変わらないようにしている。
 */

export type Visibility = 'private' | 'unlisted' | 'public';
export type SourceKind = 'manual' | 'paste' | 'web_import';
export type Instrument = 'guitar' | 'piano';

export type Song = {
  id: string;
  title: string;
  titleReading?: string;
  artist: string;
  artistReading?: string;
  externalIds: Record<string, string>;
  createdBy: string;
  createdAt: number;
  updatedAt: number;
};

export type Sheet = {
  id: string;
  songId: string;
  ownerId: string;
  visibility: Visibility;
  sourceKind: SourceKind;
  sourceUrl?: string;
  sourceSite?: string;
  importedAt?: number;
  originalKey?: string;
  capo: number;
  bpm?: number;
  timeSignature: string;
  referenceVideoUrl?: string;
  currentRevisionId: string;
  createdAt: number;
  updatedAt: number;
  deletedAt?: number;
};

export type SheetRevision = {
  id: string;
  sheetId: string;
  revisionNo: number;
  body: SheetBody;
  createdBy: string;
  createdAt: number;
};

export type UserSheetSettings = {
  userId: string;
  sheetId: string;
  transpose: number;
  /** null なら譜面の既定値 */
  capo: number | null;
  /** 自動スクロールの速さ（px/秒） */
  scrollSpeed: number;
  instrument: Instrument;
  fontScale: number;
  simplify: boolean;
  lastOpenedAt?: number;
  updatedAt: number;
};

/** 同期の対象になるテーブル */
export type SyncTable = 'songs' | 'sheets' | 'sheetRevisions' | 'userSheetSettings';

/** サーバーへの送信待ち（同じレコードは1件にまとまる） */
export type OutboxEntry = { table: SyncTable; key: string; queuedAt: number };

/** テーブルごとに、サーバーからどこまで取得したか */
export type SyncState = { table: SyncTable; cursor: string };

export class ChordDB extends Dexie {
  songs!: EntityTable<Song, 'id'>;
  sheets!: EntityTable<Sheet, 'id'>;
  sheetRevisions!: EntityTable<SheetRevision, 'id'>;
  userSheetSettings!: Dexie.Table<UserSheetSettings, [string, string]>;
  outbox!: Dexie.Table<OutboxEntry, [SyncTable, string]>;
  syncState!: Dexie.Table<SyncState, SyncTable>;

  constructor(name = 'chord') {
    super(name);
    this.version(1).stores({
      songs: 'id, title, artist, updatedAt',
      sheets: 'id, songId, ownerId, updatedAt, deletedAt',
      sheetRevisions: 'id, sheetId, [sheetId+revisionNo]',
      userSheetSettings: '[userId+sheetId], userId, lastOpenedAt',
    });
    this.version(2).stores({
      outbox: '[table+key], queuedAt',
      syncState: 'table',
    });
  }
}

let instance: ChordDB | null = null;

export function getDB(): ChordDB {
  instance ??= new ChordDB();
  return instance;
}

/** テスト用に差し替える */
export function setDB(db: ChordDB | null) {
  instance = db;
}
