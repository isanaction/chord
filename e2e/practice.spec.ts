import { expect, type Page, test } from '@playwright/test';

// 歌詞は架空のもの
const SHEET_TEXT = ['【Aメロ】', '[C]ひとつめの 行', '[G]ふたつめの 行', '【サビ】', '[F]みっつめの 行', '[C]よっつめの 行'].join('\n');

/**
 * YouTube のプレーヤーの代わり。本物と同じ呼び方で動き、時計で再生位置を進める。
 * テストからは window.__video で再生位置を操作する。
 */
const FAKE_IFRAME_API = `
(() => {
  function Player(el, opts) {
    const self = this;
    const box = document.createElement('div');
    box.textContent = 'テスト用の動画';
    box.style.cssText = 'color:#fff;display:flex;align-items:center;justify-content:center;height:100%';
    el.appendChild(box);
    let base = (opts.playerVars && opts.playerVars.start) || 0, since = performance.now(), playing = false, rate = 1;
    const now = () => (playing ? base + ((performance.now() - since) / 1000) * rate : base);
    const state = (s) => opts.events && opts.events.onStateChange && opts.events.onStateChange({ data: s });
    self.getCurrentTime = now;
    self.getDuration = () => 60;
    self.getPlayerState = () => (playing ? 1 : 2);
    self.getAvailablePlaybackRates = () => [0.5, 0.75, 1, 1.25];
    self.playVideo = () => { base = now(); since = performance.now(); playing = true; state(1); };
    self.pauseVideo = () => { base = now(); playing = false; state(2); };
    self.seekTo = (s) => { base = s; since = performance.now(); };
    self.getPlaybackRate = () => rate;
    // 本物と同じく、対応していない速度は無視し、変わったときだけ知らせる
    self.setPlaybackRate = (r) => {
      if (!self.getAvailablePlaybackRates().includes(r) || r === rate) return;
      base = now(); since = performance.now(); rate = r; window.__video.rate = r;
      setTimeout(() => opts.events && opts.events.onPlaybackRateChange && opts.events.onPlaybackRateChange({ data: r }), 0);
    };
    self.destroy = () => box.remove();
    window.__video = { player: self, rate, seek: (s) => self.seekTo(s), now };
    setTimeout(() => opts.events && opts.events.onReady && opts.events.onReady(), 0);
  }
  window.YT = { Player };
  setTimeout(() => window.onYouTubeIframeAPIReady && window.onYouTubeIframeAPIReady(), 0);
})();
`;

async function useFakeYouTube(page: Page) {
  await page.route('https://www.youtube.com/iframe_api', (route) =>
    route.fulfill({ contentType: 'text/javascript', body: FAKE_IFRAME_API }),
  );
}

async function seekVideo(page: Page, seconds: number) {
  await page.evaluate((s) => (window as unknown as { __video: { seek(s: number): void } }).__video.seek(s), seconds);
}

/** 端末内 DB（IndexedDB）に保存された再生速度 */
async function savedPlaybackRate(page: Page): Promise<number | undefined> {
  return page.evaluate(
    () =>
      new Promise<number | undefined>((resolve, reject) => {
        const open = indexedDB.open('chord');
        open.onerror = () => reject(open.error);
        open.onsuccess = () => {
          const all = open.result.transaction('userSheetSettings').objectStore('userSheetSettings').getAll();
          all.onsuccess = () => {
            open.result.close();
            resolve((all.result as { playbackRate?: number }[]).find((r) => r.playbackRate !== undefined)?.playbackRate);
          };
          all.onerror = () => reject(all.error);
        };
      }),
  );
}

async function createSheetWithVideo(page: Page, videoUrl = 'https://youtu.be/dQw4w9WgXcQ') {
  await page.goto('/new');
  await page.getByRole('textbox', { name: '譜面テキスト' }).fill(SHEET_TEXT);
  await page.getByLabel('曲名（必須）').fill('練習の曲');
  await page.getByLabel('BPM').fill('90');
  await page.getByLabel('参考動画（YouTube）').fill(videoUrl);
  await page.getByRole('button', { name: '保存', exact: true }).click();
  await expect(page.getByRole('heading', { name: '練習の曲' })).toBeVisible();
}

