import { describe, expect, it } from 'vitest';
import { PINE_DEFAULT_PRESET, PINE_RULES, bakePine, paintPine, pineGeometry, pineSilhouette, pineViolations, planPine, type PinePaintPreset, type PinePlan } from './pinePainter';

const base: PinePaintPreset = { ...PINE_DEFAULT_PRESET };
type Raster = { width: number; height: number; data: Uint8ClampedArray };
const blank = (size: number): Raster => ({ width: size, height: size, data: new Uint8ClampedArray(size * size * 4) });
const put = (r: Raster, x: number, y: number, rgb: readonly number[]) => { if (x < 0 || y < 0 || x >= r.width || y >= r.height) return; r.data.set([rgb[0], rgb[1], rgb[2], 255], (y * r.width + Math.round(x)) * 4); };
const BARK = [110, 80, 50];
/** A synthetic pine: a brown trunk and green shelves whose tips sit at the given
 * heights (fractions of the crown from the top). Each shelf is lit on top and
 * dark below unless `inverted`. With `shelves` empty the crown is a plain cone. */
function synthetic(size: number, left: number[], right: number[], opts: { inverted?: boolean; mirrorRight?: boolean } = {}): Raster {
  const r = blank(size), axis = size / 2, top = Math.round(size * .05), ground = Math.round(size * .95), skirt = Math.round(size * .8), C = skirt - top;
  const edge = (tips: number[], h: number) => {
    // Width grows linearly down the crown; inside each shelf it steps in under the tip (a sawtooth).
    const cone = h * size * .32;
    if (!tips.length) return cone;
    const above = tips.filter(t => t <= h), t = above.length ? above[above.length - 1] : 0, next = tips.find(v => v > h) ?? 1;
    return cone * (.78 + .22 * (h - t) / Math.max(.01, next - t)) + size * .02;
  };
  for (let y = top; y < skirt; y++) {
    const h = (y - top) / C, l = edge(left, h), rr = opts.mirrorRight ? l : edge(right, h);
    const tips = [...left, 1].sort((a, b) => a - b), t0 = [0, ...tips].filter(v => v <= h).pop()!, t1 = tips.find(v => v > h) ?? 1;
    const depth = (h - t0) / Math.max(.01, t1 - t0), lit = opts.inverted ? 40 + depth * 150 : 190 - depth * 150;
    for (let x = Math.round(axis - l); x <= Math.round(axis + rr); x++) put(r, x, y, [lit * .55, lit, lit * .6]);
  }
  for (let y = skirt; y < ground; y++) for (let x = axis - size * .03; x <= axis + size * .03; x++) put(r, x, y, BARK);
  return r;
}
const even = (n: number, from = .1) => Array.from({ length: n }, (_, i) => from + i * (.85 - from) / (n - 1));
const uneven = [.08, .14, .3, .38, .58, .66, .9];

