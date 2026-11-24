// Village rules: buildings, combos, kin, rank and nightfall. Pure functions.
import { DAYLIGHT } from './daylight';
import type { ResourceId, SurfaceId } from './surfaces';

export type Tag = 'Warm' | 'Quiet' | 'Sweet' | 'Bright';
export type BuildingId = 'leanto' | 'burrow' | 'campfire' | 'bench' | 'stall' | 'rack' | 'lantern' | 'well';
export type KinId = 'mochi' | 'banks' | 'cir';
export type Cost = Partial<Record<ResourceId, number>>;
export type Resources = Record<ResourceId, number>;

export interface BuildingDef {
  id: BuildingId;
  name: string;
  cost: Cost;
  beds?: number;
  appeal?: number;
  tag?: Tag;
  effect: string;
  /** Needs Village rank. */
  rank: 1 | 2;
}

export const BUILDINGS: Record<BuildingId, BuildingDef> = {
  leanto: { id: 'leanto', name: 'Lean-to', cost: { lumber: 30 }, beds: 1, rank: 1, effect: 'Shelter for 1.' },
  campfire: { id: 'campfire', name: 'Campfire', cost: { lumber: 25 }, appeal: 2, tag: 'Warm', rank: 1, effect: 'Warm. +2 appeal.' },
  bench: { id: 'bench', name: 'Log Bench', cost: { lumber: 20 }, appeal: 1, tag: 'Quiet', rank: 1, effect: 'Quiet. +1 appeal.' },
  stall: { id: 'stall', name: 'Berry Stall', cost: { lumber: 20, food: 25 }, appeal: 2, tag: 'Sweet', rank: 1, effect: 'Sweet. +2 appeal.' },
  rack: { id: 'rack', name: 'Drying Rack', cost: { lumber: 30 }, rank: 1, effect: 'Food no longer spoils.' },
  burrow: { id: 'burrow', name: 'Burrow', cost: { lumber: 50, stone: 40 }, beds: 2, appeal: 1, rank: 2, effect: 'Shelter for 2. +1 appeal.' },
  lantern: { id: 'lantern', name: 'Lantern Post', cost: { lumber: 20, stone: 25 }, appeal: 1, tag: 'Bright', rank: 2, effect: 'Bright. Dusk 1h later.' },
  well: { id: 'well', name: 'Stone Well', cost: { stone: 50 }, appeal: 3, rank: 2, effect: '+3 appeal.' },
};
export const BUILD_ORDER: BuildingId[] = ['leanto', 'campfire', 'bench', 'stall', 'rack', 'burrow', 'lantern', 'well'];

export interface ComboDef { id: string; name: string; pair: [BuildingId, BuildingId]; appeal: number; effect: string }
export const COMBOS: ComboDef[] = [
  { id: 'hearth', name: 'Hearth', pair: ['campfire', 'bench'], appeal: 2, effect: '+2 appeal' },
  { id: 'pantry', name: 'Pantry', pair: ['stall', 'rack'], appeal: 2, effect: '+2 appeal' },
  { id: 'lamplit', name: 'Lamplit Path', pair: ['lantern', 'well'], appeal: 2, effect: '+2 appeal' },
];

