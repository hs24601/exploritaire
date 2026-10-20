/** Third procedural bush study (`bush-study-v3`). A DOM-free painter: it
 * writes a straight-alpha RGBA buffer, so the same code bakes in the lab,
 * a worker or a Node fixture script. No reference pixels are read.
 *
 * The crown is a lit 3D ellipsoid of leaf clumps painted back to front. Each
 * clump is a palmate brush shape with a serrated wet edge, lit by its surface
 * normal, and casts a soft shadow onto the clumps already behind it. */
export const BUSH_PAINTER_VERSION = 'bush-study-v3';

export type BushPaintPreset = { seed: number; fullness: number; spread: number; brush: number; warmth: number; fruit: number };
export type BushRaster = { width: number; height: number; data: Uint8ClampedArray<ArrayBuffer> };

const TAU = Math.PI * 2;
const clamp = (n: number, low = 0, high = 1) => Math.max(low, Math.min(high, n));
const smooth = (a: number, b: number, x: number) => { const t = clamp((x - a) / (b - a)); return t * t * (3 - 2 * t); };
export function rng(seed: number) { let s = seed >>> 0; return () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; }; }
/** Value noise over a cells×cells grid; samples outside [0,1] wrap. */
export function noise(cells: number, random: () => number) {
  const values = Float32Array.from({ length: cells * cells }, random);
  return (x: number, y: number) => {
    const px = x * cells, py = y * cells, fx = Math.floor(px), fy = Math.floor(py);
    const ix = ((fx % cells) + cells) % cells, iy = ((fy % cells) + cells) % cells, jx = (ix + 1) % cells, jy = (iy + 1) % cells;
    const u = px - fx, v = py - fy, su = u * u * (3 - 2 * u), sv = v * v * (3 - 2 * v);
    const top = values[iy * cells + ix] * (1 - su) + values[iy * cells + jx] * su;
    return top * (1 - sv) + (values[jy * cells + ix] * (1 - su) + values[jy * cells + jx] * su) * sv;
  };
}
type RGB = readonly [number, number, number];
const hex = (value: string): RGB => [parseInt(value.slice(1, 3), 16) / 255, parseInt(value.slice(3, 5), 16) / 255, parseInt(value.slice(5, 7), 16) / 255];
function ramp(stops: readonly (readonly [number, RGB])[]) {
  return (v: number, out: number[]) => {
    let i = 1; while (i < stops.length - 1 && v > stops[i][0]) i++;
    const [a, ca] = stops[i - 1], [b, cb] = stops[i], t = clamp((v - a) / (b - a));
    for (let k = 0; k < 3; k++) out[k] = ca[k] + (cb[k] - ca[k]) * t;
  };
}

/** Premultiplied float layer with the two operations the painting needs. */
export class Layer {
  readonly px: Float32Array;
  readonly size: number;
  constructor(size: number) { this.size = size; this.px = new Float32Array(size * size * 4); }
  over(i: number, r: number, g: number, b: number, a: number) {
    const p = this.px, k = i * 4, keep = 1 - a;
    p[k] = r * a + p[k] * keep; p[k + 1] = g * a + p[k + 1] * keep; p[k + 2] = b * a + p[k + 2] * keep; p[k + 3] = a + p[k + 3] * keep;
  }
  /** Glazes a darker pigment over existing paint only; coverage is unchanged. */
  glaze(i: number, color: RGB, a: number) {
    const p = this.px, k = i * 4, cover = p[k + 3]; if (cover <= 0) return;
    for (let c = 0; c < 3; c++) p[k + c] += (color[c] * cover - p[k + c]) * a;
  }
  raster(): BushRaster {
    const data = new Uint8ClampedArray(this.size * this.size * 4), p = this.px;
    for (let k = 0; k < data.length; k += 4) {
      const a = p[k + 3]; if (a <= 0) continue;
      data[k] = p[k] / a * 255; data[k + 1] = p[k + 1] / a * 255; data[k + 2] = p[k + 2] / a * 255; data[k + 3] = a * 255;
    }
    return { width: this.size, height: this.size, data };
  }
}

type Clump = { x: number; y: number; z: number; rx: number; ry: number; angle: number; light: number; tint: number; outline: Float32Array; seed: number };
type Limb = { points: { x: number; y: number; w: number }[] };
type FruitSlot = { x: number; y: number; r: number; cover: number };
/** `fruit` is the painted prefix of `slots` for the preset's live count. */
export type BushPlan = { clumps: Clump[]; limbs: Limb[]; fruit: FruitSlot[]; slots: FruitSlot[]; ground: number; drape: number; trunk: BushTrunkForm;
  /** Per pixel column inside the skirt: the y the foliage (or trunk) must reach down to; NaN outside it. */
  hem: Float32Array;
  /** The main limbs, base first, for structural checks. */
  mains: Limb[] };
/** Most manaberries one bush can carry while every fruit stays legible. */
export const BUSH_MAX_FRUIT = 5;
/** Trunk forms a seed chooses from; all stay inside the crown-closure trunk window. */
export const BUSH_TRUNK_FORMS = ['split', 'stem', 'lean', 'triple'] as const;
export type BushTrunkForm = typeof BUSH_TRUNK_FORMS[number];

/** Mandatory crown structure (Eric, 2026-10-20). A bush is one closed mass: no
 * open background may be enclosed by foliage on its left, right and above, and
 * foliage must hang down between the limbs to the drape line. Only the lowest
 * part of the trunk (below the drape line) may show as an open window. A large
 * central gap, arch or tunnel under the crown is illegal output. */
export const BUSH_CROWN_RULES = Object.freeze({
  /** The drape line sits this fraction of the bush height above the ground. */
  maxTrunkWindow: .3,
  /** Largest enclosed transparent hole allowed, as a fraction of the bush's bounding area. */
  maxEnclosedHole: .004,
  /** Central fraction of the crown's width that must be skirted down to the hem
   * (Eric, 2026-10-20: open background under the crown beside the trunk is
   * still a central gap, even when it opens to the side). Outside it, the
   * crown's edges may curve up naturally. */
  skirtWidth: .72,
  /** Outside the trunk notch, foliage hangs to within this fraction of the bush
   * height of the ground at the skirt's centre, rising toward its edges. Only
   * the notch over the limbs may open up to maxTrunkWindow. */
  hem: .12,
  /** Between limbs (the crotch), open background may reach only this fraction
   * of the bush height; above it foliage hangs between the limbs. Only the
   * limbs themselves may show up to maxTrunkWindow. */
  maxCrotch: .16,
  /** Narrowest shortfall below the hem that counts as a gap, as a fraction of the bake width. */
  minGapWidth: .025,
});

/** Mandatory trunk growth (Eric, 2026-10-20). All main limbs grow from one
 * shared root and only diverge as they rise: they never start apart and then
 * converge, cross or rejoin (no A-frames), which no tree or bush does. */
export const BUSH_TRUNK_RULES = Object.freeze({
  /** Largest allowed narrowing of the gap between two main limbs as they rise, as a fraction of the bake. */
  maxConvergence: .012,
});

const OUTLINE = 256;
/** A broad leaf plane seen at an angle: three to five rounded lobes across its
 * upper arc with notches between them, and a flatter, slightly tucked base. */
