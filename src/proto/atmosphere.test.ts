import { describe, expect, it } from 'vitest';
import { ambianceFor, haloFor, rayAngle, scatter } from './atmosphere';
import { actorLight, getTableLighting } from './protoLighting';

describe('tilted-camera ambiance', () => {
  it('shows sun rays and motes by day, fireflies and moonbeams after dark', () => {
    const noon = ambianceFor(getTableLighting(12));
    const dusk = ambianceFor(getTableLighting(17.5));
    const night = ambianceFor(getTableLighting(23));
    expect(noon.sunRays).toBeGreaterThan(0);
    expect(dusk.sunRays).toBeGreaterThan(noon.sunRays);
    expect(noon.fireflies).toBe(0);
    expect(dusk.fireflies).toBeGreaterThan(0);
    expect(night.fireflies).toBe(1);
    expect(night.sunRays).toBe(0);
    expect(night.moonRays).toBe(1);
    expect(night.motes).toBe(0);
    expect(night.halos).toBeGreaterThan(noon.halos);
  });

  it('gives a carried candle a smaller, softer halo than a lamp, at chest height', () => {
    const lamp = haloFor({ id: 'camp-lamp', position: { x: 0, y: 0 }, radius: 5.5, height: 120 }, 1);
    const candle = haloFor(actorLight('hero', { x: 0, y: 0 })!, 1);
    expect(candle.radius).toBeLessThan(lamp.radius);
    expect(candle.opacity).toBeLessThan(lamp.opacity);
    expect(candle.lift).toBeGreaterThan(lamp.lift);
    expect(haloFor({ id: 'glow', position: { x: 0, y: 0 }, fromPiece: true }, 1).lift).toBeLessThan(lamp.lift);
  });

  it('scatters particles deterministically inside their area', () => {
    const area = { x: 10, y: -20, width: 40, height: 30 };
    const first = scatter('fireflies', 12, area, [5, 30], 8, [2, 3], [4, 8]);
    expect(scatter('fireflies', 12, area, [5, 30], 8, [2, 3], [4, 8])).toEqual(first);
    for (const p of first) {
      expect(Math.abs(p.x - area.x)).toBeLessThanOrEqual(area.width / 2);
      expect(Math.abs(p.y - area.y)).toBeLessThanOrEqual(area.height / 2);
      expect(p.lift).toBeGreaterThanOrEqual(5);
      expect(p.lift).toBeLessThanOrEqual(30);
    }
  });

  it('slants the rays away from the sun', () => {
    expect(rayAngle(getTableLighting(8))).not.toBe(0);
    expect(Math.sign(rayAngle(getTableLighting(8)))).toBe(-Math.sign(rayAngle(getTableLighting(16))));
  });
});
