// Terrain for the isometric map, read from the one height field in rules/terrain.ts.
//
// Eric (2026-11-27): flat terrain gets painted shading; tiles are raised only
// where elevation matters for movement or occlusion. Here that means land from
// one terrain level up (berm crests, hills, the fell, the northern range) stands
// as columns in whole levels; meadow, slopes under a level and the lake stay on
// the ground plane and carry the height as colour and hillshade only.
import { HILL_FROM, MOUNTAIN_FROM, SNOW_FROM, WATER_BELOW, WORLD_BOUNDS, heightAt, slopeAt, tileHeight, valueNoise } from '../rules/terrain';
import { RAISE_FROM, TIER_STEP } from './projection';

/** Raised level of a tile: 0 on the ground plane, else whole terrain levels. */
export function isoTier(x: number, y: number): number {
  const h = tileHeight(x, y);
  return h < RAISE_FROM ? 0 : Math.floor(h);
}

/** Height of a tile's top face, in world units. */
export const isoTopZ = (x: number, y: number) => isoTier(x, y) * TIER_STEP;

export type Rgb = [number, number, number];

const MEADOW: Rgb = [112, 142, 78];
const MEADOW_DRY: Rgb = [140, 150, 84];
const EARTH: Rgb = [146, 118, 78];
const HILL: Rgb = [128, 132, 76];
const ROCK: Rgb = [118, 116, 112];
const SNOW: Rgb = [232, 234, 228];
const WATER: Rgb = [70, 116, 140];
const DEEP: Rgb = [46, 84, 112];

const lerp = (a: Rgb, b: Rgb, t: number): Rgb => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
const clamp01 = (v: number) => Math.max(0, Math.min(1, v));

/** Base colour of a tile's top before light. */
export function groundColor(x: number, y: number): Rgb {
  const h = tileHeight(x, y), slope = slopeAt(x, y);
  const grain = valueNoise(x * 0.7, y * 0.7, 31) - 0.5;
  if (h < WATER_BELOW) return lerp(WATER, DEEP, clamp01((WATER_BELOW - h) / 1.6));
  if (h >= SNOW_FROM) return SNOW;
  if (h >= MOUNTAIN_FROM) return lerp(ROCK, SNOW, clamp01((h - (SNOW_FROM - 1)) / 1.2));
  if (h >= HILL_FROM) return lerp(HILL, ROCK, clamp01((h - HILL_FROM) / (MOUNTAIN_FROM - HILL_FROM)) * 0.6);
  const worn = clamp01((slope - 0.25) * 1.6) * clamp01(h * 1.2);
  return lerp(lerp(MEADOW, MEADOW_DRY, clamp01(0.5 + grain)), EARTH, worn * 0.7);
}

/** Cliff face colour for a raised column. */
export function cliffColor(x: number, y: number): Rgb {
  const h = tileHeight(x, y);
  return h >= MOUNTAIN_FROM ? [96, 94, 92] : [118, 96, 66];
}

/**
 * Painted hillshade on the top face: the slope of the continuous height field
 * against the sun, so flat-drawn slopes still read as land. -1 (shade) .. 1 (lit).
 * sun: unit vector in grid space toward the sun; elevation in radians.
 */
export function hillshade(x: number, y: number, sun: { x: number; y: number }, elevation: number): number {
  const cx = x + 0.5, cy = y + 0.5, e = 0.4;
  const dx = (heightAt(cx + e, cy) - heightAt(cx - e, cy)) / (2 * e), dy = (heightAt(cx, cy + e) - heightAt(cx, cy - e)) / (2 * e);
  const k = 0.6, nx = -dx * k, ny = -dy * k, len = Math.hypot(nx, ny, 1);
  const lx = sun.x * Math.cos(elevation), ly = sun.y * Math.cos(elevation), lz = Math.sin(elevation);
  return Math.max(-1, Math.min(1, ((nx * lx + ny * ly + lz) / len - lz) * 2.2));
}

export const ISO_BOUNDS = WORLD_BOUNDS;
