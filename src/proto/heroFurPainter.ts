/** Hero fur study (`hero-fur-study-v1`): a spike that paints Hero's sleeping
 * curl in code, for side-by-side review against the approved
 * `hero-sleeping-body-v3.png`. DOM-free like the bush and Khad Roots painters,
 * it writes straight-alpha RGBA, so it bakes in a worker or a Node fixture.
 * No reference pixels are read.
 *
 * Hero is a few lit ellipsoid parts (body, tail, haunch, ears, head, ruff,
 * paws, muzzle) painted back to front. Her tricolour markings live in each
 * part's own coordinates, so later views and poses can share them. Fur is not
 * drawn as separate shapes: each part is one wash whose colour and outline are
 * sampled upstream along its fur flow by a flame-tongue displacement, so one
 * colour licks into the next and the silhouette breaks into flames. Sparse
 * slender strokes add dark accents, then the closed eyes, nose and toe lines
 * are the only authored ink, and a thick dark outline wraps the outside of
 * the silhouette. */
import { Layer, TAU, clamp, smooth, rng, noise, hex, dabPass, paintFields, type RGB, type Fields, type BushRaster } from './bushPainter';

export const HERO_FUR_VERSION = 'hero-fur-study-v1';
/** `clump` scales fur tongue size, `brush` the accent strokes and granulation, `light` the two-value contrast. */
export type HeroFurPreset = { seed: number; clump: number; brush: number; light: number };
export const HERO_FUR_DEFAULTS: Readonly<HeroFurPreset> = Object.freeze({ seed: 2026, clump: .5, brush: .6, light: .5 });

type Coat = 'black' | 'tan' | 'white' | 'pink';
type Part = {
  id: string;
  /** Centre and outer radii (fur tips included) in reference pixels of the 1023×727 approved cutout; angle in radians. */
  x: number; y: number; rx: number; ry: number; angle: number;
  /** 0 is an ellipse; towards 1 the part narrows to a point at local v = -1 (ears). */
  taper?: number;
  /** Fur tongue length in reference pixels. */
  fur: number;
  /** Markings, in part-local u/v (−1…1, v down); `w` is a small warp so borders never run straight. */
  coat: (u: number, v: number, w: number) => Coat;
  /** Where the fur grows from, in part-local units; fur points away from it. */
  origin: readonly [number, number];
  /** Turns the radial flow towards a swirl (radians). */
  twist?: number;
  /** How far the tongues reach past the solid core, in tongue lengths. */
  fringe: number;
  /** How far colour licks across marking borders, as a fraction of the outline's reach (default .6). Faces stay calm. */
  mix?: number;
  /** Accent stroke density multiplier (default 1). */
  accent?: number;
  /** Scales this part's outline ring against `HERO_PART_OUTLINE` (default 1); 0 draws none. */
  outline?: number;
};

// Reference layout: the approved cutout is 1023×727; the frame fits it at 92% width.
const REF_W = 1023, FIT = .92, TOP = .17;
/** A leaf-shaped marking in reference pixels: rounded at its base, pointed at its tip, which lies along `angle` (degrees). */
function leaf(x: number, y: number, cx: number, cy: number, length: number, width: number, angle: number) {
  const a = angle * Math.PI / 180, dx = x - cx, dy = y - cy, t = (dx * Math.cos(a) + dy * Math.sin(a)) / length, s = (-dx * Math.sin(a) + dy * Math.cos(a)) / width;
  return t > -1 && t < 1 && Math.abs(s) < Math.pow(1 - t, .8) * Math.pow(1 + t, .45) * .78;
}

