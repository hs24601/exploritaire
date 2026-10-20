/** Khad Roots bark-plate painter (`khad-paint-v1`). DOM-free like the bush
 * painter: it paints the grown v2 geometry into a straight-alpha RGBA buffer.
 *
 * Wood is painted in vine space (along and across each vine): a near-black
 * wine base, crimson bark plates (irregular cells, each a slightly raised
 * scale with its own tone) separated by dark crevices, moonlight only on
 * upward-facing surfaces, glowing red cracks in the crevices of those upper
 * surfaces, and a restrained red wash above the upper edge. Thorns darken to
 * near-black tips. The shared watercolour glaze and granulation finish it,
 * then the clearance windows are cut out. Embers stay SVG. */
import { Layer, cells, dabPass, noise, rng } from './bushPainter';
import { KHAD_REWARD_CLEARANCE, KHAD_VALUE_CLEARANCE, khadRootGeometry, khadBridgeGeometry, type KhadSpinePoint, type KhadThornShape } from './khadRootGeometry';

export const KHAD_PAINT_VERSION = 'khad-paint-v1';
/** The painted square in card units (card space is 100 × 140). Vines reach a
 * little beyond the card on every side. */
export const KHAD_PAINT_FRAME = Object.freeze({ x: -45, y: -25, size: 190 });

type Stem = { spine: KhadSpinePoint[]; thornShapes: KhadThornShape[] };
type RGB = readonly [number, number, number];
const clamp = (n: number, lo = 0, hi = 1) => Math.max(lo, Math.min(hi, n));
const smooth = (a: number, b: number, x: number) => { const t = clamp((x - a) / (b - a)); return t * t * (3 - 2 * t); };
const hex = (v: string): RGB => [parseInt(v.slice(1, 3), 16) / 255, parseInt(v.slice(3, 5), 16) / 255, parseInt(v.slice(5, 7), 16) / 255];
const mix = (a: RGB, b: RGB, t: number): [number, number, number] => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
function seedOf(id: string) { let s = 2166136261; for (const c of id) s = Math.imul(s ^ c.charCodeAt(0), 16777619); return s >>> 0; }

// Gloom palette: near-black wine shadows through deep crimson to lit burgundy.
const WOOD: readonly (readonly [number, RGB])[] = [[0, hex('#0e0308')], [.28, hex('#2e0913')], [.5, hex('#5c1120')], [.72, hex('#8a1d2e')], [1, hex('#b8343f')]];
const wood = (v: number) => { let i = 1; while (i < WOOD.length - 1 && v > WOOD[i][0]) i++; const [a, ca] = WOOD[i - 1], [b, cb] = WOOD[i]; return mix(ca, cb, clamp((v - a) / (b - a))); };
const GLOW = hex('#ff2e47'), GLOW_CORE = hex('#ff8a6e'), HAZE = hex('#c8102e'), THORN_TIP = hex('#100307');

/** Per-pixel nearest-vine buffers for one stem, in pixels. */
function vineField(stem: Stem, toPx: (x: number, y: number) => [number, number], scale: number, size: number) {
  const pts = stem.spine.map(p => { const [x, y] = toPx(p.x, p.y); return { x, y, w: p.w * scale }; });
  const pad = Math.max(...pts.map(p => p.w)) * 2.4 + 4;
  const x0 = Math.max(0, Math.floor(Math.min(...pts.map(p => p.x)) - pad)), x1 = Math.min(size - 1, Math.ceil(Math.max(...pts.map(p => p.x)) + pad));
  const y0 = Math.max(0, Math.floor(Math.min(...pts.map(p => p.y)) - pad)), y1 = Math.min(size - 1, Math.ceil(Math.max(...pts.map(p => p.y)) + pad));
  const W = x1 - x0 + 1, H = y1 - y0 + 1, n = W * H;
  const dist = new Float32Array(n).fill(Infinity), along = new Float32Array(n), width = new Float32Array(n), up = new Float32Array(n), across = new Float32Array(n);
  let length = 0;
  for (let i = 0; i < pts.length - 1; i++) {
    const p = pts[i], q = pts[i + 1], ex = q.x - p.x, ey = q.y - p.y, l2 = ex * ex + ey * ey || 1, l = Math.sqrt(l2), m = Math.max(p.w, q.w) * 2.4 + 3;
    for (let y = Math.max(y0, Math.floor(Math.min(p.y, q.y) - m)); y <= Math.min(y1, Math.ceil(Math.max(p.y, q.y) + m)); y++)
      for (let x = Math.max(x0, Math.floor(Math.min(p.x, q.x) - m)); x <= Math.min(x1, Math.ceil(Math.max(p.x, q.x) + m)); x++) {
        const s = clamp(((x - p.x) * ex + (y - p.y) * ey) / l2), w = p.w + (q.w - p.w) * s;
        const ox = x - p.x - ex * s, oy = y - p.y - ey * s, d = Math.sqrt(ox * ox + oy * oy), k = (y - y0) * W + x - x0;
        if (d - w < dist[k]) { dist[k] = d - w; along[k] = length + l * s; width[k] = w; up[k] = -oy / Math.max(1, w); across[k] = (ox * -ey + oy * ex) / l / Math.max(1, w); }
      }
    length += l;
  }
  return { x0, y0, W, H, dist, along, width, up, across };
}

