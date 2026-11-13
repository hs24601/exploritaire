import { afterEach, describe, expect, it, vi } from 'vitest';
import { mobileLightingEnabled, mobileLightSize, projectMobileWash } from './mobileLighting';
import { atmospherePointAtHeight } from './volumetricAtmosphere';

afterEach(() => vi.unstubAllGlobals());
const image = (width: number, height: number) => ({ width, height, data: new Uint8ClampedArray(width * height * 4) }) as ImageData;

it('chooses mobile on phones and desktop-UA tablets, with explicit comparison overrides', () => {
  const setup = (userAgent: string, coarse: boolean, search = '') => {
    vi.stubGlobal('navigator', { userAgent });
    vi.stubGlobal('window', { location: { search }, matchMedia: (q: string) => ({ matches: q === '(pointer: coarse)' ? coarse : !coarse }) });
  };
  setup('Android', false); expect(mobileLightingEnabled()).toBe(true);
  setup('Macintosh', true); expect(mobileLightingEnabled()).toBe(true);
  setup('Windows', false); expect(mobileLightingEnabled()).toBe(false);
  setup('Android', true, '?lightingRenderer=desktop'); expect(mobileLightingEnabled()).toBe(false);
  setup('Windows', false, '?lightingRenderer=mobile'); expect(mobileLightingEnabled()).toBe(true);
});

it('bounds backing pixels through phone rotation, tablet and desktop overrides', () => {
  for (const [w, h] of [[390, 844], [844, 390], [2048, 1536], [1, 1], [0, 0]]) {
    const size = mobileLightSize(w, h);
    expect(size.width).toBeGreaterThan(0); expect(size.height).toBeGreaterThan(0);
    expect(size.width).toBeLessThanOrEqual(256); expect(size.height).toBeLessThanOrEqual(192);
  }
});

describe('retained wash projection', () => {
  it('retains unlit ground outside the cached surface instead of exposing bright grid', () => {
    const output = image(8, 8);
    projectMobileWash(image(10, 10), output, { width: 200, height: 200 },
      { x: 10000, y: 0, scale: 1 }, { x: 0, y: 0, scale: 1 }, { angle: 0, perspective: 600 }, [0, 0, 0, 255]);
    for (let i = 0; i < output.data.length; i += 4) expect([...output.data.slice(i, i + 4)]).toEqual([0, 0, 0, 255]);
  });
  it('matches the shared inverse camera projection through pan, spin, zoom and tilt', () => {
    const source = image(180, 180), view = { width: 200, height: 200 };
    for (let y = 0; y < 180; y++) for (let x = 0; x < 180; x++) {
      const i = (y * 180 + x) * 4;
      source.data.set([x, y, 99, 255], i);
    }
    const painted = { x: 6, y: -9, scale: 1.5, yaw: 37 };
    for (const angle of [0, 60, 82]) for (const yaw of [0, 90, -135]) {
      const live = { x: -14, y: 3, scale: 2.1, yaw }, tilt = { angle, perspective: 600, aimY: 12 };
      const output = image(20, 20); projectMobileWash(source, output, view, live, painted, tilt);
      for (const [x, y] of [[2, 2], [10, 10], [15, 13]]) {
        const world = atmospherePointAtHeight({ x: ((x + .5) / 20 - .5) * 200, y: ((y + .5) / 20 - .5) * 200 }, 0, live, tilt);
        const r = painted.yaw * Math.PI / 180, px = world.x * painted.scale + painted.x, py = world.y * painted.scale + painted.y;
        const sx = Math.floor(((px * Math.cos(r) - py * Math.sin(r)) / 600 + .5) * 180);
        const sy = Math.floor(((px * Math.sin(r) + py * Math.cos(r)) / 600 + .5) * 180);
        const i = (y * 20 + x) * 4;
        if (sx >= 0 && sx < 180 && sy >= 0 && sy < 180) expect([...output.data.slice(i, i + 4)]).toEqual([sx, sy, 99, 255]);
        else expect(output.data[i + 3]).toBe(0);
      }
    }
  });
  it('clears reused output above the horizon and outside the retained wash', () => {
    const source = image(10, 10); source.data.fill(255);
    const output = image(20, 20); output.data.fill(255);
    projectMobileWash(source, output, { width: 2000, height: 2000 },
      { x: 10000, y: 0, scale: 1 }, { x: 0, y: 0, scale: 1 }, { angle: 82, perspective: 600 });
    expect(output.data.every(v => v === 0)).toBe(true);
  });
});