// Measured on the approved cutout with a 50px grid (artifacts/hero-fur-study/reference-grid.png).
const PARTS: readonly Part[] = [
  { id: 'body', x: 680, y: 430, rx: 262, ry: 232, angle: -.08, fur: 95, origin: [-1.1, -.3], fringe: .5,
    coat: (u, v, w) => u + w * .1 > .74 && v < .25 ? 'tan' : 'black' },
  { id: 'tail', x: 935, y: 425, rx: 68, ry: 92, angle: .1, fur: 52, origin: [-.6, 0], fringe: .6,
    coat: (u, v, w) => Math.hypot(u + .3, v) + w * .1 < .6 ? 'black' : v > .25 ? 'white' : 'tan' },
  { id: 'haunch', x: 760, y: 505, rx: 165, ry: 152, angle: .15, fur: 82, origin: [-.55, .55], twist: .75, fringe: .3,
    // A copper swirl around a dark hip whorl; the twisted flow draws the spiral.
    coat: (u, v, w) => Math.hypot(u - .05, v + .1) + w * .15 < .3 ? 'black' : 'tan' },
  { id: 'hind-paw', x: 622, y: 612, rx: 88, ry: 50, angle: -.1, fur: 40, origin: [1.2, -.4], fringe: .25, mix: .2, accent: .3, coat: () => 'white' },
  { id: 'near-ear', x: 560, y: 300, rx: 118, ry: 150, angle: .65, taper: .78, fur: 72, origin: [0, 1.1], fringe: .55, coat: earCoat },
  { id: 'far-ear', x: 195, y: 200, rx: 122, ry: 142, angle: -.25, taper: .78, fur: 72, origin: [0, 1.1], fringe: .55, coat: earCoat },
  { id: 'head', x: 300, y: 430, rx: 272, ry: 182, angle: 0, fur: 66, origin: [-.05, .45], fringe: .5, mix: .35, accent: .25,
    coat: (u, v, w) => {
      // Markings are measured in reference pixels; the warp keeps borders from running straight.
      const x = 300 + u * 272 + w * 14, y = 430 + v * 182 - w * 8;
      // The blaze runs diagonally (her head is turned), narrow on the forehead and opening into the muzzle.
      const along = clamp((y - 250) / 300), centre = 372 - along * 86, half = 14 + along * 14 + smooth(.45, 1, along) ** 1.4 * 80;
      if (y > 245 && Math.abs(x - centre) < half) return 'white';
      if ((x < 90 && y > 400 && y < 470) || (y > 535 && x > 180 && x < 400)) return 'white';
      // Copper brows flicker up and out above the closed eyes; copper cheeks sweep out below them.
      if (leaf(x, y, 238, 386, 38, 32, -70) || leaf(x, y, 402, 432, 32, 26, -45) || leaf(x, y, 178, 490, 92, 50, 196) || leaf(x, y, 430, 524, 62, 38, 18)) return 'tan';
      return 'black';
    } },
  { id: 'ruff', x: 515, y: 548, rx: 72, ry: 102, angle: -.3, fur: 58, origin: [.9, -.7], fringe: .45,
    coat: (_u, v, w) => v + w * .12 < -.6 ? 'black' : 'white' },
  { id: 'left-paw', x: 198, y: 605, rx: 102, ry: 56, angle: .05, fur: 40, origin: [1.2, -.6], fringe: .2, mix: .2, accent: .3, coat: () => 'white' },
  { id: 'right-paw', x: 380, y: 616, rx: 102, ry: 54, angle: -.05, fur: 40, origin: [1.2, -.6], fringe: .2, mix: .2, accent: .3, coat: () => 'white' },
  { id: 'muzzle', x: 292, y: 532, rx: 92, ry: 52, angle: -.05, fur: 34, origin: [-.1, -.6], fringe: .15, mix: 0, accent: 0,
    // No ring: around the muzzle it read as a dark mask, and even a fine line was unwanted (Eric, 2026-10-20).
    outline: 0, coat: () => 'white' },
];

function earCoat(u: number, v: number, w: number): Coat {
  const across = Math.abs(u);
  if (v + w * .08 < -.6 || across > .7 + w * .08) return 'black';
  if (across < .42 && v > -.35 && v < .78) return 'pink';
  return 'tan';
}