test('動画に合わせて同期を記録し、再生位置の行が追いかけられ、セクションをループできる', async ({ page }) => {
  await useFakeYouTube(page);
  await createSheetWithVideo(page);

  await page.getByRole('button', { name: '▶ 動画で練習' }).click();
  await expect(page.getByText('テスト用の動画')).toBeVisible();
  await expect(page.getByText('「同期を記録」で、動画に合わせて譜面が進むようになります')).toBeVisible();

  // 記録モード: 行の歌い出しの位置で「記録」を押す
  await page.getByRole('button', { name: '同期を記録' }).click();
  const record = page.getByRole('button', { name: '今の位置を次の行の時刻として記録する' });
  for (const [i, seconds] of [2, 6, 10, 14].entries()) {
    await seekVideo(page, seconds);
    if (i === 3) {
      // スペースキーでも記録できる（ボタンにフォーカスがないとき）
      await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
      await page.keyboard.press(' ');
    }
    else await record.click();
  }
  const line = (text: string) => page.locator('[data-line-id]', { hasText: text });
  await expect(line('ひとつめの').getByText('0:02.0')).toBeVisible();
  await expect(line('よっつめの').getByText('0:14.0')).toBeVisible();
  // 最後の行まで記録したら止まり、続けて押しても先頭の行の時刻を上書きしない
  await expect(page.getByText('最後の行まで記録しました')).toBeVisible();
  await seekVideo(page, 30);
  await page.keyboard.press(' ');
  await expect(line('ひとつめの').getByText('0:02.0')).toBeVisible();
  await expect(record).toBeDisabled();

  // 動画と操作パネルが増えても、画面全体ははみ出さない（見出しが画面に残る）
  await expect(page.getByRole('heading', { name: '練習の曲' })).toBeInViewport();

  // 選んだ行の時刻を 0.1 秒ずつ直せる
  await line('ふたつめの').click();
  await page.getByRole('button', { name: '+0.1秒' }).click();
  await expect(line('ふたつめの').getByText('0:06.1')).toBeVisible();
  await page.getByRole('button', { name: '完了' }).click();

  // 再生位置に合わせて、演奏中の行が強調される
  await seekVideo(page, 11);
  await expect(line('みっつめの')).toHaveAttribute('aria-current', 'true');
  await seekVideo(page, 3);
  await expect(line('ひとつめの')).toHaveAttribute('aria-current', 'true');

  // 行を押すと、その行から再生位置が移る
  await line('よっつめの').click();
  await expect(line('よっつめの')).toHaveAttribute('aria-current', 'true');

  // サビをループ: 終わり（動画の最後）を過ぎるとサビの頭に戻る
  await page.getByRole('button', { name: 'サビをループする' }).click();
  await expect(page.getByRole('button', { name: /ループ サビ/ })).toBeVisible();
  await page.getByRole('button', { name: '動画を再生する' }).click();
  await seekVideo(page, 60);
  await expect(line('みっつめの')).toHaveAttribute('aria-current', 'true');

  // 速度を変えると、動画とボタンの表示に反映され、開き直しても残る
  await page.getByRole('button', { name: '遅く' }).click();
  await expect(page.getByText('速度 ×0.75')).toBeVisible();
  expect(await page.evaluate(() => (window as unknown as { __video: { rate: number } }).__video.rate)).toBe(0.75);

  // 保存は画面の更新と並行して行うので、端末内 DB に入ったのを確かめてから開き直す
  await expect.poll(() => savedPlaybackRate(page)).toBe(0.75);

  await page.reload();
  await page.getByRole('button', { name: '▶ 動画で練習' }).click();
  await expect(page.getByText('速度 ×0.75')).toBeVisible();
  await expect(page.getByRole('button', { name: /ループ サビ/ })).toBeVisible();
  // 記録した同期データも残っている
  await seekVideo(page, 7);
  await expect(line('ふたつめの')).toHaveAttribute('aria-current', 'true');

  // プレーヤー自身のメニューで速度を変えても、表示が実際の速度に合う
  await page.evaluate(() => (window as unknown as { __video: { player: { setPlaybackRate(r: number): void } } }).__video.player.setPlaybackRate(1.25));
  await expect(page.getByText('速度 ×1.25')).toBeVisible();
});

test('コード図を押すとコードが鳴り、メトロノームは曲の BPM から始まる', async ({ page }) => {
  await useFakeYouTube(page);
  await createSheetWithVideo(page);

  // 音が鳴ったかは、作った音源（オシレーター）の数で確かめる
  await page.evaluate(() => {
    const w = window as unknown as { __oscillators: number };
    w.__oscillators = 0;
    const original = AudioContext.prototype.createOscillator;
    AudioContext.prototype.createOscillator = function (this: AudioContext) {
      w.__oscillators++;
      return original.call(this);
    };
  });
  await page.getByRole('button', { name: 'C を鳴らす' }).click();
  await expect.poll(() => page.evaluate(() => (window as unknown as { __oscillators: number }).__oscillators)).toBeGreaterThan(0);

  await page.getByRole('button', { name: 'メトロノーム', exact: true }).click();
  const metronome = page.getByRole('group', { name: 'メトロノーム' });
  await expect(metronome.getByText('90', { exact: true })).toBeVisible();
  await metronome.getByRole('button', { name: 'テンポを上げる' }).click();
  await expect(metronome.getByText('91', { exact: true })).toBeVisible();
  await metronome.getByRole('button', { name: '鳴らす' }).click();
  await expect(metronome.getByRole('button', { name: '止める' })).toBeVisible();
  await metronome.getByRole('button', { name: '止める' }).click();
  await metronome.getByRole('button', { name: 'メトロノームを閉じる' }).click();
  await expect(metronome).toHaveCount(0);
});

test('参考動画の URL の開始位置（t=）から再生できる', async ({ page }) => {
  await useFakeYouTube(page);
  await createSheetWithVideo(page, 'https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=30');
  await page.getByRole('button', { name: '▶ 動画で練習' }).click();
  await expect(page.getByText('0:30.0 / 1:00.0')).toBeVisible();
});
