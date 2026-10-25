/** First procedural pine study (`pine-study-v1`). A DOM-free painter in the
 * bush painter's mould: it writes straight-alpha RGBA, so the same code bakes
 * in a worker, on the main thread or in a Node fixture. No reference pixels
 * are read.
 *
 * The tree is grown, not drawn: a wandering leader, then whorls of drooping
 * branches at irregular, staggered heights, each walked outward under gravity.
 * Foliage is painted as fringed spray planes laid along those branches, each
 * either sunlit or shaded, which cast cool shade onto the planes below. Bark is
 * the bush painter's limb painting, and the shared watercolour glaze and
 * granulation finish it. See PINE_RULES for the illegal outputs it avoids. */
import { Layer, clamp, dabPass, hex, noise, paintFields, paintLimb, ramp, rng, smooth, type BushRaster, type Fields, type Limb, type RGB } from './bushPainter';

export const PINE_PAINTER_VERSION = 'pine-study-v1';

/** `slender` narrows the crown (0 broad, 1 narrow); `fullness` adds tiers;
 * `droop` sets how far branches sag; `trunk` raises the crown off the ground. */
export type PinePaintPreset = { seed: number; slender: number; fullness: number; droop: number; trunk: number; brush: number; warmth: number };
export const PINE_DEFAULT_PRESET: Readonly<PinePaintPreset> = Object.freeze({ seed: 1207, slender: .15, fullness: .6, droop: .5, trunk: .05, brush: .65, warmth: .3 });

/** Illegal pine outputs (Eric, 2026-10-20). Each limit is checked on the
 * painted raster (`pineSilhouette`) or the grown plan (`pineGeometry`), in a
 * seed sweep and against a synthetic bad shape. Reference values from
 * `pine-sprite-v1.png` are noted where they were measured. */
export const PINE_RULES = Object.freeze({
  /** 1. No symmetric cone: share of the silhouette that does not match its mirror about the trunk axis (reference .24). */
  minMirrorMismatch: .12,
  /** 2. No ruler-straight flanks: RMS deviation of each smoothed crown edge from its best-fit line, as a fraction of crown width. */
  minFlankDeviation: .025,
  /** 3. No evenly spaced tiers: coefficient of variation of shelf-tip spacing on each side (reference .39 / .45). */
  minTierSpacingCV: .2,
  /** 4. No mirrored tiers: mean height difference between each shelf tip and the nearest one on the other side, as a fraction of height. */
  minTierStagger: .02,
  /** 5. No flat-bottomed stacked cones: every side branch's tip hangs below where it leaves the leader, by at least this fraction of its length. */
  minBranchDroop: .05,
  /** 6. No floating crown: the trunk column is painted without a see-through gap from the ground to the apex (rows, as a fraction of height). */
  maxTrunkColumnGap: 0,
  /** 7. Upright, single leader: apex offset from the trunk base as a fraction of height, and exactly one top. */
  maxApexOffset: .04,
  /** A second top counts only when the dip between it and the apex reaches this fraction of height. */
  topProminence: .03,
  /** ...and only within this fraction of the height below the apex: a forked leader rises near the apex,
   * while a spray shoulder lower on the spire is not a second top (measure correction, 2026-10-20). */
  topZone: .1,
  /** 8. No geometric trunk: each visible trunk edge strays from its best-fit line by at least this fraction of the visible trunk length... */
  minTrunkEdgeDeviation: .01,
  /** ...and the foot flares at most this much over the mid-trunk width (no bulb or pot). */
  maxBaseFlare: 1.35,
  /** 9. Proportions: width over height, visible trunk as a fraction of height, and the widest row within the lowest share of the crown. */
  aspect: [.45, .8] as readonly [number, number],
  visibleTrunk: [.08, .35] as readonly [number, number],
  widestWithin: .3,
  /** 10. Two-value foliage: 90th over 10th percentile luminance (reference 5.4), and undersides never lit above the tops over them. */
  minValueRatio: 3,
  minTopDownLight: 0,
  /** 11. Largest enclosed transparent hole inside the silhouette, as a fraction of its bounding area. Edges stay transparent. */
  maxEnclosedHole: .004,
  /** 12. Coherent lighting (approved 2026-10-20): lit foliage clusters with lit neighbours (reference 1.56), and the
   * left/right lit-share ratio shows a direction without leaving a flank in total shadow (reference 0.56). */
  minLightCoherence: 1.3,
  lightSide: [.25, 4] as readonly [number, number],
});

type Pt = { x: number; y: number; w: number };
export type PineBranch = { points: Pt[]; side: -1 | 1; tier: number };
/** A spray of foliage: a plane laid along a branch from (x, y) toward `angle`,
 * with a thin upper edge, a hanging fringe of `drop` and a downward bend. */
export type PineFrond = { x: number; y: number; angle: number; len: number; top: number; drop: number; bend: number;
  teeth: Float32Array; light: number; tint: number; z: number; key: number; seed: number };
export type PinePlan = { size: number; ground: number; root: { x: number; y: number }; apex: { x: number; y: number };
  /** Bottom of the lowest foliage at the trunk; the visible trunk runs from here to the ground. */
  skirt: number;
  leader: Limb; branches: PineBranch[]; fronds: PineFrond[]; tiers: number[] };

const TEETH = 128;
/** The lower outline of a spray: a few broad hanging lobes over a shallower
 * base, so each spray reads as one painted mass rather than a comb of spikes.
 * Values are the hang depth (0..1) along the spray. */
function lobes(random: () => number) {
  const count = 3 + Math.floor(random() * 4), bumps = Array.from({ length: count }, (_, i) => ({ at: (i + .25 + random() * .5) / count, depth: .7 + random() * .3, width: .12 + random() * .13 }));
  return Float32Array.from({ length: TEETH }, (_, i) => {
    const u = i / (TEETH - 1); let d = .55 + Math.sin(u * 9 + count) * .04;
    for (const b of bumps) d = Math.max(d, b.depth * Math.exp(-(((u - b.at) / b.width) ** 2)));
    return d;
  });
}

/** Light from the upper right and in front, matching the approved pines (they are lit more on the right). */
const MOON = [.35, .75, .55] as const;

