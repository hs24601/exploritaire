import defaults from '../data/watercolorPresets.json';

/** Original analytic adaptation of the pigment-load/deposit ideas reviewed in
 * ART.md (sroman81, https://codepen.io/sroman81/pen/jEypxaB). This transparent
 * wash uses ordinary alpha, not the reference's substrate-dependent KM optics.
 * Large wet masses explain the form; sparse sediment only supports them. */
export const WATERCOLOR_VERSION = 'wash-v1';
export type WashPalette = 'woodland' | 'dirt' | 'slate' | 'water' | 'wine';
export type WashPreset = { version: 1; seed: string; load: number; water: number; rim: number; granulation: number; roughness: number; opacity: number };
export const DEFAULT_WASH: Readonly<WashPreset> = Object.freeze({ ...defaults, version: 1 });
export const WASH_CONTROLS = ['load', 'water', 'rim', 'granulation', 'roughness', 'opacity'] as const;
const colors: Record<WashPalette, readonly [number, number, number][]> = {
  woodland: [[103, 116, 67], [119, 100, 66], [66, 88, 66]],
  dirt: [[162, 116, 72], [128, 90, 59], [105, 82, 62]],
  slate: [[110, 123, 137], [94, 103, 116], [145, 136, 116]],
  water: [[57, 111, 125], [66, 100, 135], [85, 131, 132]],
  wine: [[98, 57, 70], [72, 57, 76], [95, 80, 70]],
};
const clamp = (n: number) => Math.max(0, Math.min(1, n));
const smooth = (a: number, b: number, n: number) => { const t = clamp((n - a) / (b - a)); return t * t * (3 - 2 * t); };
function randomFor(seed: string) {
  let state = 2166136261;
  for (let i = 0; i < seed.length; i++) state = Math.imul(state ^ seed.charCodeAt(i), 16777619);
  return () => { state = (Math.imul(state, 1664525) + 1013904223) >>> 0; return state / 4294967296; };
}
function noiseGrid(cells: number, random: () => number) {
  const side = cells + 1, grid = Float32Array.from({ length: side * side }, random);
  return (x: number, y: number) => {
    const gx = clamp(x) * cells, gy = clamp(y) * cells;
    const ix = Math.min(cells - 1, Math.floor(gx)), iy = Math.min(cells - 1, Math.floor(gy));
    const tx = smooth(0, 1, gx - ix), ty = smooth(0, 1, gy - iy);
    const a = grid[iy * side + ix] * (1 - tx) + grid[iy * side + ix + 1] * tx;
    const b = grid[(iy + 1) * side + ix] * (1 - tx) + grid[(iy + 1) * side + ix + 1] * tx;
    return a * (1 - ty) + b * ty;
  };
}

/** JSON is deliberately small and strict: presets cannot carry game state,
 * arbitrary asset URLs or accidentally allocate unbounded raster dimensions. */
export function parseWashPreset(value: unknown): WashPreset {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Expected a watercolor preset object.');
  const p = value as Record<string, unknown>;
  if (p.version !== 1 || typeof p.seed !== 'string' || !p.seed.trim() || p.seed.length > 96) throw new Error('Preset needs version 1 and a seed of 1–96 characters.');
  if (Object.keys(p).some(key => !['version', 'seed', ...WASH_CONTROLS].includes(key))) throw new Error('Unknown preset property. Import only watercolor settings.');
  for (const key of WASH_CONTROLS) if (typeof p[key] !== 'number' || !Number.isFinite(p[key]) || Number(p[key]) < 0 || Number(p[key]) > 1) throw new Error(`${key} must be between 0 and 1.`);
  return { version: 1, seed: p.seed, ...Object.fromEntries(WASH_CONTROLS.map(key => [key, p[key]])) } as WashPreset;
}
export function washPresetKey(preset: Readonly<WashPreset> = DEFAULT_WASH) {
  return `${WATERCOLOR_VERSION}:${JSON.stringify([preset.seed, ...WASH_CONTROLS.map(key => preset[key])])}`;
}
export function biomeWashPalette(kind: string): WashPalette {
  if (kind === 'dark-woods') return 'wine';
  if (kind === 'hero-den' || kind === 'dirt' || kind === 'path') return 'dirt';
  if (kind === 'impassable-mountain') return 'slate';
  return kind === 'water' ? 'water' : 'woodland';
}

