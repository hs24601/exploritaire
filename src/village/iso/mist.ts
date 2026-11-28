// Drifting ground mist for the isometric map, after the ?tree basin's low mist
// (src/book/basinMist.ts): soft pockets that hug the land a little above it,
// ride a slow wind across the grid, thicken and thin under two crossing
// travelling waves (so banks form, roll through and break up), pool in low
// ground, thin on high ground, burn off near lights and part around Hero.
//
// Two layers: wide, faint fog banks and smaller, denser wisps. Everything is a
// pure function of world position and time, so pockets are found by lattice
// cell for just the visible range, with nothing stored between frames.
import { heightAt, valueNoise } from '../rules/terrain';

export interface MistLayer {
  /** Lattice spacing, in tiles. */
  cell: number;
  /** Pocket radius range, in tiles. */
  size: [number, number];
  /** Peak opacity. */
  alpha: number;
  /** Height above the land, in world units. */
  lift: [number, number];
  /** Wind, in tiles per second (grid x east, y south). */
  wind: [number, number];
  seed: number;
}

export const MIST_LAYERS: readonly MistLayer[] = [
  { cell: 5.5, size: [3.2, 4.8], alpha: 0.5, lift: [0.1, 0.35], wind: [0.08, -0.04], seed: 11 },
  { cell: 2.3, size: [1.1, 1.9], alpha: 0.75, lift: [0.15, 0.6], wind: [0.16, -0.07], seed: 29 },
];

export interface MistPocket { x: number; y: number; z: number; r: number; a: number; layer: number; key: number }

/** How much mist the hour carries, 0–1. Mornings are thickest, midday thinnest. */
export function mistForPhase(phase: string): number {
  return phase === 'Dawn' ? 1 : phase === 'Day' ? 0.4 : phase === 'Golden hour' ? 0.6 : phase === 'Dusk' ? 0.85 : 0.75;
}

/** Thickness of the rolling banks at a point and time: two crossing travelling waves, as in ?tree. */
export function mistDensity(x: number, y: number, t: number): number {
  const first = 0.5 + 0.5 * Math.sin(x * 0.21 + Math.sin(y * 0.16 + t * 0.06) * 1.4 + t * 0.05);
  const second = 0.5 + 0.5 * Math.cos(y * 0.27 - x * 0.11 - t * 0.07);
  return 0.15 + 0.85 * first * (0.4 + 0.6 * second);
}

interface Clearing { x: number; y: number; radius: number }

/**
 * Pockets whose centres fall in [x0, x1) × [y0, y1) at time t (seconds).
 * `amount` scales everything (the hour); `clear` lists places the mist parts around.
 */
export function mistPockets(x0: number, y0: number, x1: number, y1: number, t: number, amount: number, clear: readonly Clearing[]): MistPocket[] {
  const out: MistPocket[] = [];
  if (amount <= 0.01) return out;
  MIST_LAYERS.forEach((L, layer) => {
    const sx = L.wind[0] * t, sy = L.wind[1] * t;
    // Lattice cells in wind-carried space: a pocket rides the wind and its cell's successor takes its place.
    const c0 = Math.floor((x0 - sx) / L.cell) - 1, c1 = Math.ceil((x1 - sx) / L.cell) + 1;
    const r0 = Math.floor((y0 - sy) / L.cell) - 1, r1 = Math.ceil((y1 - sy) / L.cell) + 1;
    for (let r = r0; r <= r1; r++) for (let c = c0; c <= c1; c++) {
      const j1 = valueNoise(c * 7.13 + 0.5, r * 3.71 + 0.5, L.seed), j2 = valueNoise(c * 2.17 + 0.5, r * 9.07 + 0.5, L.seed + 1);
      const wobble = j1 * 6.28;
      const x = (c + 0.15 + j1 * 0.7) * L.cell + sx + Math.sin(t * 0.09 + wobble) * L.cell * 0.12;
      const y = (r + 0.15 + j2 * 0.7) * L.cell + sy + Math.cos(t * 0.07 + wobble) * L.cell * 0.1;
      if (x < x0 || x >= x1 || y < y0 || y >= y1) continue;
      const h = heightAt(x, y);
      // Pools in hollows and over the lake, thins up the hills, gone on the peaks.
      const ground = Math.max(0, Math.min(1.25, 1.05 - h * 0.28));
      let a = L.alpha * amount * ground * mistDensity(x, y, t);
      for (const k of clear) {
        const d = Math.hypot(x - k.x, y - k.y);
        if (d < k.radius) a *= 0.15 + 0.85 * (d / k.radius) ** 2;
      }
      if (a < 0.015) continue;
      const lift = L.lift[0] + (L.lift[1] - L.lift[0]) * (0.5 + 0.5 * Math.sin(t * 0.11 + wobble));
      out.push({ x, y, z: lift, r: L.size[0] + (L.size[1] - L.size[0]) * j2, a, layer, key: (c * 73856093) ^ (r * 19349663) ^ layer });
    }
  });
  return out;
}

const spriteCache = new Map<string, HTMLCanvasElement>();
/**
 * One soft, uneven mist puff in a given tint: overlapping feathered dabs with a
 * little grain, so pockets read as painted vapour rather than smooth discs.
 */
export function mistSprite(tint: string, variant: number): HTMLCanvasElement {
  const key = `${tint}:${variant}`;
  const hit = spriteCache.get(key);
  if (hit) return hit;
  const S = 128, c = document.createElement('canvas');
  c.width = S; c.height = S;
  const ctx = c.getContext('2d')!;
  let seed = 977 + variant * 131;
  const rnd = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
  for (let k = 0; k < 9; k++) {
    const ang = rnd() * Math.PI * 2, d = rnd() * S * 0.2;
    const cx = S / 2 + Math.cos(ang) * d, cy = S / 2 + Math.sin(ang) * d * 0.8, r = S * (0.2 + rnd() * 0.18);
    const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
    g.addColorStop(0, tint); g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.globalAlpha = 0.35 + rnd() * 0.3;
    ctx.fillStyle = g; ctx.fillRect(0, 0, S, S);
  }
  // Feather the whole puff so no dab edge survives.
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = 'destination-in';
  const fade = ctx.createRadialGradient(S / 2, S / 2, S * 0.18, S / 2, S / 2, S / 2);
  fade.addColorStop(0, '#000'); fade.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = fade; ctx.fillRect(0, 0, S, S);
  spriteCache.set(key, c);
  if (spriteCache.size > 24) spriteCache.delete(spriteCache.keys().next().value!);
  return c;
}