export interface KinDef {
  id: KinId;
  name: string;
  portrait: string;
  /** Appeal the village needs before this kin wanders by. */
  appealNeeded: number;
  likes: Tag[];
  eats: number;
  perk: string;
  /** One-line version for compact rows. */
  perkShort: string;
  surface?: SurfaceId;
}
const ART = '/assets/runtime';
export const KIN: Record<KinId, KinDef> = {
  mochi: { id: 'mochi', name: 'Mochi', portrait: `${ART}/characters/mochi/expressions/emojis/watercolor/v1/mochi_emoji_happy.png`,
    appealNeeded: 0, likes: ['Sweet', 'Warm'], eats: 8, surface: 'berries',
    perk: 'Berry Patch: every chain of 5 picks gives +1 food.', perkShort: 'Berries: +1 food per 5-chain' },
  banks: { id: 'banks', name: 'Banks', portrait: `${ART}/characters/banks/expressions/emojis/watercolor/v4/banks_emoji_happy.png`,
    appealNeeded: 4, likes: ['Quiet', 'Warm'], eats: 10, surface: 'forest',
    perk: 'Forest: felling a tree gives +2 more lumber.', perkShort: 'Forest: +2 per felled tree' },
  cir: { id: 'cir', name: 'Cir', portrait: `${ART}/keru/cir/cir-watercolor-v1.png`,
    appealNeeded: 8, likes: ['Bright'], eats: 6, surface: 'quarry',
    perk: 'Quarry: the first stock card each run costs no daylight.', perkShort: 'Quarry: first stock card free' },
};
export const KIN_ORDER: KinId[] = ['mochi', 'banks', 'cir'];

export const PLOT_COLS = 5;
export const PLOT_ROWS = 3;
export const SPOIL_RATE = 0.25;
export const LEAVE_AFTER_HUNGRY = 2;
export const WANDERER_STAYS = 3;

export interface Resident { kin: KinId; hungry: number }
export interface Wanderer { kin: KinId; daysLeft: number }

export interface VillageState {
  resources: Resources;
  /** Plot index -> building. */
  plots: (BuildingId | null)[];
  residents: Resident[];
  gate: Wanderer[];
  /** Kin that have left for good this save (they don't come back). */
  gone: KinId[];
}

export function newVillage(): VillageState {
  return {
    resources: { lumber: 0, food: 10, stone: 0 },
    plots: Array(PLOT_COLS * PLOT_ROWS).fill(null),
    residents: [],
    gate: [{ kin: 'mochi', daysLeft: WANDERER_STAYS }],
    gone: [],
  };
}

export function canAfford(res: Resources, cost: Cost): boolean {
  return (Object.keys(cost) as ResourceId[]).every(k => res[k] >= (cost[k] ?? 0));
}

export function pay(res: Resources, cost: Cost): Resources {
  const out = { ...res };
  for (const k of Object.keys(cost) as ResourceId[]) out[k] -= cost[k] ?? 0;
  return out;
}

export function built(v: VillageState, id: BuildingId): boolean {
  return v.plots.includes(id);
}

export function neighboursOf(i: number): number[] {
  const r = Math.floor(i / PLOT_COLS), c = i % PLOT_COLS;
  const out: number[] = [];
  if (r > 0) out.push(i - PLOT_COLS);
  if (r < PLOT_ROWS - 1) out.push(i + PLOT_COLS);
  if (c > 0) out.push(i - 1);
  if (c < PLOT_COLS - 1) out.push(i + 1);
  return out;
}

/** Active combos with the plot pair that forms each one (first match). */
export function activeCombos(plots: (BuildingId | null)[]): { combo: ComboDef; at: [number, number] }[] {
  const out: { combo: ComboDef; at: [number, number] }[] = [];
  for (const combo of COMBOS) {
    let found: [number, number] | null = null;
    plots.forEach((b, i) => {
      if (found || b !== combo.pair[0]) return;
      const j = neighboursOf(i).find(n => plots[n] === combo.pair[1]);
      if (j !== undefined) found = [i, j];
    });
    if (found) out.push({ combo, at: found });
  }
  return out;
}

export function appeal(v: VillageState): number {
  const base = v.plots.reduce((n, b) => n + (b ? BUILDINGS[b].appeal ?? 0 : 0), 0);
  return base + activeCombos(v.plots).reduce((n, c) => n + c.combo.appeal, 0);
}

export function tags(v: VillageState): Tag[] {
  return [...new Set(v.plots.flatMap(b => (b && BUILDINGS[b].tag ? [BUILDINGS[b].tag!] : [])))];
}

export function beds(v: VillageState): number {
  return v.plots.reduce((n, b) => n + (b ? BUILDINGS[b].beds ?? 0 : 0), 0);
}

