import type { SheetBody, SheetMeta } from '@/domain/sheet/types';
import {
  type ChordDB,
  getDB,
  type Sheet,
  type SheetRevision,
  type Song,
  type SourceKind,
  type SyncTable,
  type UserSheetSettings,
} from './db';

/** ログインしていないときの、端末内の利用者 ID（EX-01） */
export const LOCAL_USER_ID = 'local';

let currentUser = LOCAL_USER_ID;

/** いまの利用者 ID。ログインするとサーバーの利用者 ID になる */
export function currentUserId(): string {
  return currentUser;
}

export function setCurrentUserId(id: string | null) {
  currentUser = id ?? LOCAL_USER_ID;
}

function newId(): string {
  return crypto.randomUUID();
}

export function settingsKey(userId: string, sheetId: string): string {
  return JSON.stringify([userId, sheetId]);
}

/** 変更したレコードを送信待ちに積む（同じレコードは1件にまとまる） */
async function enqueue(db: ChordDB, table: SyncTable, key: string) {
  await db.outbox.put({ table, key, queuedAt: Date.now() });
  notifyChanged();
}

const changeListeners = new Set<() => void>();

/** 端末内のデータが変わったときに呼ばれる（同期のきっかけに使う） */
export function onLocalChange(listener: () => void): () => void {
  changeListeners.add(listener);
  return () => changeListeners.delete(listener);
}

function notifyChanged() {
  changeListeners.forEach((l) => l());
}

export type SheetInput = {
  meta: SheetMeta;
  body: SheetBody;
  referenceVideoUrl?: string;
};

export type NewSheetInput = SheetInput & {
  sourceKind: SourceKind;
  sourceUrl?: string;
  sourceSite?: string;
};

export class ValidationError extends Error {}

function requireTitle(meta: SheetMeta) {
  if (!meta.title?.trim()) throw new ValidationError('曲名を入力してください');
}

const WRITE_TABLES = (db: ChordDB) => [db.songs, db.sheets, db.sheetRevisions, db.userSheetSettings, db.outbox];

export async function createSheet(input: NewSheetInput): Promise<string> {
  requireTitle(input.meta);
  const db = getDB();
  const user = currentUserId();
  const now = Date.now();
  const song: Song = {
    id: newId(),
    title: input.meta.title!.trim(),
    artist: input.meta.artist?.trim() ?? '',
    externalIds: {},
    createdBy: user,
    createdAt: now,
    updatedAt: now,
  };
  const sheetId = newId();
  const revision: SheetRevision = {
    id: newId(),
    sheetId,
    revisionNo: 1,
    body: input.body,
    createdBy: user,
    createdAt: now,
  };
  const sheet: Sheet = {
    id: sheetId,
    songId: song.id,
    ownerId: user,
    // 外部取り込みの譜面は常に非公開（EX-13）。サーバー側でも制約で保証している
    visibility: 'private',
    sourceKind: input.sourceKind,
    sourceUrl: input.sourceUrl,
    sourceSite: input.sourceSite,
    importedAt: input.sourceKind === 'web_import' ? now : undefined,
    originalKey: input.meta.key,
    capo: input.meta.capo ?? 0,
    bpm: input.meta.bpm,
    timeSignature: input.meta.timeSignature ?? '4/4',
    referenceVideoUrl: input.referenceVideoUrl,
    currentRevisionId: revision.id,
    createdAt: now,
    updatedAt: now,
  };
  await db.transaction('rw', WRITE_TABLES(db), async () => {
    await db.songs.add(song);
    await db.sheets.add(sheet);
    await db.sheetRevisions.add(revision);
    await enqueue(db, 'songs', song.id);
    await enqueue(db, 'sheets', sheet.id);
    await enqueue(db, 'sheetRevisions', revision.id);
  });
  return sheetId;
}

/** 譜面を更新する。本体は新しい版として積み上げる（EX-06）。 */
export async function updateSheet(sheetId: string, input: SheetInput): Promise<void> {
  requireTitle(input.meta);
  const db = getDB();
  const now = Date.now();
  await db.transaction('rw', WRITE_TABLES(db), async () => {
    const sheet = await db.sheets.get(sheetId);
    if (!sheet || sheet.deletedAt) throw new Error('譜面が見つかりません');
    const last = await db.sheetRevisions.where('[sheetId+revisionNo]').between([sheetId, 0], [sheetId, Infinity]).last();
    const revision: SheetRevision = {
      id: newId(),
      sheetId,
      revisionNo: (last?.revisionNo ?? 0) + 1,
      body: input.body,
      createdBy: currentUserId(),
      createdAt: now,
    };
    await db.sheetRevisions.add(revision);
    await db.songs.update(sheet.songId, {
      title: input.meta.title!.trim(),
      artist: input.meta.artist?.trim() ?? '',
      updatedAt: now,
    });
    await db.sheets.update(sheetId, {
      currentRevisionId: revision.id,
      originalKey: input.meta.key,
      capo: input.meta.capo ?? 0,
      bpm: input.meta.bpm,
      timeSignature: input.meta.timeSignature ?? '4/4',
      referenceVideoUrl: input.referenceVideoUrl,
      updatedAt: now,
    });
    await enqueue(db, 'sheetRevisions', revision.id);
    await enqueue(db, 'songs', sheet.songId);
    await enqueue(db, 'sheets', sheetId);
  });
}

