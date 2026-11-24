// Whole-game reducer for village.html: day clock, active surface run, village.
import { DAYLIGHT } from './daylight';
import { draw, fall, play, runEnd, type Run, type Side } from './golf';
import { SURFACES, type SurfaceId } from './surfaces';
import { MAP_TILES, tileIndex } from './map';
import {
  BUILDINGS, DEEP_ROCK_YIELD, canAfford, dayLength, demolishBlocker, gain, hasResident, hasSiteBonus, newVillage, nightfall, pay,
  placeBlocker, rank, refundFor, welcome, welcomeBlocker,
  type BuildingId, type KinId, type NightReport, type RankId, type VillageState,
} from './village';

export type View = 'village' | SurfaceId;

export interface ActiveRun {
  surface: SurfaceId;
  location: 0 | 1;
  run: Run;
  /** Units from resident perks this run. */
  perkBonus: number;
  /** Units from buildings placed by a feature (Woodshed, Lantern) this run. */
  siteBonus: number;
  freeDrawUsed: boolean;
  minutes: number;
}

export interface GameState {
  version: 2;
  day: number;
  /** Daylight spent today, in minutes. */
  minutes: number;
  village: VillageState;
  mastery: Record<SurfaceId, number>;
  location: Record<SurfaceId, 0 | 1>;
  rankReached: RankId;
  active: ActiveRun | null;
  /** The last finished run, kept for the summary until the next one starts. */
  lastRun: ActiveRun | null;
  view: View;
  seed: number;
  night: NightReport | null;
}

export function newGame(seed = Date.now() % 100000): GameState {
  return {
    version: 2, day: 1, minutes: 0, village: newVillage(),
    mastery: { forest: 0, berries: 0, quarry: 0 },
    location: { forest: 0, berries: 0, quarry: 0 },
    rankReached: 1, active: null, lastRun: null, view: 'village', seed, night: null,
  };
}

export type Action =
  | { type: 'view'; view: View }
  /** Tap a feature on the map: no walking, the run deals at once (Eric, 2026-11-24). */
  | { type: 'open'; surface: SurfaceId }
  | { type: 'location'; surface: SurfaceId; location: 0 | 1 }
  | { type: 'start'; surface: SurfaceId }
  | { type: 'play'; pile: number }
  | { type: 'draw' }
  /** Birch Stand: choose which way a cleared birch falls. */
  | { type: 'fall'; side: Side }
  | { type: 'leave' }
  | { type: 'build'; building: BuildingId; tile: number }
  | { type: 'demolish'; tile: number }
  | { type: 'welcome'; kin: KinId }
  | { type: 'rest' }
  | { type: 'dawn' }
  | { type: 'reset' };

export const daylightLeft = (s: GameState) => Math.max(0, dayLength(s.village) - s.minutes);

export function surfaceUnlocked(s: GameState, id: SurfaceId): boolean {
  return id !== 'quarry' || s.rankReached >= 2;
}

export function drawCost(s: GameState): number {
  const a = s.active;
  if (a && a.surface === 'quarry' && !a.freeDrawUsed && hasResident(s.village, 'cir')) return 0;
  return DAYLIGHT.drawMinutes;
}

/** Total a run has paid so far, bonuses included. */
export const runTotal = (a: ActiveRun) => a.run.earned + a.perkBonus + (a.siteBonus ?? 0);

/** A run nobody has touched yet can be re-dealt (location change). */
const untouched = (a: ActiveRun) => a.run.receipts === 0 && a.run.draws === 0;

function deal(s: GameState, surface: SurfaceId): GameState {
  const location = s.location[surface];
  const run = SURFACES[surface].deal(s.seed, location);
  const started: GameState = { ...s, seed: s.seed + 1, view: surface, lastRun: null,
    active: { surface, location, run, perkBonus: 0, siteBonus: 0, freeDrawUsed: false, minutes: DAYLIGHT.startMinutes } };
  return DAYLIGHT.startMinutes ? spend(started, DAYLIGHT.startMinutes) : started;
}

function finishRun(s: GameState): GameState {
  return s.active ? { ...s, active: null, lastRun: s.active } : s;
}

function endDay(s: GameState): GameState {
  const done = finishRun(s);
  const { village, report } = nightfall(done.village);
  return { ...done, village, night: report, rankReached: Math.max(done.rankReached, rank(village)) as RankId };
}

/** Spend daylight; dusk ends the run and the day. */
function spend(s: GameState, minutes: number): GameState {
  const next = { ...s, minutes: s.minutes + minutes };
  return daylightLeft(next) <= 0 ? endDay(next) : next;
}

function credit(s: GameState, surface: SurfaceId, units: number): GameState {
  const res = SURFACES[surface].resource;
  return { ...s, village: { ...s.village, resources: { ...s.village.resources, [res]: s.village.resources[res] + units } } };
}

