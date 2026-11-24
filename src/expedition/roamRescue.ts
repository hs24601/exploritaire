import { TABLE_GRID } from '../proto/gridCoordinates';
import { materializeTiles, SAVED_TILE_DOCUMENT } from '../proto/tileEditor/runtime';
import { newAuthoredTile } from '../proto/tileEditor/schema';
import { apCap, createPlayableSandboxScenario, newActor, type BattleActor, type BattleState } from '../proto/rules/battle';
import { carrySeriesParty } from '../proto/rules/combatSeries';
import { stockCard } from '../proto/rules/skirmish';
import { MOTE_IDS, type LightMoteId, type MoteCounts } from '../proto/rules/lightMoteData';
import { prepareActor as prepareBareActor } from './demiRescue';
import { iceDescription, ICE_RARITY_NAMES } from '../proto/rules/iceRewards';
import type { RarityTier } from '../proto/rules/keruInvokeData';
// Rescue starts bare, but earned abilities must survive travel and transfers.
const prepareActor = (a: BattleActor): BattleActor => ({ ...prepareBareActor(a), iceRewards: a.iceRewards ?? [] });

export const ROAM_RESCUE_SAVE = 'exploritaire.roam-demi.v1';
export type Point = { x: number; y: number };
export const cellPoint = (column: number, row: number) => TABLE_GRID.center(TABLE_GRID.cell(column, row));
export const DEN = cellPoint(0, 2);
export const cellKey = (p: Point) => { const c = TABLE_GRID.atWorld(p); return `${c.column},${c.row}`; };
export const RESCUE_POIS = [
  { id: 'west-void', kind: 'void', column: -2, row: 0, label: 'Void mote' },
  { id: 'west-frost', kind: 'frost', column: -3, row: -1, label: 'Stranded Frost mote', guard: 'west-void' },
  { id: 'east-void', kind: 'void', column: 2, row: -2, label: 'Void mote' },
  { id: 'east-frost', kind: 'frost', column: 3, row: -3, label: 'Stranded Frost mote', guard: 'east-void' },
  { id: 'dark-demi', kind: 'dark-demi', column: 0, row: -6, label: 'Dark Demi' },
  { id: 'red-phoenix', kind: 'red', column: -4, row: 1, label: 'Crimson mote · Phoenix' },
  { id: 'red-stone', kind: 'red', column: 4, row: -1, label: 'Crimson mote' },
  { id: 'red-timber', kind: 'red', column: -3, row: -5, label: 'Crimson mote' },
] as const;
export const MOUNTAINS = new Set(['-1,0','0,0','1,0','-3,-2','-2,-2','-1,-2','0,-2','0,-4','1,-4','2,-4','3,-4']);

// Shared authored discovery region north of (0,1). Aldan's 2D view uses these
// coordinates and mountain collisions; Roam remains its separate 3D sandbox.
const north = [];
for (let row = -7; row <= 2; row++) for (let col = -4; col <= 4; col++) {
  if (col === 0 && (row === 1 || row === 2)) continue;
  const mountain = MOUNTAINS.has(`${col},${row}`);
  const tile = newAuthoredTile(mountain ? 'impassable-mountain' : 'woods', col, row, `rescue-${col + 4}-${row + 7}`);
  tile.populationDensity = mountain || Math.abs(col) <= 1 && row <= -5 || RESCUE_POIS.some(p => p.column === col && p.row === row) ? 0 : 1;
  tile.initiallyRevealed = mountain;
  north.push(tile);
}
export const RESCUE_TILES = materializeTiles({ ...SAVED_TILE_DOCUMENT, tiles: [
  ...SAVED_TILE_DOCUMENT.tiles!.filter(t => t.id === 'hero-den' || t.id === 'den-manaberries'), ...north,
] }, [], false);

export type RoamRescueState = {
  version: 1; safe: boolean; collection: MoteCounts; recipes: string[]; attempts: number;
  position: Point; visited: string[]; cleared: string[]; collected: string[];
  hero: BattleActor; demi?: BattleActor; joined: boolean; haul: MoteCounts;
  returnEncounters: number; returnSteps: number; nextAmbush: number; seed: number;
  encounter?: { id: string; kind: 'void' | 'boss' | 'surge' | 'red'; battle: BattleState; rewardSeed?: number };
  lastBattle?: BattleState; notice?: string;
  pendingFrost?: string;
  supplies?: Record<string, number>; supplyHaul?: Record<string, number>;
};
export const initialRoamRescue = (): RoamRescueState => ({
  version: 1, safe: false, collection: {}, recipes: [], attempts: 1, position: DEN,
  visited: [cellKey(DEN), '0,1'], cleared: [], collected: [], joined: false, haul: {},
  hero: prepareActor({ ...newActor('hero'), hp: 32, maxHp: 32, lightMotes: {}, charge: 0 }),
  returnEncounters: 0, returnSteps: 0, nextAmbush: 2, seed: 73819,
});
const randomSeed = (seed: number) => (Math.imul(seed, 1664525) + 1013904223) >>> 0;
const totalMotes = (a: BattleActor) => Object.values(a.lightMotes ?? {}).reduce((n, v) => n + (v ?? 0), 0);