/** Bark plates, crevices and upper-surface glow for one vine. */
function paintVine(layer: Layer, stem: Stem, seed: number, toPx: (x: number, y: number) => [number, number], scale: number, pass: 'haze' | 'wood') {
  const { size } = layer, f = vineField(stem, toPx, scale, size), plates = cells(seed), edgeNoise = noise(48, rng(seed ^ 0x51ed));
  const seams = noise(24, rng(seed ^ 0x9a3)), mottle = noise(64, rng(seed ^ 0x2b7)), warpA = noise(20, rng(seed ^ 0x77)), warpB = noise(20, rng(seed ^ 0x4c1));
  const mean = stem.spine.reduce((s, p) => s + p.w, 0) / stem.spine.length * scale;
  // Plates scale with the vine's girth, so thick runs carry broad scales and
  // thin shoots fine ones, as in the painted reference.
  // Near-round plates: elongated ones line up in rows whose crevices run along
  // the vine and read as streaks.
  const plateLong = Math.max(2.6, mean * .56), plateWide = Math.max(2.4, mean * .5);
  for (let y = 0; y < f.H; y++) for (let x = 0; x < f.W; x++) {
    const k = y * f.W + x, px = f.x0 + x, py = f.y0 + y;
    const rough = (edgeNoise(px / size * 1.6, py / size * 1.6) - .5) * Math.max(1.2, mean * .35);
    const d = f.dist[k] + rough;
    // Red wash just above upper edges: a restrained miasma, never below.
    if (pass === 'haze') {
      if (d <= 0) continue;
      const above = f.up[k] > .2 ? smooth(.2, 1, f.up[k]) : 0, reach = Math.max(2, f.width[k] * .9);
      const haze = above * smooth(reach, 0, d) * .26;
      if (haze > .004) layer.over(py * size + px, HAZE[0], HAZE[1], HAZE[2], haze);
      continue;
    }
    if (d > 1) continue;
    const alpha = smooth(1, -1, d);
    if (alpha < .003) continue;
    const u = f.along[k], v = f.across[k], up = clamp(f.up[k], -1, 1);
    // A warped plate grid: rows break up and plate sizes vary along the vine.
    const wu = u / plateLong + (warpA(u / (mean * 14) % 1, (v + 1) * .25) - .5) * 1.4;
    const wv = (v + 1) * f.width[k] / plateWide + (warpB(u / (mean * 11) % 1, (v + 1) * .25) - .5) * 1.2;
    const cell = plates(wu, wv);
    // Crevices between plates, broken where seams heal over.
    const gap = cell.f2 - cell.f1, crevice = (1 - smooth(.03, .16, gap)) * (.55 + seams(u / (mean * 9) % 1, .5) * .6);
    const dome = smooth(.55, 0, cell.f1);
    // The upper shoulder of a rounded vine catches the light, not its outline:
    // light peaks part-way up and rolls off toward the rim.
    const shoulder = smooth(0, .45, up) * smooth(1, .7, up), rim = smooth(.7, 1, Math.abs(v));
    let value = .22 + (cell.id - .5) * .26 + dome * .12 + shoulder * .14;
    value += (mottle(px / size * 3, py / size * 3) - .5) * .14;
    value -= crevice * .42;
    // Rounded body: margins roll into shadow, the underside most of all.
    value -= rim * .26 + smooth(0, -1, up) * .2;
    let color = wood(clamp(value));
    // Moon response: glowing cracks only in the crevices of upward-facing bark,
    // strongest at plate junctions (where three plates meet) and in patches, so
    // they read as broken cracks rather than lines along the vine.
    // Moon response: one wandering crack runs along the upper shoulder,
    // breaking up along its length, with short branches where plate borders
    // meet it and a soft bloom. Other plate borders stay dark crevices.
    const lane = .42 + (warpA(u / (mean * 9) % 1, .8) - .5) * .4, off = Math.abs(up - lane) * f.width[k];
    const on = smooth(.44, .66, seams(u / (mean * 6) % 1, .2)) * (1 - rim) * smooth(.05, .3, up);
    const flicker = .6 + mottle(px / size * 9, py / size * 9) * .8;
    const vein = (1 - smooth(.35, 1.6, off)) * flicker, branch = (1 - smooth(.4, 1.8, gap * plateWide)) * (1 - smooth(1.5, 6, off)) * .8;
    const crack = clamp(Math.max(vein, branch)) * on, bloom = (1 - smooth(0, 4, off)) * on * .18;
    const glow = Math.max(crack, bloom);
    if (glow > .02) { color = mix(color, GLOW, clamp(glow * 1.1)); if (crack > .6) color = mix(color, GLOW_CORE, clamp((crack - .6) * 1.4)); }
    layer.over(py * size + px, color[0], color[1], color[2], alpha);
  }
}

