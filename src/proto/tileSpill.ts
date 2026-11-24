/** Edge spill between unlike neighbouring tiles. Each type's surface profile
 * selects compatible neighbours automatically, with per-pair rule overrides;
 * the decals straddle the shared edge and thin out into the neighbour, so
 * tiles read less square while each keeps its own type, label and rules.
 * Pure and DOM-free; presentation only (nothing in play reads a spill).
 * Companion to terrainAutotile.ts, which joins like tiles. */
import { MIN_SPILL_HEIGHT, SCENERY_HEIGHTS } from './sceneryHeight';
import { cellRoll, type AutotileCell } from './terrainAutotile';

export type SpillSide = 'north' | 'east' | 'south' | 'west';
export type SpillRule = {
  /** Tile kind that spills (tileType, else terrain). */
  from: string;
  /** Neighbour kinds it spills onto. */
  onto: readonly string[];
  /** Sides of the source it spills from; all four when omitted. */
  sides?: readonly SpillSide[];
  /** Decal files under assets/deprecated/pixel/environment/spill/. */
  art: readonly string[];
  /** Decals per shared edge. */
  count: number;
  /** Physical relief in shared height units; minimum and default are 1 in immersion. */
  relief?: number;
  /** Optional deterministic local height variation, in shared units. */
  reliefRange?: readonly [number, number];
  /** How far into the neighbour decals reach, in cells. */
  reach: number;
  /** How far back over the source's own edge a decal may start, in cells. */
  overlap: number;
  /** Decal size range, in world px (the longer side). */
  size: readonly [number, number];
  /** Share of the edge's length decals spread along, centred (default 1). */
  spread?: number;
};
export type SpillDecal = {
  id: string; art: string; x: number; y: number; size: number;
  sourceTileId?: string; targetTileId?: string;
  /** Quarter turns and mirror; pixel art stays crisp. */
  turn: 0 | 90 | 180 | 270; flip: boolean;
  from: string; onto: string; relief: number;
};
type Rect = { left: number; top: number; right: number; bottom: number };
/** Accept live map tiles directly; `kind` also supports small standalone maps. */
export type SpillTile = {
  id: string; kind?: string; tileType?: string; terrain?: string; road?: unknown;
  flags?: readonly string[]; unlocked?: boolean;
  position: { x: number; y: number };
};

const STEPS: Record<SpillSide, { x: number; y: number }> = { north: { x: 0, y: -1 }, east: { x: 1, y: 0 }, south: { x: 0, y: 1 }, west: { x: -1, y: 0 } };

const PEBBLES = ['pebble-a.svg', 'pebble-b.svg', 'pebble-c.svg', 'pebble-d.svg'];
/** The project's spill rules: the den's cave mouth sheds stones onto the
 * dirt in front of it; berry foliage crosses their already shared earth base. */
export const TILE_SPILLS: readonly SpillRule[] = [
  { from: 'hero-den', onto: ['dirt'], sides: ['north'], art: PEBBLES, relief: SCENERY_HEIGHTS.denSpill, count: 12, reach: .45, overlap: .08, size: [4, 10], spread: .62 },
  { from: 'berry-patch', onto: ['dirt'], art: ['sprig-a.svg', 'sprig-b.svg', 'sprig-c.svg'], reliefRange: [1, 3], count: 6, reach: .32, overlap: .16, size: [9, 15] },
];

export type SpillSurface = 'soil' | 'vegetation' | 'rock' | 'water';
/** A new tile type supplies one profile, rather than rules for every pairing.
 * Receiving surfaces are explicit: land debris never spills onto water or an
 * unregistered type. Same surfaces join without scattering duplicate edges. */
export type TileSpillProfile = {
  surface: SpillSurface;
  /** Optional incoming-surface restriction; [] protects authored structures. */
  accepts?: readonly SpillSurface[];
  spill?: Omit<SpillRule, 'from' | 'onto'> & { onto: readonly SpillSurface[] };
};
const foliage: NonNullable<TileSpillProfile['spill']> = {
  onto: ['soil', 'rock'], art: ['sprig-a.svg', 'sprig-b.svg', 'sprig-c.svg'],
  count: 4, reach: .32, overlap: .16, size: [7, 10], reliefRange: [1, 2],
};
const earth: NonNullable<TileSpillProfile['spill']> = {
  onto: ['rock'], art: ['clod-a.svg', 'clod-b.svg', 'clod-c.svg'],
  count: 6, reach: .3, overlap: .16, size: [8, 13], reliefRange: [1, 1.6],
};
export const TILE_SPILL_PROFILES: Readonly<Record<string, TileSpillProfile>> = {
  'hero-den': { surface: 'rock', accepts: [], spill: { onto: ['soil', 'vegetation'], sides: ['north'], art: PEBBLES,
    relief: SCENERY_HEIGHTS.denSpill, count: 12, reach: .45, overlap: .08, size: [4, 10], spread: .62 } },
  'impassable-mountain': { surface: 'rock', spill: { onto: ['soil', 'vegetation'], art: PEBBLES,
    relief: SCENERY_HEIGHTS.denSpill, reliefRange: [1, 2], count: 6, reach: .32, overlap: .12, size: [7, 11] } },
  'berry-patch': { surface: 'vegetation', spill: foliage },
  woods: { surface: 'vegetation', spill: foliage },
  dirt: { surface: 'soil', spill: earth },
  path: { surface: 'soil', spill: earth },
  road: { surface: 'soil', spill: earth },
  water: { surface: 'water' },
};

