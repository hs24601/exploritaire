/** Pure rules for the ?city slice: kin, tokens, zones, buildings, recipes, rest and save data. */

export type ResourceId = 'berry' | 'wood' | 'stone' | 'reed' | 'fish' | 'dried';
export type KinId = 'hero' | 'mochi' | 'banks' | 'demi' | 'cir' | 'riv';
export type BuildingId = 'woodpile' | 'burrow' | 'rack' | 'dam' | 'lookout' | 'wheel';
export type ZoneId = 'den' | 'thicket' | 'hollow' | 'stream' | 'frost' | 'ember';
export type EncounterId = 'slimes' | 'roots' | 'frost' | 'ember';
export type CardKind = 'bush' | 'tree' | 'outcrop' | 'reeds' | 'pool';

export type AbilityDef = { name: string; cost: number; damage: number; stagger: number; heal?: number; text: string };
export type KinDef = { name: string; stamina: number; food: number; hp: number; affinity: ResourceId | null; ability: AbilityDef; blurb: string };

/** Provisional first-pass values: each kin has its own stamina, appetite and HP. */
export const KIN: Record<KinId, KinDef> = {
  hero: { name: 'Hero', stamina: 4, food: 2, hp: 12, affinity: null, blurb: 'Steady all-rounder.', ability: { name: 'Bite', cost: 2, damage: 3, stagger: 1, text: '3 damage, 1 stagger' } },
  mochi: { name: 'Mochi', stamina: 3, food: 1, hp: 9, affinity: 'berry', blurb: 'Quick paws for berries.', ability: { name: 'Scratch', cost: 2, damage: 1, stagger: 3, text: '1 damage, 3 stagger' } },
  banks: { name: 'Banks', stamina: 5, food: 2, hp: 14, affinity: 'wood', blurb: 'Strong back for timber.', ability: { name: 'Pounce', cost: 3, damage: 4, stagger: 2, text: '4 damage, 2 stagger' } },
  demi: { name: 'Demi', stamina: 6, food: 3, hp: 16, affinity: 'stone', blurb: 'Tireless, hungry digger.', ability: { name: 'Frost Claw', cost: 3, damage: 2, stagger: 4, text: '2 damage, 4 stagger' } },
  cir: { name: 'Cir', stamina: 3, food: 1, hp: 8, affinity: null, blurb: 'Fragile, fierce flame.', ability: { name: 'Burn', cost: 2, damage: 3, stagger: 2, text: '3 damage, 2 stagger' } },
  riv: { name: 'Riv', stamina: 4, food: 2, hp: 11, affinity: 'fish', blurb: 'At home in the water.', ability: { name: 'Mend', cost: 2, damage: 0, stagger: 0, heal: 4, text: 'Heal an ally 4' } },
};
export const KIN_ORDER: KinId[] = ['hero', 'mochi', 'banks', 'riv', 'demi', 'cir'];

export const RESOURCES: Record<ResourceId, { name: string; plural: string; food: number }> = {
  berry: { name: 'Berry', plural: 'Berries', food: 1 },
  wood: { name: 'Wood', plural: 'Wood', food: 0 },
  stone: { name: 'Stone', plural: 'Stone', food: 0 },
  reed: { name: 'Reed', plural: 'Reeds', food: 0 },
  fish: { name: 'Fish', plural: 'Fish', food: 2 },
  dried: { name: 'Dried berries', plural: 'Dried berries', food: 2 },
};
export const RESOURCE_ORDER: ResourceId[] = ['berry', 'dried', 'fish', 'wood', 'stone', 'reed'];

export const CARD_KINDS: Record<CardKind, { name: string; resource: ResourceId; max: number; regrow: number }> = {
  bush: { name: 'Berry Bush', resource: 'berry', max: 12, regrow: 6 },
  tree: { name: 'Old Tree', resource: 'wood', max: 10, regrow: 4 },
  outcrop: { name: 'Stone Outcrop', resource: 'stone', max: 8, regrow: 3 },
  reeds: { name: 'Reed Bed', resource: 'reed', max: 10, regrow: 5 },
  pool: { name: 'Fishing Pool', resource: 'fish', max: 6, regrow: 3 },
};