/** Thorns are the vines' most recognisable feature, so they read clearly
 * against both the dark wood and the card: a mid-crimson body lighter than the
 * wood, a moonlit flank with a bright ridge, a fine broken shimmer of brighter
 * flecks (the painted stand-in for the grain the SVG filter gives v1/v2), a
 * thin near-black outline and only the very tip darkening. Static, like the
 * rest of the paint. Upward-pointing thorns also keep a hot edge on the lit
 * flank (moon response); thorns hanging under a vine never glow. */
function paintThorn(layer: Layer, thorn: KhadThornShape, toPx: (x: number, y: number) => [number, number], shimmer: (x: number, y: number) => number) {
  const { size } = layer, q = (p0: { x: number; y: number }, c: { x: number; y: number }, p1: { x: number; y: number }) => Array.from({ length: 10 }, (_, i) => {
    const t = (i + 1) / 10, a = 1 - t; return toPx(a * a * p0.x + 2 * a * t * c.x + t * t * p1.x, a * a * p0.y + 2 * a * t * c.y + t * t * p1.y);
  });
  const poly = [toPx(thorn.a.x, thorn.a.y), ...q(thorn.a, thorn.c1, thorn.tip), ...q(thorn.tip, thorn.c2, thorn.b)];
  const [bx, by] = toPx((thorn.a.x + thorn.b.x) / 2, (thorn.a.y + thorn.b.y) / 2), [tx, ty] = toPx(thorn.tip.x, thorn.tip.y);
  const len = Math.hypot(tx - bx, ty - by) || 1, upward = (by - ty) / len;
  // The flank facing up catches moonlight; the other side falls into shadow.
  const nx = -(ty - by) / len, ny = (tx - bx) / len, litSide = ny < 0 ? 1 : -1;
  const edgeDistance = (x: number, y: number) => { let best = Infinity;
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) { const [x0, y0] = poly[j], [x1, y1] = poly[i], vx = x1 - x0, vy = y1 - y0, l2 = vx * vx + vy * vy || 1, t = clamp(((x - x0) * vx + (y - y0) * vy) / l2); best = Math.min(best, Math.hypot(x - x0 - vx * t, y - y0 - vy * t)); }
    return best; };
  const outline = Math.max(.8, len * .045), moon = .6 + .4 * Math.max(0, upward);
  const ys = poly.map(p => p[1]);
  for (let y = Math.max(0, Math.floor(Math.min(...ys))); y <= Math.min(size - 1, Math.ceil(Math.max(...ys))); y++) {
    const xs: number[] = [];
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) { const [xi, yi] = poly[i], [xj, yj] = poly[j]; if ((yi > y + .5) !== (yj > y + .5)) xs.push(xi + (y + .5 - yi) * (xj - xi) / (yj - yi)); }
    xs.sort((m, n) => m - n);
    for (let s = 0; s + 1 < xs.length; s += 2) for (let x = Math.max(0, Math.ceil(xs[s] - .5)); x <= Math.min(size - 1, Math.floor(xs[s + 1] - .5)); x++) {
      const px = x + .5, py = y + .5, t = clamp(((px - bx) * (tx - bx) + (py - by) * (ty - by)) / (len * len));
      const side = clamp(((px - bx) * nx + (py - by) * ny) * litSide / Math.max(1, len * .22), -1, 1);
      let value = .5 - t * .14 + side * .22 * moon;
      // A bright ridge just inside the lit flank, tapering toward the tip.
      value += Math.exp(-(((side - .45) / .18) ** 2)) * .24 * moon * (1 - t * .7);
      // Shimmer: brighter flecks, densest on the lit half, never on the tip.
      const fleck = shimmer(px / size, py / size);
      if (fleck > .66 && side > -.2) value += (fleck - .66) * 1.1 * (1 - smooth(.6, .95, t));
      let color = mix(wood(clamp(value)), THORN_TIP, smooth(.82, 1, t) * .7);
      if (upward > .25 && side > .75 && t < .5) color = mix(color, GLOW, (side - .75) * 1.6 * (1 - t * 2) * smooth(.25, .6, upward));
      // Thin dark outline keeps the silhouette crisp against wood and card.
      const edge = edgeDistance(px, py);
      if (edge < outline) color = mix(color, THORN_TIP, smooth(outline, outline * .25, edge) * .85);
      layer.over(y * size + x, color[0], color[1], color[2], 1);
    }
  }
}

