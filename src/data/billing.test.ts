// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

async function loadBilling(enabled: boolean) {
  vi.resetModules();
  vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://example.supabase.co');
  vi.stubEnv('NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY', 'sb_publishable_test');
  vi.stubEnv('NEXT_PUBLIC_BILLING_ENABLED', enabled ? '1' : '');
  return import('./billing');
}

describe('区間ループ・速度変更の回数（端末）', () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => vi.unstubAllEnvs());

  it('決済の準備前は、誰でも制限なく使える', async () => {
    const billing = await loadBilling(false);
    for (const id of ['a', 'b', 'c', 'd', 'e']) expect(billing.claimPracticeToolsFor(id)).toBe(true);
  });

  it('決済を始めたら、ログインしていない人は無料プランとして1日3曲まで', async () => {
    const billing = await loadBilling(true);
    for (const id of ['a', 'b', 'c']) expect(billing.claimPracticeToolsFor(id)).toBe(true);
    expect(billing.claimPracticeToolsFor('d')).toBe(false);
    // 使った曲は何度でも
    expect(billing.claimPracticeToolsFor('a')).toBe(true);
    // 端末に残るので、開き直しても数は続く
    const again = await loadBilling(true);
    expect(again.claimPracticeToolsFor('d')).toBe(false);
  });
});
