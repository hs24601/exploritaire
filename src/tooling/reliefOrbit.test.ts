import { describe, expect, it } from 'vitest';
import { reliefFacingYaw, pineViewPair } from './reliefOrbit';

describe('pine relief camera following', () => {
  it('bounds the painting viewing angle over multiple complete camera turns', () => {
    const limit = 8 * Math.PI / 180;
    for (let yaw = -8 * Math.PI; yaw <= 8 * Math.PI; yaw += .01) {
      expect(Math.abs(yaw - reliefFacingYaw(yaw, limit))).toBeLessThanOrEqual(limit + 1e-10);
      expect(reliefFacingYaw(yaw, 0)).toBe(yaw);
    }
  });
  it('joins seamlessly across the orbit seam and does not accumulate lag', () => {
    const epsilon = .00001, limit = .14;
    const a = reliefFacingYaw(Math.PI - epsilon, limit);
    const b = reliefFacingYaw(-Math.PI + epsilon, limit) + 2 * Math.PI;
    expect(Math.abs(a - b)).toBeLessThan(.0001);
    expect(reliefFacingYaw(2 * Math.PI, limit)).toBeCloseTo(2 * Math.PI, 10);
  });
});

describe('painted directional views', () => {
  it('changes paintings around the circle and wraps from the final view to the first', () => {
    for (let i = 0; i < 8; i++) {
      const pair = pineViewPair(i * Math.PI / 4 + .000001);
      expect(pair.a).toBe(i); expect(pair.blend).toBe(0);
    }
    expect(pineViewPair(-.001).b).toBe(0);
    expect(pineViewPair(-.001).blend).toBe(1);
    expect(pineViewPair(Math.PI / 8).blend).toBeCloseTo(.5);
    expect(pineViewPair(Math.PI / 8 + .01, false).blend).toBe(1);
  });
});
