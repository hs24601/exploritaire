// Village light field: how much light reaches each square of the grid, 0–100%,
// built on the table light engine (src/proto/protoLighting.ts: falloff, screen-
// combined sources, dim/lit/bright levels). Two jobs, kept apart:
//
// 1. Ambiance: the sun follows the village's own daylight clock (dawn when the
//    day starts, dusk when daylight runs out), so a fresh day opens in low gold
//    light, noon is clear, dusk goes violet and night is moonlit blue. High ground
//    catches first and last light; hollows pool shade.
// 2. Fog of war: squares become known when a light source reaches them at "dim" or
//    better (the sapling, Hero's party, campfires, lanterns...). Known squares stay
//    on the map as memory; unknown ones stay under painted mist.
//
// Visual knowledge only: gameplay keeps reading map.ts (fogged() until Village rank)
// and never depends on how lit something looks.
import { AMBIENT_FLOOR, LIGHT_CELL_SIZE, LIGHT_LEVEL_THRESHOLDS, lightFalloff, lightLevelFor, type LightLevel, type Rgb } from '../../proto/protoLighting';
import type { GameState } from './game';
import { FOG, MAP_COLS, MAP_ROWS, SAPLING, fogged, inRect, onVillageGrid, tileAt, tileIndex } from './map';
import { tileHeight, smoothstep } from './terrain';
import { dayLength } from './village';

export interface VillageLight {
  id: string;
  /** Grid position in tile units (tile centre = x + 0.5). */
  x: number;
  y: number;
  /** Reach in tiles. */
  radius: number;
  /** Peak contribution, 0–1. */
  strength: number;
  color: string;
  /** Visual flicker only. */
  flicker?: boolean;
}

export interface Ambient {
  /** 0 at dawn, 1 at dusk (clamped). */
  progress: number;
  /** Sun height, 0–1. 0 at night. */
  sun: number;
  /** How golden the hour is, 0–1. */
  twilight: number;
  night: boolean;
  phase: 'Dawn' | 'Day' | 'Golden hour' | 'Dusk' | 'Night';
  /** Ambient light on flat open ground, 0–1, before local lights. */
  ambient: number;
  /** Colour the dark takes on (shadow tint). */
  shade: Rgb;
  /** Colour of the sunlight itself (for the grade wash). */
  sunColor: Rgb;
  /** Sun direction across the map, unit vector in grid space (x east, y south). */
  sunDir: { x: number; y: number };
}

const mix = (a: number, b: number, t: number) => a + (b - a) * t;
const mixRgb = (a: Rgb, b: Rgb, t: number): Rgb => ({ r: Math.round(mix(a.r, b.r, t)), g: Math.round(mix(a.g, b.g, t)), b: Math.round(mix(a.b, b.b, t)) });

const NIGHT_SHADE: Rgb = { r: 10, g: 20, b: 48 };
const DUSK_SHADE: Rgb = { r: 40, g: 20, b: 46 };
const DAWN_SHADE: Rgb = { r: 30, g: 28, b: 52 };
const DAY_SHADE: Rgb = { r: 16, g: 22, b: 26 };
const NOON_SUN: Rgb = { r: 255, g: 246, b: 222 };
const LOW_SUN: Rgb = { r: 255, g: 168, b: 88 };
const DUSK_SUN: Rgb = { r: 236, g: 128, b: 150 };
const MOON: Rgb = { r: 150, g: 176, b: 230 };

/** Dawn and dusk floors: the first and last light are low but always readable. */
export const DAWN_AMBIENT = 0.48;
export const NOON_AMBIENT = 0.96;

/** Ambient light for daylight spent so far (the village clock), or night. */
export function ambientAt(minutes: number, dayMinutes: number, night: boolean): Ambient {
  const progress = Math.max(0, Math.min(1, minutes / Math.max(1, dayMinutes)));
  if (night || minutes >= dayMinutes) {
    return { progress: 1, sun: 0, twilight: 0, night: true, phase: 'Night', ambient: AMBIENT_FLOOR,
      shade: NIGHT_SHADE, sunColor: MOON, sunDir: { x: 0.2, y: 0.98 } };
  }
  const arc = Math.sin(progress * Math.PI);
  const sun = arc;
  // Golden at both ends, clear by mid-morning.
  const twilight = Math.max(0, 1 - arc / 0.6);
  const evening = progress > 0.5;
  const ambient = mix(DAWN_AMBIENT, NOON_AMBIENT, Math.pow(arc, 0.65));
  const lowShade = evening ? DUSK_SHADE : DAWN_SHADE;
  const lowSun = evening ? mixRgb(LOW_SUN, DUSK_SUN, smoothstep(0.82, 1, progress)) : LOW_SUN;
  const phase = progress < 0.12 ? 'Dawn' : progress > 0.9 ? 'Dusk' : twilight > 0.25 ? 'Golden hour' : 'Day';
  // Sun travels east → south → west; light falls from the sun toward the map.
  const az = Math.PI * progress; // 0 east, π/2 south, π west
  return { progress, sun, twilight, night: false, phase, ambient,
    shade: mixRgb(DAY_SHADE, lowShade, twilight), sunColor: mixRgb(NOON_SUN, lowSun, twilight),
    sunDir: { x: Math.cos(az), y: Math.sin(az) } };
}