export function reduce(s: GameState, a: Action): GameState {
  if (s.night && a.type !== 'dawn' && a.type !== 'reset') return s;
  switch (a.type) {
    case 'view': return a.view !== 'village' && !surfaceUnlocked(s, a.view) ? s : { ...s, view: a.view };
    case 'open': {
      if (!surfaceUnlocked(s, a.surface)) return s;
      if (s.active?.surface === a.surface) return { ...s, view: a.surface };
      // One run at a time: working another feature banks the run in progress.
      const banked = s.active ? finishRun(s) : s;
      if (daylightLeft(banked) <= DAYLIGHT.startMinutes) return { ...banked, view: a.surface };
      return deal(banked, a.surface);
    }
    case 'location': {
      const act = s.active?.surface === a.surface ? s.active : null;
      if (act && !untouched(act)) return s;
      const next = { ...s, location: { ...s.location, [a.surface]: a.location } };
      return act ? deal({ ...next, active: null }, a.surface) : next;
    }
    case 'start': {
      if (s.active || !surfaceUnlocked(s, a.surface)) return s;
      if (daylightLeft(s) <= DAYLIGHT.startMinutes) return s;
      return deal(s, a.surface);
    }
    case 'play':
    case 'fall': {
      const act = s.active;
      if (!act) return s;
      const before = act.run;
      const run = a.type === 'play' ? play(before, a.pile) : fall(before, a.side);
      if (run === before) return s;
      let units = run.earned - before.earned;
      let perkBonus = act.perkBonus;
      let siteBonus = act.siteBonus ?? 0;
      const felled = run.felled > before.felled;
      if (act.surface === 'forest' && felled && hasResident(s.village, 'banks')) { units += 2; perkBonus += 2; }
      if (a.type === 'play' && act.surface === 'berries' && run.chain % 5 === 0 && hasResident(s.village, 'mochi')) { units += 1; perkBonus += 1; }
      if (act.surface === 'forest' && felled && hasSiteBonus(s.village.plots, 'woodshed')) { units += 1; siteBonus += 1; }
      const landed = run.foundation[run.foundation.length - 1];
      if (a.type === 'play' && act.surface === 'quarry' && landed.yield >= DEEP_ROCK_YIELD && hasSiteBonus(s.village.plots, 'lantern')) { units += 1; siteBonus += 1; }
      let next = credit(s, act.surface, units);
      // Choosing a fall is free: only the play that cleared the trunk cost daylight.
      const minutes = a.type === 'play' ? DAYLIGHT.playMinutes : 0;
      next = { ...next, mastery: a.type === 'play' ? { ...next.mastery, [act.surface]: next.mastery[act.surface] + 1 } : next.mastery,
        active: { ...act, run, perkBonus, siteBonus, minutes: act.minutes + minutes } };
      if (minutes) next = spend(next, minutes);
      if (next.active && runEnd(next.active.run)) next = finishRun(next);
      return next;
    }
    case 'draw': {
      const act = s.active;
      if (!act || act.run.stock.length === 0) return s;
      const cost = drawCost(s);
      if (cost > daylightLeft(s)) return s;
      const run = draw(act.run);
      let next: GameState = { ...s, active: { ...act, run, freeDrawUsed: act.freeDrawUsed || cost === 0, minutes: act.minutes + cost } };
      next = spend(next, cost);
      if (next.active && runEnd(next.active.run)) next = finishRun(next);
      return next;
    }
    case 'leave': return { ...finishRun(s), view: 'village' };
    case 'build': {
      const def = BUILDINGS[a.building];
      if (placeBlocker(s.village, s.rankReached, a.building, a.tile) || !canAfford(s.village.resources, def.cost) || def.rank > s.rankReached) return s;
      const plots = s.village.plots.slice();
      plots[a.tile] = a.building;
      const village = { ...s.village, plots, resources: pay(s.village.resources, def.cost) };
      return { ...s, village, rankReached: Math.max(s.rankReached, rank(village)) as RankId };
    }
    case 'demolish': {
      // Can't pull a roof off a sleeping kin.
      if (demolishBlocker(s.village, a.tile)) return s;
      const b = s.village.plots[a.tile]!;
      const plots = s.village.plots.slice();
      plots[a.tile] = null;
      return { ...s, village: { ...s.village, plots, resources: gain(s.village.resources, refundFor(b)) } };
    }
    case 'welcome': {
      if (welcomeBlocker(s.village, a.kin)) return s;
      const village = welcome(s.village, a.kin);
      return { ...s, village, rankReached: Math.max(s.rankReached, rank(village)) as RankId };
    }
    case 'rest': return endDay(s);
    case 'dawn': return s.night ? { ...s, night: null, day: s.day + 1, minutes: 0, view: 'village' } : s;
    case 'reset': return newGame();
  }
}

export const SAVE_KEY = 'exploritaire.village.v1';

/** Version 1 saves kept buildings on a 5x3 plot board: set that block down on the map, combos intact. */
export function migrate(parsed: unknown): GameState | null {
  const g = parsed as Omit<GameState, 'version'> & { version: number };
  if (g?.version === 2) return g as GameState;
  if (g?.version !== 1) return null;
  const plots: (BuildingId | null)[] = Array(MAP_TILES).fill(null);
  g.village.plots.forEach((b, i) => { if (b) plots[tileIndex(1 + (i % 5), 2 + Math.floor(i / 5))] = b; });
  const fix = (a: ActiveRun | null) => (a ? { ...a, siteBonus: a.siteBonus ?? 0 } : a);
  return { ...g, version: 2, village: { ...g.village, plots }, active: fix(g.active), lastRun: fix(g.lastRun) };
}

export function loadGame(): GameState {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (raw) { const g = migrate(JSON.parse(raw)); if (g) return g; }
  } catch { /* fall through to a new game */ }
  return newGame();
}

export function saveGame(s: GameState): void {
  try { localStorage.setItem(SAVE_KEY, JSON.stringify(s)); } catch { /* storage may be unavailable */ }
}
