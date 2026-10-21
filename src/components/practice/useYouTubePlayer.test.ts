import { describe, expect, it } from 'vitest';
import { nearestRate } from './useYouTubePlayer';

describe('再生速度', () => {
  it('動画が対応している速度のうち、最も近いものを使う', () => {
    expect(nearestRate([0.5, 0.75, 1, 1.25], 0.75)).toBe(0.75);
    // ライブ動画などは 1 倍しか選べない
    expect(nearestRate([1], 1.25)).toBe(1);
    expect(nearestRate([0.25, 0.5, 1], 0.7)).toBe(0.5);
    expect(nearestRate([], 0.75)).toBe(0.75);
  });
});
