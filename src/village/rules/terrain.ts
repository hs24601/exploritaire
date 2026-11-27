// Village topography (prototype): one deterministic height field over the whole
// village grid, in grid tile units. The starting patch stays a flat clearing so no
// current rule moves; beyond it the land rises into hills, an old earthwork berm
// curls around the north and west of the clearing (open at the gate), a lake basin
// sits to the south-east and a mountain range closes the far north.
//
// Presentation only for now: the map paints it (hill washes, contours, sun-driven
// hillshade) and the light field lets high ground catch first and last light.
// Gameplay hooks (vantage, passability, climbs) are proposals in
// docs/research/village-lighting-terrain.md.
import { MAP_COLS, MAP_ROWS, OUTER_PAD, SAPLING } from './map';

export type TerrainKind = 'water' | 'flat' | 'rise' | 'hill' | 'mountain';

/** Height bands, in contour levels (one level ≈ a storey of land). */
export const WATER_BELOW = -0.45;
export const HILL_FROM = 1.4;
export const MOUNTAIN_FROM = 4.2;
export const SNOW_FROM = 7.4;

const hash = (x: number, y: number, seed: number) => {
  let h = Math.imul(x | 0, 374761393) ^ Math.imul(y | 0, 668265263) ^ Math.imul(seed, 2246822519);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
};
const smooth = (t: number) => t * t * (3 - 2 * t);
export const smoothstep = (a: number, b: number, v: number) => {
  const t = Math.max(0, Math.min(1, (v - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

/** Value noise, 0–1, continuous across tiles. */
export function valueNoise(x: number, y: number, seed: number): number {
  const ix = Math.floor(x), iy = Math.floor(y), fx = smooth(x - ix), fy = smooth(y - iy);
  const a = hash(ix, iy, seed), b = hash(ix + 1, iy, seed), c = hash(ix, iy + 1, seed), d = hash(ix + 1, iy + 1, seed);
  return a + (b - a) * fx + (c - a) * fy + (a - b - c + d) * fx * fy;
}

function fbm(x: number, y: number, seed: number, octaves = 3): number {
  let sum = 0, amp = 0.5, freq = 1, norm = 0;
  for (let i = 0; i < octaves; i++) { sum += valueNoise(x * freq, y * freq, seed + i * 17) * amp; norm += amp; amp *= 0.5; freq *= 2.03; }
  return sum / norm;
}

/** Berm arc around the clearing, in world offsets from the sapling (north positive). */
const BERM = { radius: 5.7, from: 20 * Math.PI / 180, to: 168 * Math.PI / 180, height: 1.15 };
const LAKE = { x: 10.5, y: -9, radius: 3.6 };

/**
 * Height at a grid point (x across, y down, tile units; tile centres are at +0.5).
 * Continuous, so painting can sample between tiles.
 */
export function heightAt(x: number, y: number): number {
  const wx = x - (SAPLING.x + 0.5), wy = (SAPLING.y + 0.5) - y;
  const d = Math.hypot(wx, wy);
  // The clearing: flat out to the patch edge, then the land is free to move.
  const open = smoothstep(4.6, 9.5, d);
  const rolling = (fbm(x / 7.5, y / 7.5, 41) - 0.42) * 4.2 * open;
  // A low earthwork on the north and west, broken where the gate track comes in.
  const angle = Math.atan2(wy, wx);
  const along = angle >= BERM.from && angle <= BERM.to ? 1 : 0;
  const bermEnds = along * smoothstep(BERM.from, BERM.from + 0.35, angle) * smoothstep(BERM.to, BERM.to - 0.35, angle);
  const berm = BERM.height * bermEnds * Math.exp(-((d - BERM.radius) ** 2) / 0.55) * (0.85 + 0.3 * valueNoise(x * 0.9, y * 0.9, 9));
  // The range: ridged noise rising past twelve squares north.
  const north = smoothstep(11, 21, wy);
  const ridge = 1 - Math.abs(2 * fbm(x / 6, y / 9, 77, 4) - 1);
  const range = north * (2.2 + ridge * ridge * 6.5);
  // One lone fell to the east, a landmark from the clearing.
  const fell = 5.2 * Math.exp(-(((wx - 17) ** 2) + ((wy - 4) ** 2)) / 9);
  // A lake basin to the south-east.
  const lake = -2.4 * Math.exp(-(((wx - LAKE.x) ** 2) + ((wy - LAKE.y) ** 2)) / (LAKE.radius ** 2));
  return rolling + berm + range + fell + lake;
}

/** Height at a tile's centre. */
export const tileHeight = (x: number, y: number) => heightAt(x + 0.5, y + 0.5);

/** Steepest rise across a tile, in levels per tile. */
export function slopeAt(x: number, y: number): number {
  const cx = x + 0.5, cy = y + 0.5, e = 0.5;
  return Math.hypot(heightAt(cx + e, cy) - heightAt(cx - e, cy), heightAt(cx, cy + e) - heightAt(cx, cy - e)) / (2 * e);
}

export function terrainKind(x: number, y: number): TerrainKind {
  const h = tileHeight(x, y);
  if (h < WATER_BELOW) return 'water';
  if (h >= MOUNTAIN_FROM) return 'mountain';
  if (h >= HILL_FROM) return 'hill';
  return slopeAt(x, y) > 0.55 ? 'rise' : 'flat';
}

export const TERRAIN_LABEL: Record<TerrainKind, string> = {
  water: 'Lake', flat: 'Meadow', rise: 'Slope', hill: 'Hills', mountain: 'Mountains',
};

/** World extent covered by the height field, in grid tiles. */
export const WORLD_BOUNDS = { x: -OUTER_PAD, y: -OUTER_PAD, w: MAP_COLS + 2 * OUTER_PAD, h: MAP_ROWS + 2 * OUTER_PAD };

export type Segment = [number, number, number, number];

/**
 * Contour lines by marching squares over a sampled height grid. Returns one list of
 * segments per level, in grid tile units.
 */
export function contours(levels: number[], step = 0.5, bounds = WORLD_BOUNDS): Map<number, Segment[]> {
  const cols = Math.round(bounds.w / step) + 1, rows = Math.round(bounds.h / step) + 1;
  const h = new Float32Array(cols * rows);
  for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) h[j * cols + i] = heightAt(bounds.x + i * step, bounds.y + j * step);
  const out = new Map<number, Segment[]>();
  for (const level of levels) {
    const segs: Segment[] = [];
    for (let j = 0; j < rows - 1; j++) for (let i = 0; i < cols - 1; i++) {
      const a = h[j * cols + i], b = h[j * cols + i + 1], c = h[(j + 1) * cols + i + 1], d = h[(j + 1) * cols + i];
      const code = (a > level ? 8 : 0) | (b > level ? 4 : 0) | (c > level ? 2 : 0) | (d > level ? 1 : 0);
      if (code === 0 || code === 15) continue;
      const x0 = bounds.x + i * step, y0 = bounds.y + j * step;
      const lerp = (p: number, q: number) => (level - p) / (q - p);
      const top: [number, number] = [x0 + lerp(a, b) * step, y0];
      const right: [number, number] = [x0 + step, y0 + lerp(b, c) * step];
      const bottom: [number, number] = [x0 + lerp(d, c) * step, y0 + step];
      const left: [number, number] = [x0, y0 + lerp(a, d) * step];
      const pairs: [[number, number], [number, number]][] = ({
        1: [[left, bottom]], 2: [[bottom, right]], 3: [[left, right]], 4: [[top, right]], 5: [[left, top], [bottom, right]],
        6: [[top, bottom]], 7: [[left, top]], 8: [[left, top]], 9: [[top, bottom]], 10: [[top, right], [left, bottom]],
        11: [[top, right]], 12: [[left, right]], 13: [[bottom, right]], 14: [[left, bottom]],
      } as Record<number, [[number, number], [number, number]][]>)[code];
      for (const [p, q] of pairs) segs.push([p[0], p[1], q[0], q[1]]);
    }
    out.set(level, segs);
  }
  return out;
}
