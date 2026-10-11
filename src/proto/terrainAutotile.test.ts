import { describe, expect, it } from 'vitest';
import { autotileCells, autotilePlacement, autotileShape, MOUNTAIN_AUTOTILE, terrainAutotilePlacements } from './terrainAutotile';
import { createInitialState } from './rules/setup';
import { immutableTerrainRegions } from './tileLabels';
import { TABLE_GRID } from './gridCoordinates';

describe('terrain autotiling', () => {
  it('names shapes from the four-side mask', () => {
    expect(autotileShape(0)).toBe('lone');
    expect(autotileShape(4)).toBe('end');
    expect(autotileShape(5)).toBe('corridor');
    expect(autotileShape(10)).toBe('corridor');
    expect(autotileShape(6)).toBe('corner');
    expect(autotileShape(7)).toBe('edge');
    expect(autotileShape(15)).toBe('interior');
  });

  it('joins only cells in the group and leans toward joined sides', () => {
    const cells = [{ column: 0, row: 0 }, { column: 1, row: 0 }, { column: 0, row: 1 }, { column: 5, row: 5 }];
    const pieces = autotileCells(cells);
    expect(pieces.get(cells[0])).toMatchObject({ mask: 2 | 4, shape: 'corner' });
    expect(pieces.get(cells[1])).toMatchObject({ mask: 8, shape: 'end', inward: { x: -1, y: 0 } });
    expect(pieces.get(cells[3])).toMatchObject({ mask: 0, shape: 'lone', inward: { x: 0, y: 0 } });
    const corner = pieces.get(cells[0])!.inward;
    expect(Math.hypot(corner.x, corner.y)).toBeCloseTo(1);
  });

  it('is stable per cell and varies between neighbours', () => {
    const row = Array.from({ length: 12 }, (_, column) => ({ column, row: 0 }));
    const first = [...autotileCells(row).values()].map(piece => autotilePlacement(piece, MOUNTAIN_AUTOTILE, 48));
    const again = [...autotileCells(row).values()].map(piece => autotilePlacement(piece, MOUNTAIN_AUTOTILE, 48));
    expect(again).toEqual(first);
    expect(new Set(first.map(p => p.flip)).size).toBe(2);
    expect(new Set(first.map(p => p.scale.toFixed(3))).size).toBeGreaterThan(6);
    for (const p of first) {
      expect(Math.abs(p.dx)).toBeLessThanOrEqual(48 * .25);
      expect(p.scale).toBeGreaterThan(.5);
      expect(p.scale).toBeLessThan(1.3);
    }
  });

  it('gives the starting mountains neighbour-aware pieces around the den notch', () => {
    const regions = immutableTerrainRegions(createInitialState().biomeTiles);
    const pieces = terrainAutotilePlacements(regions, position => TABLE_GRID.atWorld(position), TABLE_GRID.cellSize);
    expect(Object.fromEntries([...pieces].map(([id, piece]) => [id, piece.shape]))).toEqual({
      'mountain--1-2': 'end', 'mountain-1-2': 'end',
      'mountain--1-3': 'corner', 'mountain-0-3': 'corridor', 'mountain-1-3': 'corner',
    });
  });
});
