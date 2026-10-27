import { expect, it } from 'vitest';
import { tableGridStrokes } from './tableGridProjection';
import { projectTilt, tableCameraTilt } from './tableTilt';

it('keeps projected grid strokes finite and inside the viewport through orbit and zoom', () => {
  for (const scale of [1.7, 4.5, 6.8]) for (const yaw of [0, 45, 90, 135, 180, 225, 270, 315]) {
    const view = { width: 1280, height: 720 };
    const strokes = tableGridStrokes(view, { x: 90, y: -75, scale, yaw }, tableCameraTilt(view.height, scale));
    expect(strokes.length).toBeGreaterThan(0); expect(strokes.length).toBeLessThan(1000);
    for (const line of strokes) for (const point of [line.from, line.to]) {
      expect(Number.isFinite(point.x) && Number.isFinite(point.y)).toBe(true);
      expect(Math.abs(point.x)).toBeLessThanOrEqual(view.width / 2 + .02);
      expect(Math.abs(point.y)).toBeLessThanOrEqual(view.height / 2 + .02);
    }
  }
});

it('registers grid boundaries to the existing world projection at maximum zoom', () => {
  const view = { width: 1280, height: 720 }, camera = { x: 20, y: -180, scale: 6.8, yaw: 45 };
  const tilt = tableCameraTilt(view.height, camera.scale), lines = tableGridStrokes(view, camera, tilt);
  const point = { x: 24, y: 24 }, yaw = camera.yaw * Math.PI / 180;
  const x = point.x * camera.scale + camera.x, y = point.y * camera.scale + camera.y;
  const expected = projectTilt({ x: x * Math.cos(yaw) - y * Math.sin(yaw), y: x * Math.sin(yaw) + y * Math.cos(yaw) }, tilt);
  const touching = lines.filter(({ from: a, to: b }) => Math.abs((b.y - a.y) * expected.x - (b.x - a.x) * expected.y + b.x * a.y - b.y * a.x) / Math.hypot(b.y - a.y, b.x - a.x) < .01);
  expect(touching.length).toBeGreaterThanOrEqual(2);
});