/** Per-pair exceptions win over a profile. Custom `rules` replace the defaults
 * entirely for compatibility with authored standalone maps. */
export function resolveTileSpillRules(from: string, onto: string, {
  rules, profiles = rules ? {} : TILE_SPILL_PROFILES,
}: { rules?: readonly SpillRule[]; profiles?: Readonly<Record<string, TileSpillProfile>> } = {}): readonly SpillRule[] {
  if (from === onto) return [];
  const exact = (rules ?? TILE_SPILLS).filter(rule => rule.from === from && rule.onto.includes(onto));
  if (exact.length) return exact;
  const source = profiles[from], target = profiles[onto];
  if (!source?.spill || !target || source.surface === target.surface || !source.spill.onto.includes(target.surface)) return [];
  if (target.accepts && !target.accepts.includes(source.surface)) return [];
  return [{ ...source.spill, from, onto: [onto] }];
}

const tileKind = (tile: SpillTile) => tile.kind ?? (tile.tileType === 'unexplored'
  ? tile.road ? 'road' : 'path' : tile.tileType ?? tile.terrain);
// Rule order and unrelated map edits must not reshuffle an existing seam.
const ruleKey = (rule: SpillRule) => JSON.stringify([rule.from, [...rule.onto].sort(), rule.sides,
  rule.art, rule.count, rule.reach, rule.overlap, rule.size, rule.spread]);
const stringSalt = (key: string) => [...key].reduce((hash, char) => Math.imul(hash, 31) + char.charCodeAt(0) | 0, 0);

const overlaps = (a: Rect, b: Rect) => a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom;

/** Decals for every pair of unlike neighbours a rule covers. `avoid` (world
 * rects, such as tile labels) are kept clear; a decal that would land on one
 * tries a few other spots and is otherwise left out. Stable per edge. */
export function tileSpills(tiles: readonly SpillTile[], cellOf: (position: { x: number; y: number }) => AutotileCell, cellSize: number,
  { rules, profiles, avoid = [] }: { rules?: readonly SpillRule[]; profiles?: Readonly<Record<string, TileSpillProfile>>; avoid?: readonly Rect[] } = {}): SpillDecal[] {
  const at = new Map<string, SpillTile & AutotileCell>();
  for (const tile of tiles) {
    if (tile.unlocked === false || tile.flags?.includes('unexplored')) continue;
    const { column, row } = cellOf(tile.position);
    at.set(`${column},${row}`, { ...tile, kind: tileKind(tile), column, row });
  }
  const decals: SpillDecal[] = [];
  for (const source of at.values()) {
    if (!source.kind) continue;
    for (const side of Object.keys(STEPS) as SpillSide[]) {
      const step = STEPS[side], target = at.get(`${source.column + step.x},${source.row + step.y}`);
      if (!target?.kind) continue;
      const resolved = resolveTileSpillRules(source.kind, target.kind, { rules, profiles });
      for (const rule of resolved) {
        if ((rule.sides && !rule.sides.includes(side)) || !rule.art.length) continue;
        const key = ruleKey(rule);
        // Edge midpoint, the direction into the neighbour and along the edge.
        const edge = { x: source.position.x + step.x * cellSize / 2, y: source.position.y + step.y * cellSize / 2 };
        const along = { x: -step.y, y: step.x }, salt = Object.keys(STEPS).indexOf(side) * 97 + stringSalt(key);
        for (let index = 0; index < rule.count; index++) {
          for (let attempt = 0; attempt < 4; attempt++) {
            const roll = (n: number) => cellRoll(source.column, source.row, salt + index * 7 + attempt * 1009 + n);
            // Three of every four pieces form the prominent seam band.
            // Smaller outliers trail into the receiving tile without leaving
            // the dividing line exposed to a uniformly scattered effect.
            const seam = index % 4 !== 3;
            const sizeRoll = seam ? .5 + roll(0) * .5 : roll(0) * .5;
            const size = rule.size[0] + sizeRoll * (rule.size[1] - rule.size[0]);
            // Spread along the edge, denser near it; never past the edge's ends.
            const t = (index + .2 + roll(1) * .6) / rule.count - .5;
            const band = Math.min(rule.overlap, rule.reach, size * .3 / cellSize);
            const depth = seam ? (roll(2) - (source.kind === 'hero-den' ? .35 : .5)) * band
              : roll(2) ** 2 * rule.reach;
            const span = (cellSize - size) * (rule.spread ?? 1);
            const x = edge.x + along.x * t * span + step.x * depth * cellSize;
            const y = edge.y + along.y * t * span + step.y * depth * cellSize;
            const box = { left: x - size / 2, top: y - size / 2, right: x + size / 2, bottom: y + size / 2 };
            if (avoid.some(rect => overlaps(rect, box))) continue;
            decals.push({ id: `${source.id}>${target.id}:${side}:${key}:${index}`, sourceTileId: source.id, targetTileId: target.id, art: rule.art[Math.floor(roll(3) * rule.art.length)], x, y, size,
              turn: ([0, 90, 180, 270] as const)[Math.floor(roll(4) * 4)], flip: roll(5) < .5, from: source.kind!, onto: target.kind, relief: Math.max(MIN_SPILL_HEIGHT, rule.reliefRange ? rule.reliefRange[0] + roll(6) * (rule.reliefRange[1] - rule.reliefRange[0]) : rule.relief ?? MIN_SPILL_HEIGHT) });
            break;
          }
        }
      }
    }
  }
  return decals;
}
