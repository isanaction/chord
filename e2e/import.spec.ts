import { expect, test } from '@playwright/test';
import { buildBookmarklet } from '../src/importers/bookmarklet';

test('ブックマークレットで別のページから取り込み、非公開で保存する', async ({ page, context, baseURL }) => {
  const appOrigin = new URL(baseURL!).origin;
  // 取り込み元に見立てた別オリジンのページ（localhost と 127.0.0.1 は別オリジン）
  const sourceUrl = appOrigin.replace('localhost', '127.0.0.1') + '/import';
  await page.goto(sourceUrl);
  await page.evaluate(() => {
    const pre = document.createElement('pre');
    pre.id = 'sheet';
    pre.textContent = '【サビ】\nC   D\n夜が明けたら\nG   Em\nきっと';
    document.body.appendChild(pre);
    const range = document.createRange();
    range.selectNodeContents(pre);
    getSelection()!.removeAllRanges();
    getSelection()!.addRange(range);
  });

  const code = decodeURIComponent(buildBookmarklet(appOrigin).slice('javascript:'.length));
  const popupPromise = context.waitForEvent('page');
  await page.evaluate(code);
  const popup = await popupPromise;

  await expect(popup.getByText('127.0.0.1:3100 から取り込みました。内容を確認して保存してください')).toBeVisible();
  await expect(popup.getByText('非公開で保存（取り込んだ譜面は公開できません）')).toBeVisible();
  await expect(popup.getByRole('textbox', { name: '譜面テキスト' })).toHaveValue(/夜が明けたら/);
  await popup.getByLabel('曲名（必須）').fill('取り込みテスト');
  await popup.getByRole('button', { name: 'ライブラリに保存' }).click();
  await expect(popup.getByRole('heading', { name: '取り込みテスト' })).toBeVisible();

  await popup.goto('/');
  await popup.getByRole('button', { name: '取り込み' }).click();
  await expect(popup.getByRole('link', { name: /取り込みテスト/ })).toBeVisible();
});

test('ブックマークレット以外から開くと案内を出す', async ({ page }) => {
  await page.goto('/import/receive');
  await expect(page.getByRole('alert').filter({ hasText: 'ブックマークレットから開いてください' })).toBeVisible();
});
