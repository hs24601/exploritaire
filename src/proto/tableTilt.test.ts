import { expect, it } from 'vitest';
import { projectTilt, tableTiltFor, unprojectTilt } from './tableTilt';

it('round-trips table points through the tilted projection', () => {
  for (const height of [390, 720, 1300]) {
    const tilt = tableTiltFor(height);
    for (const point of [{ x: 0, y: 0 }, { x: 140, y: -300 }, { x: -220, y: 260 }, { x: 900, y: -1200 }]) {
      const back = unprojectTilt(projectTilt(point, tilt), tilt);
      expect(back.x).toBeCloseTo(point.x, 6);
      expect(back.y).toBeCloseTo(point.y, 6);
    }
  }
});

it('keeps the pivot fixed, shrinks the far side and enlarges the near side', () => {
  const tilt = tableTiltFor(720);
  expect(projectTilt({ x: 0, y: 0 }, tilt)).toEqual({ x: 0, y: 0 });
  const far = projectTilt({ x: 100, y: -200 }, tilt), near = projectTilt({ x: 100, y: 200 }, tilt);
  expect(far.x).toBeLessThan(100);
  expect(near.x).toBeGreaterThan(100);
  expect(Math.abs(far.y)).toBeLessThan(200);
});

it('maps screen points above the horizon to a finite table point', () => {
  const back = unprojectTilt({ x: 10, y: -100000 }, tableTiltFor(720));
  expect(Number.isFinite(back.x) && Number.isFinite(back.y)).toBe(true);
});