export function planPine(preset: Readonly<PinePaintPreset>, size: number): PinePlan {
  // Separate streams: the leader and branches, then foliage, so retuning one never reshuffles the other.
  const wood = rng(preset.seed ^ 0x51ae7), leaf = rng(preset.seed ^ 0x2f0c3);
  const ground = size * .965, top = size * .035, H = ground - top;
  const root = { x: size * .5 + (wood() - .5) * size * .02, y: ground };
  // The visible trunk is a seeded share of the height; the crown fills the rest.
  const trunkShare = .12 + preset.trunk * .14 + wood() * .04, skirt = ground - H * trunkShare;
  // Leader: an upright walker whose heading wanders inside a narrow lane, so
  // the apex stays over the root while the stem never runs ruler-straight. A
  // leader whose visible trunk breaks PINE_RULES 8 (ruled edges or a bulb foot)
  // regrows from the next deterministic sub-seed.
  const lane = .028, steps = 90, w0 = H * (.028 + wood() * .009), flare = .03 + wood() * .05, trunkSeed = Math.floor(wood() * 2 ** 31);
  let leader: Pt[] = [];
  for (let attempt = 0; attempt < 12; attempt++) {
    const stem = rng(trunkSeed + attempt * 7919), wander = noise(8, rng(Math.floor(stem() * 2 ** 31))), girth = noise(8, rng(Math.floor(stem() * 2 ** 31))), sway = noise(8, rng(Math.floor(stem() * 2 ** 31)));
    leader = []; let x = root.x, y = root.y, h = (stem() - .5) * lane;
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      // The trunk tapers visibly from its foot to the crown, bulging and pinching a little on the way; the foot flares only slightly.
      const w = Math.max(size * .002, w0 * (1 - t) ** .85 * (1 - .14 * smooth(0, .24, t)) * (1 + (girth(t * 9, .4) - girth(0, .4)) * .14) * (1 + flare * smooth(.05, 0, t)));
      // The lower trunk drifts gently from side to side (never a snaking S); this fades out by the crown so the apex stays over the root.
      leader.push({ x: x + (sway(t * 3, .5) - .5) * w0 * .5 * smooth(.45, .1, t), y, w });
      h += (wander(t * 1.6, .3) - .5) * .05; h = Math.max(-lane, Math.min(lane, h));
      x += Math.sin(h) * H / steps; y -= Math.cos(h) * H / steps;
    }
    const shape = trunkShape(leader, skirt, ground);
    if (shape.edge >= PINE_RULES.minTrunkEdgeDeviation * 1.15 && shape.flare <= PINE_RULES.maxBaseFlare * .96) break;
  }
  const apex = { x: leader[steps].x, y: leader[steps].y }, C = skirt - apex.y;
  const leaderX = (yy: number) => { for (let i = 1; i < leader.length; i++) if (leader[i].y <= yy) { const a = leader[i - 1], b = leader[i], t = (a.y - yy) / ((a.y - b.y) || 1); return a.x + (b.x - a.x) * t; } return apex.x; };
  const half = H * (.3 - preset.slender * .06) * (.92 + wood() * .16);
  // Each side's envelope wanders on its own, so the flanks are neither straight nor mirrored.
  const flank = [noise(5, rng(Math.floor(wood() * 2 ** 31))), noise(5, rng(Math.floor(wood() * 2 ** 31)))];
  // Below 1 the flank is convex, a full bell like the reference rather than a straight cone.
  const power = .58 + wood() * .22;
  const envelope = (s: number, side: -1 | 1) => half * Math.max(.05, Math.max(0, 1 - s) ** power) * (1 + (flank[side < 0 ? 0 : 1](s * 1.4, .5) - .5) * .36) * (1 + .08 * smooth(.25, 0, s));
  // Shelves start a little above the skirt so the lowest fringe hangs to it.
  const shelfY = (s: number) => skirt - (.06 + s * .9) * C;
  // Shelves: each side grows its own, so the two sides are staggered, never
  // paired. Major shelves jut out past the shelf below and make the stepped
  // flank; minor shelves are short and tuck inside the crown between them, as
  // in the reference, where only some shelves reach the silhouette. The eye reads the majors'
  // rhythm, and tips closer than about 3% of the height merge into one, so the
  // majors are spaced irregularly with gaps above that (PINE_RULES 3, 4). A
  // plan that comes out too even, or with the sides paired, regrows from the
  // next deterministic sub-seed.
  const merge = .04 * H / C;
  /** `reach` is the shelf's share of the envelope at its height. */
  type Shelf = { s: number; major: boolean; reach: number };
  const spread = (list: number[]) => {
    const gaps = list.slice(1).map((v, i) => v - list[i]), mean = gaps.reduce((a, b) => a + b, 0) / (gaps.length || 1);
    return gaps.length < 2 ? 0 : Math.sqrt(gaps.reduce((a, b) => a + (b - mean) ** 2, 0) / gaps.length) / mean;
  };
  let sides: Shelf[][] = [[], []], best = -Infinity;
  for (let attempt = 0; attempt < 32; attempt++) {
    const jitter = rng((preset.seed ^ 0x7135) + attempt * 7919);
    const trial = [0, 1].map(k => {
      const list: Shelf[] = [];
      for (let s = k ? .02 + jitter() * .05 : jitter() * .03; s < .88;) {
        list.push({ s, major: true, reach: .92 + jitter() * .16 });
        // Visible gaps (in tree heights, like the reference's 9–18%) are either
        // short or long, never close enough to merge, which keeps the rhythm uneven.
        const long = jitter() < .5, step = H / C * (long ? .14 + jitter() * .05 : .08 + jitter() * .02);
        // A doubling spray layer just above the shelf thickens it without making
        // a tip of its own (it is narrower and within the merge distance)...
        if (jitter() < .4 + preset.fullness * .5) list.push({ s: s + H / C * (.02 + jitter() * .025), major: false, reach: .6 + jitter() * .14 });
        // ...and a long gap holds a short shelf hidden in the fringe of the one above.
        if (long) list.push({ s: s + step * (.5 + jitter() * .15), major: false, reach: .45 + jitter() * .1 });
        s += step;
      }
      return list.filter(v => v.s <= .9);
    });
    // The visible rhythm: walking up, shelves closer than about 8% of the height
    // read as one, the wider of them, because its edge fills the gap under the
    // other's tip. That rhythm must be uneven.
    const majors = trial.map((list, k) => {
      const seen: { s: number; w: number }[] = [];
      for (const v of [...list].sort((a, b) => a.s - b.s)) {
        const w = envelope(v.s, k ? 1 : -1) * v.reach, last = seen[seen.length - 1];
        if (last && v.s - last.s < .08 * H / C) { if (w > last.w) seen[seen.length - 1] = { s: v.s, w }; } else seen.push({ s: v.s, w });
      }
      return seen.map(v => v.s);
    });
    const stagger = majors[0].reduce((a, s) => a + Math.min(...majors[1].map(t => Math.abs(s - t))), 0) / majors[0].length / (H / C);
    // Margins over PINE_RULES leave room for what painting adds; the best attempt is kept if none clears them.
    const score = Math.min(spread(majors[0]) / .32, spread(majors[1]) / .32, Math.min(majors[0].length, majors[1].length) / 4, stagger / (PINE_RULES.minTierStagger * 1.8));
    if (score > best) { best = score; sides = trial; }
    if (score >= 1) break;
  }
  // Front and deep sprays follow the merged heights of both sides.
  const tiers = [...sides[0], ...sides[1]].filter(v => v.major).map(v => v.s).sort((a, b) => a - b).filter((s, i, all) => !i || s - all[i - 1] > merge * .5);
  const branches: PineBranch[] = [], fronds: PineFrond[] = [];
  const sag = .22 + preset.droop * .5;
  // A visible spray is always longer than it is deep; deeper ones read as hanging
  // curtains. Deep core sprays are exempt: they fill the dark recesses.
  // Sprays that catch the light are lit by one shared model once the crown is
  // grown (the lighting pass below); `along` is how far out along its branch a spray sits.
  const lighting: { f: PineFrond; along: number }[] = [];
  const frond = (f: Omit<PineFrond, 'teeth' | 'tint' | 'seed'>, along = -1) => {
    const made = { ...f, top: f.z < -.5 ? f.top : Math.min(f.top, f.len * .3), drop: f.z < -.5 ? f.drop : Math.min(f.drop, f.len * .62), teeth: lobes(leaf), tint: leaf() - .5, seed: Math.floor(leaf() * 2 ** 31) };
    fronds.push(made); if (along >= 0) lighting.push({ f: made, along });
  };
  for (const side of [-1, 1] as const) sides[side < 0 ? 0 : 1].forEach(({ s: ss, major, reach: share }, tier, list) => {
    const next = list.slice(tier + 1).find(v => v.major)?.s ?? .96, gap = Math.max(merge, next - ss);
    const reach = envelope(ss, side) * share;
    if (reach < size * .012) return;
    // Grow the branch: it leaves the leader near level and sags under its own
    // weight toward the tip, with a little wander and one small kink.
    const bw = noise(6, rng(Math.floor(wood() * 2 ** 31))), kink = { at: .3 + wood() * .5, turn: (wood() - .5) * .22 };
    const n = 24, pts: { x: number; y: number }[] = []; let bx = 0, by = 0, bh = side * (Math.PI / 2 - .14 * smooth(.85, .55, ss) + wood() * .2);
    const fall = side * (Math.PI / 2 + .06 + sag * .22);
    for (let i = 0; i <= n; i++) {
      const t = i / n; pts.push({ x: bx, y: by });
      bh += (fall - bh) * .08 + (bw(t, .5) - .5) * .1; if (Math.abs(t - kink.at) < .5 / n) bh += kink.turn;
      bx += Math.sin(bh); by -= Math.cos(bh);
    }
    // Scale the walk so the tip reaches the envelope, and let the outer part
    // sag further (heavier toward the tip), so every shelf droops. The sag stays
    // small next to the shelf spacing: a deep sag lets each shelf reach past the
    // tip above it, which smooths the stepped flank into a straight diagonal.
    const k = reach / Math.abs(pts[n].x), len = pts.slice(1).reduce((sum, p, i) => sum + Math.hypot(p.x - pts[i].x, p.y - pts[i].y), 0) * k;
    const bend = reach * (.03 + sag * .06), path = pts.map((p, i) => ({ x: p.x * k, y: p.y * k + bend * (i / n) ** 2 }));
    const short = PINE_RULES.minBranchDroop * 1.6 * len - path[n].y;
    if (short > 0) path.forEach((p, i) => { p.y += short * (i / n) ** 2; });
    // Hang it from the leader so its tip lands on this shelf.
    const attachY = Math.max(apex.y + C * .04, Math.min(skirt - C * .03, shelfY(ss) - path[n].y)), ax = leaderX(attachY);
    const w = Math.max(size * .002, w0 * .2 * (1 - ss));
    const points = path.map((p, i) => ({ x: ax + p.x, y: attachY + p.y, w: w * (1 - i / n * .8) }));
    branches.push({ points, side, tier });
    // Sprays overlap along the branch, the outermost reaching just past its tip.
    const sprays = (major ? 4 : 2) + (reach > half * .4 ? 1 : 0) + (leaf() < .5 ? 1 : 0);
    for (let j = 0; j < sprays; j++) {
      const t0 = clamp(j / sprays * .8 + (leaf() - .5) * .08, 0, .82), t1 = Math.min(1, t0 + .32 + leaf() * .22);
      const a = at(points, t0), b = at(points, t1), slen = Math.hypot(b.x - a.x, b.y - a.y) * (1.2 + leaf() * .25);
      frond({ x: a.x, y: a.y, angle: Math.atan2(b.y - a.y, b.x - a.x), len: slen, top: C * (.024 + leaf() * .02) * (1 - ss * .4),
        drop: (C * (.03 + leaf() * .02) + gap * C * (.25 + leaf() * .2)) * (1 - ss * .3), bend: slen * (.03 + leaf() * .06) * sag,
        // Minor shelves sit deeper in the crown, so they paint before (behind) the majors near them.
        light: 0, z: major ? .2 : -.2, key: ss + .01 * j - (major ? 0 : .08) }, (t0 + t1) / 2);
    }
  });
  tiers.forEach((s, tier) => {
    // The last tier has no shelf above it; cap its gap so its sprays stay out of the spire.
    const gap = Math.min((tiers[tier + 1] ?? .96) - s, .12 * H / C);
    // Front sprays hang over the leader, so the centre reads as overlapping
    // shelves rather than a stem with arms. They and the deep sprays stay well
    // inside the envelope, leaving the recess under each shelf tip open: the
    // flank steps like the reference instead of running smooth.
    const fronts = 3 + (leaf() < .5 ? 1 : 0), width = (envelope(s, -1) + envelope(s, 1)) / 2, fy0 = shelfY(s);
    for (let j = 0; j < fronts; j++) {
      const side = leaf() < .5 ? -1 : 1, len = width * (.3 + leaf() * .22), fx = leaderX(fy0) + side * width * leaf() * .35 - side * len * .3;
      frond({ x: fx, y: fy0 - gap * C * (.25 + leaf() * .5), angle: side > 0 ? .2 + leaf() * .45 : Math.PI - .2 - leaf() * .45, len,
        top: C * (.022 + leaf() * .02), drop: C * (.03 + leaf() * .02) + gap * C * (.25 + leaf() * .2), bend: len * .06 * sag,
        light: 0, z: .8, key: s + gap * .45 + j * .001 }, .7);
    }
    // Deep sprays behind the shelves fill the core with dark recesses, so no
    // daylight shows between tiers and the crown always meets its trunk.
    for (let j = 0; j < 3; j++) {
      const side = j === 1 ? (leaf() < .5 ? -1 : 1) : j === 0 ? -1 : 1, len = width * (.3 + leaf() * .18);
      frond({ x: leaderX(fy0) + side * width * .1 - side * len * .2, y: fy0 - gap * C * (.8 + leaf() * .3), angle: side > 0 ? .3 + leaf() * .3 : Math.PI - .3 - leaf() * .3, len,
        top: C * .03, drop: gap * C * (1.2 + leaf() * .4), bend: len * .06, light: .04 + leaf() * .1, z: -.6, key: s - 2 });
    }
  });
  // The spire: one spray on the leader's tip, pointing up, with small sprays
  // reaching out and slightly down below it. Sprays angled upward here would
  // make horns, a second top (PINE_RULES 7); the tip stays the single highest point.
  for (let j = 0; j < 5; j++) {
    const s = .84 + j * .025, yy = skirt - s * C, side = j % 2 ? 1 : -1, len = half * (.2 - j * .028) * (.85 + leaf() * .3);
    frond({ x: leaderX(yy), y: yy, angle: side > 0 ? .05 + leaf() * .25 : Math.PI - .05 - leaf() * .25, len,
      top: C * .012, drop: C * (.035 + leaf() * .02), bend: len * .04, light: 0, z: .5, key: 2 + j }, .8);
  }
  frond({ x: leaderX(apex.y + C * .15), y: apex.y + C * .15, angle: -Math.PI / 2 + (leaf() - .5) * .1, len: C * .16, top: C * .022, drop: C * .03, bend: 0,
    light: 0, z: .6, key: 3 }, 1);
  // Lighting: one light from the upper right and front lights the whole crown, so
  // lit and shaded sprays fall in coherent regions rather than at random. Each
  // spray's facing comes from where it sits on the crown's rounded surface:
  // outward across the flanks, toward the viewer at the centre, and upward
  // everywhere, since shelf tops face the sky. Sprays deep along a branch sit
  // under the shelf above and fall into its shade; outer tips and the upper crown
  // catch more. Low-frequency noise, sampled by position so neighbours agree,
  // breaks the boundary into soft patches. A per-tree threshold keeps about 40%
  // of sprays lit, and the lit and shaded groups stay a clear value apart.
  const patch = noise(4, rng(preset.seed ^ 0x11e47)), moonLength = Math.hypot(...MOON), moon = MOON.map(v => v / moonLength);
  const scores = lighting.map(({ f, along }) => {
    const mx = f.x + Math.cos(f.angle) * f.len * .5, my = f.y + Math.sin(f.angle) * f.len * .5 - f.top * .5;
    const h = clamp((skirt - my) / C), offset = mx - leaderX(my), across = clamp(offset / Math.max(size * .01, envelope(h, offset < 0 ? -1 : 1)), -1.2, 1.2);
    const nx = across * .18, ny = .62, nz = Math.sqrt(Math.max(0, 1 - Math.min(1, across * across))) * .8 + (f.z > .5 ? .25 : 0), n = Math.hypot(nx, ny, nz) || 1;
    const facing = (nx * moon[0] + ny * moon[1] + nz * moon[2]) / n;
    return facing + (along - .5) * .5 + h * .18 + (patch(mx / size * 1.3, my / size * 1.3) - .5) * .5;
  });
  const order = [...scores].sort((a, b) => a - b), cut = order[Math.floor(order.length * .6)] ?? 0;
  lighting.forEach(({ f }, i) => {
    const d = scores[i] - cut;
    f.light = d >= 0 ? clamp(.74 + d * .3, .74, .94) : clamp(.42 + d * .5, .16, .42);
  });
  // Sprays that hang over the trunk stop at the skirt, so the trunk's visible
  // share is the planned one; sprays clear of the trunk may hang lower.
  for (const f of fronds) {
    const x1 = f.x + Math.cos(f.angle) * f.len, band = w0 * 2;
    if (Math.min(f.x, x1) - f.drop * .3 < root.x + band && Math.max(f.x, x1) + f.drop * .3 > root.x - band) f.drop = Math.min(f.drop, Math.max(C * .01, skirt - f.y - f.bend));
  }
  fronds.sort((a, b) => a.key - b.key);
  // Fit: shrink the whole tree about its root if any spray would cross the
  // canvas gutter. Uniform, so the silhouette keeps its proportions.
  const extent = Math.max(...fronds.map(f => Math.max(Math.abs(f.x - root.x), Math.abs(f.x + Math.cos(f.angle) * f.len - root.x)) + f.drop * .4 + f.top));
  const fit = Math.min(1, size * .47 / extent);
  if (fit < 1) {
    const sx = (p: { x: number; y: number }) => { p.x = root.x + (p.x - root.x) * fit; p.y = root.y + (p.y - root.y) * fit; };
    leader.forEach(p => { sx(p); p.w *= fit; }); branches.forEach(b => b.points.forEach(p => { sx(p); p.w *= fit; })); sx(apex);
    fronds.forEach(f => { sx(f); f.len *= fit; f.top *= fit; f.drop *= fit; f.bend *= fit; });
  }
  return { size, ground, root, apex, skirt: root.y + (skirt - root.y) * fit, leader: { points: leader }, branches, fronds, tiers };
}

