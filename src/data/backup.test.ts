import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { parseSheetText } from '@/domain/sheet/parse';
import { BackupFormatError, exportAll, importAll, parseBackup } from './backup';
import { ChordDB, setDB } from './db';
import { createSheet, getSheetDetail, LOCAL_USER_ID, saveSettings, setCurrentUserId, updateSheet } from './repository';

const body = () => parseSheetText('[C]あいう[G]えお').body;

beforeEach(() => {
  setCurrentUserId(null);
  setDB(new ChordDB(`backup-${Math.random()}`));
});

describe('書き出しと読み込み', () => {
  it('書き出したものを別の端末で読み込める', async () => {
    const id = await createSheet({ meta: { title: '冬のプラットホーム', key: 'C' }, body: body(), sourceKind: 'paste' });
    await saveSettings(id, { transpose: 2 });
    const json = JSON.stringify(await exportAll());

    setDB(new ChordDB(`other-${Math.random()}`));
    const result = await importAll(parseBackup(json), LOCAL_USER_ID);
    expect(result).toEqual({ added: 4, updated: 0, skipped: 0 });
    expect((await getSheetDetail(id))?.song.title).toBe('冬のプラットホーム');
  });

  it('同じものを読み込んでも重複しない。新しいものだけ上書きする', async () => {
    const id = await createSheet({ meta: { title: 'A' }, body: body(), sourceKind: 'paste' });
    const backup = await exportAll();
    expect(await importAll(backup, LOCAL_USER_ID)).toMatchObject({ added: 0, updated: 0 });

    await updateSheet(id, { meta: { title: 'A（新）' }, body: body() });
    // 古い書き出しを読み込んでも新しい内容は消えない
    await importAll(backup, LOCAL_USER_ID);
    expect((await getSheetDetail(id))?.song.title).toBe('A（新）');
  });

  it('形式の違うファイルは読み込まない', () => {
    expect(() => parseBackup('not json')).toThrow(BackupFormatError);
    expect(() => parseBackup('{"app":"other","version":1}')).toThrow(BackupFormatError);
    expect(() => parseBackup('{"app":"chord","version":1,"songs":[]}')).toThrow(BackupFormatError);
  });
});