/** Lit and shaded planes per coat, plus the merle lift for black fur. */
const COATS: Record<Coat, { lit: RGB; shade: RGB }> = {
  black: { lit: hex('#686b76'), shade: hex('#2c2c34') },
  tan: { lit: hex('#ffbb4d'), shade: hex('#f07a12') },
  white: { lit: hex('#fdf8ef'), shade: hex('#e2dad6') },
  pink: { lit: hex('#ff9a8c'), shade: hex('#ea5f62') },
};
const MERLE = hex('#80838f'), INK = hex('#241b20');
const LIGHT = (() => { const l = [-.45, -.65, .62], n = Math.hypot(l[0], l[1], l[2]); return l.map(c => c / n); })();

type Placed = Part & { cx: number; cy: number; ax: number; ay: number; ca: number; sa: number; length: number; reach: number; core: number; seed: number };

/** Part-local coordinates before the ear taper is applied. */
function frame(p: Placed, x: number, y: number) {
  const dx = x - p.cx, dy = y - p.cy;
  return { lu: (dx * p.ca + dy * p.sa) / p.ax, v: (-dx * p.sa + dy * p.ca) / p.ay };
}
/** Tapered u and the normalized radius for a local point. */
function shape(p: Placed, lu: number, v: number) {
  const u = lu / (1 - (p.taper ?? 0) * (1 - clamp(v, -1, 1)) / 2);
  return { u, v, d: Math.hypot(u, v) };
}

/** Two-value lighting: the upper shoulder is lit and rolls off before the rim. */
function shadeOf(p: Placed, u: number, v: number, d: number, contrast: number) {
  const nz = Math.sqrt(Math.max(0, 1 - Math.min(1, d * d))), nx = u * p.ca - v * p.sa, ny = u * p.sa + v * p.ca;
  const lambert = nx * LIGHT[0] + ny * LIGHT[1] + nz * LIGHT[2];
  const lit = smooth(.18, .5, lambert) * (1 - smooth(.82, 1.02, d) * .45);
  return .5 + (lit - .5) * (.6 + contrast * .8);
}

function coatColor(coat: Coat, lit: number, merle: number, out: number[]) {
  const c = COATS[coat];
  for (let k = 0; k < 3; k++) out[k] = c.shade[k] + (c.lit[k] - c.shade[k]) * clamp(lit);
  // Merle: broad grey patches lift the black coat, never the copper or white.
  if (coat === 'black') for (let k = 0; k < 3; k++) out[k] += (MERLE[k] - out[k]) * merle * (.35 + lit * .4);
}

const hash = (n: number, seed: number) => { let h = Math.imul(n | 0, 374761393) ^ Math.imul(seed, 668265263); h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };
/** One row of flame tongues across the flow: sharp peaks of varied height and lean. */
function tongues(q: number, seed: number) {
  const cell = Math.floor(q), f = q - cell, peak = .5 + (hash(cell, seed) - .5) * .4, amp = .45 + hash(cell, seed + 1) * .55;
  const tri = f < peak ? f / peak : (1 - f) / (1 - peak);
  return { height: amp * tri ** 1.15, tri };
}

/** The part's wash. Each pixel samples colour and coverage upstream along the
 * fur flow by a tongue-shaped distance, so markings and the outline become
 * interlocking flames; tongue centres stay lighter and the gaps pool darker. */