function clumpOutline(random: () => number) {
  const count = 3 + Math.floor(random() * 3);
  const lobes = Array.from({ length: count }, (_, i) => ({
    a: Math.PI * (1.08 + (i + .5) / count * .84) + (random() - .5) * .28,
    w: .22 + random() * .14, h: .26 + random() * .2,
  }));
  // A lobe or two may also hang from the sides, which breaks the fan symmetry.
  if (random() < .7) lobes.push({ a: random() < .5 ? .35 + random() * .4 : Math.PI - .35 - random() * .4, w: .3 + random() * .12, h: .1 + random() * .12 });
  return Float32Array.from({ length: OUTLINE }, (_, i) => {
    const a = i / OUTLINE * TAU; let r = .72 - Math.max(0, Math.sin(a)) * .1;
    for (const lobe of lobes) { const d = Math.atan2(Math.sin(a - lobe.a), Math.cos(a - lobe.a)); r += lobe.h * Math.exp(-((d / lobe.w) ** 2)); }
    return r;
  });
}

const LIGHT = (() => { const l = [-.22, .84, .46], n = Math.hypot(...l); return l.map(v => v / n); })();

export function planBush(preset: Readonly<BushPaintPreset>, size: number): BushPlan {
  const random = rng(preset.seed ^ 0x6b3e1), spread = .82 + preset.spread * .18;
  const cx = size * .5, cy = size * .47, RX = size * .32 * spread, RY = size * .25;
  const clumps: Clump[] = [], count = Math.round(34 + preset.fullness * 24);
  // Best-candidate samples spread evenly over the crown's silhouette, leaving
  // a low central window where the trunk shows.
  const placed: { x: number; y: number }[] = [];
  // The crown is a seeded union of a few sub-crowns, so its outline breaks
  // into separate raised and hanging lobes instead of one smooth dome.
  const lobes = [{ x: 0, y: -.05, rx: .82, ry: .8 }, ...[-1, 1].map(side => ({ x: side * (.42 + random() * .14), y: -.05 + random() * .4, rx: .5 + random() * .14, ry: .5 + random() * .15 })),
    { x: (random() - .5) * .6, y: .45 + random() * .15, rx: .38 + random() * .12, ry: .42 },
    // Low hanging masses on both sides reach toward the ground beside the trunk.
    ...[-1, 1].map(side => ({ x: side * (.62 + random() * .14), y: -.62 - random() * .2, rx: .36 + random() * .1, ry: .42 }))];
  const inside = (x: number, y: number) => lobes.some(l => ((x - l.x) / l.rx) ** 2 + ((y - l.y) / l.ry) ** 2 < 1) && !(y < -.48 && Math.abs(x) < .1 + (y + 1.3) * .2);
  while (placed.length < count) {
    let best = { x: 0, y: 0 }, bestGap = -1;
    for (let k = 0; k < 10; k++) {
      const x = random() * 2 - 1, y = random() * 2 - 1; if (!inside(x, y)) { k--; continue; }
      const gap = placed.reduce((m, p) => Math.min(m, Math.hypot(p.x - x, p.y - y)), 9);
      if (gap > bestGap) { bestGap = gap; best = { x, y }; }
    }
    placed.push(best);
  }
  for (const { x, y } of placed) {
    // Each sample becomes a clump on the front shell, or (a third of them) a
    // shaded clump deeper in the crown that fills gaps between lit planes.
    const shell = Math.sqrt(Math.max(.08, 1 - x * x - y * y)), deep = random() < .34;
    const z = deep ? -shell * random() * .7 : shell * (.35 + random() * .65), n = Math.hypot(x, y, z) || 1;
    const lambert = (x * LIGHT[0] + y * LIGHT[1] + z * LIGHT[2]) / n;
    // A few oversized planes break the even shingle rhythm of equal clumps.
    const scale = size * (.065 + random() * .045) * (deep ? 1.15 : 1) * (random() < .16 ? 1.45 : 1);
    clumps.push({
      // Sides droop outward and down; nearer clumps sit slightly lower.
      x: cx + x * RX, y: cy - y * RY + x * x * RY * .35 + z * size * .04,
      z, rx: scale, ry: scale * (.52 + random() * .2), angle: x * .6 + (random() - .5) * .5,
      // Planes read as either sunlit or shaded, as in the painted reference,
      // with sunlit planes more likely where the crown faces the light.
      light: deep ? .22 + random() * .14 : random() < clamp(.2 + lambert * .55) ? .66 + random() * .18 : .38 + random() * .16,
      tint: random() - .5, outline: clumpOutline(random), seed: Math.floor(random() * 2 ** 31),
    });
  }
  // Lit planes sit on the outside of the crown, so they settle over shaded ones.
  clumps.forEach(c => { if (c.light > .66) { c.rx *= 1.18; c.ry *= 1.12; } });
  // Wide or tall seeds shrink toward the crown centre to keep a transparent
  // gutter; reach covers lobes, serration and the cast shade.
  const reach = (c: Clump) => c.rx * 1.45;
  const half = Math.max(...clumps.map(c => Math.abs(c.x - cx) + reach(c))), top = Math.max(...clumps.map(c => cy - c.y + reach(c)));
  const fit = Math.min(1, size * .47 / half, (cy - size * .03) / top);
  if (fit < 1) clumps.forEach(c => { c.x = cx + (c.x - cx) * fit; c.y = cy + (c.y - cy) * fit; c.rx *= fit; c.ry *= fit; });
  // Limbs are grown, not drawn: a heading that wanders with low-frequency
  // noise, small kinks, gradual turning toward the light, and a girth that
  // bulges and pinches as it tapers. Paths like this never resolve into the
  // clean arcs and ruled tapers that made an earlier V read as man-made.
  // The trunk draws from its own stream, so trunk variety never reshuffles the
  // crown or fruit, and each seed picks one of several trunk forms.
  const wood = rng(preset.seed ^ 0x7a11c);
  const form = BUSH_TRUNK_FORMS[Math.floor(wood() * BUSH_TRUNK_FORMS.length)];
  const root = { x: cx + (wood() - .5) * size * .07, y: size * .885 };
  const limbs: Limb[] = [];
  type Pt = { x: number; y: number; w: number };
  type Lane = { settle: number; min: number; max: number };
  // A lane bounds a main limb's heading. Limbs sharing a start point with
  // strictly ordered lanes have strictly ordered slopes, so the gap between them
  // can only widen as they rise (BUSH_TRUNK_RULES), however they wander inside.
  const grow = (from: { x: number; y: number }, heading: number, length: number, w0: number, w1: number, upturn: number, flare = 0, steps = 40, lane?: Lane): Limb => {
    const wander = noise(8, rng(Math.floor(wood() * 2 ** 31))), girth = noise(8, rng(Math.floor(wood() * 2 ** 31)));
    const kinks = [wood() * .6 + .2, wood() * .6 + .2].map(at => ({ at, turn: (wood() - .5) * .5 }));
    const points: Pt[] = []; let x = from.x, y = from.y, h = heading;
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      // Pinched where limbs meet, fullest a little way up, then thinning;
      // noise bulges and pinches it along the way.
      const w = (w0 + (w1 - w0) * t ** 1.4) * (1 + (girth(t * .9, .3) - .5) * .4) * (1 - flare * smooth(.22, 0, t));
      points.push({ x, y, w });
      h += (wander(t * .8, .6) - .5) * .16 - (h - (lane?.settle ?? 0)) * upturn / steps;
      for (const k of kinks) if (Math.abs(t - k.at) < .5 / steps) h += k.turn;
      if (lane) h = Math.max(lane.min, Math.min(lane.max, h));
      x += Math.sin(h) * length / steps; y -= Math.cos(h) * length / steps;
    }
    return { points };
  };
  const mains: Limb[] = [];
  // Each main limb: start, heading (radians from vertical), length, base girth,
  // upturn. Every form keeps a pinched crotch and an organic, grown path.
  const stem = (from: { x: number; y: number }, lane: Lane, length: number, girth: number, upturn: number, flare = .5) => {
    const heading = Math.max(lane.min, Math.min(lane.max, lane.settle + (wood() - .5) * .2));
    const main = grow(from, heading, size * length, size * girth, size * .012, upturn, flare, 40, lane); limbs.push(main); mains.push(main); return main;
  };
  const lean = (.44 + wood() * .16) * spread, skew = (wood() - .5) * .28, lift = .35 + wood() * .45, mid = skew * .4;
  // Lanes on either side of the shared centre heading, with a clear margin between them.
  const outward = (side: -1 | 1, settle: number, inner = .14, outer = 1.15): Lane => side < 0
    ? { settle: mid - settle, min: mid - outer, max: mid - inner } : { settle: mid + settle, min: mid + inner, max: mid + outer };
  const base = { x: root.x, y: root.y + size * .004 };
  if (form === 'split') {
    // Two limbs part at the ground: the familiar V.
    for (const side of [-1, 1] as const) stem(base, outward(side, lean * .7), .26 + wood() * .07, .03 * (1 + side * (wood() - .5) * .35), lift);
  } else if (form === 'stem') {
    // One stout trunk rises, then forks inside the visible trunk window.
    const trunk = grow(base, skew * .5, size * (.07 + wood() * .05), size * .036, size * .028, .2, .2, 40, { settle: mid, min: mid - .15, max: mid + .15 }); limbs.push(trunk);
    const top = trunk.points[trunk.points.length - 1];
    for (const side of [-1, 1] as const) stem(top, outward(side, lean * .65), .2 + wood() * .06, .026 * (1 + side * (wood() - .5) * .3), lift, .45);
  } else if (form === 'lean') {
    // Both limbs sweep the same way: one long and low, one short and upright,
    // the upright one always on the inside of the sweep.
    const dir = wood() < .5 ? -1 : 1;
    const low: Lane = { settle: dir * (lean + .2), min: dir > 0 ? .5 : -1.25, max: dir > 0 ? 1.25 : -.5 };
    const upright: Lane = { settle: dir * .05, min: dir > 0 ? -.25 : -.3, max: dir > 0 ? .3 : .25 };
    stem(base, low, .3 + wood() * .05, .033, lift * .6);
    stem(base, upright, .2 + wood() * .05, .024, lift);
  } else if (form === 'triple') {
    // Three stems fan from one root, the middle thinnest.
    stem(base, outward(-1, lean * .85, .4), .25 + wood() * .06, .027, lift);
    stem(base, { settle: mid, min: mid - .18, max: mid + .18 }, .21 + wood() * .06, .02, lift);
    stem(base, outward(1, lean * .85, .4), .25 + wood() * .06, .027, lift);
  }
  for (const main of mains) {
    const side = Math.sign(main.points[main.points.length - 1].x - root.x) || 1;
    // Side branches leave at irregular heights and lean outward and up.
    const fork = main.points[18 + Math.floor(wood() * 10)];
    limbs.push(grow(fork, side * (.9 + wood() * .4), size * (.09 + wood() * .05), size * .012, size * .004, 2.2));
    const tip = main.points[main.points.length - 1];
    limbs.push(grow(tip, side * (wood() * .4 - .25), size * (.08 + wood() * .05), tip.w * .95, size * .004, 1.5));
  }
  // A short knot or broken stub on one limb, as real wood carries.
  if (wood() < .7) {
    const host = mains[Math.floor(wood() * mains.length)], p = host.points[10 + Math.floor(wood() * 10)], out = Math.sign(p.x - root.x) || 1;
    limbs.push(grow(p, out * (1 + wood() * .4), size * .03, p.w * .45, p.w * .3, 0));
  }
  // Foliage hangs in front of each limb partway up, so the trunk reads as
  // inside the bush; the crotch near the ground stays clear.
  for (const main of mains) {
    const hangs = 1 + (random() < .35 ? 1 : 0);
    for (let h = 0; h < hangs; h++) {
      const p = main.points[Math.floor(main.points.length * (.68 + random() * .26))], outward = Math.sign(p.x - root.x) || 1;
      const scale = size * (.07 + random() * .03);
      clumps.push({
        x: p.x + outward * scale * (.25 + random() * .55), y: p.y + scale * random() * .25, z: .9 + random() * .1,
        rx: scale, ry: scale * (.55 + random() * .15), angle: outward * (.25 + random() * .3),
        light: random() < .35 ? .64 + random() * .14 : .3 + random() * .16,
        tint: random() - .5, outline: clumpOutline(random), seed: Math.floor(random() * 2 ** 31),
      });
    }
  }
  // Close the crown (see BUSH_CROWN_RULES): fill every open point above the
  // drape line that has foliage to its left, right and above, with deeper shaded
  // planes that sit behind the limbs. Below the drape line the trunk may show.
  const ground = root.y, crownTop = Math.min(...clumps.map(c => c.y - c.ry));
  const drape = ground - (ground - crownTop) * BUSH_CROWN_RULES.maxTrunkWindow * (.88 + wood() * .12);
  const covered = (x: number, y: number) => clumps.some(c => ((x - c.x) / (c.rx * .85)) ** 2 + ((y - c.y) / (c.ry * .75)) ** 2 < 1);
  const band = size * .05;
  const crownLeft = Math.min(...clumps.map(c => c.x - c.rx)), crownRight = Math.max(...clumps.map(c => c.x + c.rx)), crownMid = (crownLeft + crownRight) / 2;
  const enclosed = (x: number, y: number) => clumps.some(c => c.x < x && Math.abs(c.y - y) < band + c.ry) && clumps.some(c => c.x > x && Math.abs(c.y - y) < band + c.ry) && clumps.some(c => c.y < y && Math.abs(c.x - x) < band + c.rx);
  // The hem: a low, irregular lower edge that rises toward the skirt's sides,
  // broken only by an arch-shaped notch over the actual limbs. The notch spans
  // the limbs where they cross the drape line, plus a margin, and ramps down.
  const tall = ground - crownTop, skirtHalf = (crownRight - crownLeft) * BUSH_CROWN_RULES.skirtWidth / 2;
  // Notches hug each limb where it rises through the hem zone; the crotch
  // between limbs opens only up to maxCrotch.
  const margin = size * .01, ramp = size * .014, crotch = ground - tall * BUSH_CROWN_RULES.maxCrotch;
  const limbBands = mains.map(m => m.points.filter(p => p.y >= drape - size * .01)).filter(ps => ps.length).map(ps => [Math.min(...ps.map(p => p.x - p.w)) - margin, Math.max(...ps.map(p => p.x + p.w)) + margin]);
  const crotchL = Math.min(...limbBands.map(b => b[0])), crotchR = Math.max(...limbBands.map(b => b[1]));
  const near = (x: number, l: number, rr: number) => Math.min(smooth(l - ramp, l, x), smooth(rr + ramp, rr, x));
  const hemNoise = noise(6, rng(Math.floor(random() * 2 ** 31)));
  const hem = new Float32Array(size).fill(NaN);
  for (let x = 0; x < size; x++) {
    const off = Math.abs(x - crownMid) / skirtHalf; if (off >= 1) continue;
    // A rounded underside: low in the middle, curving steeply up to the sides.
    const low = ground - tall * (BUSH_CROWN_RULES.hem * (.7 + hemNoise(x / size, .5) * .5) + off ** 2.4 * .42);
    const overLimb = Math.max(0, ...limbBands.map(([l, rr]) => near(x, l, rr))), inCrotch = near(x, crotchL, crotchR);
    let target = low + (Math.min(low, crotch) - low) * inCrotch;
    target = target + (Math.min(target, drape) - target) * overLimb;
    hem[x] = target;
  }
  const hemAt = (x: number) => hem[Math.max(0, Math.min(size - 1, Math.round(x)))];
  const step = size * .035;
  for (let pass = 0; pass < 6; pass++) {
    let added = 0;
    for (let x = size * .06; x <= size * .94; x += step * .5) for (let y = crownTop + step, last = false; !last; y += step) {
      // Each column ends with one row placed just above its hem, so planes
      // reach the hem instead of stopping a grid step short.
      const edge = Number.isNaN(hemAt(x)) ? drape : hemAt(x) - size * .022;
      if (y >= edge) { y = edge; last = true; }
      // The hem only extends foliage downward: a point needs crown above it,
      // so the crown's own top and upper corners keep their natural outline.
      const skirted = !Number.isNaN(hemAt(x)) && y <= hemAt(x) - size * .02 && clumps.some(c => c.y < y && Math.abs(c.x - x) < c.rx * .8);
      // Test against a plane's painted underside, which is flatter than its
      // ellipse, so no gap is mistaken for foliage and the hem reaches its target.
      const hidden = clumps.some(c => ((x - c.x) / (c.rx * .8)) ** 2 + ((y - c.y) / (c.ry * (y > c.y ? .55 : .75))) ** 2 < 1);
      if (hidden || !(skirted || (y <= drape && enclosed(x, y)))) continue;
      const scale = size * (.06 + random() * .025), low = y > drape;
      clumps.push({
        // Hem planes hang toward the viewer and stay shaded; fill above sits deeper.
        x: x + (random() - .5) * step * .5, y: y + (random() - .5) * step * .5, z: low ? -.1 - random() * .2 : -.35 - random() * .3,
        rx: scale, ry: scale * (.6 + random() * .15), angle: (x - cx) / size * 1.2 + (random() - .5) * .4,
        light: low ? .26 + random() * .2 : .2 + random() * .18, tint: random() - .5, outline: clumpOutline(random), seed: Math.floor(random() * 2 ** 31),
      });
      added++;
    }
    if (!added) break;
  }
  clumps.sort((a, b) => a.z + a.light * .5 - (b.z + b.light * .5));
  // Fruit slots: the full ordered set is always planned, then the live count
  // takes a prefix. Harvesting removes only the last fruit; the others and all
  // foliage stay exactly where they were. The first slot is the central hero
  // fruit; later slots spread through the front of the crown, never into the
  // trunk window, past the crown edge or onto another fruit.
  const slots: BushPlan['fruit'] = [];
  const shuffle = <T,>(items: T[]) => { for (let i = items.length - 1; i > 0; i--) { const j = Math.floor(random() * (i + 1)); [items[i], items[j]] = [items[j], items[i]]; } return items; };
  const indexed = clumps.map((c, i) => ({ c, i }));
  const central = shuffle(indexed.filter(({ c }) => c.z > .3 && c.y > cy - RY * .4 && c.y < cy + RY * .25 && Math.abs(c.x - cx) < RX * .5));
  const wider = shuffle(indexed.filter(({ c }) => !central.some(h => h.c === c) && c.z > .1 && c.y > cy - RY * .6 && c.y < Math.min(cy + RY * .5, drape - size * .08) && Math.abs(c.x - cx) < RX * .8));
  // Any bush must be able to carry the maximum, so placement relaxes in
  // stages: generous spacing first, then any clump inside the crown, but never
  // closer than a fruit's own diameter plus a margin.
  // Design intent for every manaberry: the whole fruit sits inside the foliage
  // silhouette (never on or past the crown edge), and a covering leaf overlaps
  // only its lower edge, so the body stays legible.
  const inCrown = (x: number, y: number, r: number) => covered(x, y) && covered(x - r * 1.1, y) && covered(x + r * 1.1, y) && covered(x, y - r * 1.1) && covered(x - r * .8, y - r * .8) && covered(x + r * .8, y - r * .8);
  const coverFor = (x: number, y: number, r: number, after = -1) => clumps.findIndex((c, i) => i > after && c.z > .1 && c.y - c.ry * .55 > y + r * .35 && c.y < y + r * 2.2 && Math.abs(c.x - x) < r * 1.3);
  const anywhere = shuffle(indexed.filter(({ c }) => c.y > crownTop + size * .06 && c.y < drape - size * .07 && Math.abs(c.x - cx) < RX * .9));
  const stages = [{ hosts: [...central, ...wider], gap: .16 }, { hosts: [...central, ...wider, ...anywhere], gap: .14 }, { hosts: anywhere, gap: .135 }];
  for (const stage of stages) for (const pick of stage.hosts) {
    if (slots.length >= BUSH_MAX_FRUIT) break;
    const r = size * .063 * (.97 + random() * .06), x = pick.c.x + (random() - .5) * pick.c.rx * .4, y = pick.c.y - pick.c.ry * .2;
    if (!inCrown(x, y, r) || slots.some(f => Math.hypot(f.x - x, f.y - y) < size * stage.gap)) continue;
    // One nearer leaf plane overlaps the fruit's lower edge so it sits inside the crown.
    const cover = coverFor(x, y, r, pick.i);
    slots.push({ x, y, r, cover });
  }
  // Last resort: any well-covered point of the crown, nearest the centre first.
  if (slots.length < BUSH_MAX_FRUIT) {
    const grid: { x: number; y: number }[] = [];
    for (let y = crownTop + size * .09; y < drape - size * .08; y += size * .012) for (let x = cx - RX; x <= cx + RX; x += size * .012)
      if (inCrown(x, y, size * .063)) grid.push({ x, y });
    grid.sort((a, b) => Math.hypot(a.x - cx, (a.y - cy) * 1.4) - Math.hypot(b.x - cx, (b.y - cy) * 1.4));
    for (const { x, y } of grid) {
      if (slots.length >= BUSH_MAX_FRUIT) break;
      if (slots.some(f => Math.hypot(f.x - x, f.y - y) < size * .132)) continue;
      const r = size * .063 * (.97 + random() * .06);
      const cover = coverFor(x, y, r);
      slots.push({ x, y, r, cover });
    }
  }
  // A covering leaf may never reach another slot's body, so each fruit looks the
  // same at every count; drop covers that would.
  for (const slot of slots) if (slot.cover >= 0) {
    const c = clumps[slot.cover];
    if (slots.some(other => other !== slot && ((other.x - c.x) / (c.rx * 1.2 + other.r)) ** 2 + ((other.y - other.r * .3 - c.y) / (c.ry * 1.2 + other.r * .7)) ** 2 < 1)) slot.cover = -1;
  }
  const fruit = slots.slice(0, Math.max(0, Math.min(BUSH_MAX_FRUIT, Math.round(preset.fruit))));
  return { clumps, limbs, fruit, slots, ground, drape, trunk: form, mains, hem };
}