/** 論理削除（同期で他の端末に削除を伝えるため） */
export async function deleteSheet(sheetId: string): Promise<void> {
  const db = getDB();
  const now = Date.now();
  await db.transaction('rw', WRITE_TABLES(db), async () => {
    await db.sheets.update(sheetId, { deletedAt: now, updatedAt: now });
    await enqueue(db, 'sheets', sheetId);
  });
}

export type SheetDetail = { sheet: Sheet; song: Song; revision: SheetRevision };

export async function getSheetDetail(sheetId: string): Promise<SheetDetail | null> {
  const db = getDB();
  const sheet = await db.sheets.get(sheetId);
  if (!sheet || sheet.deletedAt) return null;
  const [song, revision] = await Promise.all([db.songs.get(sheet.songId), db.sheetRevisions.get(sheet.currentRevisionId)]);
  if (!song || !revision) return null;
  return { sheet, song, revision };
}

export function metaOf(detail: SheetDetail): SheetMeta {
  return {
    title: detail.song.title,
    artist: detail.song.artist || undefined,
    key: detail.sheet.originalKey,
    capo: detail.sheet.capo,
    bpm: detail.sheet.bpm,
    timeSignature: detail.sheet.timeSignature,
  };
}

export type LibraryItem = {
  sheetId: string;
  title: string;
  artist: string;
  key?: string;
  capo: number;
  sourceKind: SourceKind;
  updatedAt: number;
  lastOpenedAt?: number;
};

/**
 * ライブラリの一覧。最近開いた順（開いたことがなければ更新順）。
 * 端末内の DB はその端末の利用者1人分なので、持ち主では絞り込まない。
 * 同期で届いた直後で、本体の版がまだ届いていない譜面は出さない。
 */
export async function listLibrary(): Promise<LibraryItem[]> {
  const db = getDB();
  const sheets = (await db.sheets.toArray()).filter((s) => !s.deletedAt);
  const songs = new Map((await db.songs.bulkGet(sheets.map((s) => s.songId))).filter(Boolean).map((s) => [s!.id, s!]));
  const settings = new Map(
    (await db.userSheetSettings.where('userId').equals(currentUserId()).toArray()).map((s) => [s.sheetId, s]),
  );
  return sheets
    .filter((s) => songs.has(s.songId))
    .map((s) => {
      const song = songs.get(s.songId)!;
      return {
        sheetId: s.id,
        title: song.title,
        artist: song.artist,
        key: s.originalKey,
        capo: s.capo,
        sourceKind: s.sourceKind,
        updatedAt: s.updatedAt,
        lastOpenedAt: settings.get(s.id)?.lastOpenedAt,
      };
    })
    .sort((a, b) => (b.lastOpenedAt ?? b.updatedAt) - (a.lastOpenedAt ?? a.updatedAt));
}

export const DEFAULT_SETTINGS: Omit<UserSheetSettings, 'userId' | 'sheetId' | 'updatedAt'> = {
  transpose: 0,
  capo: null,
  scrollSpeed: 24,
  instrument: 'guitar',
  fontScale: 1,
  simplify: false,
};

export async function getSettings(sheetId: string): Promise<UserSheetSettings> {
  const user = currentUserId();
  const found = await getDB().userSheetSettings.get([user, sheetId]);
  return found ?? { ...DEFAULT_SETTINGS, userId: user, sheetId, updatedAt: 0 };
}

export async function saveSettings(
  sheetId: string,
  patch: Partial<Omit<UserSheetSettings, 'userId' | 'sheetId'>>,
): Promise<UserSheetSettings> {
  const db = getDB();
  return db.transaction('rw', db.userSheetSettings, db.outbox, async () => {
    const current = await getSettings(sheetId);
    const next = { ...current, ...patch, updatedAt: Date.now() };
    await db.userSheetSettings.put(next);
    await enqueue(db, 'userSheetSettings', settingsKey(next.userId, sheetId));
    return next;
  });
}

/**
 * ログインしたとき、未ログインの間に作ったデータをその利用者のものにして送信待ちに積む。
 * 同期より前に呼ぶ。
 */
export async function adoptLocalData(userId: string): Promise<void> {
  const db = getDB();
  await db.transaction('rw', WRITE_TABLES(db), async () => {
    const now = Date.now();
    const songs = (await db.songs.toArray()).filter((s) => s.createdBy === LOCAL_USER_ID);
    for (const s of songs) {
      await db.songs.update(s.id, { createdBy: userId, updatedAt: now });
      await enqueue(db, 'songs', s.id);
    }
    const sheets = await db.sheets.where('ownerId').equals(LOCAL_USER_ID).toArray();
    for (const s of sheets) {
      await db.sheets.update(s.id, { ownerId: userId, updatedAt: now });
      await enqueue(db, 'sheets', s.id);
    }
    const revisions = (await db.sheetRevisions.toArray()).filter((r) => r.createdBy === LOCAL_USER_ID);
    for (const r of revisions) {
      await db.sheetRevisions.update(r.id, { createdBy: userId });
      await enqueue(db, 'sheetRevisions', r.id);
    }
    const settings = await db.userSheetSettings.where('userId').equals(LOCAL_USER_ID).toArray();
    for (const s of settings) {
      await db.userSheetSettings.delete([LOCAL_USER_ID, s.sheetId]);
      await db.userSheetSettings.put({ ...s, userId, updatedAt: now });
      await db.outbox.delete(['userSheetSettings', settingsKey(LOCAL_USER_ID, s.sheetId)]);
      await enqueue(db, 'userSheetSettings', settingsKey(userId, s.sheetId));
    }
  });
}