export function ambientFor(game: GameState): Ambient {
  return ambientAt(game.minutes, dayLength(game.village), !!game.night);
}

const centre = (i: number) => { const t = tileAt(i); return { x: t.x + 0.5, y: t.y + 0.5 }; };

/** Every light source on the map right now. */
export function villageLights(game: GameState): VillageLight[] {
  const lights: VillageLight[] = [
    { id: 'sapling', x: SAPLING.x + 0.5, y: SAPLING.y + 0.5, radius: 2.4, strength: 0.78, color: '#e8f59a' },
  ];
  for (const party of game.parties) {
    const p = centre(party.tile);
    const hero = party.members.includes('hero');
    // Hero carries the brightest light; more company, a little more reach.
    lights.push({ id: `party-${party.tile}`, ...p, radius: (hero ? 2.4 : 1.7) + 0.15 * (party.members.length - 1),
      strength: hero ? 0.72 : 0.5, color: '#ffc27a', flicker: true });
  }
  game.village.plots.forEach((b, i) => {
    if (b === 'campfire') lights.push({ id: `campfire-${i}`, ...centre(i), radius: 2.5, strength: 0.9, color: '#ff9446', flicker: true });
    else if (b === 'lantern') lights.push({ id: `lantern-${i}`, ...centre(i), radius: 3.1, strength: 0.86, color: '#ffd27a' });
    else if (b === 'stall') lights.push({ id: `stall-${i}`, ...centre(i), radius: 0.9, strength: 0.4, color: '#ffb36b' });
  });
  if (game.den && !game.den.dig) lights.push({ id: 'den', ...centre(game.den.tile), radius: 1.1, strength: 0.5, color: '#ffb35c', flicker: true });
  // The berry patch keeps the faint blue glow it has in Proto's biome lights.
  if (game.rankReached >= 1) lights.push({ id: 'berries', x: 6.5, y: 1.5, radius: 0.95, strength: 0.32, color: '#9cdeff' });
  return lights;
}

/** One light's steady contribution at a grid point. */
export const contribution = (l: VillageLight, x: number, y: number) =>
  l.strength * lightFalloff(Math.hypot(x - l.x, y - l.y) * LIGHT_CELL_SIZE, l.radius);

/** Combined local light at a point (screen-combined, never above 1). */
export function localLight(lights: readonly VillageLight[], x: number, y: number): number {
  let unlit = 1;
  for (const l of lights) {
    if (Math.abs(x - l.x) > l.radius || Math.abs(y - l.y) > l.radius) continue;
    unlit *= 1 - Math.min(1, contribution(l, x, y));
  }
  return 1 - unlit;
}

/** Ambient adjusted for the land: peaks hold the low sun, hollows pool shade. */
export function terrainAmbient(a: Ambient, height: number): number {
  if (a.night) return a.ambient + Math.max(0, height) * 0.006;
  const lift = smoothstep(0.5, 6, height) * a.twilight * 0.22;
  const hollow = smoothstep(-0.2, -2, height) * (0.08 + a.twilight * 0.1);
  return Math.max(AMBIENT_FLOOR, Math.min(1, a.ambient + lift - hollow));
}

export interface TileLight { percent: number; level: LightLevel; ambient: number; local: number; total: number }

/** Light on one square (its centre), as the engine's 0–100% and level. */
export function tileLight(game: GameState, x: number, y: number, lights = villageLights(game), a = ambientFor(game)): TileLight {
  const ambient = terrainAmbient(a, tileHeight(x, y));
  const local = localLight(lights, x + 0.5, y + 0.5);
  const total = Math.min(1, 1 - (1 - ambient) * (1 - local));
  return { percent: Math.round(total * 100), level: lightLevelFor(total), ambient, local, total };
}

/** Squares known from the start: the clearing, minus land under the rank fog. */
export function startingKnown(rankReached: number): number[] {
  const out: number[] = [];
  for (let y = 0; y < MAP_ROWS; y++) for (let x = 0; x < MAP_COLS; x++) if (!fogged(x, y, rankReached)) out.push(tileIndex(x, y));
  return out;
}

/**
 * Squares a light reveals: any square whose centre gets at least "dim" local light.
 * Land under the rank fog stays hidden until the rank lifts it.
 */
export function revealedBy(lights: readonly VillageLight[], rankReached: number): number[] {
  const out: number[] = [];
  for (const l of lights) {
    const r = Math.ceil(l.radius);
    const cx = Math.floor(l.x), cy = Math.floor(l.y);
    for (let y = cy - r; y <= cy + r; y++) for (let x = cx - r; x <= cx + r; x++) {
      if (!onVillageGrid(x, y) || fogged(x, y, rankReached)) continue;
      if (contribution(l, x + 0.5, y + 0.5) >= LIGHT_LEVEL_THRESHOLDS.dim) out.push(tileIndex(x, y));
    }
  }
  return out;
}

/** Union of what's already known with what the current lights reveal. */
export function knownTiles(previous: Iterable<number>, game: GameState, lights = villageLights(game)): Set<number> {
  const known = new Set<number>();
  for (const i of previous) {
    const t = tileAt(i);
    if (!(inRect(FOG, t.x, t.y) && fogged(t.x, t.y, game.rankReached))) known.add(i);
  }
  for (const i of startingKnown(game.rankReached)) known.add(i);
  for (const i of revealedBy(lights, game.rankReached)) known.add(i);
  return known;
}