function at(points: Pt[], t: number) {
  const f = clamp(t) * (points.length - 1), i = Math.min(points.length - 2, Math.floor(f)), s = f - i, a = points[i], b = points[i + 1];
  return { x: a.x + (b.x - a.x) * s, y: a.y + (b.y - a.y) * s };
}

const fract = (n: number) => n - Math.floor(n);
/** Paints one spray: a ragged upper edge, a near-flat body of one value (lit or
 * shaded), and a lobed lower edge broken into small stepped teeth, with
 * pigment pooled along the margin. Before painting, it glazes cool shade onto
 * whatever already lies under its lower edge. */
function paintFrond(layer: Layer, f: PineFrond, preset: Readonly<PinePaintPreset>, fields: Fields, colors: ReturnType<typeof ramp>) {
  const { size } = layer, ca = Math.cos(f.angle), sa = Math.sin(f.angle);
  // The lower edge hangs toward screen-down whichever way the spray points.
  const nx = ca >= 0 ? -sa : sa, ny = ca >= 0 ? ca : -ca;
  const pad = f.drop * 1.5 + f.top + f.bend + 4;
  const xs = [f.x, f.x + ca * f.len], ys = [f.y, f.y + sa * f.len];
  const minX = Math.max(0, Math.floor(Math.min(...xs) - pad)), maxX = Math.min(size - 1, Math.ceil(Math.max(...xs) + pad));
  const minY = Math.max(0, Math.floor(Math.min(...ys) - pad)), maxY = Math.min(size - 1, Math.ceil(Math.max(...ys) + pad + f.drop * .5));
  const local = noise(5, rng(f.seed)), shadow: RGB = hex('#0a1915'), out = [0, 0, 0], { grid } = fields;
  // Small stepped teeth along both edges, sized to the bake, leaning toward the tip.
  const period = size * (.01 + fract(f.seed * 1e-5) * .006), amp = size * .007 * (.5 + preset.brush), phase = fract(f.seed * 7.3e-6) * 9;
  const shape = (x: number, y: number) => {
    const dx = x - f.x, dy = y - f.y, u = (dx * ca + dy * sa) / f.len;
    if (u < -.1 || u > 1.08) return undefined;
    const uc = clamp(u), v = dx * nx + dy * ny - f.bend * uc * uc;
    const body = Math.sin(Math.PI * Math.min(1, (uc + .05) * .97)) ** .45 * (1 - uc * .3);
    const hang = f.teeth[Math.round(uc * (TEETH - 1))] * Math.min(1, (1 - uc) * 3 + .12) * Math.min(1, uc * 4 + .35);
    return { u: uc, v, upper: -f.top * body, lower: f.drop * hang * (1 - uc * .2) };
  };
  // Pass 1: cast shade beneath the lower edge onto paint already there.
  for (let y = minY; y <= maxY; y++) for (let x = minX; x <= maxX; x++) {
    const s = shape(x, y - f.drop * .3); if (!s) continue;
    const inside = Math.min(s.v - s.upper, s.lower - s.v) / Math.max(2, f.drop * .45);
    const strength = smooth(-.3, .6, inside) * .58;
    if (strength > .004) layer.glaze(y * size + x, shadow, strength);
  }
  // Pass 2: the spray.
  for (let y = minY; y <= maxY; y++) for (let x = minX; x <= maxX; x++) {
    const s = shape(x, y); if (!s) continue;
    const at = y * size + x, fine = grid.fine[at], mid = grid.mid[at];
    const rag = (fine - .5) * amp * .9 + (mid - .5) * amp * 1.4;
    const tooth = fract((s.u * f.len + Math.max(0, s.v) * .5) / period + phase + (mid - .5) * 1.2) * amp;
    const edge = Math.min(s.v - s.upper + rag - tooth * .5, s.lower - s.v + rag - tooth, (1 - s.u) * f.len * .9 + rag + 1, (s.u + .1) * f.len + rag);
    const alpha = smooth(-.7, .7, edge);
    if (alpha < .003) continue;
    // One value per plane, as in the reference: mottled by broad wet-in-wet
    // blooms, a little darker along the lower margin, never a smooth gradient.
    const depth = clamp((s.v - s.upper) / Math.max(1, s.lower - s.upper));
    const broad = local(s.u * .7 + f.tint, depth * .5), wash = grid.broad[at];
    // Lit sprays are lit on their upper surface and fall into shade underneath, as in the reference.
    let value = f.light + (broad - .5) * .3 + (wash - .5) * .12 - smooth(.35, .95, depth) * (.06 + f.light * .3) + smooth(.3, 0, depth) * .03;
    const pooled = (1 - smooth(0, 1.6 + f.drop * .03, edge)) * (.5 + mid * .9);
    value -= pooled * .07;
    value += (fine - .5) * .04 + (mid - .5) * .06;
    colors(clamp(value), out);
    // Temperature drift independent of value: some planes lean olive, others slate-teal.
    const drift = (f.tint + (wash - .5) * .6) * .05;
    layer.over(at, clamp(out[0] + drift), clamp(out[1] + drift * .3), clamp(out[2] - drift * .6 - pooled * .02), alpha);
  }
}

