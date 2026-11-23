/** Pure sky geometry for the stellar grid: chains become constellations.
 *
 * The live chain is charted like a melody: each star steps right, and its
 * height is the card's rank (A low, K high), so a rising run draws a rising
 * line and the sound (pitch = rank) matches the shape. When the chain breaks
 * the figure is named by length and settles into a free patch of sky. */
export type SkyPoint = { x: number; y: number };
export type Rect = { x: number; y: number; w: number; h: number };

const hash = (n: number) => { let h = Math.imul(n ^ 0x9e3779b9, 0x85ebca6b); h ^= h >>> 13; h = Math.imul(h, 0xc2b2ae35); h ^= h >>> 16; return (h >>> 0) / 4294967296; };

/** Star positions for a chain of ranks, in a 0–1 chart box. Short chains sit centred. */
export function chartPoints(ranks: readonly number[], seed = 0): SkyPoint[] {
  const n = ranks.length; if (!n) return [];
  const step = n > 1 ? Math.min(1 / 6, 1 / (n - 1)) : 0, start = (1 - step * (n - 1)) / 2;
  return ranks.map((rank, i) => ({
    x: Math.min(1, Math.max(0, start + i * step + (hash(seed * 31 + i) - 0.5) * step * 0.35)),
    y: Math.min(1, Math.max(0, 1 - (rank - 1) / 12 + (hash(seed * 17 + i + 101) - 0.5) * 0.08)),
  }));
}

const NAMES = {
  small: ['The Spark', 'The Seed', 'The Ember', 'The Twins', 'The Lamp', 'The Pebble'],
  mid: ['The Heron', 'The Lantern', 'The Fox', 'The Hare', 'The Kite', 'The Lyre', 'The Owl'],
  large: ['The Crane', 'The Stag', 'The Great Bear', 'The Ship', 'The Archer', 'The Whale'],
  grand: ['The Serpent', 'The Wanderer', 'The World Tree', 'The Leviathan', 'The Phoenix'],
} as const;

/** Name by the number of cards played in the chain; `index` counts figures of that size so far. */
export function constellationName(plays: number, index: number) {
  const list = plays >= 8 ? NAMES.grand : plays >= 5 ? NAMES.large : plays >= 3 ? NAMES.mid : NAMES.small;
  const name = list[index % list.length], round = Math.floor(index / list.length);
  return round ? `${name} ${['II', 'III', 'IV', 'V'][Math.min(3, round - 1)]}` : name;
}
export const sizeClass = (plays: number) => plays >= 8 ? 'grand' : plays >= 5 ? 'large' : plays >= 3 ? 'mid' : 'small';

const inside = (p: SkyPoint, r: Rect, pad: number) => p.x > r.x - pad && p.x < r.x + r.w + pad && p.y > r.y - pad && p.y < r.y + r.h + pad;

/** Choose a resting place (viewport 0–1) clear of the UI and far from earlier figures.
 * `half` is the settled figure's half-size. Returns null when the sky has no room. */
export function pickHome(homes: readonly SkyPoint[], reserved: readonly Rect[], half: SkyPoint, aspect: number, seed = 0): SkyPoint | null {
  let best: SkyPoint | null = null, bestScore = -Infinity;
  for (let gy = 0; gy < 9; gy++) for (let gx = 0; gx < 13; gx++) {
    const p = { x: 0.04 + gx / 12 * 0.92 + (hash(seed + gx * 13 + gy) - 0.5) * 0.02, y: 0.06 + gy / 8 * 0.88 };
    if (p.x - half.x < 0.01 || p.x + half.x > 0.99 || p.y - half.y < 0.01 || p.y + half.y > 0.99) continue;
    const corners = [{ x: p.x - half.x, y: p.y - half.y }, { x: p.x + half.x, y: p.y - half.y }, { x: p.x - half.x, y: p.y + half.y }, { x: p.x + half.x, y: p.y + half.y }, p];
    if (reserved.some(r => corners.some(c => inside(c, r, 0.005)))) continue;
    const spacing = homes.length ? Math.min(...homes.map(h => Math.hypot((h.x - p.x) * aspect, h.y - p.y))) : 1;
    const score = spacing + hash(seed * 7 + gx + gy * 13) * 0.01;
    if (score > bestScore) { bestScore = score; best = p; }
  }
  return best;
}
