import { expect, test } from '@playwright/test';
import { readFile } from 'node:fs/promises';

async function addSheet(page: import('@playwright/test').Page, title: string) {
  await page.goto('/new');
  await page.getByRole('textbox', { name: '譜面テキスト' }).fill('Key: G\nG       C\nまだ眠る街の\nD       G\n白い息が');
  await page.getByLabel('曲名（必須）').fill(title);
  await page.getByRole('button', { name: '保存', exact: true }).click();
  await expect(page.getByRole('heading', { name: title })).toBeVisible();
  return new URL(page.url()).searchParams.get('id')!;
}

test('オフラインでも保存済みの譜面を開ける', async ({ page, context }) => {
  await page.goto('/');
  // Service Worker が画面と JS を保存し終えるまで待つ
  await page.evaluate(async () => {
    const reg = await navigator.serviceWorker.ready;
    return reg.active?.state;
  });
  const id = await addSheet(page, 'オフラインの曲');

  await context.setOffline(true);
  await page.goto(`/sheet?id=${id}`);
  await expect(page.getByRole('heading', { name: 'オフラインの曲' })).toBeVisible();
  await page.goto('/');
  await expect(page.getByRole('link', { name: /オフラインの曲/ })).toBeVisible();
  await context.setOffline(false);
});

test('同期が未設定なら端末だけに保存すると案内し、書き出し・読み込みができる', async ({ page }) => {
  await addSheet(page, '書き出す曲');
  await page.goto('/settings');
  await expect(page.getByText('同期先が設定されていないため')).toBeVisible();

  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'すべて書き出す' }).click();
  const download = await downloadPromise;
  const json = JSON.parse(await readFile((await download.path())!, 'utf8'));
  expect(json.app).toBe('chord');
  expect(json.songs.map((s: { title: string }) => s.title)).toContain('書き出す曲');

  await page.getByLabel('書き出したファイルを読み込む').setInputFiles((await download.path())!);
  await expect(page.getByRole('status')).toContainText('読み込みました');
});