/** Greyed ochre-brown bark sampled from the approved pines, with a cool umber shade (kept red-dominant so bark never reads as foliage). */
const pineBark = { bark: ramp([[0, hex('#221a13')], [.3, hex('#3d3123')], [.52, hex('#5c4a34')], [.74, hex('#86704f')], [1, hex('#b39a6f')]]), cool: hex('#38302b') };

/** Most bakes per pine before the least-flawed attempt is accepted. */
const PINE_ATTEMPTS = 6;
/** Bakes a pine that passes PINE_RULES. Planning makes most seeds legal by
 * construction; a painted result that still breaks a rule regrows from the
 * next deterministic sub-seed, so output stays fixed per preset and size.
 * `attempt` is 0 for the first bake; `violations` is empty unless every attempt failed. */
export function bakePine(preset: Readonly<PinePaintPreset>, size = 512, attempts = PINE_ATTEMPTS) {
  if (!Number.isInteger(size) || size < 64 || size > 1536) throw new Error('Pine raster must be 64–1536 pixels.');
  let best: { raster: BushRaster; plan: PinePlan; attempt: number; violations: string[] } | undefined;
  for (let attempt = 0; attempt < attempts; attempt++) {
    const trial = attempt ? { ...preset, seed: (preset.seed + Math.imul(attempt, 0x9e3779b1)) >>> 0 } : preset;
    const plan = planPine(trial, size), raster = paintPlan(trial, plan, size), violations = pineViolations(raster, plan);
    if (!best || violations.length < best.violations.length) best = { raster, plan, attempt, violations };
    if (!violations.length) break;
  }
  return best!;
}

