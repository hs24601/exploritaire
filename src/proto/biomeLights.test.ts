import { describe, expect, it } from 'vitest';
import { biomeLights, sampleTableLight } from './protoLighting';
import { createInitialState } from './rules/setup';
import { heightToWorld } from './sceneryHeight';

describe('scenery light sources', () => {
  it('gives the remaining sparse berry bounded blue light until harvested, without revealing hidden bushes', () => {
    const tile = { id: 'sparse', position: { x: 0, y: 48 }, unlocked: true, tileType: 'berry-patch', berryPatchVariant: 'sparse' as const };
    expect(biomeLights([tile])[0]).toMatchObject({ color: '#9cdeff', radius: .85, fromPiece: true });
    expect(sampleTableLight(0, tile.position, biomeLights([tile])).local).toBeCloseTo(.58);
    for (const change of [{ berryHarvested: true }, { flags: ['unexplored'] }, { unlocked: false }]) {
      expect(biomeLights([{ ...tile, ...change }])).toEqual([]);
    }
    expect(sampleTableLight(0, { x: 48, y: 48 }, biomeLights([tile])).local).toBe(0);
    expect(biomeLights([{ ...tile, position: { x: 96, y: 48 } }])[0].position.x).toBe(96);
  });
  const sapling = () => createInitialState().biomeTiles.find(tile => tile.id === 'curious-sapling')!;
  it('keeps a faint undiscovered sapling glow while concealing other and locked emitters', () => {
    expect(biomeLights([sapling()])[0]).toMatchObject({ strength: .16, radius: 1.25, fireflies: true });
    expect(biomeLights([{ ...sapling(), id: 'other-tree' }])).toEqual([]);
    expect(biomeLights([{ ...sapling(), flags: [], unlocked: false }])).toEqual([]);
  });
  it('lights the sapling and nearby ground through the shared field', () => {
    const tile = { ...sapling(), flags: [] };
    const lights = biomeLights([tile]);
    expect(lights[0]).toMatchObject({ id: 'biome-light-curious-sapling', fromPiece: true, height: heightToWorld(2) });
    expect(sampleTableLight(0, tile.position, lights).local).toBeCloseTo(.65);
    const nearby = { x: tile.position.x + 48, y: tile.position.y };
    expect(sampleTableLight(0, nearby, lights).total).toBeGreaterThan(sampleTableLight(0, nearby).total);
    expect(sampleTableLight(0, { x: tile.position.x + 144, y: tile.position.y }, lights).local).toBe(0);
  });
  it('follows live tile positions, removal and existing light blockers', () => {
    const tile = { ...sapling(), flags: [], position: { x: 96, y: 0 } };
    const lights = biomeLights([tile]);
    expect(lights[0].position).toEqual(tile.position);
    expect(biomeLights([])).toEqual([]);
    expect(sampleTableLight(0, { x: 0, y: 0 }, lights, [{ id: 'wall', left: 40, right: 56, top: -24, bottom: 24 }]).local).toBe(0);
  });
});