function paintWash(layer: Layer, p: Placed, fields: Fields, merle: (x: number, y: number) => number, contrast: number) {
  const { size } = layer, reach = Math.max(p.ax, p.ay) * 1.05, out = [0, 0, 0], twist = p.twist ?? 0;
  const radius = (p.ax + p.ay) / 2, spacing = p.length * .42, ct = Math.cos(twist), st = Math.sin(twist), turns = Math.max(3, Math.round(TAU * radius / spacing));
  for (let y = Math.max(0, Math.floor(p.cy - reach)); y <= Math.min(size - 1, Math.ceil(p.cy + reach)); y++)
    for (let x = Math.max(0, Math.floor(p.cx - reach)); x <= Math.min(size - 1, Math.ceil(p.cx + reach)); x++) {
      const { lu, v } = frame(p, x, y), i = y * size + x;
      if (shape(p, lu, v).d > 1.08) continue;
      const ox = lu - p.origin[0], oy = v - p.origin[1], theta = Math.atan2(oy, ox), r = Math.max(.02, Math.hypot(ox, oy));
      // Across-flow coordinate: angle for radial fur, rings for a full swirl, spirals between.
      // A whole number of tongues around the origin, so radial fur has no seam where the angle wraps.
      const across = theta * ct * turns / TAU - Math.log(r) * st * radius / spacing + (fields.grid.mid[i] - .5) * .6;
      const a = tongues(across, p.seed), b = tongues(across * 2.1 + .37, p.seed + 7);
      // Tongues fade in away from the flow origin, where they would crowd into a sunburst.
      const grown = smooth(spacing * .8, spacing * 2.6, r * radius);
      const height = Math.max(a.height, b.height * .55) * grown, drift = p.reach * height;
      const flow = theta + twist, fx = Math.cos(flow) / p.ax, fy = Math.sin(flow) / p.ay;
      const edge = shape(p, lu - fx * drift, v - fy * drift).d + (fields.grid.fine[i] - .5) * .03;
      const alpha = smooth(p.core + .015, p.core - .015, edge); if (alpha < .01) continue;
      const mix = drift * (p.mix ?? .6), s = shape(p, lu - fx * mix, v - fy * mix);
      const w = (fields.grid.broad[i] - .5) * 1.2 + (fields.grid.mid[i] - .5) * .8;
      // Strand modulation follows how busy the part is, so the face and paws stay calm washes.
      const busy = grown * clamp(p.accent ?? 1, .15, 1);
      const lit = shadeOf(p, s.u, s.v, s.d, contrast) + (a.tri - .5) * .22 * busy + (fields.grid.broad[i] - .5) * .2;
      coatColor(p.coat(s.u, s.v, w), lit, smooth(.45, .75, merle(x / size, y / size)), out);
      // Pigment pools in the gaps between tongues and at the outline's drying edge.
      const pool = 1 - smooth(.3, 0, a.tri) * .22 * busy - smooth(p.core - .06, p.core, edge) * .14;
      layer.over(i, out[0] * pool, out[1] * pool, out[2] * pool, alpha);
    }
}

type Stroke = { x: number; y: number; angle: number; length: number; width: number; bend: number; color: RGB; alpha: number };

/** A slender leaf stroke: rounded base, widest a third of the way, pointed tip; wet soft edge with a pooled rim. */
function paintStroke(layer: Layer, c: Stroke) {
  const { size } = layer, ca = Math.cos(c.angle), sa = Math.sin(c.angle), reach = c.length * 1.1 + c.width;
  const bx = c.x + ca * c.length * .45, by = c.y + sa * c.length * .45;
  for (let y = Math.max(0, Math.floor(by - reach)); y <= Math.min(size - 1, Math.ceil(by + reach)); y++)
    for (let x = Math.max(0, Math.floor(bx - reach)); x <= Math.min(size - 1, Math.ceil(bx + reach)); x++) {
      const i = y * size + x; if (layer.px[i * 4 + 3] < .5) continue;
      const dx = x - c.x, dy = y - c.y, t = (dx * ca + dy * sa) / c.length;
      if (t < -.22 || t > 1) continue;
      const s = (-dx * sa + dy * ca) - c.bend * c.length * t * t;
      const half = c.width * Math.pow(Math.sin(Math.PI * Math.min(1, (t + .22) / 1.22)), .65); if (half < .3) continue;
      const q = Math.abs(s) / half, alpha = smooth(1, Math.max(0, 1 - 1.6 / half), q) * c.alpha * (1 - smooth(.7, 1, t) * .4);
      if (alpha < .01) continue;
      const pool = 1 - smooth(.6, 1, q) * .25;
      // Stays inside the painted body: strokes glaze, they never add coverage.
      layer.glaze(i, [c.color[0] * pool, c.color[1] * pool, c.color[2] * pool], alpha);
    }
}