export type BuildingDef = { name: string; cost: Partial<Record<ResourceId, number>>; text: string; repeatable: boolean; pair?: [ResourceId, ResourceId]; card?: string };
export const BUILDINGS: Record<BuildingId, BuildingDef> = {
  woodpile: { name: 'Woodpile', cost: { wood: 6 }, text: '+10 storage for every token', repeatable: true, pair: ['wood', 'wood'] },
  burrow: { name: 'Burrow', cost: { wood: 6, stone: 2 }, text: '+1 housing for a rescued kin', repeatable: true, pair: ['wood', 'stone'] },
  rack: { name: 'Drying Rack', cost: { wood: 4, berry: 6 }, text: 'Dry 3 berries into 2 dried berries (2 food each)', repeatable: false, pair: ['berry', 'wood'] },
  lookout: { name: 'Lookout', cost: { wood: 6, stone: 2 }, text: 'Exploring costs no stamina', repeatable: false, pair: ['stone', 'stone'] },
  dam: { name: 'Beaver Dam', cost: { wood: 10, stone: 4 }, text: 'Opens the Stream', repeatable: false, card: 'Won from the Root Hollow' },
  wheel: { name: 'Water Wheel', cost: { wood: 8, reed: 4 }, text: '+1 max stamina for every kin', repeatable: false, card: 'Found in a long Reed Bed game' },
};
export const BUILDING_ORDER: BuildingId[] = ['woodpile', 'burrow', 'rack', 'lookout', 'dam', 'wheel'];

export type EncounterDef = { name: string; foes: ('slime' | 'root')[] };
export const ENCOUNTERS: Record<EncounterId, EncounterDef> = {
  slimes: { name: 'Dark Slimes', foes: ['slime', 'slime'] },
  roots: { name: 'Khad Root', foes: ['root', 'slime'] },
  frost: { name: 'Frozen Roots', foes: ['root', 'root'] },
  ember: { name: 'Smouldering Thicket', foes: ['root', 'slime', 'slime'] },
};

export type ZoneDef = { name: string; cards: CardKind[]; encounter?: EncounterId; rescue?: KinId; recipe?: BuildingId; requires?: BuildingId };
export const ZONES: Record<ZoneId, ZoneDef> = {
  den: { name: 'Den Clearing', cards: ['bush', 'bush', 'tree'] },
  thicket: { name: 'The Thicket', cards: ['tree', 'outcrop'], encounter: 'slimes', rescue: 'banks' },
  hollow: { name: 'Root Hollow', cards: ['bush', 'tree'], encounter: 'roots', recipe: 'dam' },
  stream: { name: 'The Stream', cards: ['reeds', 'pool'], rescue: 'riv', requires: 'dam' },
  frost: { name: 'Frost Hollow', cards: ['outcrop', 'bush'], encounter: 'frost', rescue: 'demi' },
  ember: { name: 'Ember Ridge', cards: ['tree', 'outcrop'], encounter: 'ember', rescue: 'cir' },
};
export const ZONE_ORDER: ZoneId[] = ['den', 'thicket', 'hollow', 'stream', 'frost', 'ember'];

export type KinState = { id: KinId; housed: boolean; stamina: number; hp: number; malnourished: boolean };
export type ResourceCard = { id: string; kind: CardKind; zone: ZoneId; yield: number };
export type ZoneState = { id: ZoneId; revealed: boolean; cleared: boolean };
export type CityState = {
  version: 1;
  day: number;
  kin: KinState[];
  tokens: Record<ResourceId, number>;
  cards: ResourceCard[];
  zones: ZoneState[];
  buildings: BuildingId[];
  recipes: BuildingId[];
  layout: 'columns' | 'grid';
  seed: number;
  lastRest?: RestReport;
  /** Where each loose card sits on the table, in table units. Missing entries are placed automatically. */
  table?: Record<string, { x: number; y: number }>;
};
export type RestReport = { day: number; eaten: number; fed: KinId[]; hungry: KinId[] };

export const BASE_HOUSING = 2;
export const BASE_STORAGE = 20;
export const SAVE_KEY = 'exploritaire.city.v1';

export function createCity(seed = 1): CityState {
  const cards: ResourceCard[] = [];
  for (const zone of ZONE_ORDER) ZONES[zone].cards.forEach((kind, i) => cards.push({ id: `${zone}-${kind}-${i}`, kind, zone, yield: CARD_KINDS[kind].max }));
  return {
    version: 1, day: 1, seed,
    kin: [freshKin('hero', true), freshKin('mochi', true)],
    tokens: { berry: 4, wood: 0, stone: 0, reed: 0, fish: 0, dried: 0 },
    cards,
    zones: ZONE_ORDER.map(id => ({ id, revealed: id === 'den', cleared: !ZONES[id].encounter })),
    buildings: [], recipes: [], layout: 'columns',
  };
}