/** Measures a bake against BUSH_CROWN_RULES. `enclosedHole` is the largest
 * transparent region above the drape line that reaches neither the canvas edge
 * nor the legal trunk window below that line, as a fraction of the bush's
 * bounding area. `window` is how far the centre foliage stops above the
 * ground, as a fraction of the bush height. */
/** Worst narrowing of the horizontal gap between any two main limbs as they
 * rise (pixels), and whether any pair crosses. A legal trunk only diverges. */
export function trunkStructure(plan: BushPlan) {
  const xAt = (limb: Limb, y: number) => { const p = limb.points; for (let i = 1; i < p.length; i++) if ((p[i - 1].y - y) * (p[i].y - y) <= 0) { const t = (y - p[i - 1].y) / ((p[i].y - p[i - 1].y) || 1); return p[i - 1].x + (p[i].x - p[i - 1].x) * t; } return undefined; };
  let convergence = 0, crossed = false;
  for (let a = 0; a < plan.mains.length; a++) for (let b = a + 1; b < plan.mains.length; b++) {
    const top = Math.max(Math.min(...plan.mains[a].points.map(p => p.y)), Math.min(...plan.mains[b].points.map(p => p.y)));
    let widest = -Infinity, sign = 0;
    for (let y = plan.ground - 1; y > top; y -= 1) {
      const xa = xAt(plan.mains[a], y), xb = xAt(plan.mains[b], y); if (xa === undefined || xb === undefined) continue;
      const gap = xb - xa;
      if (Math.abs(gap) > 1.5) { if (sign && Math.sign(gap) !== sign) crossed = true; sign ||= Math.sign(gap); }
      widest = Math.max(widest, Math.abs(gap)); convergence = Math.max(convergence, widest - Math.abs(gap));
    }
  }
  return { convergence, crossed };
}