/** Sparse accents along the flow: near-black strokes in black fur, deep copper in tan, faint grey partings in white. */
function planStrokes(p: Placed, size: number, fields: Fields, preset: Readonly<HeroFurPreset>, random: () => number) {
  const length = p.length * 1.05, width = length * .15, area = Math.PI * p.ax * p.ay * (1 - (p.taper ?? 0) * .45);
  const count = Math.round(area / (length * width) * (.2 + preset.brush * .3) * (p.accent ?? 1)), strokes: Stroke[] = [];
  for (let tries = 0; strokes.length < count && tries < count * 6; tries++) {
    const x = p.cx + (random() * 2 - 1) * p.ax, y = p.cy + (random() * 2 - 1) * p.ay;
    if (x < 0 || y < 0 || x >= size || y >= size) continue;
    const { lu, v } = frame(p, x, y), s = shape(p, lu, v); if (s.d > p.core * .92) continue;
    const coat = p.coat(s.u, s.v, (fields.grid.broad[Math.floor(y) * size + Math.floor(x)] - .5) * 2);
    const flow = Math.atan2(v - p.origin[1], lu - p.origin[0]) + (p.twist ?? 0) + (random() - .5) * .3;
    const lx = Math.cos(flow), ly = Math.sin(flow), angle = Math.atan2(lx * p.sa * p.ax / p.ay + ly * p.ca, lx * p.ca - ly * p.sa * p.ay / p.ax);
    const color = coat === 'black' ? hex('#15141a') : coat === 'tan' ? hex('#b84a0c') : coat === 'pink' ? hex('#d24456') : hex('#b7adb2');
    const alpha = coat === 'black' ? .5 + random() * .3 : coat === 'white' ? .25 + random() * .15 : .35 + random() * .25;
    const scale = .7 + random() * .6;
    strokes.push({ x, y, angle, length: length * scale, width: width * scale, bend: (random() - .5) * .6, color, alpha });
  }
  return strokes;
}

