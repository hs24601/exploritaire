import { describe, expect, it } from 'vitest';
import { TABLE_GRID, snapToTableGrid } from './tableGrid';

describe('table grid', () => {
  it('snaps world positions to a stable grid intersection', () => {
    expect(snapToTableGrid({ x: 58, y: 57 })).toEqual({ x: 59.375, y: 61.111111111111114 });
  });

  it('keeps tiles inside the authored table bounds', () => {
    expect(snapToTableGrid({ x: -10, y: 150 })).toEqual({ x: TABLE_GRID.minX, y: TABLE_GRID.maxY });
  });
});
