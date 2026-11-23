import { describe, expect, it } from 'vitest';
import { forestLayout, boundedBillboardYaw, wrapAngle } from './forestLayout';

describe('single-source forest layout', () => {
  it('is deterministic, grounded in a bounded grove and leaves separated trunks', () => {
    const trees = forestLayout(160);
    expect(trees).toHaveLength(160); expect(trees).toEqual(forestLayout(160));
    for (let i = 0; i < trees.length; i++) {
      const tree = trees[i]; expect(Math.hypot(tree.x, tree.z)).toBeLessThanOrEqual(35);
      expect(tree.height).toBeGreaterThanOrEqual(6); expect(tree.height).toBeLessThanOrEqual(11);
      for (const other of trees.slice(i + 1)) expect(Math.hypot(tree.x - other.x, tree.z - other.z)).toBeGreaterThanOrEqual(2.6);
    }
  });
  it('holds the authored view inside 30 degrees, following only when necessary across the seam', () => {
    expect(boundedBillboardYaw(.2, 0)).toBe(0);
    let heading = 0;
    for (let view = 0; view < Math.PI * 6; view += .01) {
      const next = boundedBillboardYaw(view, heading);
      expect(Math.abs(wrapAngle(view - next))).toBeLessThanOrEqual(Math.PI / 6 + 1e-9);
      expect(Math.abs(next - heading)).toBeLessThan(.011);
      heading = next;
    }
  });
});
