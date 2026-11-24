import { expect, it } from 'vitest';
import { standeeRasterScale } from './spriteRaster';

it('retains six physical samples per world unit across ordinary display densities', () => {
  for (const ratio of [1, 1.25, 1.5, 2, 3, 4, 6]) {
    expect(standeeRasterScale(ratio, 6) * ratio).toBeCloseTo(6);
  }
  expect(standeeRasterScale(3, 6)).toBe(2);
  expect(standeeRasterScale(1, 6)).toBe(6);
});

it('never downsamples layout and safely handles unavailable density readings', () => {
  expect(standeeRasterScale(8, 6)).toBe(1);
  for (const ratio of [0, .5, NaN, Infinity]) expect(standeeRasterScale(ratio, 6)).toBe(6);
});
