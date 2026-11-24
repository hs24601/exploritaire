import type { BiomeTileState } from '../protoState';
import { TABLE_GRID } from '../gridCoordinates';
import { CLEAR_AREA_CELLS } from '../worldBounds';

export const TILE_KINDS = ['path', 'dirt', 'woods', 'water', 'berry-patch', 'hero-den', 'impassable-mountain'] as const;
export type TileKind = typeof TILE_KINDS[number];
export type TerrainDefaults = { traversalDifficulty: number; travelCards: number };
export type AuthoredTile = {
  populationDensity?: number;
  berryPatchVariant?: 'sparse';
  passage?: BiomeTileState['passage'];
  id: string; title: string; kind: TileKind; column: number; row: number;
  gridSize: BiomeTileState['gridSize']; resourceDensity: number; tableauSize: number;
  unlocked: boolean; threat: BiomeTileState['threat']; initiallyRevealed: boolean;
  flags: Array<'rough' | 'danger' | 'impassable'>;
  traversalDifficulty?: number; travelCards?: number; opensTableauOnArrival?: boolean;
  road?: BiomeTileState['road']; light?: BiomeTileState['light'];
};
export type TileDocument = { version: 1; defaults: Record<TileKind, TerrainDefaults>; tiles: AuthoredTile[] | null };

export const tileKind = (tile: BiomeTileState): TileKind => tile.road || tile.tileType === 'unexplored' ? 'path'
  : tile.tileType ?? tile.terrain ?? 'woods';

/** Explicit allowlist: a session's cards, seed, fog and traversal work never become authored data. */
export function authorTile(tile: BiomeTileState): AuthoredTile {
  const cell = TABLE_GRID.atWorld(tile.position);
  return { id: tile.id, title: tile.title, kind: tileKind(tile), column: cell.column, row: cell.row,
    populationDensity: tile.populationDensity, berryPatchVariant: tile.berryPatchVariant, gridSize: { ...tile.gridSize }, resourceDensity: tile.resourceDensity, tableauSize: tile.tableauSize,
    unlocked: tile.unlocked, threat: tile.threat, initiallyRevealed: !tile.flags?.includes('unexplored'),
    flags: (tile.flags ?? []).filter(flag => flag !== 'unexplored'),
    ...(tile.traversalDifficulty !== undefined ? { traversalDifficulty: tile.traversalDifficulty } : {}),
    ...(tile.passage ? { passage: structuredClone(tile.passage) } : {}),
    ...(tile.travelCards !== undefined ? { travelCards: tile.travelCards } : {}),
    ...(tile.opensTableauOnArrival !== undefined ? { opensTableauOnArrival: tile.opensTableauOnArrival } : {}),
    ...(tile.road ? { road: { ...tile.road } } : {}), ...(tile.light ? { light: { ...tile.light } } : {}) };
}

export function newAuthoredTile(kind: TileKind, column: number, row: number, id: string): AuthoredTile {
  return { id, kind, title: ({ path: 'Path', dirt: 'Dirt', woods: 'Woods', water: 'Pond', 'berry-patch': 'Manaberry Patch', 'hero-den': "Hero's Den", 'impassable-mountain': 'Impassable Mountains' })[kind],
    column, row, populationDensity: kind === 'woods' ? 3 : kind === 'berry-patch' ? 2 : 0, gridSize: { columns: 1, rows: 1 }, resourceDensity: kind === 'woods' ? .3 : kind === 'berry-patch' ? .2 : 0,
    tableauSize: kind === 'woods' || kind === 'berry-patch' ? 28 : kind === 'path' ? 13 : 0,
    unlocked: true, threat: 'none', initiallyRevealed: false, flags: kind === 'impassable-mountain' ? ['impassable'] : [] };
}

export function coversCell(tile: AuthoredTile, column: number, row: number) {
  const left = tile.column - Math.floor(tile.gridSize.columns / 2), top = tile.row - Math.floor(tile.gridSize.rows / 2);
  return column >= left && column < left + tile.gridSize.columns && row >= top && row < top + tile.gridSize.rows;
}

