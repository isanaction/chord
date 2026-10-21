import { expect, test } from '@playwright/test';

test('料金プランと規約類を設定から開ける（決済の準備前は準備中と表示する）', async ({ page }) => {
  await page.goto('/settings');
  await page.getByRole('navigation', { name: 'このサービスについて' }).getByRole('link', { name: '料金プラン' }).click();
  await expect(page.getByRole('heading', { name: '料金プラン' })).toBeVisible();
  await expect(page.getByRole('row', { name: /区間ループ・速度変更/ })).toContainText('1日 3 曲まで');
  await expect(page.getByText('有料プランは準備中です')).toBeVisible();

  for (const [link, heading, text] of [
    ['利用規約', '利用規約', '自動で更新されます'],
    ['プライバシーポリシー', 'プライバシーポリシー', 'Stripe, Inc.'],
    ['特定商取引法に基づく表記', '特定商取引法に基づく表記', '月額 480円（税込）'],
  ]) {
    await page.goto('/pricing');
    await page.getByRole('navigation', { name: '規約類' }).getByRole('link', { name: link }).click();
    await expect(page.getByRole('heading', { name: heading })).toBeVisible();
    await expect(page.getByText(text).first()).toBeVisible();
  }
});

test('決済の API は、Stripe が設定されていなければ 503 を返す', async ({ request }) => {
  for (const path of ['/api/billing/checkout', '/api/billing/portal', '/api/billing/webhook']) {
    const res = await request.post(path, { data: {} });
    expect(res.status()).toBe(503);
  }
});
