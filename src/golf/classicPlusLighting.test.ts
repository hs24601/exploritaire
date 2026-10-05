import { describe, expect, it } from 'vitest';
import { getTableLighting, tableObjectShadow } from './classicPlusLighting';
describe('table lighting scaffold', () => {
  it('cycles continuously between noon, twilight and night with a visibility floor', () => {
    expect(getTableLighting(12).daylight).toBe(1);
    expect(getTableLighting(0).phase).toBe('Night');
    expect(getTableLighting(7).phase).toBe('Twilight');
    expect(getTableLighting(36)).toEqual(getTableLighting(12));
    expect(getTableLighting(0).darkness).toBeLessThan(0.7);
  });
  it('moves shadows from west to east as the daylight source moves', () => {
    expect(tableObjectShadow(8, { x: 0, y: 0 })).not.toEqual(tableObjectShadow(16, { x: 0, y: 0 }));
    expect(getTableLighting(8).source.x).toBeLessThan(0);
    expect(getTableLighting(16).source.x).toBeGreaterThan(0);
  });
  it('casts local shadows only inside a tabletop light radius', () => {
    const light = { id: 'lamp', position: { x: 48, y: 0 }, radius: 3 };
    expect(tableObjectShadow(0, { x: 0, y: 0 }, 8, [light])).not.toEqual(tableObjectShadow(0, { x: 0, y: 0 }));
    expect(tableObjectShadow(0, { x: 1000, y: 0 }, 8, [light])).toEqual(tableObjectShadow(0, { x: 1000, y: 0 }));
  });
});
