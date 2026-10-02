import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { parseSheetText } from '@/domain/sheet/parse';
import { ChordDB, setDB } from './db';
import {
  createSheet,
  deleteSheet,
  getSettings,
  getSheetDetail,
  listLibrary,
  saveSettings,
  updateSheet,
  ValidationError,
} from './repository';

const sample = () => parseSheetText('{title: 坂道とスニーカー}\n{key: Eb}\n[Eb]あいう[Bb]えお');

beforeEach(() => {
  setDB(new ChordDB(`test-${Math.random()}`));
});

describe('譜面の保存', () => {
  it('作成して読み出せる', async () => {
    const { meta, body } = sample();
    const id = await createSheet({ meta, body, sourceKind: 'paste' });
    const detail = await getSheetDetail(id);
    expect(detail?.song.title).toBe('坂道とスニーカー');
    expect(detail?.sheet.originalKey).toBe('Eb');
    expect(detail?.sheet.visibility).toBe('private');
    expect(detail?.revision.revisionNo).toBe(1);
  });

  it('曲名がなければ保存しない', async () => {
    const { body } = sample();
    await expect(createSheet({ meta: {}, body, sourceKind: 'paste' })).rejects.toBeInstanceOf(ValidationError);
  });

  it('外部取り込みの譜面は非公開で保存し、取り込み元を記録する', async () => {
    const { meta, body } = sample();
    const id = await createSheet({ meta, body, sourceKind: 'web_import', sourceUrl: 'https://example.com/x', sourceSite: 'ufret' });
    const detail = await getSheetDetail(id);
    expect(detail?.sheet).toMatchObject({ visibility: 'private', sourceSite: 'ufret', sourceUrl: 'https://example.com/x' });
    expect(detail?.sheet.importedAt).toBeTypeOf('number');
  });

  it('更新すると版が増える', async () => {
    const { meta, body } = sample();
    const id = await createSheet({ meta, body, sourceKind: 'paste' });
    await updateSheet(id, { meta: { ...meta, title: '坂道とスニーカー（改）', capo: 1 }, body });
    const detail = await getSheetDetail(id);
    expect(detail?.revision.revisionNo).toBe(2);
    expect(detail?.song.title).toBe('坂道とスニーカー（改）');
    expect(detail?.sheet.capo).toBe(1);
  });

  it('削除した譜面は一覧に出ない', async () => {
    const { meta, body } = sample();
    const id = await createSheet({ meta, body, sourceKind: 'paste' });
    await deleteSheet(id);
    expect(await getSheetDetail(id)).toBeNull();
    expect(await listLibrary()).toEqual([]);
  });
});

describe('個人設定とライブラリ', () => {
  it('設定を保存し、最近開いた順に並べる', async () => {
    const { body } = sample();
    const a = await createSheet({ meta: { title: 'A' }, body, sourceKind: 'paste' });
    const b = await createSheet({ meta: { title: 'B' }, body, sourceKind: 'paste' });
    expect((await getSettings(a)).transpose).toBe(0);
    await saveSettings(a, { transpose: -2, lastOpenedAt: Date.now() + 1000 });
    expect((await getSettings(a)).transpose).toBe(-2);
    const list = await listLibrary();
    expect(list.map((i) => i.sheetId)).toEqual([a, b]);
  });
});