export function paintPine(preset: Readonly<PinePaintPreset>, size = 512): BushRaster { return bakePine(preset, size).raster; }

function paintPlan(preset: Readonly<PinePaintPreset>, plan: PinePlan, size: number): BushRaster {
  const layer = new Layer(size), random = rng(preset.seed ^ 0x9e37);
  const fields = paintFields(size, random);
  const w = preset.warmth;
  // Value ramp sampled from the approved pines: near-black spruce through slate
  // teal and sage to a pale mint (cool, warmth 0) or yellow-green (warm, 1); warmth only moves the lit end.
  const colors = ramp([
    [0, hex('#0c1a17')], [.18, hex('#16302a')], [.34, hex('#284634')], [.5, hex('#3f6040')],
    [.66, [.36 + w * .1, .52 + w * .03, .38 - w * .09]], [.82, [.5 + w * .12, .64 + w * .03, .46 - w * .12]], [1, [.66 + w * .1, .76 + w * .02, .56 - w * .14]],
  ]);
  // The trunk stands behind the whole crown; only the skirt and dark gaps reveal it.
  // The leader stops short of the apex so no bare twig pokes past the top spray.
  paintLimb(layer, { points: plan.leader.points.slice(0, Math.round(plan.leader.points.length * .93)) }, fields, random, pineBark);
  for (const f of plan.fronds) paintFrond(layer, f, preset, fields, colors);
  // The foot is cut flat along a slightly ragged ground line: a fixed anchor, no rounded cap.
  const cut = noise(24, rng(preset.seed ^ 0x6f07));
  for (let x = 0; x < size; x++) { const g = Math.round(plan.ground + (cut(x / size, .5) - .5) * size * .006);
    for (let y = Math.max(0, g); y < size; y++) layer.px.fill(0, (y * size + x) * 4, (y * size + x) * 4 + 4); }
  dabPass(layer, random, .45 + preset.brush * .55);
  return layer.raster();
}