export function worldBattle(s: RoamRescueState, kind: 'void' | 'boss' | 'surge' | 'red'): BattleState {
  const pair = kind === 'surge' && s.returnEncounters >= 2;
  const fresh = createPlayableSandboxScenario(pair ? '101' : '100');
  const seed = randomSeed(s.seed + s.cleared.length * 173 + s.returnEncounters * 347);
  fresh.seed = seed; fresh.effectSeed = seed;
  fresh.columns = fresh.columns.map((p, c) => p.map((_, i) => stockCard(seed, c * 4 + i)));
  const hp = kind === 'boss' ? 18 : kind === 'surge' ? pair ? 4 : 6 : 6;
  fresh.foes = fresh.foes.map((f, i) => ({ ...f, name: kind === 'boss' ? 'Dark Demi' : kind === 'red' ? 'Crimson Mote' : kind === 'surge' ? `Surge Mote ${i + 1}` : 'Void Mote', darkDemi: kind === 'boss', hp, profile: { ...f.profile, maxHp: hp } }));
  const carried = s.lastBattle ? carrySeriesParty(s.lastBattle, fresh) : fresh;
  return { ...carried, expeditionKeru: [], keruInvoke: undefined, cir: undefined, cirCompanion: undefined, keruExpedition: undefined, keruSelection: undefined,
    momentum: { ...fresh.momentum!, decayEnabled: false },
    party: [s.hero, ...(s.demi ? [s.demi] : [])].map(a => ({ ...prepareActor(a), targetId: fresh.foes[0].id })),
  };
}
function encounter(s: RoamRescueState, id: string, kind: 'void' | 'boss' | 'surge' | 'red'): RoamRescueState {
  const battle = worldBattle(s, kind);
  return { ...s, notice: undefined, encounter: { id, kind, battle, rewardSeed: battle.seed } };
}
function bank(s: RoamRescueState): RoamRescueState {
  return { ...s, safe: true, joined: false, haul: {}, supplyHaul: {}, supplies: Object.fromEntries(['wood','stone'].map(id => [id, (s.supplies?.[id] ?? 0) + (s.supplyHaul?.[id] ?? 0)])), collection: Object.fromEntries(MOTE_IDS.map(id => [id, (s.collection[id] ?? 0) + (s.haul[id] ?? 0)])), notice: 'Demi is home. Motes and supplies secured.' };
}
function frostPickup(s: RoamRescueState): RoamRescueState {
  const p = RESCUE_POIS.find(p => p.kind === 'frost' && cellKey(s.position) === `${p.column},${p.row}`);
  if (!p || p.kind !== 'frost' || s.collected.includes(p.id) || !s.cleared.includes(p.guard)) return s;
  return { ...s, pendingFrost: p.id };
}
function claimFrost(s: RoamRescueState): RoamRescueState {
  if (!s.pendingFrost) return s;
  const hero = prepareActor({ ...s.hero, lightMotes: { ...s.hero.lightMotes, 'frost-mote': (s.hero.lightMotes?.['frost-mote'] ?? 0) + 1 } });
  return { ...s, hero, pendingFrost: undefined, collected: [...s.collected, s.pendingFrost], haul: { ...s.haul, 'frost-mote': (s.haul['frost-mote'] ?? 0) + 1 },
    recipes: hero.lightMotes!['frost-mote']! >= 2 ? [...new Set([...s.recipes, 'Ice Climber'])] : s.recipes,
    notice: '❄ +1 Frost mote · +1 max AP' };
}
/** Rolls are derived from the saved encounter seed; inspection/reload never rerolls. */
export function crimsonLoot(s: RoamRescueState) {
  const e = s.encounter!;
  const roll = randomSeed((e.rewardSeed ?? e.battle.seed) + [...e.id].reduce((n, c) => n + c.charCodeAt(0), 0));
  const tier: RarityTier = roll % 100 < 65 ? 1 : roll % 100 < 95 ? 2 : 3;
  const phoenix = e.id === 'red-phoenix';
  const supplies = e.id === 'red-stone' ? { stone: 3, wood: 0 } : { wood: 3, stone: 0 };
  const bonus: LightMoteId | undefined = (roll >>> 8) % 100 < 40 ? ((roll >>> 16) % 2 ? 'ember-mote' : 'verdant-mote') : undefined;
  return { phoenix, tier, supplies, bonus, description: `${supplies.wood ? '3 wood' : '3 stone'} for base building; bank at the den.${bonus ? ` Bonus: 1 ${bonus === 'ember-mote' ? 'Ember' : 'Verdant'} mote (+1 max AP).` : ''}${phoenix ? ` ${ICE_RARITY_NAMES[tier]} Heart of the Phoenix: ${iceDescription('heart-of-the-phoenix', tier)}` : ''}` };
}
export type RoamRescueAction =
  | { type: 'step'; position: Point }
  | { type: 'position'; position: Point }
  | { type: 'battle'; id: string; battle: BattleState }
  | { type: 'continue' }
  | { type: 'claim-frost' }
  | { type: 'transfer'; id: LightMoteId; from: 'hero' | 'demi' }
  | { type: 'dismiss' }
  | { type: 'restart' }
  | { type: 'purge' };

