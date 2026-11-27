// Whole-game reducer for village.html: day clock, active surface run, village.
import { DAYLIGHT, DAY_CYCLE_MINUTES } from './daylight';
import { draw, fall, play, rng, runEnd, shuffledDeck, type Rank, type Run, type Side } from './golf';
import { SURFACES, type SurfaceId } from './surfaces';
import { FEATURES, MAP_TILES, featureAt, fogged, isGate, isSapling, SAPLING, tileAt, tileIndex, validTileIndex } from './map';
import { activeAspen, aspenAcceptsRank, aspenDraw, aspenPlay, aspenReceive, aspenSeed, aspenSpill, aspenTop, ASPEN_TREE_COUNT, KIN_STAMINA_MAX, dealAspen, freshStamina, startingParties,
  type AspenGrove, type AspenRun, type KinStamina, type Party, type TokenKin } from './aspen';
import {
  BUILDINGS, canAfford, dayLength, demolishBlocker, gain, hasResident, hasSiteBonus, newVillage, nightfall, pay,
  placeBlocker, rank, refundFor, welcome, welcomeBlocker,
  type BuildingId, type KinId, type NightReport, type RankId, type Resources, type VillageState,
} from './village';

import { dealDig, dealSimpleDen, DEN_REST_MINUTES, DIG_KIN, digPlay, digRemaining, IMPROVED_DEN_WOOD, restSimpleDen, type DenRest, type DenSite } from './den';

export type View = 'village' | 'den' | SurfaceId;

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
  parties: Party[];
  /** Saves predating the developer roster had every kin on the map by default. */
  devKinRoster: true;
  aspen: AspenGrove | null;
  stamina: KinStamina;
  aspenCards: Rank[];
  den: DenSite | null;
  denRest: DenRest;
}

export const maxStamina = (game: GameState, kin: TokenKin) => KIN_STAMINA_MAX + (game.denRest[kin] ?? 0);
export const dailyMaxApBonus = (game: GameState, kin: TokenKin) => game.denRest[kin] ? 1 : 0;
export function dailyStamina(denRest: DenRest): KinStamina {
  const stamina = freshStamina();
  for (const kin of Object.keys(stamina) as TokenKin[]) stamina[kin] += denRest[kin] ?? 0;
  return stamina;
}

export function surfaceWorkers(game: GameState, surface: SurfaceId): TokenKin[] {
  if (surface === 'quarry') return [];
  const { x, y } = FEATURES[surface].node;
  return game.parties.find(party => party.tile === tileIndex(x, y))?.members ?? [];
}

export function newGame(seed = Date.now() % 100000): GameState {
  return {
    version: 2, day: 1, minutes: 0, village: newVillage(),
    mastery: { forest: 0, berries: 0, quarry: 0 },
    location: { forest: 0, berries: 0, quarry: 0 },
    rankReached: 1, active: null, lastRun: null, view: 'village', seed, night: null, parties: startingParties(), devKinRoster: true, aspen: null, stamina: freshStamina(), aspenCards: [], den: null, denRest: {},
  };
}

export type Action =
  | { type: 'den-place'; tile: number; improve: boolean }
  | { type: 'den-start'; from: number; kin?: TokenKin }
  | { type: 'den-play'; column: number }
  | { type: 'den-draw' }
  | { type: 'den-house'; kin: TokenKin }
  | { type: 'dev-config'; day?: number; minutes?: number; resources?: Resources; restoreKin?: TokenKin | 'all'; unlock?: RankId }
  | { type: 'dev-place-kin'; kin: Exclude<TokenKin, 'hero'>; tile: number }
  | { type: 'view'; view: View }
  | { type: 'move-party'; from: number; to: number; kin?: TokenKin }
  | { type: 'deploy'; from: number; surface: SurfaceId; kin?: TokenKin }
  | { type: 'group-kin'; members: TokenKin[] }
  | { type: 'inspect-biome'; surface: SurfaceId }
  | { type: 'aspen-target'; tree: number }
  | { type: 'aspen-overview' }
  | { type: 'aspen-play'; pile: number; foundation: number }
  | { type: 'aspen-play-card'; card: number; foundation: number }
  | { type: 'aspen-gather-card'; tree: number }
  | { type: 'aspen-draw'; foundation: number }
  | { type: 'aspen-land' }
  | { type: 'aspen-collect'; tree: number }
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