/** Geometry checks on the grown plan: branch droop (rule 5) and the visible
 * trunk's edges and foot (rule 8). */
export function pineGeometry(plan: PinePlan) {
  let droop = Infinity;
  for (const b of plan.branches) {
    const p = b.points, len = p.slice(1).reduce((s, q, i) => s + Math.hypot(q.x - p[i].x, q.y - p[i].y), 0);
    droop = Math.min(droop, (p[p.length - 1].y - p[0].y) / (len || 1));
  }
  const { edge, flare } = trunkShape(plan.leader.points, plan.skirt, plan.ground);
  return { droop, trunkEdge: edge, flare };
}

/** The visible trunk's character (PINE_RULES 8): how far its least irregular
 * edge strays from a straight line, as a fraction of its length, and its foot's
 * width over its mid width. */
function trunkShape(points: readonly Pt[], skirt: number, ground: number) {
  const visible = points.filter(p => p.y >= skirt), length = ground - skirt;
  const deviation = (edge: number[], ys: number[]) => {
    const n = edge.length, my = ys.reduce((s, v) => s + v, 0) / n, mx = edge.reduce((s, v) => s + v, 0) / n;
    let sxy = 0, syy = 0; for (let i = 0; i < n; i++) { sxy += (ys[i] - my) * (edge[i] - mx); syy += (ys[i] - my) ** 2; }
    const slope = syy ? sxy / syy : 0; return Math.max(...edge.map((e, i) => Math.abs(e - (mx + slope * (ys[i] - my)))));
  };
  const ys = visible.map(p => p.y);
  const edge = visible.length < 3 ? 0 : Math.min(deviation(visible.map(p => p.x - p.w), ys), deviation(visible.map(p => p.x + p.w), ys)) / (length || 1);
  const mid = visible[Math.floor(visible.length / 2)] ?? visible[0];
  return { edge, flare: visible.length ? visible[0].w / (mid.w || 1) : 1 };
}

const luminance = (d: ArrayLike<number>, i: number) => .2126 * d[i] + .7152 * d[i + 1] + .0722 * d[i + 2];
const isBark = (d: ArrayLike<number>, i: number) => d[i] > d[i + 1];

/** Raster-only checks, so the approved reference can be measured too: rules 1–4,
 * 6, 7, 9, 10 and 11. The trunk axis comes from the painted foot. */
