import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { parseSheetText } from '@/domain/sheet/parse';
import { ChordDB, setDB } from '../db';
import {
  adoptLocalData,
  createSheet,
  createSyncTrack,
  findSyncTrack,
  deleteSheet,
  getSettings,
  getSheetDetail,
  LOCAL_USER_ID,
  listLibrary,
  saveSettings,
  setCurrentUserId,
  updateSheet,
  updateSyncTrack,
} from '../repository';
import { syncOnce } from './engine';
import { FakeRemote } from './fakeRemote';
import { fromRemote, toRemote } from './remote';

const USER = '11111111-1111-4111-8111-111111111111';
const sheetText = () => ({ body: parseSheetText('[G]あいう[D]えお').body });

let remote: FakeRemote;
let pc: ChordDB;
let phone: ChordDB;

/** 端末を切り替えて操作する */
async function on<T>(device: ChordDB, fn: () => Promise<T>): Promise<T> {
  setDB(device);
  return fn();
}

beforeEach(() => {
  remote = new FakeRemote();
  pc = new ChordDB(`pc-${Math.random()}`);
  phone = new ChordDB(`phone-${Math.random()}`);
  setCurrentUserId(USER);
});

describe('行の変換', () => {
  it('camelCase と snake_case を相互に変換し、null に意味がある項目は残す', () => {
    const row = toRemote('userSheetSettings', { userId: 'u', sheetId: 's', capo: null, transpose: 2, lastOpenedAt: undefined });
    expect(row).toEqual({ user_id: 'u', sheet_id: 's', capo: null, transpose: 2, last_opened_at: null });
    expect(fromRemote('userSheetSettings', row)).toEqual({ userId: 'u', sheetId: 's', capo: null, transpose: 2 });
  });

  it('版は更新時刻 = 作成時刻として送る', () => {
    expect(toRemote('sheetRevisions', { id: 'r', createdAt: 5 })).toMatchObject({ created_at: 5, updated_at: 5 });
  });
});