/** Authored ink: closed lids, the mouth, toe lines and the nose. */
function paintFace(layer: Layer, at: (x: number, y: number) => [number, number], scale: number) {
  const { size } = layer;
  const stroke = (pts: [number, number][], width: number, color: RGB, alpha = .92) => {
    const p = pts.map(([x, y]) => at(x, y)), w = width * scale;
    let x0 = size, y0 = size, x1 = 0, y1 = 0;
    for (const [x, y] of p) { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); }
    for (let y = Math.max(0, Math.floor(y0 - w - 1)); y <= Math.min(size - 1, Math.ceil(y1 + w + 1)); y++)
      for (let x = Math.max(0, Math.floor(x0 - w - 1)); x <= Math.min(size - 1, Math.ceil(x1 + w + 1)); x++) {
        let best = Infinity, along = 0;
        for (let k = 0; k < p.length - 1; k++) {
          const [ax, ay] = p[k], [bx, by] = p[k + 1], ex = bx - ax, ey = by - ay, len2 = ex * ex + ey * ey || 1;
          const t = clamp(((x - ax) * ex + (y - ay) * ey) / len2), dist = Math.hypot(x - ax - ex * t, y - ay - ey * t);
          if (dist < best) { best = dist; along = (k + t) / (p.length - 1); }
        }
        // Tapered at both ends like a brush lift.
        const half = Math.max(.6, w * (.35 + .65 * Math.sin(along * Math.PI))), a = smooth(half + .7, half - .7, best) * alpha;
        if (a > .01) layer.over(y * size + x, color[0], color[1], color[2], a);
      }
  };
  // Closed eyes: soft downturned lids with a lash flick at the outer corner.
  stroke([[196, 418], [216, 432], [244, 441], [272, 442]], 6, INK);
  stroke([[196, 418], [188, 410]], 2.5, INK, .8);
  stroke([[358, 476], [384, 487], [414, 489], [442, 482]], 6, INK);
  stroke([[442, 482], [452, 474]], 2.5, INK, .8);
  // Mouth: a short drop from the nose and a contented curve to her right.
  stroke([[276, 546], [262, 558]], 2.5, INK, .8);
  stroke([[276, 546], [292, 558], [326, 560], [356, 548]], 2.5, INK, .8);
  // Toe separations on the front and hind paws.
  for (const [x, y] of [[148, 612], [196, 620], [244, 618], [334, 626], [382, 632], [430, 628], [598, 618], [642, 620]] as const) stroke([[x, y - 16], [x + 3, y + 22]], 3, hex('#5d5158'), .75);
  // The nose: a rounded dark pad with a lifted top highlight, not a gloss dot.
  const [nx, ny] = at(276, 520), rx = 40 * scale, ry = 27 * scale, hi = hex('#8a7880');
  for (let y = Math.max(0, Math.floor(ny - ry - 2)); y <= Math.min(size - 1, Math.ceil(ny + ry + 2)); y++)
    for (let x = Math.max(0, Math.floor(nx - rx - 2)); x <= Math.min(size - 1, Math.ceil(nx + rx + 2)); x++) {
      const u = (x - nx) / rx, v = (y - ny) / ry, wide = 1 - .25 * smooth(-.2, 1, v), d = Math.hypot(u / wide, v);
      const alpha = smooth(1.02, .9, d); if (alpha < .01) continue;
      const lift = smooth(.75, 0, Math.hypot(u + .1, v + .45)) * .55;
      layer.over(y * size + x, INK[0] + (hi[0] - INK[0]) * lift, INK[1] + (hi[1] - INK[1]) * lift, INK[2] + (hi[2] - INK[2]) * lift, alpha);
    }
}

/** Outline widths in reference pixels (Eric, 2026-10-20): a dark, thick stroke
 * around the outside, and around every body part where it overlaps the parts
 * behind it (paws, tail, ears, muzzle), so the parts read distinctly. */
export const HERO_OUTLINE = 27;
export const HERO_PART_OUTLINE = 18;

/** Two-pass chamfer distance (in pixels) from every pixel to the nearest solidly painted pixel of `px`. */
function paintedDistance(px: Float32Array, size: number) {
  const n = size * size, dist = new Float32Array(n).fill(1e9);
  for (let i = 0; i < n; i++) if (px[i * 4 + 3] > .5) dist[i] = 0;
  const D = 1, E = Math.SQRT2;
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const i = y * size + x; let d = dist[i];
    if (x > 0) d = Math.min(d, dist[i - 1] + D);
    if (y > 0) { d = Math.min(d, dist[i - size] + D); if (x > 0) d = Math.min(d, dist[i - size - 1] + E); if (x < size - 1) d = Math.min(d, dist[i - size + 1] + E); }
    dist[i] = d;
  }
  for (let y = size - 1; y >= 0; y--) for (let x = size - 1; x >= 0; x--) {
    const i = y * size + x; let d = dist[i];
    if (x < size - 1) d = Math.min(d, dist[i + 1] + D);
    if (y < size - 1) { d = Math.min(d, dist[i + size] + D); if (x < size - 1) d = Math.min(d, dist[i + size + 1] + E); if (x > 0) d = Math.min(d, dist[i + size - 1] + E); }
    dist[i] = d;
  }
  return dist;
}

/** Brush-width ink coverage at a distance from painted pixels; the width swells
 * and thins a little with brush-scale noise so it reads as a loaded brush, not a vector stroke. */