export function pineSilhouette(raster: { width: number; height: number; data: ArrayLike<number> }) {
  const { width: W, height: Hh, data: d } = raster, A = (x: number, y: number) => d[(y * W + x) * 4 + 3] > 40;
  let x0 = W, x1 = -1, y0 = Hh, y1 = -1;
  for (let y = 0; y < Hh; y++) for (let x = 0; x < W; x++) if (A(x, y)) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
  const H = y1 - y0 + 1, Wd = x1 - x0 + 1;
  const left: number[] = [], right: number[] = [], widths: number[] = [];
  for (let y = y0; y <= y1; y++) { let l = -1, r = -1; for (let x = x0; x <= x1; x++) if (A(x, y)) { if (l < 0) l = x; r = x; } left.push(l); right.push(r); widths.push(l < 0 ? 0 : r - l + 1); }
  // Trunk axis: centre of the painted foot, a little above the very bottom.
  const footRow = Math.max(0, H - 1 - Math.round(H * .02)), axis = (left[footRow] + right[footRow]) / 2, footWidth = widths[footRow];
  // Visible trunk: from the ground up to the first row where foliage covers most
  // of the band over the trunk. Skirts may hang lower at the sides; stray
  // greenish bark pixels at the foot are not foliage.
  let crownBase = H - 1;
  for (let i = H - 1; i >= 0; i--) { const y = y0 + i; let leafy = 0, n = 0;
    for (let x = Math.round(axis - footWidth / 2); x <= Math.round(axis + footWidth / 2); x++) { if (x < 0 || x >= W) continue; const k = (y * W + x) * 4; n++; if (d[k + 3] > 128 && !isBark(d, k)) leafy++; }
    if (leafy > n / 2) { crownBase = i; break; } }
  const visibleTrunk = (H - 1 - crownBase) / H;
  // 1. Mirror mismatch about the trunk axis.
  let diff = 0, union = 0;
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) { const m = Math.round(2 * axis - x), a = A(x, y), b = m >= 0 && m < W && A(m, y); if (a || b) union++; if (a !== b) diff++; }
  // Smoothed crown edges, apex to crown base.
  const smoothEdge = (e: number[]) => e.map((_, i) => { let s = 0, n = 0; for (let k = -6; k <= 6; k++) { const v = e[i + k]; if (v !== undefined && v >= 0 && i + k < crownBase) { s += v; n++; } } return n ? s / n : NaN; });
  const sl = smoothEdge(left), sr = smoothEdge(right);
  // 2. Flank deviation from a straight line, from apex to the widest crown row.
  let widest = 0; for (let i = 0; i < crownBase; i++) if (widths[i] > widths[widest]) widest = i;
  const flank = (e: number[]) => {
    const ys: number[] = [], xs: number[] = []; for (let i = Math.round(H * .04); i <= widest; i++) if (!Number.isNaN(e[i])) { ys.push(i); xs.push(e[i]); }
    const n = ys.length; if (n < 3) return 0;
    const my = ys.reduce((s, v) => s + v, 0) / n, mx = xs.reduce((s, v) => s + v, 0) / n;
    let sxy = 0, syy = 0; for (let i = 0; i < n; i++) { sxy += (ys[i] - my) * (xs[i] - mx); syy += (ys[i] - my) ** 2; }
    const slope = sxy / (syy || 1); return Math.sqrt(xs.reduce((s, v, i) => s + (v - (mx + slope * (ys[i] - my))) ** 2, 0) / n) / (widths[widest] || 1);
  };
  // 3–4. Shelf tips: local extremes of each smoothed edge within ±3% of height.
  const tips = (e: number[], sign: number) => {
    const res: number[] = [], win = Math.max(2, Math.round(H * .03));
    for (let i = 8; i < crownBase - 2; i++) { const v = e[i]; if (Number.isNaN(v)) continue;
      let ok = true; for (let k = -win; k <= win && ok; k++) { const w = e[i + k]; if (k && w !== undefined && !Number.isNaN(w) && sign * w > sign * v) ok = false; }
      if (ok && (!res.length || i - res[res.length - 1] > 5)) res.push(i); }
    return res;
  };
  const lt = tips(sl, -1), rt = tips(sr, 1);
  const cv = (t: number[]) => { const g = t.slice(1).map((v, i) => v - t[i]); if (g.length < 2) return 0; const m = g.reduce((s, v) => s + v, 0) / g.length; return Math.sqrt(g.reduce((s, v) => s + (v - m) ** 2, 0) / g.length) / m; };
  const stagger = lt.length && rt.length ? lt.map(a => Math.min(...rt.map(b => Math.abs(a - b)))).reduce((s, v) => s + v, 0) / lt.length / H : 0;
  // 6. Trunk column: every row from the ground to the apex is painted near the axis.
  let gap = 0, run = 0, apexRow = 0;
  while (apexRow < H && left[apexRow] < 0) apexRow++;
  const apexX = left[apexRow] < 0 ? axis : (left[apexRow] + right[apexRow]) / 2, reachX = Math.max(2, Math.round(Wd * .02));
  for (let i = footRow; i >= apexRow + Math.round(H * .03); i--) { const y = y0 + i, cx = Math.round(axis + (apexX - axis) * (H - 1 - i) / Math.max(1, H - 1 - apexRow)); let hit = false;
    for (let k = -reachX; k <= reachX && !hit; k++) { const x = cx + k; if (x >= 0 && x < W && A(x, y)) hit = true; } run = hit ? 0 : run + 1; gap = Math.max(gap, run); }
  // 7. Apex offset and number of tops: peaks of the column-top profile.
  const topRows = Math.max(1, Math.round(H * .03)); let ac = 0, an = 0;
  for (let i = 0; i < topRows; i++) if (left[i] >= 0) { ac += (left[i] + right[i]) / 2; an++; }
  const apexOffset = Math.abs(ac / (an || 1) - axis) / H;
  const colTop = new Float32Array(Wd).fill(H);
  for (let x = x0; x <= x1; x++) for (let y = y0; y <= y1; y++) if (A(x, y)) { colTop[x - x0] = y - y0; break; }
  // Topographic prominence: walk each way to the first higher column; the
  // deepest dip on the way is that side's prominence (unbounded at an edge).
  const prominence = H * PINE_RULES.topProminence; let tops = 0;
  for (let i = 0; i < Wd; i++) {
    const v = colTop[i]; if (v > H * PINE_RULES.topZone || (i > 0 && colTop[i - 1] <= v)) continue;
    // Ties break rightward, so two equal summits a notch apart count once.
    const dip = (step: -1 | 1) => { let deepest = 0; for (let j = i + step; j >= 0 && j < Wd; j += step) { if (colTop[j] < v || (step > 0 && colTop[j] === v && deepest > 0)) return deepest; deepest = Math.max(deepest, colTop[j] - v); } return Infinity; };
    if (Math.min(dip(-1), dip(1)) >= prominence) tops++;
  }
  // 10. Value: foliage luminance percentiles and the top-down light sign.
  const lum: number[] = []; let topDown = 0, td = 0; const dy = Math.max(2, Math.round(H * .015));
  for (let y = y0; y < y0 + crownBase; y++) for (let x = x0; x <= x1; x++) {
    const i = (y * W + x) * 4; if (d[i + 3] < 200 || isBark(d, i)) continue; const l = luminance(d, i); lum.push(l);
    const j = ((y + dy) * W + x) * 4; if (y + dy < Hh && d[j + 3] >= 200 && !isBark(d, j)) { topDown += l - luminance(d, j); td++; }
  }
  lum.sort((a, b) => a - b);
  const q = (p: number) => lum.length ? lum[Math.min(lum.length - 1, Math.floor(p * lum.length))] : 0;
  // 12. Lighting: the brightest 35% of foliage counts as lit. Side bias is the
  // lit share left of the trunk axis over the lit share right of it. Coherence
  // is how much likelier a lit pixel's neighbours 3% of the height away are lit
  // than foliage is overall; random lit and shaded sprays score about 1.
  const litCut = q(.65), state = new Uint8Array(W * Hh), sides = [0, 0, 0, 0]; let lit = 0, leafy = 0;
  for (let y = y0; y < y0 + crownBase; y++) for (let x = x0; x <= x1; x++) {
    const i = (y * W + x) * 4; if (d[i + 3] < 200 || isBark(d, i)) continue;
    const on = luminance(d, i) >= litCut, k = x < axis ? 0 : 2; state[y * W + x] = on ? 2 : 1;
    sides[k]++; if (on) { sides[k + 1]++; lit++; } leafy++;
  }
  const reach = Math.max(1, Math.round(H * .03)); let same = 0, near = 0, sample = 0;
  for (let y = y0; y < y0 + crownBase; y++) for (let x = x0; x <= x1; x++) {
    if (state[y * W + x] !== 2 || sample++ % 7) continue;
    for (const [dx, dy2] of [[reach, 0], [-reach, 0], [0, reach], [0, -reach]]) {
      const nx = x + dx, ny = y + dy2; if (nx < 0 || ny < 0 || nx >= W || ny >= Hh) continue;
      const v = state[ny * W + nx]; if (!v) continue; near++; if (v === 2) same++;
    }
  }
  const lightSide = (sides[1] / Math.max(1, sides[0])) / Math.max(1e-6, sides[3] / Math.max(1, sides[2]));
  const lightCoherence = (same / Math.max(1, near)) / Math.max(1e-6, lit / Math.max(1, leafy));
  // 11. Enclosed holes: transparent space not connected to the canvas edge.
  const seen = new Uint8Array(W * Hh), stack: number[] = [], open = (i: number) => d[i * 4 + 3] < 40;
  for (let x = 0; x < W; x++) stack.push(x, (Hh - 1) * W + x);
  for (let y = 0; y < Hh; y++) stack.push(y * W, y * W + W - 1);
  while (stack.length) { const i = stack.pop()!; if (seen[i] || !open(i)) continue; seen[i] = 1; const x = i % W;
    if (x > 0) stack.push(i - 1); if (x < W - 1) stack.push(i + 1); if (i >= W) stack.push(i - W); if (i < W * (Hh - 1)) stack.push(i + W); }
  let hole = 0;
  for (let i = 0; i < W * Hh; i++) if (open(i) && !seen[i]) { let area = 0; stack.push(i); seen[i] = 1;
    while (stack.length) { const j = stack.pop()!; area++; const x = j % W; for (const k of [x > 0 ? j - 1 : -1, x < W - 1 ? j + 1 : -1, j - W, j + W]) if (k >= 0 && k < W * Hh && !seen[k] && open(k)) { seen[k] = 1; stack.push(k); } }
    hole = Math.max(hole, area); }
  let edge = 0, clip = ''; const mark = (a: number, side: string) => { if (a > edge) { edge = a; clip = side; } };
  for (let x = 0; x < W; x++) { mark(d[x * 4 + 3], 'top'); mark(d[((Hh - 1) * W + x) * 4 + 3], 'bottom'); }
  for (let y = 0; y < Hh; y++) { mark(d[y * W * 4 + 3], 'left'); mark(d[(y * W + W - 1) * 4 + 3], 'right'); }
  return {
    aspect: Wd / H, visibleTrunk, widestAt: widest / Math.max(1, crownBase), mirror: diff / Math.max(1, union),
    flank: Math.min(flank(sl), flank(sr)), tierCV: Math.min(cv(lt), cv(rt)), tiers: [lt.length, rt.length] as const, tipRows: [lt.map(v => +(v / H).toFixed(3)), rt.map(v => +(v / H).toFixed(3))], stagger,
    trunkGap: gap / H, apexOffset, tops, valueRatio: q(.9) / Math.max(1, q(.1)), topDown: topDown / Math.max(1, td), lightSide, lightCoherence,
    hole: hole / Math.max(1, Wd * H), edgeAlpha: edge, clip,
  };
}

