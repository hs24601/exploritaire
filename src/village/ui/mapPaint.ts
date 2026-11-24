// Painted map ground for the village, using the same method as the portals.html?tree
// grove floor (src/book/worldTreeGroundCover.ts): a soil base, then the shared
// radial-dab watercolour wash (src/proto/radialDabs, ART.md's default for procedural
// ground) stamped as many rotated, low-contrast islands, plus loose painted grass
// blades and leaf/stone flecks. Features get denser washes in their own pigment
// with soft, ragged edges that bleed past the footprint. Baked once per size and
// rank, then reused: nothing is redrawn per frame.
import { paintCanvas, DEFAULT_PAINT } from '../../proto/watercolorPaint';
import type { WashPalette } from '../../proto/watercolorWash';
import { FEATURES, FOG, GATE, MAP_COLS, MAP_ROWS, type Rect } from '../rules/map';

const ART = '/assets/runtime/environment/watercolor/v1';
/** Interim feature art: existing approved watercolour overheads, until the authored village set lands. */
const FEATURE_ART = {
  forest: `${ART}/woods-overhead-v1.png`,
  berries: `${ART}/berry-patch-overhead-v2.png`,
  quarry: `${ART}/stone-spill-v1.png`,
} as const;

function rng(seed: number) {
  let s = seed >>> 0 || 1;
  return () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; };
}

const images = new Map<string, HTMLImageElement>();
let loading: Promise<void> | null = null;
/** Resolves when the interim feature paintings are decoded (or failed: the washes stand alone). */
export function loadMapArt(): Promise<void> {
  loading ??= Promise.all(Object.values(FEATURE_ART).map(src => new Promise<void>(done => {
    const img = new Image();
    img.onload = () => { images.set(src, img); done(); };
    img.onerror = () => done();
    img.src = src;
  }))).then(() => undefined);
  return loading;
}

/** One wash stamp: the shared dab canvas, rotated and stretched like the grove's ground islands. */
function stamp(ctx: CanvasRenderingContext2D, palette: WashPalette, variation: number, x: number, y: number, w: number, h: number, angle: number, alpha = 1) {
  const wash = paintCanvas(palette, DEFAULT_PAINT, variation % 6);
  if (!wash) return;
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.translate(x, y);
  ctx.rotate(angle);
  ctx.drawImage(wash, -w / 2, -h / 2, w, h);
  ctx.restore();
}

/** Grass blades as in the grove's painted grass cards, much smaller. */
function tuft(ctx: CanvasRenderingContext2D, x: number, y: number, size: number, random: () => number) {
  const colors = ['#526448b0', '#798052a0', '#384e3fb0', '#8b865879'];
  for (let i = 0; i < 5; i++) {
    const bx = x + (random() - 0.5) * size * 0.5, tip = bx + (random() - 0.5) * size * 0.8, top = y - size * (0.45 + random() * 0.5);
    ctx.fillStyle = colors[i % 4];
    ctx.beginPath();
    ctx.moveTo(bx - size * 0.03, y);
    ctx.quadraticCurveTo(bx - size * 0.08, top + size * 0.2, tip, top);
    ctx.quadraticCurveTo(bx + size * 0.05, top + size * 0.3, bx + size * 0.04, y);
    ctx.closePath();
    ctx.fill();
  }
}

/** Fill a footprint with a soft, ragged pigment mass that bleeds past its edge. */
function featureWash(ctx: CanvasRenderingContext2D, r: Rect, t: number, palette: WashPalette, seed: number, density: number, alpha: number) {
  const random = rng(seed);
  const n = Math.round(r.w * r.h * density);
  for (let i = 0; i < n; i++) {
    const x = (r.x + 0.1 + random() * (r.w - 0.2)) * t, y = (r.y + 0.1 + random() * (r.h - 0.2)) * t;
    const s = t * (0.9 + random() * 1.1);
    stamp(ctx, palette, seed + i, x, y, s * (1 + random() * 0.6), s, random() * Math.PI * 2, alpha);
  }
}