export function crownStructure(raster: BushRaster, plan: BushPlan) {
  const { width, height, data } = raster, open = (i: number) => data[i * 4 + 3] < 40;
  let x0 = width, x1 = 0, y0 = height, y1 = 0;
  for (let i = 0; i < width * height; i++) if (!open(i)) { const x = i % width, y = (i / width) | 0; x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
  const seen = new Uint8Array(width * height), stack: number[] = [];
  for (let x = 0; x < width; x++) stack.push(x, (height - 1) * width + x);
  for (let y = 0; y < height; y++) stack.push(y * width, y * width + width - 1);
  const flood = (floor: number) => { while (stack.length) { const i = stack.pop()!; if (seen[i] || !open(i) || i < floor) continue; seen[i] = 1; const x = i % width;
    if (x > 0) stack.push(i - 1); if (x < width - 1) stack.push(i + 1); if (i >= width) stack.push(i - width); if (i < width * (height - 1)) stack.push(i + width); } };
  flood(0);
  // Open paint-free space below the drape line is the permitted trunk window; it
  // may not extend the exemption upward into the crown.
  const drapeRow = Math.max(0, Math.ceil(plan.drape)) * width;
  for (let i = drapeRow; i < width * height; i++) if (open(i) && !seen[i]) stack.push(i);
  flood(drapeRow);
  let largest = 0;
  for (let i = 0; i < width * height; i++) if (open(i) && !seen[i]) {
    let area = 0; stack.push(i); seen[i] = 1;
    while (stack.length) { const j = stack.pop()!; area++; const x = j % width;
      for (const k of [x > 0 ? j - 1 : -1, x < width - 1 ? j + 1 : -1, j - width, j + width]) if (k >= 0 && k < width * height && !seen[k] && open(k)) { seen[k] = 1; stack.push(k); } }
    largest = Math.max(largest, area);
  }
  const box = Math.max(1, (x1 - x0 + 1) * (y1 - y0 + 1)), centre = width / 2, crownTop = Math.min(...plan.clumps.map(c => c.y - c.ry));
  const underside = Math.max(...plan.clumps.filter(c => Math.abs(c.x - centre) < width * .1).map(c => c.y + c.ry * .6));
  // Skirt: in the central columns, how far above the ground the paint stops, at
  // worst. Only foliage or the trunk itself may fill a column down to the drape
  // line; bark painted over foliage counts, since the trunk may show there.
  // Reported as the worst shortfall above the hem, as a fraction of bush height.
  // A gap must be at least BUSH_CROWN_RULES.minGapWidth wide to count: hairline
  // slits where two leaf planes nearly meet are ordinary paint, not a gap.
  const shortfall = new Float32Array(width);
  for (let x = 0; x < width; x++) {
    const target = plan.hem[Math.round(x * plan.hem.length / width)]; if (Number.isNaN(target)) continue;
    let lowest = -1;
    for (let y = height - 1; y >= 0; y--) { const i = (y * width + x) * 4; if (data[i + 3] > 40) { lowest = y; break; } }
    shortfall[x] = lowest < 0 ? 1 : Math.max(0, (target - lowest) / (plan.ground - crownTop));
  }
  const span = Math.max(1, Math.round(width * BUSH_CROWN_RULES.minGapWidth));
  let skirt = 0;
  for (let x = 0; x + span <= width; x++) { let least = Infinity; for (let k = 0; k < span; k++) least = Math.min(least, shortfall[x + k]); skirt = Math.max(skirt, least); }
  return { enclosedHole: largest / box, window: (plan.ground - underside) / (plan.ground - crownTop), skirt };
}

function paintClump(layer: Layer, clump: Clump, preset: Readonly<BushPaintPreset>, fields: Fields, colors: ReturnType<typeof ramp>) {
  const { size } = layer, cos = Math.cos(-clump.angle), sin = Math.sin(-clump.angle), reach = clump.rx * 1.45;
  const minX = Math.max(0, Math.floor(clump.x - reach)), maxX = Math.min(size - 1, Math.ceil(clump.x + reach));
  const minY = Math.max(0, Math.floor(clump.y - reach)), maxY = Math.min(size - 1, Math.ceil(clump.y + reach));
  const aa = 1.2 / clump.ry, teeth = .035 + preset.brush * .085, local = noise(4, rng(clump.seed)), out = [0, 0, 0];
  const shadow = hex('#0f2a2b'), sx = clump.rx * .1, sy = clump.ry * .42, { grid } = fields;
  let limit = 0; for (const r of clump.outline) limit = Math.max(limit, r);
  const shadeLimit = limit + .1, paintLimit = limit + teeth * 1.3 + aa;
  const turn = OUTLINE / TAU;
  // Pass 1: a soft cool shade on whatever is already painted beneath the lower
  // edge. This is what separates a lit plane from the mass behind it.
  for (let y = minY; y <= Math.min(size - 1, maxY + Math.ceil(sy)); y++) for (let x = minX; x <= maxX; x++) {
    const dx = x - clump.x - sx, dy = y - clump.y - sy, lx = (dx * cos - dy * sin) / (clump.rx * 1.06), ly = (dx * sin + dy * cos) / (clump.ry * 1.06);
    const r = Math.sqrt(lx * lx + ly * ly); if (r > shadeLimit) continue;
    const edge = clump.outline[Math.floor((Math.atan2(ly, lx) + TAU) * turn) % OUTLINE] - r;
    const strength = smooth(-.08, .3, edge) * .62;
    if (strength > .004) layer.glaze(y * size + x, shadow, strength);
  }
  // Pass 2: the clump itself.
  for (let y = minY; y <= maxY; y++) for (let x = minX; x <= maxX; x++) {
    const dx = x - clump.x, dy = y - clump.y, lx = (dx * cos - dy * sin) / clump.rx, ly = (dx * sin + dy * cos) / clump.ry;
    const r = Math.sqrt(lx * lx + ly * ly); if (r > paintLimit) continue;
    const at = y * size + x, fine = grid.fine[at], mid = grid.mid[at];
    // Serration: small crisp teeth from the fine field, larger bites from the
    // mid field. Both are scaled by brush so brush=0 keeps the lobed outline.
    const edge = clump.outline[Math.floor((Math.atan2(ly, lx) + TAU) * turn) % OUTLINE] - r + (fine - .5) * teeth * 1.7 + (mid - .5) * teeth * .9;
    const alpha = smooth(-aa, aa, edge);
    if (alpha < .003) continue;
    const broad = local(lx * .25 + .5, ly * .25 + .5), wash = grid.broad[at];
    // Light falls across each plane from its upper edge; the lower margin and
    // the inner fold stay in shade. A water bloom lifts pigment off the middle.
    let value = clump.light + (-ly) * (.06 + clump.light * .12) - smooth(.2, 1, ly) * (.06 + clump.light * .16) + (broad - .5) * .36 + (wash - .5) * .18;
    value += smooth(.35, .75, broad) * smooth(.15, .6, edge) * .09;
    const pooled = (1 - smooth(0, .15, edge)) * (.55 + mid * .9);
    value -= pooled * .15;
    value += (fine - .5) * .06 + (mid - .5) * .1;
    colors(clamp(value), out);
    // Temperature drift independent of value: some planes lean olive, others teal.
    const drift = (clump.tint + (wash - .5) * .6) * .07;
    // Pooled margins dry toward olive rather than plain grey-dark.
    layer.over(at, clamp(out[0] + drift + pooled * .02), clamp(out[1] + drift * .3), clamp(out[2] - drift * .8 - pooled * .05), alpha);
  }
}

/** Anisotropic cellular noise for bark: distance to the nearest and second
 * nearest jittered feature point, plus a stable id for the nearest cell. */
export function cells(seed: number) {
  const hash = (x: number, y: number, k: number) => { let h = Math.imul(x, 374761393) ^ Math.imul(y, 668265263) ^ Math.imul(k + seed, 2246822519); h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };
  const result = { f1: 0, f2: 0, id: 0 };
  return (u: number, v: number) => {
    const cx = Math.floor(u), cy = Math.floor(v); let f1 = 9, f2 = 9, id = 0;
    for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) {
      const gx = cx + i, gy = cy + j, px = gx + hash(gx, gy, 1), py = gy + hash(gx, gy, 2), d = Math.hypot(px - u, py - v);
      if (d < f1) { f2 = f1; f1 = d; id = hash(gx, gy, 3); } else if (d < f2) f2 = d;
    }
    result.f1 = f1; result.f2 = f2; result.id = id; return result;
  };
}

