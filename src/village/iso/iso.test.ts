import { describe, expect, it } from 'vitest';
import { TILE_H, TILE_RATIO, TILE_W, Z_PX, headingFor, project, unproject } from './projection';
import { isoTier } from './terrainIso';
import { MAP_COLS, MAP_ROWS } from '../rules/map';

describe('isometric projection', () => {
  it('is true isometric: a √3 : 1 diamond and cubes as tall as the diamond', () => {
    expect(TILE_RATIO).toBeCloseTo(1.732, 3);
    expect(TILE_H).toBeCloseTo(147.8, 1);
    expect(Z_PX).toBeCloseTo(TILE_H, 6);
    const n = project(0, 0), e = project(1, 0), s = project(1, 1), w = project(0, 1);
    expect(e.x - w.x).toBeCloseTo(TILE_W, 6);
    expect(s.y - n.y).toBeCloseTo(TILE_H, 6);
  });

  it('round-trips screen and ground at any height', () => {
    for (const [x, y, z] of [[0, 0, 0], [3.25, -7.5, 0], [12, 40, 2.5], [-30, 5, 4]]) {
      const p = project(x, y, z);
      const g = unproject(p.x, p.y, z);
      expect(g.x).toBeCloseTo(x, 9);
      expect(g.y).toBeCloseTo(y, 9);
    }
  });

  it('puts north up-right, east down-right and the viewer to the south-east', () => {
    expect(headingFor(0, 1)).toBe('SW');
    expect(headingFor(1, 0)).toBe('SE');
    expect(headingFor(1, 1)).toBe('S');
    expect(headingFor(-1, -1)).toBe('N');
    expect(headingFor(0, -1)).toBe('NE');
  });
});

describe('isometric terrain tiers', () => {
  it('keeps the starting patch on the ground plane', () => {
    for (let y = 0; y < MAP_ROWS; y++) for (let x = 0; x < MAP_COLS; x++) expect(isoTier(x, y)).toBe(0);
  });

  it('raises the northern range', () => {
    let raised = 0;
    for (let x = -10; x < 20; x++) if (isoTier(x, -30) > 0) raised++;
    expect(raised).toBeGreaterThan(20);
  });
});