function freshKin(id: KinId, housed: boolean): KinState {
  return { id, housed, stamina: KIN[id].stamina, hp: KIN[id].hp, malnourished: false };
}

const count = (s: CityState, b: BuildingId) => s.buildings.filter(x => x === b).length;
export const has = (s: CityState, b: BuildingId) => s.buildings.includes(b);
export const housing = (s: CityState) => BASE_HOUSING + count(s, 'burrow');
export const storage = (s: CityState) => BASE_STORAGE + 10 * count(s, 'woodpile');
export const maxStamina = (s: CityState, k: KinState) => Math.max(1, KIN[k.id].stamina + (has(s, 'wheel') ? 1 : 0) - (k.malnourished ? 2 : 0));
export const maxHp = (k: KinState) => k.malnourished ? Math.ceil(KIN[k.id].hp * 0.75) : KIN[k.id].hp;
export const activeKin = (s: CityState) => s.kin.filter(k => k.housed);
export const kinOf = (s: CityState, id: KinId) => s.kin.find(k => k.id === id);
export const zoneOf = (s: CityState, id: ZoneId) => s.zones.find(z => z.id === id)!;
export const foodNeed = (s: CityState) => activeKin(s).reduce((n, k) => n + KIN[k.id].food, 0);
export const foodStored = (s: CityState) => RESOURCE_ORDER.reduce((n, r) => n + s.tokens[r] * RESOURCES[r].food, 0);

const withKin = (s: CityState, id: KinId, f: (k: KinState) => KinState): CityState => ({ ...s, kin: s.kin.map(k => k.id === id ? f(k) : k) });

export function canAfford(s: CityState, cost: Partial<Record<ResourceId, number>>) {
  return (Object.keys(cost) as ResourceId[]).every(r => s.tokens[r] >= (cost[r] ?? 0));
}

export function spendStamina(s: CityState, id: KinId, n = 1): CityState | null {
  const k = kinOf(s, id);
  if (!k?.housed || k.stamina < n) return null;
  return withKin(s, id, x => ({ ...x, stamina: x.stamina - n }));
}

/** Adds gathered tokens, bounded by the card's remaining yield and storage. Returns the amount actually gained. */
export function gather(s: CityState, cardId: string, amount: number): { state: CityState; gained: number } {
  const card = s.cards.find(c => c.id === cardId);
  if (!card || amount <= 0) return { state: s, gained: 0 };
  const r = CARD_KINDS[card.kind].resource;
  const gained = Math.max(0, Math.min(amount, card.yield, storage(s) - s.tokens[r]));
  if (!gained) return { state: s, gained: 0 };
  return {
    gained,
    state: { ...s, tokens: { ...s.tokens, [r]: s.tokens[r] + gained }, cards: s.cards.map(c => c.id === cardId ? { ...c, yield: c.yield - gained } : c) },
  };
}

/** Receipt yield: 1 per receipt, +1 on every 5th card of a streak, or every 3rd for a kin whose affinity matches. */
export function receiptYield(streak: number, kin: KinId, resource: ResourceId) {
  const every = KIN[kin].affinity === resource ? 3 : 5;
  return streak > 0 && streak % every === 0 ? 2 : 1;
}

export function canExplore(s: CityState, zone: ZoneId) {
  const z = zoneOf(s, zone), req = ZONES[zone].requires;
  return !z.revealed && (!req || has(s, req));
}
export const exploreCost = (s: CityState) => has(s, 'lookout') ? 0 : 1;

export function explore(s: CityState, zone: ZoneId, kin: KinId): CityState | null {
  if (!canExplore(s, zone)) return null;
  const paid = exploreCost(s) ? spendStamina(s, kin, exploreCost(s)) : s;
  if (!paid) return null;
  let next: CityState = { ...paid, zones: paid.zones.map(z => z.id === zone ? { ...z, revealed: true } : z) };
  // Zones without an encounter hand over their rescue on discovery (the Stream's Riv).
  if (!ZONES[zone].encounter) next = rescue(next, ZONES[zone].rescue);
  return next;
}

