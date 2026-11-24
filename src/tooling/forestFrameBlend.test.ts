import { describe, expect, it } from 'vitest';
import { historyWeight } from './forestFrameBlend';

describe('forest temporal crossfade', () => {
  it('fades consistently across frame rates and clears after a long pause', () => {
    expect(historyWeight(1 / 60, 70) ** 2).toBeCloseTo(historyWeight(1 / 30, 70), 10);
    expect(historyWeight(1, 70)).toBeLessThan(.000001);
    expect(historyWeight(1 / 60, 0)).toBe(0);
  });
});
