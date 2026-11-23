import { describe, expect, it } from 'vitest';
import { chartPoints, constellationName, pickHome } from './stellarSky';

describe('stellar sky', () => {
  it('charts rank as height: a rising run climbs and K sits above A', () => {
    const p = chartPoints([3, 4, 5, 6]);
    expect(p[3].y).toBeLessThan(p[0].y);
    for (let i = 1; i < p.length; i++) expect(p[i].x).toBeGreaterThan(p[i - 1].x);
    const [a, k] = chartPoints([1, 13]);
    expect(k.y).toBeLessThan(a.y);
  });
  it('keeps long chains inside the chart box', () => {
    const p = chartPoints(Array.from({ length: 20 }, (_, i) => (i % 13) + 1), 5);
    expect(p.every(s => s.x >= 0 && s.x <= 1 && s.y >= 0 && s.y <= 1)).toBe(true);
  });
  it('names figures by chain length without repeating', () => {
    expect(constellationName(2, 0)).toBe('The Spark');
    expect(constellationName(4, 1)).toBe('The Lantern');
    expect(constellationName(9, 0)).toBe('The Serpent');
    expect(constellationName(9, 5)).toBe('The Serpent II');
  });
  it('settles figures clear of reserved UI and apart from each other', () => {
    const grid = { x: 0.3, y: 0.15, w: 0.4, h: 0.85 }, half = { x: 0.06, y: 0.05 };
    const homes: { x: number; y: number }[] = [];
    for (let i = 0; i < 6; i++) { const h = pickHome(homes, [grid], half, 16 / 9, i); expect(h).not.toBeNull(); homes.push(h!); }
    for (const h of homes) expect(h.x + half.x <= grid.x || h.x - half.x >= grid.x + grid.w).toBe(true);
    const gaps = homes.flatMap((a, i) => homes.slice(i + 1).map(b => Math.hypot(a.x - b.x, a.y - b.y)));
    expect(Math.min(...gaps)).toBeGreaterThan(0.1);
  });
});
