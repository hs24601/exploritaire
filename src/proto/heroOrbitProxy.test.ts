import { describe, expect, it } from 'vitest';
import { HERO_ORBIT_COAT_COLOURS, HERO_ORBIT_FRAME, HERO_ORBIT_VIEWS, renderHeroOrbitGuide } from './heroOrbitProxy';
import { HERO_ORBIT_DIRECTIONAL_SPRITE, HERO_ORBIT_SOURCE } from './heroOrbitSprite';
import { HERO_ORBIT_ATLAS } from './heroOrbitAtlas';

type Raster = { width: number; height: number; data: Uint8ClampedArray };
const size = 256;
const guides = Object.fromEntries(HERO_ORBIT_VIEWS.map(view => [view.id, renderHeroOrbitGuide(view.azimuth, undefined, size)])) as Record<string, Raster>;
function bounds(r: Raster) {
  let x0 = r.width, y0 = r.height, x1 = -1, y1 = -1;
  for (let y = 0; y < r.height; y++) for (let x = 0; x < r.width; x++) if (r.data[(y * r.width + x) * 4 + 3] > 128) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
  return { x0, y0, x1, y1 };
}
/** Pixels whose colour is a shaded step (1, .86 or .72) of one coat colour. */
function count(r: Raster, coat: keyof typeof HERO_ORBIT_COAT_COLOURS) {
  const c = HERO_ORBIT_COAT_COLOURS[coat]; let n = 0;
  for (let i = 0; i < r.data.length; i += 4) {
    if (r.data[i + 3] < 250) continue;
    if ([1, .86, .72].some(s => Math.abs(r.data[i] - c[0] * s) < 3 && Math.abs(r.data[i + 1] - c[1] * s) < 3 && Math.abs(r.data[i + 2] - c[2] * s) < 3)) n++;
  }
  return n;
}

describe('Hero orbit proxy guides', () => {
  it('renders deterministically on a transparent background', () => {
    expect(renderHeroOrbitGuide(45, undefined, size).data).toEqual(guides['front-quarter'].data);
    for (const r of Object.values(guides)) for (const [x, y] of [[0, 0], [size - 1, 0], [0, size - 1], [size - 1, size - 1]]) expect(r.data[(y * size + x) * 4 + 3]).toBe(0);
  });

  it('registers every view to one ground line and one world scale', () => {
    // The world origin sits on the ground line; at a 15° camera the nearer paws project a little below it.
    const floor = HERO_ORBIT_FRAME.ground * size;
    for (const r of Object.values(guides)) {
      const b = bounds(r);
      expect(b.y1).toBeGreaterThanOrEqual(floor); expect(b.y1 - floor).toBeLessThan(size * .1);
      expect(b.x0).toBeGreaterThan(0); expect(b.y0).toBeGreaterThan(0); expect(b.x1).toBeLessThan(size - 1);
    }
    // Mirrored pairs agree: front and rear share a width, as do the two quarter views.
    const width = (id: string) => { const b = bounds(guides[id]); return b.x1 - b.x0; };
    expect(Math.abs(width('front') - width('rear'))).toBeLessThanOrEqual(2);
    expect(Math.abs(width('front-quarter') - width('rear-quarter'))).toBeLessThanOrEqual(2);
  });

  it('faces screen-left in the side view, like the approved sheets', () => {
    const r = guides.side, b = bounds(r);
    let noseX = size;
    for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) { const i = (y * size + x) * 4; if (r.data[i + 3] > 250 && r.data[i] < 30 && r.data[i + 1] < 25) noseX = Math.min(noseX, x); }
    expect(noseX - b.x0).toBeLessThan((b.x1 - b.x0) * .15);
  });

  it('shows the face only from the front half, and her tricolour coat everywhere', () => {
    for (const id of ['front', 'front-quarter', 'side']) expect(count(guides[id], 'eye')).toBeGreaterThan(0);
    for (const id of ['rear-quarter', 'rear']) expect(count(guides[id], 'eye')).toBe(0);
    for (const r of Object.values(guides)) for (const coat of ['black', 'tan', 'white'] as const) expect(count(r, coat)).toBeGreaterThan(size * size * .002);
  });
});

describe('Hero orbit sprite', () => {
  it('swaps only the low-tier standing frames to the orbit sheet', () => {
    expect(HERO_ORBIT_DIRECTIONAL_SPRITE.low.map(frame => frame.source)).toEqual(Array(5).fill(HERO_ORBIT_SOURCE));
    expect(HERO_ORBIT_DIRECTIONAL_SPRITE.high.some(frame => frame.source === HERO_ORBIT_SOURCE)).toBe(false);
    expect(HERO_ORBIT_DIRECTIONAL_SPRITE.top.source).not.toBe(HERO_ORBIT_SOURCE);
    HERO_ORBIT_VIEWS.forEach((view, i) => expect(HERO_ORBIT_DIRECTIONAL_SPRITE.low[i].parts[0].rect).toEqual(HERO_ORBIT_ATLAS.rects[view.id]));
  });
});
