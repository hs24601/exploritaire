import savedDocument from '../../data/protoTiles.json';
import { TABLE_GRID } from '../gridCoordinates';
import type { BiomeTileState, ProtoState } from '../protoState';
import { createBiomeTableau } from '../rules/setup';
import { createOrdinaryPlaces } from '../rules/ordinaryDay';
import { createSleepDeal } from '../rules/rest';
import { createRoadTile } from '../roadTiles';
import { tileKind, coversCell, validateTileDocument, type TileDocument, type AuthoredTile } from './schema';

validateTileDocument(savedDocument);
export const SAVED_TILE_DOCUMENT: TileDocument = savedDocument;

function freshDeal(definition: AuthoredTile, seed: number) {
  let deal: { tableau: BiomeTileState['tableau']; stock: BiomeTileState['stock'] };
  if (definition.kind === 'hero-den') {
    const rest = createSleepDeal(); deal = { tableau: rest.tableau, stock: rest.stock.slice(1) };
  } else if (definition.kind === 'berry-patch') deal = definition.berryPatchVariant === 'sparse' ? { tableau: [], stock: [] } : createOrdinaryPlaces(seed)[0];
  else if (definition.kind === 'path') deal = createRoadTile(definition.id, definition.column, definition.row);
  else if (definition.kind === 'woods' && definition.tableauSize > 0) deal = createBiomeTableau(seed, definition.resourceDensity, definition.tableauSize, ['wood']);
  else deal = { tableau: [], stock: [] };
  // New copies never share a card identity with their source.
  const tableau = deal.tableau.map((column, c) => column.map((card, i) => ({ ...card, id: `${definition.id}-deal-${c}-${i}` })));
  const stock = deal.stock.map((card, i) => ({ ...card, id: `${definition.id}-stock-${i}` }));
  return { tableau, stock, dealt: tableau.reduce((n, col) => n + col.length, 0) + stock.length };
}

/** Resolve shared defaults at the boundary, leaving authored overrides optional. */
export function materializeTiles(document: TileDocument, existing: readonly BiomeTileState[], preserveSession = true): BiomeTileState[] {
  if (!document.tiles) return existing.map(tile => ({ ...tile, ...document.defaults[tileKind(tile)],
    ...(tile.traversalDifficulty !== undefined ? { traversalDifficulty: tile.traversalDifficulty } : {}),
    ...(tile.travelCards !== undefined ? { travelCards: tile.travelCards } : {}) }));
  return document.tiles.map((definition, index) => {
    const old = existing.find(tile => tile.id === definition.id);
    const sameDeal = old && tileKind(old) === definition.kind && old.berryPatchVariant === definition.berryPatchVariant && old.tableauSize === definition.tableauSize && old.resourceDensity === definition.resourceDensity;
    const seed = old?.seed ?? index * 7919 + 1;
    const deal = sameDeal ? { tableau: old.tableau, stock: old.stock, dealt: old.dealt } : freshDeal(definition, seed);
    const discovered = preserveSession && old && !old.flags?.includes('unexplored') && tileKind(old) === definition.kind;
    return {
      id: definition.id, title: definition.title, sizeLabel: 'Small', gridSize: { ...definition.gridSize },
      populationDensity: definition.populationDensity, berryPatchVariant: definition.berryPatchVariant,
      berryHarvested: preserveSession && sameDeal ? old.berryHarvested : undefined,
      position: TABLE_GRID.center(TABLE_GRID.cell(definition.column, definition.row)), resourceDensity: definition.resourceDensity,
      tableauSize: definition.tableauSize, unlocked: definition.unlocked, threat: definition.threat, seed, ...deal,
      terrain: definition.kind === 'water' ? 'water' : 'woods',
      tileType: definition.kind === 'woods' || definition.kind === 'water' ? undefined : definition.kind,
      passage: definition.passage, passageOpen: preserveSession && JSON.stringify(old?.passage)===JSON.stringify(definition.passage) ? old?.passageOpen : undefined,
      road: definition.road, light: definition.light, opensTableauOnArrival: definition.opensTableauOnArrival,
      flags: [...definition.flags, ...(!definition.initiallyRevealed && !discovered ? ['unexplored' as const] : [])],
      danger: definition.flags.includes('danger'),
      ...document.defaults[definition.kind],
      ...(definition.traversalDifficulty !== undefined ? { traversalDifficulty: definition.traversalDifficulty } : {}),
      ...(definition.travelCards !== undefined ? { travelCards: definition.travelCards } : {}),
      ...(preserveSession && sameDeal ? { traversalProgress: old.traversalProgress, clearedDay: old.clearedDay } : {}),
    };
  });
}

export function applyTileDocument(state: ProtoState, document: TileDocument): ProtoState {
  validateTileDocument(document);
  if (state.journey || state.scene !== 'exploration' || state.selectedBiomeId) throw new Error('Finish travel and leave the tableau before applying tile changes');
  for (const actor of state.worldActors) {
    const cell = TABLE_GRID.atWorld(actor.position);
    const destination = document.tiles?.find(tile => coversCell(tile, cell.column, cell.row));
    if (destination && (!destination.unlocked || destination.flags.includes('impassable'))) throw new Error(`Move ${actor.label} off the cell before blocking it`);
  }
  return { ...state, biomeTiles: materializeTiles(document, state.biomeTiles) };
}
