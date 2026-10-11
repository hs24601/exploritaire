/** Edge spill between unlike neighbouring tiles. A rule says which tile kind
 * scatters which decals across which of its sides onto which neighbour kinds;
 * the decals straddle the shared edge and thin out into the neighbour, so
 * tiles read less square while each keeps its own type, label and rules.
 * Pure and DOM-free; presentation only (nothing in play reads a spill).
 * Companion to terrainAutotile.ts, which joins like tiles. */
import { cellRoll, type AutotileCell } from './terrainAutotile';

export type SpillSide = 'north' | 'east' | 'south' | 'west';
export type SpillRule = {
  /** Tile kind that spills (tileType, else terrain). */
  from: string;
  /** Neighbour kinds it spills onto. */
  onto: readonly string[];
  /** Sides of the source it spills from; all four when omitted. */
  sides?: readonly SpillSide[];
  /** Decal files under assets/biomes/spill/. */
  art: readonly string[];
  /** Decals per shared edge. */
  count: number;
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
  /** Quarter turns and mirror; pixel art stays crisp. */
  turn: 0 | 90 | 180 | 270; flip: boolean;
  from: string; onto: string;
};
type Rect = { left: number; top: number; right: number; bottom: number };
type SpillTile = { id: string; kind?: string; position: { x: number; y: number } };

const STEPS: Record<SpillSide, { x: number; y: number }> = { north: { x: 0, y: -1 }, east: { x: 1, y: 0 }, south: { x: 0, y: 1 }, west: { x: -1, y: 0 } };

const PEBBLES = ['pebble-a.svg', 'pebble-b.svg', 'pebble-c.svg', 'pebble-d.svg'];
/** The project's spill rules: the den's cave mouth sheds stones onto the
 * dirt in front of it; the berry patch and dirt trade sprigs and clods. */
export const TILE_SPILLS: readonly SpillRule[] = [
  { from: 'hero-den', onto: ['dirt'], sides: ['north'], art: PEBBLES, count: 12, reach: .45, overlap: .08, size: [4, 10], spread: .62 },
  { from: 'berry-patch', onto: ['dirt'], art: ['sprig-a.svg', 'sprig-b.svg', 'sprig-c.svg'], count: 6, reach: .32, overlap: .16, size: [9, 15] },
  { from: 'dirt', onto: ['berry-patch'], art: ['clod-a.svg', 'clod-b.svg', 'clod-c.svg'], count: 6, reach: .3, overlap: .16, size: [8, 13] },
];

const overlaps = (a: Rect, b: Rect) => a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom;

/** Decals for every pair of unlike neighbours a rule covers. `avoid` (world
 * rects, such as tile labels) are kept clear; a decal that would land on one
 * tries a few other spots and is otherwise left out. Stable per edge. */
export function tileSpills(tiles: readonly SpillTile[], cellOf: (position: { x: number; y: number }) => AutotileCell, cellSize: number,
  { rules = TILE_SPILLS, avoid = [] }: { rules?: readonly SpillRule[]; avoid?: readonly Rect[] } = {}): SpillDecal[] {
  const at = new Map<string, SpillTile & AutotileCell>();
  for (const tile of tiles) { const { column, row } = cellOf(tile.position); at.set(`${column},${row}`, { ...tile, column, row }); }
  const decals: SpillDecal[] = [];
  for (const source of at.values()) for (const rule of rules) {
    if (rule.from !== source.kind) continue;
    for (const side of rule.sides ?? (Object.keys(STEPS) as SpillSide[])) {
      const step = STEPS[side], target = at.get(`${source.column + step.x},${source.row + step.y}`);
      if (!target?.kind || !rule.onto.includes(target.kind)) continue;
      // Edge midpoint, the direction into the neighbour and along the edge.
      const edge = { x: source.position.x + step.x * cellSize / 2, y: source.position.y + step.y * cellSize / 2 };
      const along = { x: -step.y, y: step.x }, salt = Object.keys(STEPS).indexOf(side) * 97 + rules.indexOf(rule) * 13;
      for (let index = 0; index < rule.count; index++) {
        for (let attempt = 0; attempt < 4; attempt++) {
          const roll = (n: number) => cellRoll(source.column, source.row, salt + index * 7 + attempt * 1009 + n);
          const size = rule.size[0] + roll(0) * (rule.size[1] - rule.size[0]);
          // Spread along the edge, denser near it; never past the edge's ends.
          const t = (index + .2 + roll(1) * .6) / rule.count - .5;
          const depth = roll(2) ** 1.7 * (rule.reach + rule.overlap) - rule.overlap;
          const span = (cellSize - size) * (rule.spread ?? 1);
          const x = edge.x + along.x * t * span + step.x * depth * cellSize;
          const y = edge.y + along.y * t * span + step.y * depth * cellSize;
          const box = { left: x - size / 2, top: y - size / 2, right: x + size / 2, bottom: y + size / 2 };
          if (avoid.some(rect => overlaps(rect, box))) continue;
          decals.push({ id: `${source.id}>${target.id}:${index}`, art: rule.art[Math.floor(roll(3) * rule.art.length)], x, y, size,
            turn: ([0, 90, 180, 270] as const)[Math.floor(roll(4) * 4)], flip: roll(5) < .5, from: source.kind!, onto: target.kind });
          break;
        }
      }
    }
  }
  return decals;
}