/** The same validation is used by the UI and the disk-writing development endpoint. */
export function validateTileDocument(value: unknown): asserts value is TileDocument {
  const fail = (message: string): never => { throw new Error(message); };
  const object = (v: unknown): Record<string, any> => v && typeof v === 'object' && !Array.isArray(v) ? v as Record<string, any> : fail('Expected an object');
  const keys = (v: Record<string, any>, allowed: string[]) => { if (Object.keys(v).some(k => !allowed.includes(k))) fail('Unknown authored field'); };
  const number = (n: unknown, min: number, max: number, integer = false) => typeof n === 'number' && Number.isFinite(n) && n >= min && n <= max && (!integer || Number.isInteger(n));
  const profile = (v: unknown) => { const p = object(v); keys(p, ['traversalDifficulty', 'travelCards']); if (!number(p.traversalDifficulty, 0, 100) || !number(p.travelCards, 1, 100, true)) fail('Travel costs must be 0–100 STA and 1–100 cards'); };
  const doc = object(value); keys(doc, ['version', 'defaults', 'tiles']);
  if (doc.version !== 1) fail('Unsupported tile document version');
  const defaults = object(doc.defaults); keys(defaults, [...TILE_KINDS]);
  TILE_KINDS.forEach(kind => profile(defaults[kind]));
  if (doc.defaults['hero-den'].traversalDifficulty !== 0) fail('The den must remain free to enter');
  if (doc.tiles === null) return;
  if (!Array.isArray(doc.tiles) || doc.tiles.length > CLEAR_AREA_CELLS ** 2) fail('Invalid tile list');
  const ids = new Set<string>(), cells = new Set<string>();
  const half = Math.floor(CLEAR_AREA_CELLS / 2);
  for (const raw of doc.tiles) {
    const t = object(raw);
    keys(t, ['id', 'title', 'kind', 'column', 'row', 'gridSize', 'resourceDensity', 'tableauSize', 'unlocked', 'threat', 'initiallyRevealed', 'flags', 'traversalDifficulty', 'travelCards', 'opensTableauOnArrival', 'road', 'light', 'passage', 'populationDensity', 'berryPatchVariant']);
    if (typeof t.id !== 'string' || !/^[a-zA-Z0-9_-]{1,100}$/.test(t.id) || ids.has(t.id)) fail('Tile IDs must be unique letters, numbers, dashes or underscores');
    ids.add(t.id);
    if (typeof t.title !== 'string' || !t.title.trim() || t.title.length > 120 || !TILE_KINDS.includes(t.kind)) fail('Each tile needs a title and supported terrain');
    if (!number(t.column, -half, half, true) || !number(t.row, -half, half, true)) fail('Choose a cell inside the 15 × 15 table');
    const size = object(t.gridSize); keys(size, ['columns', 'rows']);
    if (!number(size.columns, 1, 15, true) || !number(size.rows, 1, 15, true)) fail('Invalid tile footprint');
    for (let x = 0; x < size.columns; x++) for (let y = 0; y < size.rows; y++) {
      const col = t.column - Math.floor(size.columns / 2) + x, row = t.row - Math.floor(size.rows / 2) + y, key = `${col},${row}`;
      if (Math.abs(col) > half || Math.abs(row) > half || cells.has(key)) fail('Tile footprints overlap or leave the table');
      cells.add(key);
    }
    if (t.populationDensity !== undefined && !number(t.populationDensity, 0, 10, true)) fail('Population density must be 0–10');
    if (t.berryPatchVariant !== undefined && (t.berryPatchVariant !== 'sparse' || t.kind !== 'berry-patch' || size.columns !== 1 || size.rows !== 1)) fail('Sparse manaberries require a single-cell manaberry patch');
    if (!number(t.resourceDensity, 0, 1) || !number(t.tableauSize, 0, 51, true)) fail('Resource density must be 0–1 and deal size 0–51');
    if (typeof t.unlocked !== 'boolean' || typeof t.initiallyRevealed !== 'boolean' || !['none', 'low', 'high'].includes(t.threat)) fail('Invalid tile settings');
    if (!Array.isArray(t.flags) || t.flags.some((f: unknown) => !['rough', 'danger', 'impassable'].includes(f as string)) || new Set(t.flags).size !== t.flags.length) fail('Invalid terrain flags');
    if (t.kind === 'impassable-mountain' && !t.flags.includes('impassable')) fail('Mountains must remain impassable');
    if (t.traversalDifficulty !== undefined && !number(t.traversalDifficulty, 0, 100)) fail('Invalid STA override');
    if (t.travelCards !== undefined && !number(t.travelCards, 1, 100, true)) fail('Invalid travel card override');
    if (t.opensTableauOnArrival !== undefined && typeof t.opensTableauOnArrival !== 'boolean') fail('Invalid arrival setting');
    if (t.passage !== undefined) {
      const p=object(t.passage); keys(p,['axis','title','tags','columns','breachAP']);
      if (t.kind==='hero-den'||size.columns!==1||size.rows!==1||!['east-west','north-south'].includes(p.axis)||typeof p.title!=='string'||!p.title.trim()||p.title.length>120||!Array.isArray(p.tags)||!p.tags.length||p.tags.length>8||p.tags.some((tag:unknown)=>typeof tag!=='string'||!/^[a-z][a-z0-9-]{0,30}$/.test(tag))||!number(p.columns,1,10,true)||!number(p.breachAP,1,100,true)) fail('Invalid single-cell terrain passage');
    }
    if (t.road !== undefined) {
      const road = object(t.road); keys(road, ['shape', 'rotation']);
      if (t.kind !== 'path' || !['straight', 'crossroads', 'curve', 'fork'].includes(road.shape) || ![0, 90, 180, 270].includes(road.rotation)) fail('Invalid road');
    }
    if (t.light !== undefined) {
      const light = object(t.light); keys(light, ['color', 'strength', 'radius', 'height', 'flicker']);
      if (typeof light.color !== 'string' || !/^#[0-9a-f]{6}$/i.test(light.color) || !number(light.strength, 0, 1) || !number(light.radius, .1, 15) || !number(light.height, 0, 1000) || !number(light.flicker, 0, 1)) fail('Invalid scenery light');
    }
  }
  const den = doc.tiles.find((t: AuthoredTile) => t.id === 'hero-den');
  if (!den || den.kind !== 'hero-den' || den.column !== 0 || den.row !== 2 || den.gridSize.columns !== 1 || den.gridSize.rows !== 1 || !den.unlocked || den.flags.length || den.traversalDifficulty && den.traversalDifficulty !== 0 || doc.tiles.filter((t: AuthoredTile) => t.kind === 'hero-den').length !== 1) fail("Keep Hero's Den at table:0,2, unlocked and traversable");
}
