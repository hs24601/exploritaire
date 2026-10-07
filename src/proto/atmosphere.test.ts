import { describe, expect, it } from 'vitest';
import { BIOME_AMBIANCE, ambianceFor, emitterArea, haloFor, rayAngle, scatter, shaftSlots, visibleCells } from './atmosphere';
import { tableTiltFor } from './tableTilt';
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

  it('anchors world cells to the table: panning slides the window, cells keep their keys', () => {
    const view = { width: 800, height: 600 };
    const here = visibleCells(view, { x: 0, y: 0, scale: 1 }, null, 200);
    const keys = new Set(here.map((c) => c.key));
    expect(keys.has('0,0')).toBe(true);
    // Pan the camera right by two cells: the world under it shifts left.
    const panned = visibleCells(view, { x: 400, y: 0, scale: 1 }, null, 200);
    expect(panned.some((c) => c.key === '-4,0')).toBe(true);
    expect(panned.find((c) => c.key === '0,0')).toEqual(here.find((c) => c.key === '0,0'));
    // Zooming out shows more cells; tilting adds the far rows, capped.
    expect(visibleCells(view, { x: 0, y: 0, scale: 0.5 }, null, 200).length).toBeGreaterThan(here.length);
    const tilted = visibleCells(view, { x: 0, y: 0, scale: 1 }, tableTiltFor(600), 200);
    expect(tilted.length).toBeGreaterThan(here.length);
    expect(tilted.length).toBeLessThan(here.length * 4);
  });

  it('pins light shafts to the world so they slide with a pan', () => {
    const before = shaftSlots(800, 0, { x: 0, scale: 1 }, 340);
    const after = shaftSlots(800, 0, { x: 100, scale: 1 }, 340);
    const slot = before.find((s) => after.some((a) => a.slot === s.slot))!;
    expect(after.find((a) => a.slot === slot.slot)!.x - slot.x).toBeCloseTo(100);
  });

  it('gives every biome some ambiance, laid around its tile', () => {
    const tile = { x: 100, y: 50, width: 120, height: 80 };
    for (const emitters of Object.values(BIOME_AMBIANCE)) {
      expect(emitters.length).toBeGreaterThan(0);
      for (const emitter of emitters) expect(Math.abs(emitterArea(emitter, tile).x - tile.x)).toBe(0);
    }
    expect(ambianceFor(getTableLighting(23)).mist).toBeGreaterThan(ambianceFor(getTableLighting(12)).mist);
  });
});