function drawFeatureArt(ctx: CanvasRenderingContext2D, id: keyof typeof FEATURE_ART, r: Rect, t: number) {
  const img = images.get(FEATURE_ART[id]);
  if (!img) return;
  const bleed = 0.12;
  const x = (r.x - r.w * bleed / 2) * t, y = (r.y - r.h * bleed / 2) * t, w = r.w * (1 + bleed) * t, h = r.h * (1 + bleed) * t;
  ctx.save();
  if (id === 'forest') {
    ctx.globalAlpha = 0.96;
    ctx.drawImage(img, x, y, w, h);
  } else if (id === 'berries') {
    ctx.globalAlpha = 0.95;
    const inset = 0.1 * t;
    ctx.drawImage(img, x + inset, y + inset, w - inset * 2, h - inset * 2);
  } else {
    // Quarry: three loose stone piles across the pit, rotated so they don't repeat.
    const random = rng(4242);
    for (let i = 0; i < 3; i++) {
      const s = t * (0.95 + random() * 0.35);
      ctx.save();
      ctx.translate((r.x + 0.55 + (i % 2) * 0.9 + random() * 0.2) * t, (r.y + 0.6 + Math.floor(i / 2) * 0.85 + random() * 0.15) * t);
      ctx.rotate((random() - 0.5) * 1.2);
      ctx.globalAlpha = 0.92;
      ctx.drawImage(img, -s / 2, -s / 2, s, s);
      ctx.restore();
    }
  }
  ctx.restore();
}

const groundCache = new Map<string, HTMLCanvasElement>();
const fogCache = new Map<string, HTMLCanvasElement>();

/** The painted ground for the whole grid at `t` pixels per tile. */
export function bakeGround(t: number): HTMLCanvasElement {
  const key = `${t}:${images.size}`;
  const hit = groundCache.get(key);
  if (hit) return hit;
  const W = MAP_COLS * t, H = MAP_ROWS * t;
  const canvas = document.createElement('canvas');
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext('2d')!;
  const random = rng(20261124);

  // Soil base, as under the grove.
  ctx.fillStyle = '#5e6b4c';
  ctx.fillRect(0, 0, W, H);
  // Broad low-contrast islands of the shared woodland wash, then a smaller mottled pass.
  for (let i = 0; i < MAP_COLS * MAP_ROWS * 4; i++) {
    const s = t * (0.9 + random() * 1.6);
    stamp(ctx, 'woodland', i, random() * W, random() * H, s * (1 + random() * 0.8), s, random() * Math.PI * 2, 0.85);
  }
  for (let i = 0; i < MAP_COLS * MAP_ROWS * 7; i++) {
    const s = t * (0.3 + random() * 0.55);
    stamp(ctx, i % 4 ? 'woodland' : 'water', 50 + i, random() * W, random() * H, s * (1 + random()), s, random() * Math.PI * 2, i % 4 ? 0.8 : 0.35);
  }
  // A worn clearing where the village grows, and a track in from the gate.
  for (let i = 0; i < 16; i++) {
    const x = (1.6 + random() * 3.8) * t, y = (2.6 + random() * 2.6) * t, s = t * (0.7 + random() * 0.8);
    stamp(ctx, 'dirt', 100 + i, x, y, s * 1.3, s, random() * Math.PI, 0.32);
  }
  for (let k = 0; k <= 12; k++) {
    const f = k / 12, x = (GATE.x + 0.15 + f * 2.8) * t, y = (GATE.y + 0.55 - f * 1.1 + Math.sin(f * 5) * 0.12) * t;
    stamp(ctx, 'dirt', 200 + k, x, y, t * 0.75, t * 0.42, random() * 0.6, 0.5);
  }
  // Feature washes under the paintings.
  featureWash(ctx, FEATURES.forest.rect, t, 'woodland', 301, 5, 1);
  featureWash(ctx, FEATURES.forest.rect, t, 'wine', 302, 1.2, 0.35);
  featureWash(ctx, FEATURES.berries.rect, t, 'woodland', 311, 3, 0.9);
  featureWash(ctx, FEATURES.berries.rect, t, 'wine', 312, 1.2, 0.5);
  featureWash(ctx, FEATURES.quarry.rect, t, 'slate', 321, 5, 1);
  featureWash(ctx, FEATURES.quarry.rect, t, 'dirt', 322, 1.5, 0.45);
  for (const id of ['forest', 'berries', 'quarry'] as const) drawFeatureArt(ctx, id, FEATURES[id].rect, t);
  // Grass and litter on the open meadow only.
  const open = (x: number, y: number) => !Object.values(FEATURES).some(f => x > f.rect.x - 0.1 && x < f.rect.x + f.rect.w + 0.1 && y > f.rect.y - 0.1 && y < f.rect.y + f.rect.h + 0.1);
  for (let i = 0; i < MAP_COLS * MAP_ROWS * 1.5; i++) {
    const gx = random() * MAP_COLS, gy = random() * MAP_ROWS;
    if (!open(gx, gy)) continue;
    tuft(ctx, gx * t, gy * t, t * (0.1 + random() * 0.1), random);
  }
  const flecks = ['#8b805775', '#55674488', '#78796388', '#63513d88'];
  for (let i = 0; i < MAP_COLS * MAP_ROWS * 3; i++) {
    const gx = random() * MAP_COLS, gy = random() * MAP_ROWS;
    if (!open(gx, gy)) continue;
    ctx.fillStyle = flecks[i % 4];
    ctx.beginPath();
    ctx.ellipse(gx * t, gy * t, t * (0.012 + random() * 0.03), t * (0.006 + random() * 0.015), random() * 6, 0, Math.PI * 2);
    ctx.fill();
  }
  // Paper light: a faint lift in the middle, a soft fall-off at the map's edge.
  const v = ctx.createRadialGradient(W * 0.42, H * 0.55, Math.min(W, H) * 0.2, W * 0.5, H * 0.5, Math.max(W, H) * 0.72);
  v.addColorStop(0, 'rgba(255,244,214,0.10)');
  v.addColorStop(1, 'rgba(14,20,16,0.28)');
  ctx.fillStyle = v;
  ctx.fillRect(0, 0, W, H);

  groundCache.set(key, canvas);
  if (groundCache.size > 6) groundCache.delete(groundCache.keys().next().value!);
  return canvas;
}