export function rescue(s: CityState, id: KinId | undefined): CityState {
  if (!id || kinOf(s, id)) return s;
  const housed = activeKin(s).length < housing(s);
  return { ...s, kin: [...s.kin, freshKin(id, housed)] };
}

/** Rehouse waiting kin whenever housing grows. */
export function settle(s: CityState): CityState {
  let room = housing(s) - activeKin(s).length;
  if (room <= 0 || s.kin.every(k => k.housed)) return s;
  return { ...s, kin: s.kin.map(k => !k.housed && room-- > 0 ? { ...k, housed: true } : k) };
}

export function clearZone(s: CityState, zone: ZoneId): CityState {
  let next: CityState = { ...s, zones: s.zones.map(z => z.id === zone ? { ...z, cleared: true } : z) };
  next = rescue(next, ZONES[zone].rescue);
  const recipe = ZONES[zone].recipe;
  if (recipe) next = learn(next, recipe);
  return next;
}

export function learn(s: CityState, b: BuildingId): CityState {
  return s.recipes.includes(b) ? s : { ...s, recipes: [...s.recipes, b] };
}

/** Combining two token stacks discovers the building whose recipe pairs them. */
export function combine(s: CityState, a: ResourceId, b: ResourceId): { state: CityState; found: BuildingId | null } {
  if (s.tokens[a] < (a === b ? 2 : 1) || s.tokens[b] < 1) return { state: s, found: null };
  const key = [a, b].sort().join('+');
  const found = BUILDING_ORDER.find(id => BUILDINGS[id].pair && [...BUILDINGS[id].pair!].sort().join('+') === key) ?? null;
  if (!found || s.recipes.includes(found)) return { state: s, found: null };
  return { state: learn(s, found), found };
}

export function canBuild(s: CityState, b: BuildingId) {
  return s.recipes.includes(b) && (BUILDINGS[b].repeatable || !has(s, b)) && canAfford(s, BUILDINGS[b].cost);
}

export function build(s: CityState, b: BuildingId): CityState | null {
  if (!canBuild(s, b)) return null;
  const tokens = { ...s.tokens };
  for (const [r, n] of Object.entries(BUILDINGS[b].cost) as [ResourceId, number][]) tokens[r] -= n;
  let next: CityState = { ...s, tokens, buildings: [...s.buildings, b] };
  if (b === 'wheel') next = { ...next, kin: next.kin.map(k => ({ ...k, stamina: k.stamina + 1 })) };
  return settle(next);
}

export function dryBerries(s: CityState): CityState | null {
  if (!has(s, 'rack') || s.tokens.berry < 3 || s.tokens.dried + 2 > storage(s)) return null;
  return { ...s, tokens: { ...s.tokens, berry: s.tokens.berry - 3, dried: s.tokens.dried + 2 } };
}

/** Rest: feed kin in roster order (fish, then dried, then berries), refill stamina, heal, regrow cards and start a new day. */
export function rest(s: CityState): CityState {
  const tokens = { ...s.tokens };
  const fed: KinId[] = [], hungry: KinId[] = [];
  let eaten = 0;
  const kin = s.kin.map(k => {
    if (!k.housed) return k;
    let need = KIN[k.id].food;
    for (const r of ['fish', 'dried', 'berry'] as ResourceId[]) {
      while (need > 0 && tokens[r] > 0) { tokens[r]--; need -= RESOURCES[r].food; eaten++; }
    }
    const ok = need <= 0;
    (ok ? fed : hungry).push(k.id);
    const next = { ...k, malnourished: !ok };
    const top = maxHp(next);
    return { ...next, stamina: maxStamina(s, next), hp: ok ? top : Math.min(top, Math.max(k.hp, Math.ceil(top / 2))) };
  });
  const cards = s.cards.map(c => ({ ...c, yield: Math.min(CARD_KINDS[c.kind].max, c.yield + CARD_KINDS[c.kind].regrow) }));
  return { ...s, day: s.day + 1, tokens, kin, cards, lastRest: { day: s.day, eaten, fed, hungry } };
}

export function load(raw: string | null): CityState | null {
  if (!raw) return null;
  try {
    const data = JSON.parse(raw) as CityState;
    return data?.version === 1 && Array.isArray(data.kin) && data.tokens ? data : null;
  } catch { return null; }
}
