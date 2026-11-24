import { describe, expect, it } from 'vitest';
import { HERO_FUR_DEFAULTS, paintHeroSleeping } from './heroFurPainter';

type Raster = { width: number; height: number; data: Uint8ClampedArray };
const lum = (r: Raster, x: number, y: number) => { const i = (y * r.width + x) * 4; return r.data[i] * .3 + r.data[i + 1] * .59 + r.data[i + 2] * .11; };
// Reference pixels of the approved 1023×727 cutout, mapped into the painter's frame.
const frame = (size: number, x: number, y: number) => [Math.round(.04 * size + x * .92 * size / 1023), Math.round(.17 * size + y * .92 * size / 1023)];

describe('Hero fur study painter', () => {
  it('bakes identical pixels for the same preset and different pixels per seed', () => {
    const a = paintHeroSleeping(HERO_FUR_DEFAULTS, 256), b = paintHeroSleeping(HERO_FUR_DEFAULTS, 256), c = paintHeroSleeping({ ...HERO_FUR_DEFAULTS, seed: 7 }, 256);
    expect(a.data).toEqual(b.data);
    expect(a.data).not.toEqual(c.data);
  });

  it('rejects bake sizes outside 128–1024', () => {
    expect(() => paintHeroSleeping(HERO_FUR_DEFAULTS, 64)).toThrow();
    expect(() => paintHeroSleeping(HERO_FUR_DEFAULTS, 2048)).toThrow();
  });

  it('fits inside its frame without clipping fur at the edges', () => {
    for (const seed of [2026, 11, 512]) {
      const r = paintHeroSleeping({ ...HERO_FUR_DEFAULTS, seed }, 256);
      for (let k = 0; k < r.width; k++) for (const [x, y] of [[k, 0], [k, r.height - 1], [0, k], [r.width - 1, k]]) expect(r.data[(y * r.width + x) * 4 + 3]).toBe(0);
    }
  });

  it('paints all three coat colours of a tricolour Aussie in meaningful amounts', () => {
    for (const seed of [2026, 11, 512]) {
      const r = paintHeroSleeping({ ...HERO_FUR_DEFAULTS, seed }, 256);
      let painted = 0, dark = 0, copper = 0, cream = 0;
      for (let i = 0; i < r.data.length; i += 4) {
        if (r.data[i + 3] < 200) continue;
        painted++;
        const [red, green, blue] = [r.data[i], r.data[i + 1], r.data[i + 2]];
        if (red * .3 + green * .59 + blue * .11 < 90) dark++;
        else if (red > 190 && green > 80 && green < 190 && blue < 110) copper++;
        else if (red > 210 && green > 205 && blue > 195) cream++;
      }
      expect(dark / painted).toBeGreaterThan(.15);
      expect(copper / painted).toBeGreaterThan(.06);
      expect(cream / painted).toBeGreaterThan(.1);
    }
  });

  it('wraps the silhouette in a dark outline', () => {
    for (const seed of [2026, 11]) {
      const r = paintHeroSleeping({ ...HERO_FUR_DEFAULTS, seed }, 512);
      let edge = 0, inked = 0;
      for (let y = 1; y < r.height - 1; y++) for (let x = 1; x < r.width - 1; x++) {
        const i = (y * r.width + x) * 4; if (r.data[i + 3] < 128) continue;
        if (![[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => r.data[((y + dy) * r.width + x + dx) * 4 + 3] < 128)) continue;
        edge++; if (lum(r, x, y) < 70) inked++;
      }
      expect(edge).toBeGreaterThan(500);
      expect(inked / edge).toBeGreaterThan(.9);
    }
  });

  // The first passes lost the closed eyes in near-black fur; the lids must stay readable against their surroundings.
  it('keeps both closed eyes darker than the fur around them', () => {
    const size = 512, r = paintHeroSleeping(HERO_FUR_DEFAULTS, size);
    for (const [ex, ey] of [[244, 441], [414, 489]]) {
      const [x, y] = frame(size, ex, ey);
      let lid = 255; for (let dy = -2; dy <= 2; dy++) lid = Math.min(lid, lum(r, x, y + dy));
      let ring = 0, n = 0;
      for (let a = 0; a < 16; a++) { ring += lum(r, Math.round(x + Math.cos(a / 16 * Math.PI * 2) * 9), Math.round(y + Math.sin(a / 16 * Math.PI * 2) * 9)); n++; }
      expect(lid).toBeLessThan(ring / n * .6);
    }
  });
});
