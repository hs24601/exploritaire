import { expect, it } from 'vitest';
import { cellKey, cellPoint } from './roamRescue';
import { fogRoute, MAP_CELLS, revealedCells } from './fogMapRules';

it('reveals only visited neighbourhoods and remembers them without cascading', () => {
  const seen = revealedCells(['0,2']); expect(seen.has('1,1')).toBe(true); expect(seen.has('2,0')).toBe(false);
  expect(revealedCells(['0,2','-3,-1']).has('-4,-2')).toBe(true);
});
it('routes through discovered terrain around ridges, never into fog or out of bounds', () => {
  const all = new Set(MAP_CELLS.map(c => `${c.column},${c.row}`));
  const path = fogRoute(cellPoint(0,2), '0,-6', all);
  expect(path.length).toBeGreaterThan(8); expect(path[path.length-1]).toEqual(cellPoint(0,-6));
  for (let i=0; i<path.length; i++) { const prev=i ? path[i-1] : cellPoint(0,2); expect(Math.abs(path[i].x-prev.x)+Math.abs(path[i].y-prev.y)).toBe(48); }
  expect(fogRoute(cellPoint(0,2),'0,0',all)).toEqual([]);
  expect(fogRoute(cellPoint(0,2),'0,-6',revealedCells(['0,2']))).toEqual([]);
  expect(fogRoute(cellPoint(0,2),'7,2',all)).toEqual([]);
  expect(path.map(cellKey)).not.toContain('0,0');
});
