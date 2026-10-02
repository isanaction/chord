import { expect, test } from '@playwright/test';

// 歌詞は架空のもの
const SHEET_TEXT = [
  'Key: A',
  '',
  '【Aメロ】',
  'A       E/G#     F#m',
  'まだ眠る街の 角を曲がって',
  'D       A    E',
  '白い息が ひとつゆれた',
  '',
  '【サビ】',
  'D   E       C#m  F#m',
  '夜が明けたら きっと',
  'Bm      E',
  '少しだけ遠くへ',
].join('\n');

test('貼り付けて保存し、移調・カポを変えて弾ける', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByText('まだ曲がありません')).toBeVisible();

  await page.getByRole('link', { name: 'テキストを貼り付けて追加' }).click();
  await expect(page).toHaveURL(/\/new$/);
  await page.getByRole('textbox', { name: '譜面テキスト' }).fill(SHEET_TEXT);
  await expect(page.getByLabel('元キー')).toHaveValue('A');
  await page.getByLabel('曲名（必須）').fill('夜明けのバス停');
  await page.getByLabel('アーティスト').fill('サンプルアーティスト');
  await expect(page.getByRole('region', { name: 'プレビュー' }).getByText('E/G#')).toBeVisible();
  await page.getByRole('button', { name: '保存', exact: true }).click();

  await expect(page).toHaveURL(/\/sheet\?id=/);
  await expect(page.getByRole('heading', { name: '夜明けのバス停' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'キー A' })).toBeVisible();
  await expect(page.getByRole('list', { name: 'この曲のコード' }).getByText('F#m')).toBeVisible();

  // 簡単コードの提案でカポ 2 にする
  await page.getByRole('button', { name: 'キーと表示の設定' }).click();
  const dialog = page.getByRole('dialog', { name: 'キーと表示' });
  await dialog.getByRole('button', { name: 'カポ 2 にする' }).click();
  await expect(dialog.getByText('簡単コード：カポ 2 を適用中')).toBeVisible();

  // 半音上げる
  await dialog.getByRole('button', { name: '半音上げる' }).click();
  await expect(dialog.getByText('キー A → B♭')).toBeVisible();
  await dialog.getByRole('button', { name: '閉じる' }).click();

  await expect(page.getByRole('button', { name: 'キー B♭（原曲 A）' })).toBeVisible();
  await expect(page.getByRole('button', { name: /カポ 2（A♭ の形）/ })).toBeVisible();

  // 設定は保存され、開き直しても残る
  await page.reload();
  await expect(page.getByRole('button', { name: 'キー B♭（原曲 A）' })).toBeVisible();

  // ライブラリに出る
  await page.getByRole('link', { name: 'ライブラリに戻る' }).click();
  await expect(page.getByRole('link', { name: /夜明けのバス停/ })).toBeVisible();

  // 編集して保存
  await page.getByRole('link', { name: /夜明けのバス停/ }).click();
  await page.getByRole('link', { name: '譜面を編集' }).click();
  await expect(page.getByRole('textbox', { name: '譜面テキスト' })).toHaveValue(/\[A\]まだ眠る\[E\/G#\]街の 角を\[F#m\]曲がって/);
  await page.getByLabel('曲名（必須）').fill('夜明けのバス停（改）');
  await page.getByRole('button', { name: '保存', exact: true }).click();
  await expect(page.getByRole('heading', { name: '夜明けのバス停（改）' })).toBeVisible();
});

test('自動スクロールと演奏モード', async ({ page }) => {
  await page.goto('/new');
  const long = Array.from({ length: 40 }, (_, i) => `C       G\n${i + 1}行目のうた`).join('\n');
  await page.getByRole('textbox', { name: '譜面テキスト' }).fill(long);
  await page.getByLabel('曲名（必須）').fill('長い曲');
  await page.getByRole('button', { name: '保存', exact: true }).click();
  await expect(page.getByRole('heading', { name: '長い曲' })).toBeVisible();

  await page.getByRole('button', { name: '自動スクロールを始める' }).click();
  await page.waitForTimeout(1200);
  await page.getByRole('button', { name: '自動スクロールを止める' }).click();
  const scrolled = await page.locator('main > div.overflow-y-auto').evaluate((el) => el.scrollTop);
  expect(scrolled).toBeGreaterThan(5);

  await page.getByRole('button', { name: '演奏モード' }).click();
  await expect(page.getByRole('heading', { name: '長い曲' })).toBeHidden();
  await page.getByRole('button', { name: '演奏モードを終了' }).click();
  await expect(page.getByRole('heading', { name: '長い曲' })).toBeVisible();
});