const inkAt = (fields: Fields, i: number, distance: number, width: number) => { const r = width * (.8 + fields.grid.mid[i] * .4); return smooth(r + .7, r - .7, distance); };

/** A continuous dark outline outside the silhouette, composited under the
 * paint so soft fur tips sit on the ink. */
function outerStroke(layer: Layer, fields: Fields, width: number) {
  const { size, px } = layer, dist = paintedDistance(px, size);
  for (let i = 0; i < size * size; i++) {
    const ink = inkAt(fields, i, dist[i], width);
    if (ink <= 0) continue;
    // Under-composite: the ink shows only where the paint above it is thin or absent.
    const k = i * 4, keep = 1 - px[k + 3], a = ink * .96 * keep;
    px[k] += INK[0] * a; px[k + 1] += INK[1] * a; px[k + 2] += INK[2] * a; px[k + 3] += a;
  }
}

export function paintHeroSleeping(preset: Readonly<HeroFurPreset> = HERO_FUR_DEFAULTS, size = 512): BushRaster {
  if (!Number.isInteger(size) || size < 128 || size > 1024) throw new Error('Hero fur raster must be 128–1024 pixels.');
  const layer = new Layer(size), k = FIT * size / REF_W;
  // Separate streams per subsystem, so retuning one never reshuffles another.
  const fields = paintFields(size, rng(preset.seed ^ 0x51ed)), merle = noise(5, rng(preset.seed ^ 0x3e71));
  const strokeRandom = rng(preset.seed ^ 0xc1a5), finish = rng(preset.seed ^ 0xf1b);
  const at = (x: number, y: number): [number, number] => [(1 - FIT) / 2 * size + x * k, TOP * size + y * k];
  PARTS.forEach((part, n) => {
    const [cx, cy] = at(part.x, part.y), length = part.fur * k * (.7 + preset.clump * .6), reach = length * (.45 + part.fringe);
    // Radii are measured to the fur tips; the solid core sits a tongue's reach inside them.
    const core = 1 - reach * .42 / ((part.rx + part.ry) / 2 * k);
    const p: Placed = { ...part, cx, cy, ax: part.rx * k, ay: part.ry * k, ca: Math.cos(part.angle), sa: Math.sin(part.angle), length, reach, core, seed: preset.seed * 31 + n * 101 };
    // Each part paints on its own sheet, so its accents stay inside it and its outline can be found.
    const sheet = new Layer(size);
    paintWash(sheet, p, fields, merle, preset.light);
    for (const stroke of planStrokes(p, size, fields, preset, strokeRandom)) paintStroke(sheet, stroke);
    // Ink the paint behind the part around its outline, then lay the part over it. The ring only
    // glazes existing paint; the outer stroke owns the silhouette, so the edge is never doubled.
    if (n > 0 && (part.outline ?? 1) > 0) {
      const dist = paintedDistance(sheet.px, size), width = HERO_PART_OUTLINE * (part.outline ?? 1) * k;
      for (let i = 0; i < size * size; i++) if (dist[i] > 0 && dist[i] < width * 1.3) { const ink = inkAt(fields, i, dist[i], width); if (ink > 0) layer.glaze(i, INK, ink * .96); }
    }
    for (let i = 0, q = 0; i < size * size; i++, q += 4) {
      const a = sheet.px[q + 3]; if (a <= 0) continue;
      const keep = 1 - a, out = layer.px;
      out[q] = sheet.px[q] + out[q] * keep; out[q + 1] = sheet.px[q + 1] + out[q + 1] * keep; out[q + 2] = sheet.px[q + 2] + out[q + 2] * keep; out[q + 3] = a + out[q + 3] * keep;
    }
  });
  paintFace(layer, at, k);
  dabPass(layer, finish, .35 + preset.brush * .5);
  outerStroke(layer, fields, HERO_OUTLINE * k);
  return layer.raster();
}