// A lost or restarted run keeps only what was banked at the den.
const freshRun = (s: RoamRescueState, notice: string): RoamRescueState => ({ ...initialRoamRescue(), safe: s.safe, collection: s.collection, supplies: s.supplies, recipes: s.recipes, visited: s.visited, attempts: s.attempts + 1, seed: randomSeed(s.seed), notice });

export function roamRescueReducer(s: RoamRescueState, a: RoamRescueAction): RoamRescueState {
  if (a.type === 'dismiss') return { ...s, notice: undefined };
  if (a.type === 'restart') return freshRun(s, 'Run restarted · unbanked motes and supplies lost');
  if (a.type === 'purge') return { ...initialRoamRescue(), notice: 'Saved progress purged' };
  if (a.type === 'claim-frost') return s.encounter ? s : claimFrost(s);
  if (a.type === 'battle') {
    if (s.encounter?.id !== a.id || s.encounter.battle === a.battle) return s;
    return { ...s, encounter: { ...s.encounter, battle: a.battle } };
  }
  if (a.type === 'continue') {
    const e = s.encounter;
    if (!e?.battle.result) return s;
    const hero = e.battle.party.find(a => a.id === 'hero')!, demi = e.battle.party.find(a => a.id === 'dem');
    if (e.battle.result !== 'won' || hero.hp <= 0 || s.joined && (!demi || demi.hp <= 0)) {
      return freshRun(s, 'Run lost · unbanked motes and supplies lost');
    }
    const recovered = (a: BattleActor) => ({ ...a, hp: Math.min(a.maxHp, a.hp + 3) });
    let next: RoamRescueState = { ...s, encounter: undefined, hero: recovered(hero), demi: demi ? recovered(demi) : undefined, lastBattle: e.battle, cleared: [...new Set([...s.cleared, e.id])] };
    if (e.kind === 'red') {
      const loot = crimsonLoot(s);
      next.supplyHaul = { wood: (s.supplyHaul?.wood ?? 0) + loot.supplies.wood, stone: (s.supplyHaul?.stone ?? 0) + loot.supplies.stone };
      if (loot.bonus) {
        next.hero = prepareActor({ ...next.hero, lightMotes: { ...next.hero.lightMotes, [loot.bonus]: (next.hero.lightMotes?.[loot.bonus] ?? 0) + 1 } });
        next.haul = { ...next.haul, [loot.bonus]: (next.haul[loot.bonus] ?? 0) + 1 };
      }
      if (loot.phoenix) next.hero = { ...next.hero, iceRewards: [...new Set([...(next.hero.iceRewards ?? []), 'heart-of-the-phoenix' as const])], iceRewardTiers: { ...next.hero.iceRewardTiers, 'heart-of-the-phoenix': loot.tier }, phoenixRecharge: 0 };
    }
    if (e.kind === 'boss') next = { ...next, joined: true, returnSteps: 0, returnEncounters: 0, nextAmbush: 2,
      demi: prepareActor({ ...newActor('dem'), name: 'Demi', rescueCub: true, rank: 6, hp: 24, maxHp: 24, charge: 0, lightMotes: {} }), notice: 'Demi joins you. Return to the den.' };
    if (e.kind === 'surge') {
      const seed = randomSeed(s.seed);
      next = { ...next, seed, returnEncounters: s.returnEncounters + 1, nextAmbush: s.returnSteps + 2 + (seed >>> 16) % 2 };
      // A late fight grants a small optional power, never a build-defining skill.
      if (s.returnEncounters === 1 || s.returnEncounters === 3) {
        next.hero = prepareActor({ ...next.hero, lightMotes: { ...next.hero.lightMotes, 'verdant-mote': (next.hero.lightMotes?.['verdant-mote'] ?? 0) + 1 } });
        next.haul = { ...next.haul, 'verdant-mote': (next.haul['verdant-mote'] ?? 0) + 1 };
      }
    }
    next = frostPickup(next);
    // This also covers a final interception at the den; no unearned safety.
    if (next.joined && cellKey(next.position) === cellKey(DEN)) {
      if (next.returnEncounters >= 4) return bank(next);
      return encounter(next, `surge-${next.returnEncounters}`, 'surge');
    }
    return next;
  }
  if (a.type === 'transfer') {
    if (s.encounter || s.pendingFrost || s.safe || !s.demi) return s;
    const from = a.from === 'hero' ? s.hero : s.demi, to = a.from === 'hero' ? s.demi : s.hero;
    if (!(from.lightMotes?.[a.id]) || totalMotes(to) >= 6) return s;
    const donor = prepareActor({ ...from, lightMotes: { ...from.lightMotes, [a.id]: from.lightMotes![a.id]! - 1 } });
    const receiver = prepareActor({ ...to, lightMotes: { ...to.lightMotes, [a.id]: (to.lightMotes?.[a.id] ?? 0) + 1 } });
    const recipes = (receiver.lightMotes?.['frost-mote'] ?? 0) >= 2 ? [...new Set([...s.recipes, receiver.id === 'hero' ? 'Ice Climber' : 'Glacial Armor'])] : s.recipes;
    return { ...s, hero: a.from === 'hero' ? donor : receiver, demi: a.from === 'hero' ? receiver : donor, recipes };
  }
  if (s.encounter || s.pendingFrost) return s;
  const key = cellKey(a.position);
  if (MOUNTAINS.has(key)) return s;
  let next = { ...s, position: a.position, visited: [...new Set([...s.visited, key])] };
  if (a.type === 'position' || s.safe || key === cellKey(s.position)) return next;
  if (s.joined) {
    next = { ...next, returnSteps: s.returnSteps + 1 };
    if (key === cellKey(DEN)) return s.returnEncounters >= 4 ? bank(next) : encounter(next, `surge-${s.returnEncounters}`, 'surge');
    if (s.returnEncounters < 4 && next.returnSteps >= s.nextAmbush) return encounter(next, `surge-${s.returnEncounters}`, 'surge');
    const sideMote = RESCUE_POIS.find(p => p.kind === 'red' && key === `${p.column},${p.row}` && !s.cleared.includes(p.id));
    if (sideMote) return encounter(next, sideMote.id, 'red');
    return next;
  }
  const poi = RESCUE_POIS.find(p => key === `${p.column},${p.row}`);
  if (!poi) return next;
  if (poi.kind === 'void' && !s.cleared.includes(poi.id)) return encounter(next, poi.id, 'void');
  if (poi.kind === 'red' && !s.cleared.includes(poi.id)) return encounter(next, poi.id, 'red');
  if (poi.kind === 'frost') {
    if (!s.cleared.includes(poi.guard)) return encounter(next, poi.guard, 'void');
    return frostPickup(next);
  }
  if (poi.kind === 'dark-demi' && !s.cleared.includes(poi.id)) {
    return s.collected.length >= 2 ? encounter(next, poi.id, 'boss') : { ...next, notice: `❄ ${s.collected.length}/2 · rescue the stranded motes first` };
  }
  return next;
}

export function decodeRoamRescue(raw: string | null): RoamRescueState | null {
  try {
    if (!raw) return null;
    const s = JSON.parse(raw) as RoamRescueState;
    if (s.version !== 1 || !s.hero || s.hero.id !== 'hero' || !Number.isFinite(s.hero.hp) || !Number.isFinite(s.position?.x) || !Number.isFinite(s.position?.y) || !Array.isArray(s.visited) || !Array.isArray(s.collected) || !Array.isArray(s.cleared) || !Array.isArray(s.recipes) || !s.collection || !s.haul || !Number.isInteger(s.returnEncounters) || !Number.isInteger(s.seed) || s.joined && !s.demi) return null;
    if (s.encounter && (!Array.isArray(s.encounter.battle?.columns) || !Array.isArray(s.encounter.battle?.party))) return null;
    if ([s.hero, ...(s.demi ? [s.demi] : [])].some(a => a.charge > apCap(a))) return null;
    return s;
  } catch { return null; }
}