/** Painted mist over land that isn't revealed yet: pale dabs, feathered at the inner edge. */
export function bakeFog(t: number): HTMLCanvasElement {
  const hit = fogCache.get(String(t));
  if (hit) return hit;
  const W = MAP_COLS * t, H = MAP_ROWS * t;
  const canvas = document.createElement('canvas');
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext('2d')!;
  const random = rng(777);
  const r = FOG;
  // A cool, broken mist: many soft dabs of uneven weight, denser toward the map's corner.
  for (let i = 0; i < 160; i++) {
    const x = (r.x - 0.2 + random() * (r.w + 0.4)) * t, y = (r.y - 0.2 + random() * (r.h + 0.4)) * t;
    const depth = Math.min(1, (x / t - r.x + y / t - r.y) / 2.5);
    const rad = t * (0.35 + random() * 0.75);
    const g = ctx.createRadialGradient(x, y, 0, x, y, rad);
    const tone = i % 4 === 0 ? '150,165,170' : i % 3 ? '205,214,212' : '180,192,194';
    const a = (0.1 + random() * 0.16) * (0.55 + depth * 0.6);
    g.addColorStop(0, `rgba(${tone},${a.toFixed(3)})`);
    g.addColorStop(1, `rgba(${tone},0)`);
    ctx.fillStyle = g;
    ctx.fillRect(x - rad, y - rad, rad * 2, rad * 2);
  }
  // Feather the inner edge over a full tile so the veil doesn't read as a box.
  ctx.globalCompositeOperation = 'destination-in';
  const fx = r.x * t, fy = r.y * t;
  const mask = ctx.createLinearGradient(fx - t * 0.35, 0, fx + t * 0.75, 0);
  mask.addColorStop(0, 'rgba(0,0,0,0)'); mask.addColorStop(1, 'rgba(0,0,0,1)');
  ctx.fillStyle = mask; ctx.fillRect(0, 0, W, H);
  const maskY = ctx.createLinearGradient(0, fy - t * 0.35, 0, fy + t * 0.75);
  maskY.addColorStop(0, 'rgba(0,0,0,0)'); maskY.addColorStop(1, 'rgba(0,0,0,1)');
  ctx.fillStyle = maskY; ctx.fillRect(0, 0, W, H);
  fogCache.set(String(t), canvas);
  return canvas;
}

/** Bake resolution: a few fixed steps, so resizing reuses a bake instead of repainting. */
export function bakeTile(displayTile: number, dpr: number): number {
  const want = displayTile * Math.min(2, dpr || 1);
  return want <= 72 ? 64 : want <= 112 ? 96 : want <= 160 ? 128 : 176;
}

const tokenCache = new Map<number, string>();
/** Painted disc behind a placeholder building token (dirt wash), as a data URL. */
export function tokenWash(variation: number): string {
  const hit = tokenCache.get(variation);
  if (hit) return hit;
  const c = document.createElement('canvas');
  c.width = c.height = 96;
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = '#b89b72';
  ctx.beginPath(); ctx.arc(48, 48, 44, 0, Math.PI * 2); ctx.fill();
  ctx.globalCompositeOperation = 'source-atop';
  stamp(ctx, 'dirt', variation, 48, 48, 130, 120, variation, 1);
  stamp(ctx, 'woodland', variation + 3, 40, 56, 90, 80, variation * 2, 0.5);
  const url = c.toDataURL();
  tokenCache.set(variation, url);
  return url;
}