function paintLimb(layer: Layer, limb: Limb, fields: Fields, random: () => number) {
  const { size } = layer, pts = limb.points, pad = pts[0].w * 1.8 + 2;
  const xs = pts.map(p => p.x), ys = pts.map(p => p.y);
  const minX = Math.max(0, Math.floor(Math.min(...xs) - pad)), maxX = Math.min(size - 1, Math.ceil(Math.max(...xs) + pad));
  const minY = Math.max(0, Math.floor(Math.min(...ys) - pad)), maxY = Math.min(size - 1, Math.ceil(Math.max(...ys) + pad));
  // Limb-space noise: x runs along the limb, y across it. Its cell count sets
  // brush-sized features per limb, independent of the canvas-scale fields.
  const phase = random() * 50, bark2 = noise(12, rng(Math.floor(random() * 2 ** 31)));
  const W = maxX - minX + 1, H = maxY - minY + 1, near = new Float32Array(W * H).fill(Infinity), along = new Float32Array(W * H), across = new Float32Array(W * H);
  for (let i = 0; i < pts.length - 1; i++) {
    const p = pts[i], q = pts[i + 1], ex = q.x - p.x, ey = q.y - p.y, len2 = ex * ex + ey * ey || 1, l = Math.sqrt(len2), m = Math.max(p.w, q.w) + 3;
    for (let y = Math.max(minY, Math.floor(Math.min(p.y, q.y) - m)); y <= Math.min(maxY, Math.ceil(Math.max(p.y, q.y) + m)); y++)
      for (let x = Math.max(minX, Math.floor(Math.min(p.x, q.x) - m)); x <= Math.min(maxX, Math.ceil(Math.max(p.x, q.x) + m)); x++) {
        const s = clamp(((x - p.x) * ex + (y - p.y) * ey) / len2), w = p.w + (q.w - p.w) * s;
        const ox = x - p.x - ex * s, oy = y - p.y - ey * s, d = Math.sqrt(ox * ox + oy * oy) - w, k = (y - minY) * W + x - minX;
        if (d < near[k]) { near[k] = d; along[k] = (i + s) / (pts.length - 1); across[k] = (ox * -ey + oy * ex) / l / w; }
      }
  }
  const out = [0, 0, 0], cool = hex('#4b4060'), girth = pts[0].w;
  // Bark is measured in pixels along and across the limb, so grain keeps one
  // physical scale on thick and thin limbs and at every bake size.
  let length = 0; for (let i = 1; i < pts.length; i++) length += Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y);
  const grainNoise = noise(32, rng(Math.floor(random() * 2 ** 31))), bark3 = cells(Math.floor(random() * 2 ** 31));
  const scale = Math.max(4, girth);
  for (let y = minY; y <= maxY; y++) for (let x = minX; x <= maxX; x++) {
    const k = (y - minY) * W + x - minX, bestT = along[k], bestSide = across[k];
    // A hand-painted limb swells and pinches along its length and its margin
    // wanders, rather than following one clean tapered offset curve.
    const swell = (bark2(bestT * .5, .9) - .5) * girth * .5;
    const idx = Math.round(bestT * (pts.length - 1)), pt = pts[idx], next = pts[Math.min(pts.length - 1, idx + 1)];
    const u = bestT * length, v = bestSide * pt.w;
    // Knobbly bark: rounded lumps, a little longer along the grain, divided by
    // dark crevices. Each lump is its own dab of paint with its own tone.
    const grain = grainNoise(u / (scale * 1.4) / 32 + phase, v / (scale * .3) / 32 + .5);
    const warp = grainNoise(u / (scale * .5) / 32 + .7, v / (scale * .5) / 32 + .2) - .5;
    // Warped cells lose the regular Voronoi look; the crevice network is broken
    // where the grain field is low, so lumps merge instead of tiling.
    const cell = bark3((u + warp * scale * .5) / (scale * .4), (v + (grain - .5) * scale * .35) / (scale * .27));
    const crevice = (1 - smooth(.02, .14, cell.f2 - cell.f1)) * smooth(.38, .62, grain + warp * .6);
    const best = near[k] - swell + (Math.abs(bestSide) > .75 ? crevice * 1.2 : 0);
    if (best > 3) continue;
    const rough = (fields.mid(x / size * 1.6, y / size * 1.6) - .5) * 1.6 + (fields.fine(x / size, y / size) - .5) * .5;
    const alpha = smooth(.7, -.7, best + rough);
    if (alpha < .003) continue;
    const up = next.x > pt.x ? -bestSide : bestSide;
    // Broad painted form: tan across the front, darkening toward both edges and
    // more on the underside. Lumps and crevices break it everywhere, so no
    // continuous highlight band survives to read as gloss.
    let value = .5 + up * .12 - Math.abs(bestSide) ** 1.6 * .3;
    value += (cell.id - .5) * .2 + (grain - .5) * .16;
    // Each lump is slightly fuller in its middle; a soft dome, not a specular spot.
    value += (.22 - Math.min(.22, cell.f1 * .5)) * .35;
    value -= crevice * .1 + .08;
    value -= smooth(.72, 1.05, Math.abs(bestSide)) * .2;
    const v0 = clamp(value), stepped = Math.round(v0 * 7) / 7;
    bark(stepped * .5 + v0 * .5, out);
    const shade = clamp(smooth(-.05, -.75, up) * .42 + (cell.id < .2 ? .14 : 0) + crevice * .12);
    layer.over(y * size + x, out[0] + (cool[0] - out[0]) * shade, out[1] + (cool[1] - out[1]) * shade, out[2] + (cool[2] - out[2]) * shade, alpha);
  }
  // Bark dabs: short rounded marks laid along the grain over the darker base,
  // each its own tone of the local form, with pigment pooled at its lower
  // rim. The gaps between them read as crevices and the dabs that overhang the
  // margin make a lumpy outline. Nothing here is lit, so it stays matte.
  const area = length * girth * 1.5, count = Math.round(area * 2.6 / (girth * girth * .07));
  const sample = (t: number) => {
    const f = clamp(t) * (pts.length - 1), i = Math.min(pts.length - 2, Math.floor(f)), s2 = f - i, p = pts[i], q = pts[i + 1];
    const ex = q.x - p.x, ey = q.y - p.y, l = Math.hypot(ex, ey) || 1;
    return { x: p.x + ex * s2, y: p.y + ey * s2, w: p.w + (q.w - p.w) * s2, dx: ex / l, dy: ey / l };
  };
  for (let d = 0; d < count; d++) {
    const t = random(), side = (random() * 2 - 1) * 1.02, c = sample(t);
    const nx = -c.dy, ny = c.dx, cx = c.x + nx * side * c.w, cy = c.y + ny * side * c.w;
    const up = c.dx > 0 ? -side : side, len = c.w * (.5 + random() * .5), wid = c.w * (.17 + random() * .14);
    const tilt = (random() - .5) * .5, ca = Math.cos(tilt), sa = Math.sin(tilt), dx = c.dx * ca - c.dy * sa, dy = c.dx * sa + c.dy * ca;
    // Lighter ochre dabs gather across the upper front; darker ones at the margins.
    let value = .56 + up * .2 - Math.abs(side) ** 1.6 * .36 + (random() - .5) * .38;
    const v0 = clamp(value), stepped = Math.round(v0 * 7) / 7; bark(stepped * .5 + v0 * .5, out);
    const shade = clamp(smooth(-.05, -.75, up) * .42 + (random() < .15 ? .2 : 0)), pool = .18 + random() * .14;
    const col = [0, 1, 2].map(k => out[k] + (cool[k] - out[k]) * shade);
    const reach = len + 1.5;
    for (let y = Math.max(minY, Math.floor(cy - reach)); y <= Math.min(maxY, Math.ceil(cy + reach)); y++)
      for (let x = Math.max(minX, Math.floor(cx - reach)); x <= Math.min(maxX, Math.ceil(cx + reach)); x++) {
        const k = (y - minY) * W + x - minX; if (near[k] > 2.6) continue;
        const ox = x - cx, oy = y - cy, a2 = (ox * dx + oy * dy) / len, b2 = (ox * -dy + oy * dx) / wid, q = Math.sqrt(a2 * a2 + b2 * b2);
        // Ragged dab outline: the deposit field bites into each mark's edge.
        const g = fields.grid.fine[y * size + x], m = fields.grid.mid[y * size + x];
        const cover = smooth(1.06, .88, q + (g - .5) * .5 + (m - .5) * .35) * smooth(2.6, .4, near[k]);
        if (cover < .01) continue;
        // Darker pooled pigment toward the dab's rim, heaviest on its shaded side.
        const rim = 1 - smooth(.72, 1, q) * pool * (1 + Math.max(0, b2 * Math.sign(-up || 1)) * .6);
        layer.over(y * size + x, col[0] * rim, col[1] * rim, col[2] * rim, cover * .92);
      }
  }
}
const bark = ramp([[0, hex('#24181a')], [.3, hex('#4b3127')], [.52, hex('#6d4b32')], [.74, hex('#9a744d')], [1, hex('#c9a36d')]]);