/** Clears the protected windows (rounded like the SVG mask) from all paint. */
function clearWindows(layer: Layer, toPx: (x: number, y: number) => [number, number], scale: number, obscureValue: boolean) {
  const windows = [{ ...KHAD_REWARD_CLEARANCE, r: 5 }, ...(obscureValue ? [] : [{ ...KHAD_VALUE_CLEARANCE, r: 10 }])];
  const { size, px } = layer;
  for (const w of windows) {
    const [x0, y0] = toPx(w.x, w.y), r = w.r * scale, W = w.w * scale, H = w.h * scale;
    for (let y = Math.max(0, Math.floor(y0)); y < Math.min(size, Math.ceil(y0 + H)); y++) for (let x = Math.max(0, Math.floor(x0)); x < Math.min(size, Math.ceil(x0 + W)); x++) {
      const dx = Math.max(x0 + r - x - .5, 0, x + .5 - (x0 + W - r)), dy = Math.max(y0 + r - y - .5, 0, y + .5 - (y0 + H - r));
      if (Math.hypot(dx, dy) > r) continue;
      const i = (y * size + x) * 4; px[i] = px[i + 1] = px[i + 2] = px[i + 3] = 0;
    }
  }
}

function paintStems(stems: Stem[], seed: number, density: number, obscureValue: boolean | null, frame: { x: number; y: number; size: number } = KHAD_PAINT_FRAME) {
  const size = Math.round(frame.size * density);
  if (size < 32 || size > 2048) throw new Error('Khad Roots raster must be 32–2048 pixels.');
  const layer = new Layer(size), scale = size / frame.size;
  const toPx = (x: number, y: number): [number, number] => [(x - frame.x) * scale, (y - frame.y) * scale];
  // The red wash sits beneath everything; thorns go under their vine so the
  // wood's rounded body overlaps and roots their bases.
  stems.forEach((stem, i) => paintVine(layer, stem, seed + i * 7919, toPx, scale, 'haze'));
  stems.forEach((stem, i) => {
    const shimmer = noise(Math.max(32, Math.round(size / 2.5)), rng((seed + i * 7919) ^ 0x5f1c));
    stem.thornShapes.forEach(t => paintThorn(layer, t, toPx, shimmer));
    paintVine(layer, stem, seed + i * 7919, toPx, scale, 'wood');
  });
  dabPass(layer, rng(seed ^ 0x7e11), .7);
  if (obscureValue !== null) clearWindows(layer, toPx, scale, obscureValue);
  return layer.raster();
}

/** One card's painted roots, in the KHAD_PAINT_FRAME square at `density` px per card unit. */
export function paintKhadRoots(cardId: string, obscureValue = false, density = 3) {
  return paintStems(khadRootGeometry(cardId, obscureValue).stems, seedOf(cardId), density, obscureValue);
}

/** A group link painted in its own frame (link space has no clearance windows). */
export function paintKhadBridge(a: { x: number; y: number }, b: { x: number; y: number }, id: string, frame: { x: number; y: number; size: number }, density = 3) {
  return paintStems([khadBridgeGeometry(a, b, id)], seedOf(id), density, null, frame);
}
