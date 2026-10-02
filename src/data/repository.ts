import type { SheetBody, SheetMeta } from '@/domain/sheet/types';
import { getDB, type Sheet, type SheetRevision, type Song, type SourceKind, type UserSheetSettings } from './db';

/** ログインと同期を入れるまでの、端末内の利用者 ID（EX-01） */
export const LOCAL_USER_ID = 'local';

function newId(): string {
  return crypto.randomUUID();
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

export async function createSheet(input: NewSheetInput): Promise<string> {
  requireTitle(input.meta);
  const db = getDB();
  const now = Date.now();
  const song: Song = {
    id: newId(),
    title: input.meta.title!.trim(),
    artist: input.meta.artist?.trim() ?? '',
    externalIds: {},
    createdBy: LOCAL_USER_ID,
    createdAt: now,
    updatedAt: now,
  };
  const sheetId = newId();
  const revision: SheetRevision = {
    id: newId(),
    sheetId,
    revisionNo: 1,
    body: input.body,
    createdBy: LOCAL_USER_ID,
    createdAt: now,
  };
  const sheet: Sheet = {
    id: sheetId,
    songId: song.id,
    ownerId: LOCAL_USER_ID,
    // 外部取り込みの譜面は常に非公開（EX-13）。公開機能を作るときもこの値は変えられない
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
  await db.transaction('rw', db.songs, db.sheets, db.sheetRevisions, async () => {
    await db.songs.add(song);
    await db.sheetRevisions.add(revision);
    await db.sheets.add(sheet);
  });
  return sheetId;
}

/** 譜面を更新する。本体は新しい版として積み上げる（EX-06）。 */
export async function updateSheet(sheetId: string, input: SheetInput): Promise<void> {
  requireTitle(input.meta);
  const db = getDB();
  const now = Date.now();
  await db.transaction('rw', db.songs, db.sheets, db.sheetRevisions, async () => {
    const sheet = await db.sheets.get(sheetId);
    if (!sheet || sheet.deletedAt) throw new Error('譜面が見つかりません');
    const last = await db.sheetRevisions.where('[sheetId+revisionNo]').between([sheetId, 0], [sheetId, Infinity]).last();
    const revision: SheetRevision = {
      id: newId(),
      sheetId,
      revisionNo: (last?.revisionNo ?? 0) + 1,
      body: input.body,
      createdBy: LOCAL_USER_ID,
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
  });
}

/** 論理削除（同期で他の端末に削除を伝えるため） */
export async function deleteSheet(sheetId: string): Promise<void> {
  const now = Date.now();
  await getDB().sheets.update(sheetId, { deletedAt: now, updatedAt: now });
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

/** ライブラリの一覧。最近開いた順（開いたことがなければ更新順）。 */
export async function listLibrary(): Promise<LibraryItem[]> {
  const db = getDB();
  const sheets = (await db.sheets.where('ownerId').equals(LOCAL_USER_ID).toArray()).filter((s) => !s.deletedAt);
  const songs = new Map((await db.songs.bulkGet(sheets.map((s) => s.songId))).filter(Boolean).map((s) => [s!.id, s!]));
  const settings = new Map(
    (await db.userSheetSettings.where('userId').equals(LOCAL_USER_ID).toArray()).map((s) => [s.sheetId, s]),
  );
  return sheets
    .map((s) => {
      const song = songs.get(s.songId);
      return {
        sheetId: s.id,
        title: song?.title ?? '',
        artist: song?.artist ?? '',
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
  const found = await getDB().userSheetSettings.get([LOCAL_USER_ID, sheetId]);
  return found ?? { ...DEFAULT_SETTINGS, userId: LOCAL_USER_ID, sheetId, updatedAt: 0 };
}

export async function saveSettings(
  sheetId: string,
  patch: Partial<Omit<UserSheetSettings, 'userId' | 'sheetId'>>,
): Promise<UserSheetSettings> {
  const db = getDB();
  return db.transaction('rw', db.userSheetSettings, async () => {
    const current = await getSettings(sheetId);
    const next = { ...current, ...patch, updatedAt: Date.now() };
    await db.userSheetSettings.put(next);
    return next;
  });
}