/** Watercolor dab glazing over the finished painting. Each dab is a small
 * irregular blot of transparent pigment: it carries a little of the local
 * color and darkens what lies beneath, most strongly at its rim where pigment
 * pools as the water dries (edge darkening). Some blots lift pigment from
 * their wet centers instead. Overlapping blots layer multiplicatively like
 * real glazes. There is no lighting or relief, so the surface stays matte.
 * Two scales: faint broad blooms and many small crisp blots. Silhouette and
 * coverage never change; only color inside existing paint moves. */
export function dabPass(layer: Layer, random: () => number, strength: number) {
  const { size, px } = layer, n = size * size, color = new Float32Array(n * 3);
  let covered = 0;
  for (let i = 0; i < n; i++) {
    const a = px[i * 4 + 3]; if (a > 0) { color[i * 3] = px[i * 4] / a; color[i * 3 + 1] = px[i * 4 + 1] / a; color[i * 3 + 2] = px[i * 4 + 2] / a; }
    if (a > .5) covered++;
  }
  const snapshot = color.slice();
  const scales = [
    { radius: size * .016, density: .7, darken: .06, rim: .05, carry: .2, lift: .45, tint: .12 },
    { radius: Math.max(1.6, size * .005), density: 2.4, darken: .03, rim: .045, carry: .55, lift: .3, tint: .22 },
  ];
  for (const scale of scales) {
    const count = Math.round(covered * scale.density / (Math.PI * scale.radius * scale.radius));
    for (let d = 0, tries = 0; d < count && tries < count * 4; tries++) {
      const cx = random() * size, cy = random() * size, ci = Math.floor(cy) * size + Math.floor(cx);
      if (px[ci * 4 + 3] < .6) continue;
      d++;
      // An irregular blot outline from a few seeded harmonics, never a disc.
      const R = scale.radius * (.6 + random() * .8), h1 = random() * .22, p1 = random() * TAU, h2 = random() * .14, p2 = random() * TAU, h3 = random() * .08, p3 = random() * TAU;
      const squash = .7 + random() * .3, tilt = random() * TAU, ct = Math.cos(tilt), st = Math.sin(tilt);
      const k0 = ci * 3, lifts = random() < scale.lift;
      const tint = 1 + (random() - .5) * scale.tint * strength;
      const dr = snapshot[k0] * tint, dg = snapshot[k0 + 1] * tint, db = snapshot[k0 + 2] * tint;
      const darken = scale.darken * strength * (.6 + random() * .8), rim = scale.rim * strength * (.6 + random() * .8), carry = scale.carry * strength;
      const wobble = h1 + h2 + h3, inner = R * (1 - wobble) - .45, reach = R * (1 + wobble) + .45;
      for (let y = Math.max(0, Math.floor(cy - reach)); y <= Math.min(size - 1, Math.ceil(cy + reach)); y++)
        for (let x = Math.max(0, Math.floor(cx - reach)); x <= Math.min(size - 1, Math.ceil(cx + reach)); x++) {
          const i = y * size + x; if (px[i * 4 + 3] < .5) continue;
          const ox = x - cx, oy = y - cy, u = ox * ct + oy * st, v = (oy * ct - ox * st) / squash, dist = Math.sqrt(u * u + v * v);
          if (dist > reach) continue;
          // The outline only matters in the wobble band; skip trig elsewhere.
          let r = R;
          if (dist > inner) { const a = Math.atan2(v, u); r = R * (1 + h1 * Math.sin(2 * a + p1) + h2 * Math.sin(3 * a + p2) + h3 * Math.sin(5 * a + p3)); }
          if (dist > r + .45) continue;
          const k = i * 3, er = snapshot[k] - dr, eg = snapshot[k + 1] - dg, eb = snapshot[k + 2] - db;
          // Edge-aware: a blot only glazes paint of a similar color, so it never
          // drags fruit into leaves or crosses a plane boundary.
          const same = Math.exp(-(er * er + eg * eg + eb * eb) / .022), inside = smooth(r + .45, r - .45, dist) * same;
          if (inside < .01) continue;
          const q = dist / r, pool = smooth(.55, .97, q);
          // Transmittance of the glaze: thin in the middle, pooled at the rim.
          const t = 1 - (darken * (lifts ? .3 : 1) + rim * pool) * inside;
          const lift = lifts ? (1 - smooth(0, .8, q)) * .07 * strength * inside : 0;
          for (let c = 0; c < 3; c++) {
            const base = color[k + c] + ((c === 0 ? dr : c === 1 ? dg : db) - color[k + c]) * carry * inside;
            color[k + c] = base * t + (1 - base) * lift;
          }
        }
    }
  }
  // Granulation: pigment settles into the paper's fine valleys, more where
  // the paint is dense and dark, while tiny paper highs stay lighter. Grain
  // cells are a fixed fraction of the bake, about 2px and 5px at 1024.
  const tooth = noise(Math.max(16, Math.round(size / 2)), random), weave = noise(Math.max(8, Math.round(size / 5)), random);
  const grain = .24 * strength;
  for (let y = 0, i = 0; y < size; y++) for (let x = 0; x < size; x++, i++) {
    const a = px[i * 4 + 3]; if (a <= 0) continue;
    const k = i * 3, r = color[k], g = color[k + 1], b = color[k + 2];
    const paper = tooth(x / size, y / size) * .62 + weave(x / size, y / size) * .38, dense = 1 - (r * .3 + g * .55 + b * .15);
    const settle = (paper - .5) * 2 * grain * (.45 + dense * .9), high = smooth(.32, .12, paper) * .1 * strength;
    px[i * 4] = clamp(r * (1 - settle) + (1 - r) * high) * a;
    px[i * 4 + 1] = clamp(g * (1 - settle) + (1 - g) * high) * a;
    // Settled pigment reads slightly cooler than the wash around it.
    px[i * 4 + 2] = clamp(b * (1 - settle * .8) + (1 - b) * high) * a;
  }
}

