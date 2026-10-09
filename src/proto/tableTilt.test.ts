import { expect, it } from 'vitest';
import { projectTilt, tableCameraTilt, tableTiltFor, unprojectTilt } from './tableTilt';

it('descends smoothly only beyond 265% and aims at the upper half of a standee', () => {
  for (const scale of [1.7, 3, 4.5]) {
    expect(tableCameraTilt(720, scale).angle).toBe(60);
    expect(tableCameraTilt(720, scale).aimY).toBe(0);
  }
  const start = tableCameraTilt(720, 4.5), middle = tableCameraTilt(720, 5.65), end = tableCameraTilt(720, 6.8);
  expect(middle.angle).toBeCloseTo(71);
  expect(end.angle).toBe(82);
  expect(end.aimY! / 6.8).toBe(24);
  expect(end.perspective * Math.cos(end.angle * Math.PI / 180) / 6.8)
    .toBeLessThan(start.perspective * Math.cos(start.angle * Math.PI / 180) / 4.5);
  for (const scale of [4.5, 4.501, 5.65, 6.8]) {
    const tilt = tableCameraTilt(720, scale);
    for (const point of [{ x: 0, y: 0 }, { x: 140, y: -300 }, { x: -200, y: 200 }]) {
      const back = unprojectTilt(projectTilt(point, tilt), tilt);
      expect(back.x).toBeCloseTo(point.x, 6);
      expect(back.y).toBeCloseTo(point.y, 6);
    }
  }
});

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
