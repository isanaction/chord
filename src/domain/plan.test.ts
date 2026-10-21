import { describe, expect, it } from 'vitest';
import { claimPracticeTools, FREE_PRACTICE_SHEETS_PER_DAY, localDay, planOf, type Subscription } from './plan';

const NOW = Date.UTC(2026, 9, 21, 3, 0);
const DAY = 86_400_000;
const sub = (s: Partial<Subscription>): Subscription => ({
  status: 'active',
  interval: 'month',
  currentPeriodEnd: NOW + 10 * DAY,
  cancelAtPeriodEnd: false,
  ...s,
});

describe('プラン', () => {
  it('購読がなければ無料プラン', () => {
    expect(planOf(null, NOW)).toBe('free');
  });

  it('有効な購読（試用中・再請求中を含む）は有料プラン', () => {
    expect(planOf(sub({}), NOW)).toBe('premium');
    expect(planOf(sub({ status: 'trialing' }), NOW)).toBe('premium');
    expect(planOf(sub({ status: 'past_due' }), NOW)).toBe('premium');
    // 解約予約中でも、期間の終わりまでは有料プラン
    expect(planOf(sub({ cancelAtPeriodEnd: true }), NOW)).toBe('premium');
    // 運営が手動で付けた（期限なし）
    expect(planOf(sub({ currentPeriodEnd: null }), NOW)).toBe('premium');
  });

  it('解約済み・未払いは無料プラン', () => {
    for (const status of ['canceled', 'unpaid', 'incomplete', 'incomplete_expired', 'paused']) {
      expect(planOf(sub({ status }), NOW)).toBe('free');
    }
  });

  it('期間の終わりから3日を過ぎても更新されていなければ無料プラン（同期が止まっていた場合の保険）', () => {
    expect(planOf(sub({ currentPeriodEnd: NOW - 2 * DAY }), NOW)).toBe('premium');
    expect(planOf(sub({ currentPeriodEnd: NOW - 4 * DAY }), NOW)).toBe('free');
  });
});

describe('区間ループ・速度変更の回数', () => {
  const today = new Date(2026, 9, 21, 9, 0);

  it('無料プランは1日に決まった曲数まで。同じ曲は何度でも使える', () => {
    let quota = null;
    for (let i = 0; i < FREE_PRACTICE_SHEETS_PER_DAY; i++) {
      const r = claimPracticeTools('free', quota, `s${i}`, today);
      expect(r.allowed).toBe(true);
      quota = r.quota;
    }
    expect(claimPracticeTools('free', quota, 's0', today).allowed).toBe(true);
    const over = claimPracticeTools('free', quota, 'other', today);
    expect(over.allowed).toBe(false);
    expect(over.remaining).toBe(0);
    expect(over.quota.sheetIds).toHaveLength(FREE_PRACTICE_SHEETS_PER_DAY);
  });

  it('日付が変わると数え直す', () => {
    const full = { day: localDay(today), sheetIds: ['a', 'b', 'c'] };
    const tomorrow = new Date(2026, 9, 22, 0, 1);
    const r = claimPracticeTools('free', full, 'd', tomorrow);
    expect(r.allowed).toBe(true);
    expect(r.quota).toEqual({ day: '2026-10-22', sheetIds: ['d'] });
  });

  it('有料プランは数えない', () => {
    const full = { day: localDay(today), sheetIds: ['a', 'b', 'c'] };
    const r = claimPracticeTools('premium', full, 'd', today);
    expect(r).toEqual({ allowed: true, quota: full, remaining: null });
  });
});
