import { describe, expect, it } from 'vitest';
import { biomeLights, sampleTableLight, standeeLighting } from './protoLighting';

describe('danger ember illumination', () => {
  const tile = { id: 'danger', position: { x: 96, y: 48 }, unlocked: true, danger: true, gridSize: { columns: 1, rows: 1 } };
  it('casts bounded red light on the ground and nearby scenery', () => {
    const lights = biomeLights([tile]);
    expect(lights).toHaveLength(1);
    expect(lights[0]).toMatchObject({ id: 'biome-light-danger-danger', color: '#ff3828', fromPiece: true });
    expect(sampleTableLight(0, tile.position, lights).local).toBeGreaterThan(.6);
    expect(sampleTableLight(0, { x: 1000, y: 1000 }, lights).local).toBe(0);
    const rim = standeeLighting(0, { x: 108, y: 48 }, 32, lights).rim;
    expect(rim?.color).toEqual({ r: 255, g: 56, b: 40 });
    expect(lights[0].fireflies).toBeUndefined();
  });
  it('preserves concealment, warning visibility and removal/movement', () => {
    for (const change of [{ unlocked: false }, { flags: ['unexplored'] }, { danger: false }, { road: {} }, { tileType: 'path' }]) expect(biomeLights([{ ...tile, ...change }])).toEqual([]);
    expect(biomeLights([])).toEqual([]);
    expect(biomeLights([{ ...tile, position: { x: 240, y: 96 } }])[0].position).toEqual({ x: 240, y: 96 });
  });
  it('keeps authored lights alongside the danger cloud and leaves normal terrain alone', () => {
    expect(biomeLights([{ ...tile, light: { color: '#ffffff', strength: .2 } }])).toHaveLength(2);
    expect(biomeLights([{ ...tile, danger: false }])).toEqual([]);
  });
});
