import { describe, expect, it } from 'vitest';
import { heightFogAmount } from './forestHeightFog';

const settings = { height: 4, softness: 3, density: .08 };
describe('forest height fog', () => {
  it('leaves zero-distance or disabled fog unchanged and increases with distance', () => {
    expect(heightFogAmount(0, 1.7, 0, settings)).toBe(0);
    expect(heightFogAmount(30, 1.7, 0, { ...settings, density: 0 })).toBe(0);
    expect(heightFogAmount(30, 1.7, 0, settings)).toBeGreaterThan(heightFogAmount(5, 1.7, 0, settings));
  });
  it('keeps views entirely above the bank clear and accounts for descending rays', () => {
    expect(heightFogAmount(30, 13, 10, settings)).toBe(0);
    expect(heightFogAmount(30, 13, 0, settings)).toBeGreaterThan(0);
    expect(heightFogAmount(30, 13, 0, settings)).toBeLessThan(heightFogAmount(30, 1.7, 0, settings));
  });
  it('approaches opaque dark fog within a long dense bank without exceeding one', () => {
    const fog = heightFogAmount(100, 0, 0, settings);
    expect(fog).toBeGreaterThan(.99); expect(fog).toBeLessThanOrEqual(1);
  });
});