export function freeBeds(v: VillageState): number {
  return beds(v) - v.residents.length;
}

export function hasResident(v: VillageState, kin: KinId): boolean {
  return v.residents.some(r => r.kin === kin && r.hungry === 0);
}

export type RankId = 1 | 2 | 3;
export const RANKS: Record<RankId, { name: string; residents: number; appeal: number; unlocks: string }> = {
  1: { name: 'Hamlet', residents: 0, appeal: 0, unlocks: 'Forest and Berry Patch' },
  2: { name: 'Village', residents: 2, appeal: 5, unlocks: 'the Quarry and stone buildings' },
  3: { name: 'Town', residents: 3, appeal: 12, unlocks: 'the end of this slice' },
};

export function rank(v: VillageState): RankId {
  const a = appeal(v), n = v.residents.length;
  if (n >= RANKS[3].residents && a >= RANKS[3].appeal) return 3;
  if (n >= RANKS[2].residents && a >= RANKS[2].appeal) return 2;
  return 1;
}

/** Wanderers move in only when there's a bed and the village has something they like. */
export function welcomeBlocker(v: VillageState, kin: KinId): string | null {
  if (freeBeds(v) <= 0) return 'Needs a free bed';
  const likes = KIN[kin].likes;
  if (v.residents.length > 0 && !likes.some(t => tags(v).includes(t))) return `Wants ${likes.join(' or ')}`;
  return null;
}

export function welcome(v: VillageState, kin: KinId): VillageState {
  if (welcomeBlocker(v, kin)) return v;
  return { ...v, residents: [...v.residents, { kin, hungry: 0 }], gate: v.gate.filter(w => w.kin !== kin) };
}

export function dayLength(v: VillageState): number {
  return DAYLIGHT.dayMinutes + (built(v, 'lantern') ? 60 : 0);
}

export interface NightReport {
  eaten: number;
  spoiled: number;
  hungry: KinId[];
  left: KinId[];
  arrived: KinId[];
  wandered: KinId[];
  rankBefore: RankId;
  rankAfter: RankId;
}

/** Nightfall: residents eat, food spoils, hungry kin may leave, wanderers come and go. */
export function nightfall(v: VillageState): { village: VillageState; report: NightReport } {
  const rankBefore = rank(v);
  let food = v.resources.food;
  let eaten = 0;
  const hungry: KinId[] = [];
  const left: KinId[] = [];
  const residents: Resident[] = [];
  for (const r of v.residents) {
    const need = KIN[r.kin].eats;
    if (food >= need) { food -= need; eaten += need; residents.push({ kin: r.kin, hungry: 0 }); continue; }
    const h = r.hungry + 1;
    if (h >= LEAVE_AFTER_HUNGRY) left.push(r.kin);
    else { hungry.push(r.kin); residents.push({ kin: r.kin, hungry: h }); }
  }
  const spoiled = built(v, 'rack') ? 0 : Math.floor(food * SPOIL_RATE);
  food -= spoiled;
  const gone = [...v.gone, ...left];
  const after: VillageState = { ...v, resources: { ...v.resources, food }, residents, gone };
  // Wanderers at the gate lose a day; those out of days move on (and may come back).
  const staying = v.gate.map(w => ({ ...w, daysLeft: w.daysLeft - 1 })).filter(w => w.daysLeft > 0);
  const wandered = v.gate.filter(w => w.daysLeft <= 1).map(w => w.kin);
  const a = appeal(after);
  const present = new Set<KinId>([...residents.map(r => r.kin), ...staying.map(w => w.kin), ...gone]);
  const arrived = KIN_ORDER.filter(k => !present.has(k) && !wandered.includes(k) && a >= KIN[k].appealNeeded).slice(0, 1);
  const gate = [...staying, ...arrived.map(kin => ({ kin, daysLeft: WANDERER_STAYS }))];
  const village = { ...after, gate };
  return { village, report: { eaten, spoiled, hungry, left, arrived, wandered, rankBefore, rankAfter: rank(village) } };
}