function paintFruit(layer: Layer, fruit: BushPlan['fruit'][number], seed: number, fields: Fields) {
  const { size } = layer, random = rng(seed ^ 0x213e7), mottle = noise(6, random), halo = hex('#8fd6ff');
  const bumps = Array.from({ length: 10 }, (_, i) => ({ a: i / 10 * TAU + (random() - .5) * .3, w: .16 + random() * .12, h: .035 + random() * .05 }));
  const outline = Float32Array.from({ length: OUTLINE }, (_, i) => {
    const a = i / OUTLINE * TAU; let r = .94;
    for (const b of bumps) { const d = Math.atan2(Math.sin(a - b.a), Math.cos(a - b.a)); r += b.h * Math.exp(-((d / b.w) ** 2)); }
    return r;
  });
  const reach = fruit.r * 2.2, out = [0, 0, 0];
  const shade = ramp([[0, hex('#4a0830')], [.3, hex('#8c0f45')], [.58, hex('#c8185c')], [.8, hex('#e8407e')], [1, hex('#f7a2cc')]]);
  for (let y = Math.max(0, Math.floor(fruit.y - reach)); y <= Math.min(size - 1, fruit.y + reach); y++)
    for (let x = Math.max(0, Math.floor(fruit.x - reach)); x <= Math.min(size - 1, fruit.x + reach); x++) {
      const lx = (x - fruit.x) / fruit.r, ly = (y - fruit.y) / fruit.r, r = Math.hypot(lx, ly), i = y * size + x;
      // Blue mana light sits behind and around the red body, never inside it.
      const glow = Math.exp(-(((r - .9) / .55) ** 2)) * .32 * smooth(2.1, 1, r);
      if (glow > .004) layer.over(i, halo[0], halo[1], halo[2], glow * .55);
      const edge = outline[Math.floor((Math.atan2(ly, lx) + TAU) / TAU * OUTLINE) % OUTLINE] - r + (fields.fine(x / size, y / size) - .5) * .06;
      const alpha = smooth(-.03, .03, edge);
      if (alpha < .003) continue;
      const nz = Math.sqrt(Math.max(0, 1 - Math.min(1, r * r))), lambert = clamp(lx * .42 - ly * .5 + nz * .62);
      const m = mottle(lx * .3 + .5, ly * .3 + .5);
      let value = .12 + lambert * .6 + (m - .5) * .34 + (fields.mid(x / size * 3, y / size * 3) - .5) * .22 - (1 - smooth(0, .18, edge)) * .12;
      // Broad painted lobes across the body, not a polished specular dot.
      value += Math.sin(Math.atan2(ly, lx) * 5 + r * 4 + m * 3) * .04 * r;
      const sheen = smooth(.8, 0, Math.hypot(lx - .38, ly + .3)) * .12;
      shade(clamp(value + sheen), out);
      layer.over(i, clamp(out[0] - sheen * .12), out[1], clamp(out[2] + sheen * .25), alpha);
    }
}