/** Every PINE_RULES violation for a bake and its plan, as readable strings. */
export function pineViolations(raster: BushRaster, plan?: PinePlan) {
  const r = PINE_RULES, m = pineSilhouette(raster), out: string[] = [];
  if (m.mirror < r.minMirrorMismatch) out.push(`1 symmetric: mirror ${m.mirror.toFixed(3)}`);
  if (m.flank < r.minFlankDeviation) out.push(`2 straight flank: ${m.flank.toFixed(3)}`);
  if (m.tierCV < r.minTierSpacingCV) out.push(`3 even tiers: cv ${m.tierCV.toFixed(2)}`);
  if (m.stagger < r.minTierStagger) out.push(`4 mirrored tiers: ${m.stagger.toFixed(3)}`);
  if (m.trunkGap > r.maxTrunkColumnGap) out.push(`6 floating crown: gap ${m.trunkGap.toFixed(3)}`);
  if (m.apexOffset > r.maxApexOffset) out.push(`7 leaning: ${m.apexOffset.toFixed(3)}`);
  if (m.tops !== 1) out.push(`7 tops: ${m.tops}`);
  if (m.aspect < r.aspect[0] || m.aspect > r.aspect[1]) out.push(`9 aspect ${m.aspect.toFixed(2)}`);
  if (m.visibleTrunk < r.visibleTrunk[0] || m.visibleTrunk > r.visibleTrunk[1]) out.push(`9 trunk ${m.visibleTrunk.toFixed(3)}`);
  if (m.widestAt < 1 - r.widestWithin) out.push(`9 widest at ${m.widestAt.toFixed(2)}`);
  if (m.valueRatio < r.minValueRatio) out.push(`10 flat value ${m.valueRatio.toFixed(2)}`);
  if (m.topDown < r.minTopDownLight) out.push(`10 lit undersides ${m.topDown.toFixed(2)}`);
  if (m.lightCoherence < r.minLightCoherence) out.push(`12 incoherent light: ${m.lightCoherence.toFixed(2)}`);
  if (m.lightSide < r.lightSide[0] || m.lightSide > r.lightSide[1]) out.push(`12 light side: ${m.lightSide.toFixed(2)}`);
  if (m.hole > r.maxEnclosedHole) out.push(`11 hole ${m.hole.toFixed(4)}`);
  if (m.edgeAlpha > 0) out.push(`11 clipped ${m.clip}`);
  if (plan) {
    const g = pineGeometry(plan);
    if (g.droop < r.minBranchDroop) out.push(`5 flat shelf: droop ${g.droop.toFixed(3)}`);
    if (g.trunkEdge < r.minTrunkEdgeDeviation) out.push(`8 ruled trunk: ${g.trunkEdge.toFixed(4)}`);
    if (g.flare > r.maxBaseFlare) out.push(`8 bulb foot: ${g.flare.toFixed(2)}`);
  }
  return out;
}

