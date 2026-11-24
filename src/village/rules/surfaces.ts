import { rng, shuffledDeck, type Card, type Pile, type Rank, type Run } from './golf';

export type SurfaceId = 'forest' | 'berries' | 'quarry';
export type ResourceId = 'lumber' | 'food' | 'stone';

export interface SurfaceDef {
  id: SurfaceId;
  name: string;
  skill: string;
  resource: ResourceId;
  /** One-line rule twist, shown on the surface panel. */
  twist: string;
  layout: 'columns' | 'grid' | 'shafts';
  locations: [LocationDef, LocationDef];
  deal: (seed: number, location?: 0 | 1) => Run;
}

export interface LocationDef { name: string; note: string; masteryNeeded: number }

const WRAP = true;

function baseRun(piles: Pile[], stock: Card[], fellBonus = 0): Run {
  const first = stock.pop()!;
  return {
    piles, stock, wrap: WRAP, foundation: [{ ...first, unripe: false, hidden: false }],
    receipts: 0, earned: 0, bonus: 0, draws: 0, chain: 0, bestChain: 0, felled: 0, fellBonus,
  };
}

/** Forest: 8 columns of 4 logs; each two adjacent columns are one tree (4 trees).
 *  A column pays its lumber only when it's finished; finishing both columns fells the tree for a bundle. */
export const FOREST_COLUMNS = 8;
export const FOREST_DEPTH = 4;
export const FELL_BONUS = 2;
export const OLD_OAK_FELL_BONUS = 5;
function dealForest(seed: number, location: 0 | 1 = 0): Run {
  const ranks = shuffledDeck(rng(seed));
  let id = 0;
  const card = (rank: Rank): Card => ({ id: id++, rank, yield: 1 });
  const piles: Pile[] = Array.from({ length: FOREST_COLUMNS }, (_, i) => ({ cards: [] as Card[], tree: i >> 1, held: 0 }));
  for (let row = 0; row < FOREST_DEPTH; row++) for (const p of piles) p.cards.push(card(ranks.pop()!));
  return baseRun(piles, ranks.map(card), location ? OLD_OAK_FELL_BONUS : FELL_BONUS);
}

/** Berry patch: 3x3 bushes of 4. Unripe berries ripen when a neighbour is picked. */
export const BERRY_DEPTH = 4;
export const UNRIPE_CHANCE = 0.3;
export const THICKET_UNRIPE_CHANCE = 0.5;
const GRID_NEIGHBOURS = [[1, 3], [0, 2, 4], [1, 5], [0, 4, 6], [1, 3, 5, 7], [2, 4, 8], [3, 7], [4, 6, 8], [5, 7]];
function dealBerries(seed: number, location: 0 | 1 = 0): Run {
  const rand = rng(seed);
  const ranks = shuffledDeck(rand);
  let id = 0;
  const piles: Pile[] = GRID_NEIGHBOURS.map(n => ({ cards: [] as Card[], neighbours: n }));
  for (let row = 0; row < BERRY_DEPTH; row++) for (const p of piles) p.cards.push({ id: id++, rank: ranks.pop()!, yield: location ? 2 : 1, unripe: rand() < (location ? THICKET_UNRIPE_CHANCE : UNRIPE_CHANCE) });
  // Never open on a fully green patch: the centre bush always starts ripe.
  const centre = piles[4].cards;
  centre[centre.length - 1] = { ...centre[centre.length - 1], unripe: false };
  return baseRun(piles, ranks.map(rank => ({ id: id++, rank, yield: 1 })));
}

/** Quarry: 6 shafts of 5, face-down below the surface; deeper rock pays more. */
export const QUARRY_SHAFTS = 6;
export const QUARRY_DEPTH = 5;
/** Yield by depth, surface first. */
export const DEPTH_YIELD = [1, 1, 2, 2, 3];
export const DEEP_SEAM_YIELD = [1, 2, 2, 3, 4];
function dealQuarry(seed: number, location: 0 | 1 = 0): Run {
  const ranks = shuffledDeck(rng(seed));
  let id = 0;
  const piles: Pile[] = Array.from({ length: QUARRY_SHAFTS }, () => ({ cards: [] as Card[] }));
  // Deal deepest first so the surface card ends on top.
  for (let depth = QUARRY_DEPTH - 1; depth >= 0; depth--) {
    for (const p of piles) p.cards.push({ id: id++, rank: ranks.pop()!, yield: (location ? DEEP_SEAM_YIELD : DEPTH_YIELD)[depth], hidden: depth > 0 });
  }
  return baseRun(piles, ranks.map(rank => ({ id: id++, rank, yield: 1 })));
}

export const SURFACES: Record<SurfaceId, SurfaceDef> = {
  forest: { id: 'forest', name: 'Forest', skill: 'Forestry', resource: 'lumber', layout: 'columns', deal: dealForest,
    locations: [{ name: 'Birch Stand', note: 'Light timber', masteryNeeded: 1 }, { name: 'Old Oaks', note: `Felling pays +${OLD_OAK_FELL_BONUS}`, masteryNeeded: 3 }],
    twist: `Two columns make a tree. A column pays only once it's finished; finish both to fell the tree for +${FELL_BONUS}.` },
  berries: { id: 'berries', name: 'Berry Patch', skill: 'Foraging', resource: 'food', layout: 'grid', deal: dealBerries,
    locations: [{ name: 'Sunny Hedge', note: 'Sweet and easy', masteryNeeded: 1 }, { name: 'Bramble Thicket', note: 'Greener, 2 food a berry', masteryNeeded: 3 }],
    twist: 'Green berries ripen when a bush beside them is picked.' },
  quarry: { id: 'quarry', name: 'Quarry', skill: 'Mining', resource: 'stone', layout: 'shafts', deal: dealQuarry,
    locations: [{ name: 'Rubble Pit', note: 'Shallow stone', masteryNeeded: 1 }, { name: 'Deep Seam', note: 'Richer at depth', masteryNeeded: 3 }],
    twist: 'Rock is hidden until you dig to it. Deeper rock pays more.' },
};

export const SURFACE_ORDER: SurfaceId[] = ['forest', 'berries', 'quarry'];