describe('端末間の同期', () => {
  it('PC で作った譜面がスマホに届く', async () => {
    const id = await on(pc, () => createSheet({ meta: { title: '海沿いのラジオ', key: 'D' }, ...sheetText(), sourceKind: 'paste' }));
    expect(await on(pc, () => syncOnce(pc, remote))).toMatchObject({ pushed: 3 });
    expect(await pc.outbox.count()).toBe(0);

    await on(phone, () => syncOnce(phone, remote));
    const detail = await on(phone, () => getSheetDetail(id));
    expect(detail?.song.title).toBe('海沿いのラジオ');
    expect(detail?.revision.body.sections[0].lines[0]).toMatchObject({ kind: 'lyric' });
    expect((await on(phone, listLibrary)).map((i) => i.title)).toEqual(['海沿いのラジオ']);
  });

  it('編集・個人設定・削除も届く', async () => {
    const id = await on(pc, () => createSheet({ meta: { title: 'A' }, ...sheetText(), sourceKind: 'paste' }));
    await on(pc, () => syncOnce(pc, remote));
    await on(phone, () => syncOnce(phone, remote));

    await on(phone, () => updateSheet(id, { meta: { title: 'A（改）', capo: 2 }, ...sheetText() }));
    await on(phone, () => saveSettings(id, { transpose: -1, capo: null }));
    await on(phone, () => syncOnce(phone, remote));
    await on(pc, () => syncOnce(pc, remote));

    const detail = await on(pc, () => getSheetDetail(id));
    expect(detail?.song.title).toBe('A（改）');
    expect(detail?.revision.revisionNo).toBe(2);
    const settings = await on(pc, () => getSettings(id));
    expect(settings).toMatchObject({ transpose: -1, capo: null });

    await on(pc, () => deleteSheet(id));
    await on(pc, () => syncOnce(pc, remote));
    await on(phone, () => syncOnce(phone, remote));
    expect(await on(phone, () => getSheetDetail(id))).toBeNull();
  });

  it('同じ設定を両方で変えたら、後から変えたほうが残る', async () => {
    const id = await on(pc, () => createSheet({ meta: { title: 'A' }, ...sheetText(), sourceKind: 'paste' }));
    await on(pc, () => syncOnce(pc, remote));
    await on(phone, () => syncOnce(phone, remote));

    await on(pc, () => saveSettings(id, { transpose: 1 }));
    await on(phone, () => saveSettings(id, { transpose: 3 }));
    // スマホの変更のほうが新しい（PC の更新時刻を過去にしてある）
    await pc.userSheetSettings.update([USER, id], { updatedAt: 1000 });

    await on(phone, () => syncOnce(phone, remote));
    await on(pc, () => syncOnce(pc, remote));
    await on(phone, () => syncOnce(phone, remote));
    expect((await on(pc, () => getSettings(id))).transpose).toBe(3);
    expect((await on(phone, () => getSettings(id))).transpose).toBe(3);
  });

  it('同期データと練習の設定も届く', async () => {
    const id = await on(pc, () => createSheet({ meta: { title: 'A' }, ...sheetText(), sourceKind: 'paste' }));
    const detail = await on(pc, () => getSheetDetail(id));
    const lineId = detail!.revision.body.sections[0].lines[0].id;
    const track = await on(pc, () => createSyncTrack({ sheetId: id, videoId: 'dQw4w9WgXcQ', revisionId: detail!.revision.id }));
    await on(pc, () => updateSyncTrack(track.id, { cues: [{ lineId, t: 12_340 }], offsetMs: -100 }));
    await on(pc, () => saveSettings(id, { loop: { a: 10_000, b: 20_000 }, playbackRate: 0.75, syncTrackId: track.id }));
    await on(pc, () => syncOnce(pc, remote));
    expect(remote.rows('syncTracks')[0]).toMatchObject({ video_id: 'dQw4w9WgXcQ', offset_ms: -100 });

    await on(phone, () => syncOnce(phone, remote));
    const got = await on(phone, () => findSyncTrack(id, 'dQw4w9WgXcQ'));
    expect(got).toMatchObject({ id: track.id, cues: [{ lineId, t: 12_340 }], offsetMs: -100 });
    expect(await on(phone, () => getSettings(id))).toMatchObject({
      loop: { a: 10_000, b: 20_000 },
      playbackRate: 0.75,
      syncTrackId: track.id,
    });
  });

    it('もう一度同期しても重複して取り込まない', async () => {
    await on(pc, () => createSheet({ meta: { title: 'A' }, ...sheetText(), sourceKind: 'paste' }));
    await on(pc, () => syncOnce(pc, remote));
    await on(phone, () => syncOnce(phone, remote));
    expect(await on(phone, () => syncOnce(phone, remote))).toEqual({ pushed: 0, pulled: 0 });
  });
});

describe('ログイン時の付け替え', () => {
  it('未ログインで作ったデータを自分のものにして送る', async () => {
    setCurrentUserId(null);
    const id = await on(pc, () => createSheet({ meta: { title: 'A' }, ...sheetText(), sourceKind: 'paste' }));
    await on(pc, () => saveSettings(id, { transpose: 2 }));
    expect((await pc.sheets.get(id))?.ownerId).toBe(LOCAL_USER_ID);

    setCurrentUserId(USER);
    await on(pc, () => adoptLocalData(USER));
    await on(pc, () => syncOnce(pc, remote));

    expect(remote.rows('sheets')[0]).toMatchObject({ id, owner_id: USER });
    expect(remote.rows('userSheetSettings')[0]).toMatchObject({ user_id: USER, sheet_id: id, transpose: 2 });
    expect(remote.rows('sheetRevisions')[0]).toMatchObject({ created_by: USER });
  });
});