/** Pure, bounded CPU bake. No DOM, clock, wall-time randomness or game state. */
export function renderWashPixels(size: number, palette: WashPalette, preset: Readonly<WashPreset> = DEFAULT_WASH, variation = 0): Uint8ClampedArray {
  if (!Number.isInteger(size) || size < 16 || size > 256) throw new Error('Wash raster must be 16–256 pixels.');
  parseWashPreset(preset);
  const random = randomFor(`${preset.seed}:${variation}`);
  // Geometry and paper stay identical when comparing palettes.
  const broad = noiseGrid(7, random), edge = noiseGrid(23, random), paper = noiseGrid(67, random);
  const pools = Array.from({ length: 3 }, (_, i) => ({
    x: .36 + random() * .28, y: .36 + random() * .28,
    rx: .26 + random() * .1, ry: .21 + random() * .12, angle: random() * Math.PI,
    waterX: .32 + random() * .32, waterY: .30 + random() * .32,
    color: colors[palette][i],
  })).map(pool => ({ ...pool, cos: Math.cos(pool.angle), sin: Math.sin(pool.angle) }));
  const pixels = new Uint8ClampedArray(size * size * 4);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const nx = x / (size - 1), ny = y / (size - 1), b = broad(nx, ny), e = edge(nx, ny), grain = paper(nx, ny);
    // Completely transparent gutter avoids rectangular cards/atlas edges.
    const gutter = smooth(.04, .13, Math.min(nx, ny, 1 - nx, 1 - ny));
    if (!gutter) continue;
    const boundary = 1 + (b - .5) * preset.roughness * .62 + (e - .5) * preset.roughness * .14;
    const front = smooth(.25, .7, ny + (b - .5) * .28);
    const sediment = smooth(.40, .14, grain) * smooth(.48, .75, e) * preset.granulation * .16;
    let alpha = 0, red = 0, green = 0, blue = 0;
    for (const pool of pools) {
      const dx = nx - pool.x, dy = ny - pool.y, ca = pool.cos, sa = pool.sin;
      const radius = Math.hypot((dx * ca + dy * sa) / pool.rx, (-dx * sa + dy * ca) / pool.ry);
      const distance = boundary - radius;
      const coverage = smooth(-.09, .12, distance);
      if (!coverage) continue;
      let load = (.22 + preset.load * (.9 - front * .48)) * (.82 + b * .32);
      const wetDistance = Math.hypot((nx - pool.waterX) / .20, (ny - pool.waterY) / .14);
      const paleCore = Math.exp(-wetDistance * wetDistance * 2.2);
      const waterRim = Math.exp(-Math.pow((wetDistance - .95) / .18, 2));
      const edgeRim = Math.exp(-Math.pow((distance - .09) / .055, 2)) * (.35 + e * .65);
      load *= 1 - paleCore * preset.water * .82;
      load += preset.rim * (waterRim * preset.water * .36 + edgeRim * .32);
      // Sparse valley deposition changes concentration, without a grain veil.
      load += sediment;
      const a = clamp(coverage * load * preset.opacity * .48 * gutter);
      const pigment = 1 - Math.min(.22, (waterRim + edgeRim) * preset.rim * .14);
      red = pool.color[0] * pigment * a + red * (1 - a);
      green = pool.color[1] * pigment * a + green * (1 - a);
      blue = pool.color[2] * pigment * a + blue * (1 - a);
      alpha = a + alpha * (1 - a);
    }
    const i = (y * size + x) * 4;
    if (alpha > 1 / 255) { pixels[i] = red / alpha; pixels[i + 1] = green / alpha; pixels[i + 2] = blue / alpha; pixels[i + 3] = alpha * 255; }
  }
  return pixels;
}

const cache = new Map<string, HTMLCanvasElement>();
/** Only CPU canvases are shared. Each scene owns and disposes its GPU texture. */
export function watercolorWashCanvas(palette: WashPalette, preset: Readonly<WashPreset> = DEFAULT_WASH, variation = 0, size = 256): HTMLCanvasElement | undefined {
  const key = `${palette}:${size}:${variation}:${washPresetKey(preset)}`;
  const hit = cache.get(key); if (hit) { cache.delete(key); cache.set(key, hit); return hit; }
  try {
    const canvas = document.createElement('canvas'); canvas.width = canvas.height = size;
    const ctx = canvas.getContext('2d'); if (!ctx) return undefined;
    const image = ctx.createImageData(size, size); image.data.set(renderWashPixels(size, palette, preset, variation)); ctx.putImageData(image, 0, 0);
    cache.set(key, canvas);
    if (cache.size > 24) cache.delete(cache.keys().next().value!);
    return canvas;
  } catch { return undefined; } // Original art remains available on failed bake.
}