type Fields = { fine: (x: number, y: number) => number; mid: (x: number, y: number) => number; broad: (x: number, y: number) => number;
  /** The same three fields sampled once at every bake pixel. */
  grid: { fine: Float32Array; mid: Float32Array; broad: Float32Array } };

export function paintBush(preset: Readonly<BushPaintPreset>, size = 512): BushRaster {
  if (!Number.isInteger(size) || size < 64 || size > 1024) throw new Error('Bush raster must be 64–1024 pixels.');
  const layer = new Layer(size), plan = planBush(preset, size), random = rng(preset.seed ^ 0x9e37);
  // Fields are defined in canvas-relative units so the painting holds its
  // character at every bake size; tooth size stays proportional to the clump.
  const fine = noise(150, random), mid = noise(46, random), broad = noise(7, random);
  const grid = { fine: new Float32Array(size * size), mid: new Float32Array(size * size), broad: new Float32Array(size * size) };
  for (let y = 0, i = 0; y < size; y++) for (let x = 0; x < size; x++, i++) {
    grid.fine[i] = fine(x / size, y / size); grid.mid[i] = mid(x / size, y / size); grid.broad[i] = broad(x / size, y / size);
  }
  const fields: Fields = { fine, mid, broad, grid };
  const w = preset.warmth;
  const colors = ramp([
    [0, hex('#14302f')], [.24, hex('#24594f')], [.44, hex('#3c7a56')],
    [.62, [.38 + w * .08, .6 + w * .02, .29 - w * .06]], [.8, [.64 + w * .1, .74 + w * .02, .27 - w * .07]], [1, [.84 + w * .06, .86, .42 - w * .08]],
  ]);
  const found = plan.clumps.findIndex(c => c.z > .05), limbAt = found < 0 ? plan.clumps.length - 1 : found;
  plan.clumps.forEach((clump, i) => {
    if (i === limbAt) plan.limbs.forEach(limb => paintLimb(layer, limb, fields, random));
    paintClump(layer, clump, preset, fields, colors);
  });
  plan.fruit.forEach((fruit, n) => {
    paintFruit(layer, fruit, preset.seed + n, fields);
    if (fruit.cover >= 0) paintClump(layer, plan.clumps[fruit.cover], preset, fields, colors);
  });
  dabPass(layer, random, .45 + preset.brush * .55);
  return layer.raster();
}

const canvasCache = new Map<string, HTMLCanvasElement>();
/** Browser wrapper for the lab: one bounded 12-entry cache, keyed by the full
 * preset, so seed browsing never repaints a bake it already holds. */
export function paintedBushCanvas(preset: Readonly<BushPaintPreset>, size = 512): HTMLCanvasElement {
  const key = `${BUSH_PAINTER_VERSION}:${size}:${JSON.stringify(preset)}`, hit = canvasCache.get(key);
  if (hit) { canvasCache.delete(key); canvasCache.set(key, hit); return hit; }
  const raster = paintBush(preset, size), c = document.createElement('canvas'); c.width = raster.width; c.height = raster.height;
  const ctx = c.getContext('2d'); if (!ctx) throw new Error('Canvas 2D unavailable.');
  ctx.putImageData(new ImageData(raster.data, raster.width, raster.height), 0, 0);
  canvasCache.set(key, c); if (canvasCache.size > 12) canvasCache.delete(canvasCache.keys().next().value!);
  return c;
}