describe('pine painter v1', () => {
  it('bakes identical pixels for an identical preset and different pixels per seed', () => {
    const a = paintPine(base, 128).data, b = paintPine({ ...base }, 128).data, c = paintPine({ ...base, seed: base.seed + 1 }, 128).data;
    expect(a).toEqual(b);
    expect(a).not.toEqual(c);
  });

  it('keeps every preset inside a transparent gutter with finite placement', () => {
    for (let k = 0; k < 16; k++) {
      const size = 128, preset = { ...base, seed: 300 + k, slender: k % 2, fullness: (k >> 1) % 2, droop: (k >> 2) % 2, trunk: (k >> 3) % 2, brush: k % 3 / 2 };
      const { data } = paintPine(preset, size);
      for (let i = 0; i < size; i++) for (const [x, y] of [[i, 0], [i, size - 1], [0, i], [size - 1, i]]) expect(data[(y * size + x) * 4 + 3]).toBe(0);
      const plan = planPine(preset, size);
      expect(plan.fronds.every(f => [f.x, f.y, f.len, f.top, f.drop].every(Number.isFinite))).toBe(true);
    }
  });

  it('bakes only legal pines across a seed sweep (PINE_RULES 1–12)', () => {
    let regrown = 0;
    for (let k = 0; k < 40; k++) {
      const preset = { ...base, seed: 7000 + k * 31, slender: (k * .37) % 1, fullness: (k * .53) % 1, droop: (k * .29) % 1, trunk: (k * .61) % 1, brush: (k * .17) % 1, warmth: (k * .41) % 1 };
      const bake = bakePine(preset, 256);
      expect(bake.violations, `seed ${preset.seed}`).toEqual([]);
      expect(pineViolations(bake.raster, bake.plan)).toEqual([]);
      if (bake.attempt) regrown++;
    }
    // Planning makes most seeds legal on the first bake (about 65–70% in 120-seed sweeps, mostly failing rule 3,
    // then rule 12); regrowth covers the rest, so every bake is legal.
    expect(regrown).toBeLessThanOrEqual(20);
  }, 120_000);

  it('rule 1–2: catches a symmetric, straight-sided cone', () => {
    const cone = pineSilhouette(synthetic(256, [], [], { mirrorRight: true }));
    expect(cone.mirror).toBeLessThan(PINE_RULES.minMirrorMismatch);
    expect(cone.flank).toBeLessThan(PINE_RULES.minFlankDeviation);
  });

  it('rule 3–4: catches evenly spaced and mirrored tiers, and passes uneven staggered ones', () => {
    const evenTiers = pineSilhouette(synthetic(256, even(7), even(7, .15)));
    expect(evenTiers.tierCV).toBeLessThan(PINE_RULES.minTierSpacingCV);
    const paired = pineSilhouette(synthetic(256, uneven, uneven));
    expect(paired.stagger).toBeLessThan(PINE_RULES.minTierStagger);
    const good = pineSilhouette(synthetic(256, uneven, uneven.map(t => Math.min(.95, t + .045))));
    expect(good.tierCV).toBeGreaterThanOrEqual(PINE_RULES.minTierSpacingCV);
    expect(good.stagger).toBeGreaterThanOrEqual(PINE_RULES.minTierStagger);
  });

  it('rule 5: catches flat, unsagging shelves', () => {
    const plan = planPine(base, 256);
    expect(pineGeometry(plan).droop).toBeGreaterThanOrEqual(PINE_RULES.minBranchDroop);
    const flat: PinePlan = { ...plan, branches: plan.branches.map(b => ({ ...b, points: b.points.map(p => ({ ...p, y: b.points[0].y })) })) };
    expect(pineGeometry(flat).droop).toBeLessThan(PINE_RULES.minBranchDroop);
  });

  it('rule 6: catches a crown floating above its trunk', () => {
    const bake = bakePine(base, 256), r = { ...bake.raster, data: bake.raster.data.slice() }, ys = bake.plan.skirt;
    // Erase a band across the whole width just above the skirt.
    for (let y = Math.round(ys - 20); y < Math.round(ys - 12); y++) r.data.fill(0, y * 256 * 4, (y + 1) * 256 * 4);
    expect(pineSilhouette(r).trunkGap).toBeGreaterThan(PINE_RULES.maxTrunkColumnGap);
  });

  it('rule 7: catches a leaning tree and a forked leader', () => {
    const { raster } = bakePine(base, 256), sheared = blank(256);
    for (let y = 0; y < 256; y++) for (let x = 0; x < 256; x++) {
      const sx = Math.round(x - (240 - y) * .14); if (sx < 0 || sx >= 256) continue;
      sheared.data.set(raster.data.subarray((y * 256 + sx) * 4, (y * 256 + sx) * 4 + 4), (y * 256 + x) * 4);
    }
    expect(pineSilhouette(sheared).apexOffset).toBeGreaterThan(PINE_RULES.maxApexOffset);
    const forked = synthetic(256, uneven, uneven.map(t => t + .045));
    // Two spires: notch the apex down the middle so it splits into two tops.
    for (let y = 0; y < 40; y++) for (let x = 124; x <= 132; x++) forked.data[(y * 256 + x) * 4 + 3] = 0;
    for (let y = 8; y < 40; y++) for (const x of [116, 117, 139, 140]) put(forked, x, y, [60, 110, 70]);
    expect(pineSilhouette(forked).tops).toBeGreaterThan(1);
    expect(pineSilhouette(raster).tops).toBe(1);
  });

  it('rule 8: catches a ruled column trunk and a bulb foot', () => {
    const plan = planPine(base, 256), foot = plan.leader.points[0];
    const ruled: PinePlan = { ...plan, leader: { points: plan.leader.points.map((p, i) => ({ x: foot.x, y: p.y, w: foot.w * (1 - i / plan.leader.points.length * .5) })) } };
    expect(pineGeometry(ruled).trunkEdge).toBeLessThan(PINE_RULES.minTrunkEdgeDeviation);
    const bulb: PinePlan = { ...plan, leader: { points: plan.leader.points.map((p, i) => ({ ...p, w: p.w * (1 + .9 * Math.max(0, 1 - i / 6)) })) } };
    expect(pineGeometry(bulb).flare).toBeGreaterThan(PINE_RULES.maxBaseFlare);
  });

  it('rule 9: catches a squat crown and an over-tall trunk', () => {
    const { raster } = bakePine(base, 256), squat = blank(256);
    for (let y = 0; y < 256; y++) for (let x = 0; x < 256; x++) {
      const sx = Math.round(128 + (x - 128) / 1.7); squat.data.set(raster.data.subarray((y * 256 + sx) * 4, (y * 256 + sx) * 4 + 4), (y * 256 + x) * 4);
    }
    expect(pineSilhouette(squat).aspect).toBeGreaterThan(PINE_RULES.aspect[1]);
    const lollipop = synthetic(256, uneven, uneven.map(t => t + .045));
    // Lift the whole crown: clear it and repaint it half as tall, leaving a long bare trunk.
    const lifted = blank(256);
    for (let y = 0; y < 256; y++) for (let x = 0; x < 256; x++) {
      const crown = y < 128 ? lollipop.data.subarray(((y * 2 > 204 ? 204 : y * 2) * 256 + x) * 4, ((y * 2 > 204 ? 204 : y * 2) * 256 + x) * 4 + 4) : undefined;
      if (crown && crown[3] && crown[1] > crown[0]) lifted.data.set(crown, (y * 256 + x) * 4);
      else if (y >= 100 && y < 243 && Math.abs(x - 128) < 8) lifted.data.set([...BARK, 255], (y * 256 + x) * 4);
    }
    expect(pineSilhouette(lifted).visibleTrunk).toBeGreaterThan(PINE_RULES.visibleTrunk[1]);
  });

  it('rule 10: catches a one-tone wash and lit undersides', () => {
    const flat = synthetic(256, uneven, uneven.map(t => t + .045));
    for (let i = 0; i < flat.data.length; i += 4) if (flat.data[i + 3] && flat.data[i + 1] > flat.data[i]) flat.data.set([70, 110, 75], i);
    expect(pineSilhouette(flat).valueRatio).toBeLessThan(PINE_RULES.minValueRatio);
    expect(pineSilhouette(synthetic(256, uneven, uneven.map(t => t + .045), { inverted: true })).topDown).toBeLessThan(PINE_RULES.minTopDownLight);
    expect(pineSilhouette(synthetic(256, uneven, uneven.map(t => t + .045))).topDown).toBeGreaterThanOrEqual(PINE_RULES.minTopDownLight);
  });

  it('rule 11: catches an enclosed hole and a clipped edge', () => {
    const bake = bakePine(base, 256), holed = { ...bake.raster, data: bake.raster.data.slice() };
    const cy = Math.round(bake.plan.skirt - (bake.plan.skirt - bake.plan.apex.y) * .35), cx = Math.round(bake.plan.root.x);
    for (let y = cy - 9; y <= cy + 9; y++) for (let x = cx - 9; x <= cx + 9; x++) if ((x - cx) ** 2 + (y - cy) ** 2 < 81) holed.data[(y * 256 + x) * 4 + 3] = 0;
    expect(pineSilhouette(holed).hole).toBeGreaterThan(PINE_RULES.maxEnclosedHole);
    const clipped = blank(256);
    for (let y = 0; y < 256; y++) for (let x = 0; x < 256; x++) { const sx = x + 100; if (sx < 256) clipped.data.set(bake.raster.data.subarray((y * 256 + sx) * 4, (y * 256 + sx) * 4 + 4), (y * 256 + x) * 4); }
    expect(pineSilhouette(clipped).edgeAlpha).toBeGreaterThan(0);
  });

  it('rule 12: catches incoherent lighting and a flank in total shadow', () => {
    const { raster, plan } = bakePine(base, 256), good = pineSilhouette(raster);
    expect(good.lightCoherence).toBeGreaterThanOrEqual(PINE_RULES.minLightCoherence);
    expect(good.lightSide).toBeGreaterThanOrEqual(PINE_RULES.lightSide[0]);
    expect(good.lightSide).toBeLessThanOrEqual(PINE_RULES.lightSide[1]);
    const foliage: number[] = [];
    for (let i = 0; i < raster.data.length; i += 4) if (raster.data[i + 3] >= 200 && raster.data[i + 1] >= raster.data[i]) foliage.push(i);
    // Shuffled: every foliage pixel takes another's colour, as random per-spray lighting does at the limit.
    const shuffled = { ...raster, data: raster.data.slice() };
    let s = 99; const next = () => (s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296;
    const colours = foliage.map(i => raster.data.slice(i, i + 3));
    for (let k = colours.length - 1; k > 0; k--) { const j = Math.floor(next() * (k + 1)); [colours[k], colours[j]] = [colours[j], colours[k]]; }
    foliage.forEach((i, k) => shuffled.data.set(colours[k], i));
    expect(pineSilhouette(shuffled).lightCoherence).toBeLessThan(PINE_RULES.minLightCoherence);
    // One flank darkened into total shadow, on either side.
    for (const dark of [-1, 1]) {
      const shaded = { ...raster, data: raster.data.slice() };
      for (const i of foliage) if (Math.sign((i / 4) % 256 - plan.root.x) === dark) for (let c = 0; c < 3; c++) shaded.data[i + c] = raster.data[i + c] * .3;
      const side = pineSilhouette(shaded).lightSide;
      expect(side < PINE_RULES.lightSide[0] || side > PINE_RULES.lightSide[1], `dark ${dark}: ${side}`).toBe(true);
    }
  });

  it('rejects unsupported raster sizes', () => {
    expect(() => paintPine(base, 32)).toThrow();
    expect(() => paintPine(base, 300.5)).toThrow();
  });
});
