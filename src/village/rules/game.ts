// Whole-game reducer for village.html: day clock, active surface run, village.
import { DAYLIGHT } from './daylight';
import { draw, play, runEnd, type Run } from './golf';
import { SURFACES, type SurfaceId } from './surfaces';
import {
  BUILDINGS, canAfford, dayLength, hasResident, newVillage, nightfall, pay, rank, welcome, welcomeBlocker,
  type BuildingId, type KinId, type NightReport, type RankId, type VillageState,
} from './village';

export type View = 'village' | SurfaceId;

export interface ActiveRun {
  surface: SurfaceId;
  location: 0 | 1;
  run: Run;
  /** Units from resident perks this run. */
  perkBonus: number;
  freeDrawUsed: boolean;
  minutes: number;
}

export interface GameState {
  version: 1;
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
    version: 1, day: 1, minutes: 0, village: newVillage(),
    mastery: { forest: 0, berries: 0, quarry: 0 },
    location: { forest: 0, berries: 0, quarry: 0 },
    rankReached: 1, active: null, lastRun: null, view: 'village', seed, night: null,
  };
}

export type Action =
  | { type: 'view'; view: View }
  | { type: 'location'; surface: SurfaceId; location: 0 | 1 }
  | { type: 'start'; surface: SurfaceId }
  | { type: 'play'; pile: number }
  | { type: 'draw' }
  | { type: 'leave' }
  | { type: 'build'; building: BuildingId; plot: number }
  | { type: 'demolish'; plot: number }
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
    case 'view': return { ...s, view: a.view };
    case 'location':
      if (s.active?.surface === a.surface) return s;
      return { ...s, location: { ...s.location, [a.surface]: a.location } };
    case 'start': {
      if (s.active || !surfaceUnlocked(s, a.surface)) return s;
      if (daylightLeft(s) <= DAYLIGHT.startMinutes) return s;
      const location = s.location[a.surface];
      const run = SURFACES[a.surface].deal(s.seed, location);
      const started = { ...s, seed: s.seed + 1, view: a.surface as View, lastRun: null,
        active: { surface: a.surface, location, run, perkBonus: 0, freeDrawUsed: false, minutes: DAYLIGHT.startMinutes } };
      return spend(started, DAYLIGHT.startMinutes);
    }
    case 'play': {
      const act = s.active;
      if (!act) return s;
      const before = act.run;
      let run = play(before, a.pile);
      if (run === before) return s;
      let units = run.earned - before.earned;
      let perkBonus = act.perkBonus;
      if (act.surface === 'forest' && run.felled > before.felled && hasResident(s.village, 'banks')) { units += 2; perkBonus += 2; }
      if (act.surface === 'berries' && run.chain % 5 === 0 && hasResident(s.village, 'mochi')) { units += 1; perkBonus += 1; }
      let next = credit(s, act.surface, units);
      next = { ...next, mastery: { ...next.mastery, [act.surface]: next.mastery[act.surface] + 1 },
        active: { ...act, run, perkBonus, minutes: act.minutes + DAYLIGHT.playMinutes } };
      next = spend(next, DAYLIGHT.playMinutes);
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
    case 'leave': return finishRun(s);
    case 'build': {
      const def = BUILDINGS[a.building];
      if (s.village.plots[a.plot] || !canAfford(s.village.resources, def.cost) || def.rank > s.rankReached) return s;
      const plots = s.village.plots.slice();
      plots[a.plot] = a.building;
      const village = { ...s.village, plots, resources: pay(s.village.resources, def.cost) };
      return { ...s, village, rankReached: Math.max(s.rankReached, rank(village)) as RankId };
    }
    case 'demolish': {
      const b = s.village.plots[a.plot];
      if (!b) return s;
      const plots = s.village.plots.slice();
      plots[a.plot] = null;
      const village = { ...s.village, plots };
      // Can't pull a roof off a sleeping kin.
      if (village.residents.length > plots.reduce((n, p) => n + (p ? BUILDINGS[p].beds ?? 0 : 0), 0)) return s;
      return { ...s, village };
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

export function loadGame(): GameState {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as GameState;
      if (parsed?.version === 1) return parsed;
    }
  } catch { /* fall through to a new game */ }
  return newGame();
}

export function saveGame(s: GameState): void {
  try { localStorage.setItem(SAVE_KEY, JSON.stringify(s)); } catch { /* storage may be unavailable */ }
}
