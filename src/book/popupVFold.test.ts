import { describe, it, expect } from 'vitest';
import { solveVFold } from './popupVFold';

const A = Math.PI / 4, B = Math.PI / 2;
describe('V-fold linkage', () => {
  it('stands its crease straight up when the page lies flat open', () => {
    const s = solveVFold(Math.PI, A, B);
    expect(s.c.x).toBeCloseTo(0); expect(s.c.y).toBeCloseTo(1); expect(s.c.z).toBeCloseTo(0);
  });
  it('keeps the card rigid: the crease meets both glue lines at beta, for any opening', () => {
    for (const theta of [.05, .4, 1, 1.8, 2.6, Math.PI]) {
      const s = solveVFold(theta, A, B);
      expect(s.c.length()).toBeCloseTo(1);
      expect(s.c.dot(s.gA)).toBeCloseTo(Math.cos(B));
      expect(s.c.dot(s.gB)).toBeCloseTo(Math.cos(B));
    }
  });
  it('rises into the open wedge and folds flat as the page shuts', () => {
    for (const theta of [.3, 1, 2]) { const s = solveVFold(theta, A, B); const a = Math.atan2(s.c.y, s.c.x); expect(a).toBeGreaterThanOrEqual(-1e-6); expect(a).toBeLessThanOrEqual(theta + 1e-6); }
    expect(Math.abs(solveVFold(.01, A, B).c.y)).toBeLessThan(.02);
  });
});