export function surfaceUnlocked(_s: GameState, id: SurfaceId): id is Exclude<SurfaceId, 'quarry'> {
  return id !== 'quarry';
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

function moveParty(parties: Party[], from: number, to: number, kin?: TokenKin): Party[] {
  const party = parties.find(p => p.tile === from);
  if (!party || from === to || kin && !party.members.includes(kin)) return parties;
  const target = parties.find(p => p.tile === to);
  return [...parties.filter(p => p.tile !== from && p.tile !== to),
    ...(kin && party.members.length > 1 ? [{ tile: from, members: party.members.filter(member => member !== kin) }] : []),
    { tile: to, members: [...(target?.members ?? []), ...(kin ? [kin] : party.members)] }];
}

function openLand(s: GameState, i: number): boolean {
  const { x, y } = tileAt(i);
  return validTileIndex(i) &&
    !featureAt(x, y) && !isSapling(x, y) && !isGate(x, y) && !fogged(x, y, s.rankReached);
}

export function canPlaceDevKin(s: GameState, tile: number): boolean {
  return s.view === 'village' && !s.night && openLand(s, tile) && !s.village.plots[tile];
}

export function denPlacementBlocker(s: GameState, tile: number, improve: boolean): string | undefined {
  if (improve) {
    if (s.den?.level !== 1 || s.den.dig || s.den.tile !== tile) return 'Choose the finished Simple Den';
    if (s.village.resources.lumber < IMPROVED_DEN_WOOD) return `Needs ${IMPROVED_DEN_WOOD} wood`;
  } else if (s.den || !openLand(s, tile) || s.village.plots[tile] || s.parties.some(party => party.tile === tile)) {
    return 'Choose an empty, unlocked plot';
  }
}

function emptyGrove(seed: number, members: TokenKin[]): AspenGrove {
  return { seed, members, target: null, trees: Array<null>(ASPEN_TREE_COUNT).fill(null) };
}

function saveAspenTree(s: GameState, run: AspenRun): GameState {
  const grove = s.aspen!;
  return { ...s, aspen: { ...grove, trees: grove.trees.map((tree, i) => i === grove.target ? run : tree) } };
}

export function reduce(s: GameState, a: Action): GameState {
  if (s.night && a.type !== 'dawn' && a.type !== 'reset' && a.type !== 'aspen-land' && a.type !== 'dev-config') return s;
  switch (a.type) {
    case 'den-place': {
      if (s.view !== 'village' || denPlacementBlocker(s, a.tile, a.improve)) return s;
      const den: DenSite = a.improve ? { ...s.den!, dig: dealDig(s.seed), worker: null }
        : { tile: a.tile, level: 0, dig: dealSimpleDen(), worker: null, residents: [] };
      const village = a.improve ? { ...s.village, resources: pay(s.village.resources, { lumber: IMPROVED_DEN_WOOD }) } : s.village;
      return { ...s, den, seed: s.seed + 1, village };
    }
    case 'den-start': {
      const den = s.den, party = s.parties.find(p => p.tile === a.from);
      const kin = a.kin ?? party?.members.find(member => DIG_KIN.includes(member));
      if (s.view !== 'village' || !den?.dig || !kin || !party?.members.includes(kin) || !DIG_KIN.includes(kin)) return s;
      return { ...finishRun(s), view: 'den', den: { ...den, worker: kin }, parties: moveParty(s.parties, a.from, den.tile, kin) };
    }
    case 'den-play': {
      const den = s.den, kin = den?.worker;
      if (s.view !== 'den' || !den?.dig || !kin || !daylightLeft(s)) return s;
      const dig = digPlay(den.dig, a.column);
      if (dig === den.dig) return s;
      const completed = digRemaining(dig) === 0;
      return spend({ ...s, den: completed ? { ...den, level: den.level === 0 ? 1 : 2, dig: null,
        residents: dig.simple ? [kin] : den.residents } : { ...den, dig } }, DAYLIGHT.playMinutes);
    }
    case 'den-draw': {
      const den = s.den, dig = den?.dig, kin = den?.worker;
      if (s.view !== 'den' || !den || !dig || !kin || s.stamina[kin] <= 0 || daylightLeft(s) < DAYLIGHT.drawMinutes) return s;
      const stock = dig.stock.length ? dig.stock : shuffledDeck(rng(s.seed));
      const foundation = stock[stock.length - 1];
      const nextStock = stock.slice(0, -1);
      if (dig.simple) nextStock.unshift(foundation);
      return spend({ ...s, seed: dig.stock.length ? s.seed : s.seed + 1,
        stamina: { ...s.stamina, [kin]: s.stamina[kin] - 1 },
        den: { ...den, dig: { ...dig, stock: nextStock, foundation } } }, DAYLIGHT.drawMinutes);
    }
    case 'den-house': {
      const den = s.den;
      if (!den?.level || !Object.prototype.hasOwnProperty.call(s.stamina, a.kin)) return s;
      if (den.residents.includes(a.kin)) return { ...s, den: { ...den, residents: den.residents.filter(kin => kin !== a.kin) } };
      return den.residents.length < den.level ? { ...s, den: { ...den, residents: [...den.residents, a.kin] } } : s;
    }
    case 'dev-config': {
      const next = { ...s };
      if (a.day !== undefined && Number.isSafeInteger(a.day) && a.day >= 1) next.day = a.day;
      if (a.minutes !== undefined && Number.isFinite(a.minutes)) {
        next.minutes = Math.max(0, Math.min(DAY_CYCLE_MINUTES - 1, Math.trunc(a.minutes)));
        next.night = null;
      }
      if (a.resources && Object.values(a.resources).every(value => Number.isSafeInteger(value) && value >= 0)) {
        next.village = { ...s.village, resources: a.resources };
      }
      if (a.restoreKin === 'all') next.stamina = dailyStamina(s.denRest);
      else if (a.restoreKin) next.stamina = { ...s.stamina, [a.restoreKin]: maxStamina(s, a.restoreKin) };
      if (a.unlock && a.unlock > s.rankReached) next.rankReached = a.unlock;
      return next;
    }
    case 'dev-place-kin': {
      if (!canPlaceDevKin(s, a.tile)) return s;
      const previous = s.parties.find(party => party.members.includes(a.kin));
      if (previous) {
        if (previous.tile === a.tile) return s;
        return { ...s, parties: moveParty(s.parties, previous.tile, a.tile, a.kin) };
      }
      const destination = s.parties.find(party => party.tile === a.tile);
      const parties = destination ? s.parties.map(party => party === destination
        ? { ...party, members: [...party.members, a.kin] } : party) : [...s.parties, { tile: a.tile, members: [a.kin] }];
      return { ...s, parties };
    }
    case 'move-party': {
      if (s.view !== 'village' || !openLand(s, a.to)) return s;
      const parties = moveParty(s.parties, a.from, a.to, a.kin);
      return parties === s.parties ? s : { ...s, parties };
    }
    case 'group-kin': {
      if (s.view !== 'village') return s;
      const picked = new Set(a.members);
      const members = s.parties.flatMap(p => p.members.filter(kin => picked.has(kin)));
      if (members.length < 2) return s;
      const origin = s.parties.find(p => p.members.some(kin => picked.has(kin)))!;
      const remaining = s.parties.map(p => ({ ...p, members: p.members.filter(kin => !picked.has(kin)) })).filter(p => p.members.length);
      const usable = (i: number) => !remaining.some(p => p.tile === i) && openLand(s, i);
      const start = tileAt(origin.tile);
      const distance = (i: number) => Math.abs(tileAt(i).x - start.x) + Math.abs(tileAt(i).y - start.y);
      const tile = usable(origin.tile) ? origin.tile :
        Array.from({ length: MAP_TILES }, (_, i) => i).filter(usable).sort((a, b) => distance(a) - distance(b))[0];
      return tile === undefined ? s : { ...s, parties: [...remaining, { tile, members }] };
    }
    case 'inspect-biome': {
      if (s.view !== 'village' || !surfaceUnlocked(s, a.surface)) return s;
      if (a.surface !== 'forest') return { ...s, view: a.surface };
      return { ...s, view: 'forest', seed: s.aspen ? s.seed : s.seed + 1,
        aspen: s.aspen ? { ...s.aspen, members: [],
          target: activeAspen(s.aspen)?.phase === 'falling' ? s.aspen.target : null } : emptyGrove(s.seed, []) };
    }
    case 'deploy': {
      const party = s.parties.find(p => p.tile === a.from);
      if (s.view !== 'village' || !party || a.kin && !party.members.includes(a.kin) ||
          !surfaceUnlocked(s, a.surface) || activeAspen(s.aspen)?.phase === 'falling') return s;
      const node = FEATURES[a.surface].node;
      const to = tileIndex(node.x, node.y);
      const parties = moveParty(s.parties, a.from, to, a.kin);
      if (a.surface !== 'forest') return reduce({ ...s, parties }, { type: 'open', surface: a.surface });
      const members = parties.find(p => p.tile === to)!.members;
      const grove = s.aspen;
      return { ...finishRun(s), parties, view: 'forest', seed: grove ? s.seed : s.seed + 1,
        aspen: grove
          ? { ...grove, members, target: null }
          : emptyGrove(s.seed, members) };
    }
    case 'aspen-target': {
      const grove = s.aspen;
      if (s.view !== 'forest' || !grove?.members.length || !Number.isInteger(a.tree) || a.tree < 0 || a.tree >= grove.trees.length ||
          activeAspen(grove)?.phase === 'falling' || (grove.trees[a.tree]?.phase ?? 'standing') !== 'standing') return s;
      const existing = grove.trees[a.tree];
      const fresh = () => dealAspen(aspenSeed(grove.seed, a.tree), grove.members);
      let run = existing ?? fresh();
      if (existing && (run.foundations.length !== grove.members.length ||
          grove.members.some((kin, i) => run.foundations[i]?.kin !== kin))) {
        run = { ...existing, foundations: fresh().foundations.map(base =>
          existing.foundations.find(f => f.kin === base.kin) ?? base) };
      }
      return saveAspenTree({ ...s, aspen: { ...grove, target: a.tree } }, run);
    }
    case 'aspen-overview':
      return s.view === 'forest' && s.aspen && activeAspen(s.aspen)?.phase !== 'falling'
        ? { ...s, aspen: { ...s.aspen, target: null } } : s;
    case 'aspen-play':
    case 'aspen-play-card': {
      const run = activeAspen(s.aspen);
      if (s.view !== 'forest' || !run) return s;
      const rank = a.type === 'aspen-play-card' ? s.aspenCards[a.card] : aspenTop(run, a.pile);
      if (rank === undefined || !aspenAcceptsRank(run, rank, a.foundation, s.stamina)) return s;
      const { kin } = run.foundations[a.foundation];
      const next = a.type === 'aspen-play-card' ? aspenReceive(run, rank, a.foundation) : aspenPlay(run, a.pile, a.foundation);
      const aspenCards = a.type === 'aspen-play-card' ? s.aspenCards.filter((_, index) => index !== a.card) : s.aspenCards;
      return saveAspenTree({ ...s, aspenCards, stamina: { ...s.stamina, [kin]: s.stamina[kin] - 1 } }, next);
    }
    case 'aspen-draw': {
      const run = activeAspen(s.aspen);
      return s.view === 'forest' && run ? saveAspenTree(s, aspenDraw(run, a.foundation)) : s;
    }
    case 'aspen-land': {
      const grove = s.aspen, run = activeAspen(grove);
      return grove?.target != null && run?.phase === 'falling'
        ? saveAspenTree(s, { ...run, phase: 'fallen', spill: aspenSpill(aspenSeed(grove.seed, grove.target)) }) : s;
    }
    case 'aspen-gather-card': {
      const grove = s.aspen, tree = grove?.trees[a.tree];
      if (s.view !== 'forest' || !grove || tree?.spill === undefined) return s;
      const trees = grove.trees.map((other, i) => i === a.tree ? { ...tree, spill: undefined } : other);
      return { ...s, aspenCards: [...s.aspenCards, tree.spill], aspen: { ...grove, trees } };
    }
    case 'aspen-collect': {
      const grove = s.aspen;
      const tree = grove?.trees[a.tree];
      if (s.view !== 'forest' || !grove || tree?.phase !== 'fallen') return s;
      const trees = grove.trees.map((run, i): AspenRun | null => i === a.tree ? { ...tree, phase: 'felled' } : run);
      return credit({ ...s, aspen: { ...grove, trees } }, 'forest', 1);
    }
    case 'view': return a.view === 'den' || (a.view !== 'village' && !surfaceUnlocked(s, a.view)) ? s : { ...s, view: a.view };
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
      const workers = surfaceWorkers(s, act.surface);
      const worker = workers.find(kin => s.stamina[kin] > 0);
      if (a.type === 'play' && workers.length && !worker) return s;
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
      let next = credit(s, act.surface, units);
      // Choosing a fall is free: only the play that cleared the trunk cost daylight and stamina.
      const minutes = a.type === 'play' ? DAYLIGHT.playMinutes : 0;
      next = { ...next, mastery: a.type === 'play' ? { ...next.mastery, [act.surface]: next.mastery[act.surface] + 1 } : next.mastery,
        stamina: worker && a.type === 'play' ? { ...s.stamina, [worker]: s.stamina[worker] - 1 } : s.stamina,
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
      if (s.den?.tile === a.tile || placeBlocker(s.village, s.rankReached, a.building, a.tile) || !canAfford(s.village.resources, def.cost) || def.rank > s.rankReached) return s;
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
    case 'dawn': {
      if (!s.night) return s;
      const denRest: DenRest = {};
      if (s.den?.level && DAY_CYCLE_MINUTES - s.minutes >= DEN_REST_MINUTES) {
        for (const kin of s.den.residents) denRest[kin] = s.den.level;
      }
      let den = s.den;
      const stamina = dailyStamina(denRest);
      if (den?.dig?.simple && den.worker) {
        stamina[den.worker] -= 1;
        den = { ...den, dig: restSimpleDen(den.dig) };
      }
      return { ...s, night: null, day: s.day + 1, minutes: 0, view: 'village', den, denRest, stamina };
    }
    case 'reset': return newGame();
  }
}

export const SAVE_KEY = 'exploritaire.village.v1';

function migrateRun(active: ActiveRun | null): ActiveRun | null {
  if (!active || active.surface === 'quarry') return null;
  const { run } = active;
  if (active.surface !== 'berries' || active.location !== 0) return { ...active, siteBonus: active.siteBonus ?? 0 };
  return { ...active, siteBonus: active.siteBonus ?? 0, run: { ...run, piles: run.piles.map(pile => ({ ...pile,
    cards: pile.cards.map(card => card.unripe ? { ...card, unripe: false, leafCovered: true } : card),
  })) } };
}

/** Version 1 saves kept buildings on a 5x3 plot board: set that block down on the map, combos intact. */
export function migrate(parsed: unknown): GameState | null {
  const g = parsed as Omit<GameState, 'version'> & { version: number };
  if (g?.version === 2) {
    type SavedTree = Omit<AspenRun, 'maxHp'> & Partial<Pick<AspenRun, 'maxHp'>>;
    const previous = (parsed as { aspen?: SavedTree | (Omit<AspenGrove, 'trees'> & { trees: (SavedTree | null)[] }) }).aspen;
    const aspen = !previous ? null : 'trees' in previous ? { ...previous,
      trees: Array.from({ length: ASPEN_TREE_COUNT }, (_, index) => {
        const tree = previous.trees[index];
        return tree ? { ...tree, maxHp: tree.maxHp ?? 12 } : null;
      }) } : {
      seed: g.seed, members: previous.foundations.map(f => f.kin), target: 0,
      trees: [{ ...previous, maxHp: previous.maxHp ?? 12 }, ...Array<null>(ASPEN_TREE_COUNT - 1).fill(null)],
    };
    const savedDen = g.den ?? null;
    const oldDig = savedDen?.dig;
    let den = savedDen?.level === 0 && oldDig && !oldDig.simple && oldDig.piles.every(pile => pile.length === 2)
      ? { ...savedDen, dig: dealSimpleDen() } : savedDen;
    let parties = g.parties ?? startingParties();
    if (g.day === 1 && g.minutes === 0 && g.view === 'village' && !g.active && !aspen && !den &&
        parties[0]?.members.length === 1 && parties[0].members[0] === 'hero' && parties.length === 1 &&
        (parties[0].tile === tileIndex(4, 7) || parties[0].tile === tileIndex(2, 3))) {
      parties = startingParties();
    }
    const plots = g.village.plots.slice();
    while (plots.length < MAP_TILES) plots.push(null);
    const center = tileIndex(SAPLING.x, SAPLING.y);
    if (plots[center] || den?.tile === center || parties.some(party => party.tile === center)) {
      const candidates = Array.from({ length: MAP_TILES }, (_, i) => i).filter(i =>
        openLand(g as GameState, i) && !plots[i] && den?.tile !== i && !parties.some(party => party.tile === i));
      const distance = (i: number) => Math.abs(tileAt(i).x - SAPLING.x) + Math.abs(tileAt(i).y - SAPLING.y);
      const destination = candidates.sort((a, b) => distance(a) - distance(b))[0];
      if (destination !== undefined) {
        plots[destination] = plots[center];
        plots[center] = null;
        if (den?.tile === center) den = { ...den, tile: destination };
        parties = moveParty(parties, center, destination);
      }
    }
    return { ...g, version: 2, devKinRoster: true, village: { ...g.village, plots },
      parties: g.devKinRoster ? parties : parties.flatMap(({ tile, members }) => members.includes('hero') ? [{ tile, members: ['hero'] }] : []),
      aspen, stamina: { ...freshStamina(), ...g.stamina }, aspenCards: g.aspenCards ?? [],
      active: migrateRun(g.active), lastRun: migrateRun(g.lastRun), den, denRest: g.denRest ?? {},
      view: g.view === 'quarry' || g.view === 'forest' && !aspen ? 'village' : g.view };
  }
  if (g?.version !== 1) return null;
  const plots: (BuildingId | null)[] = Array(MAP_TILES).fill(null);
  g.village.plots.forEach((b, i) => { if (b) plots[tileIndex(1 + (i % 5), 2 + Math.floor(i / 5))] = b; });
  return migrate({ ...g, version: 2, village: { ...g.village, plots },
    parties: startingParties(), devKinRoster: true, aspen: null, stamina: freshStamina(), aspenCards: [], den: null, denRest: {} });
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
