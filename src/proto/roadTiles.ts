import type { BiomeTileState } from './protoState';
import { createQuestBiomeDeal } from './protoQuestDeals';
import { TABLE_GRID } from './gridCoordinates';
import { CLEAR_AREA_CELLS } from './worldBounds';

export type RoadShape = 'straight' | 'crossroads' | 'curve' | 'fork';
export type RoadTile = { shape: RoadShape; rotation: 0 | 90 | 180 | 270 };

/** Paths meet the midpoint of each cardinal edge. Rotate the whole print. */
export const ROAD_PATHS: Record<RoadShape, string> = {
  straight: 'M24 0V48',
  crossroads: 'M24 0V48 M0 24H48',
  curve: 'M24 0V8 Q24 24 40 24H48',
  fork: 'M24 48V32 Q24 24 16 24H0 M24 32Q24 24 32 24H48',
};

export const createRoadTile = (id: string, column: number, row: number, road?: RoadTile): BiomeTileState => {
  const deal = createQuestBiomeDeal('small');
  const tableau = deal.tableau.map(column => column.map(({ rank, questStep }, index) => ({ id: `${id}-${questStep}-${index}`, rank, questStep })));
  return ({
  id, title: road?.shape === 'crossroads' ? 'Crossroads' : road ? 'Road' : 'Path', road, tileType: 'unexplored',
  sizeLabel: 'Small', gridSize: { columns: 1, rows: 1 }, position: { x: column * 48, y: row * 48 },
  resourceDensity: 0, tableauSize: 13, seed: 0, tableau, stock: [], dealt: 13, unlocked: true,
  travelCost: 0, threat: 'none', flags: ['unexplored'],
});
};

/** Materialize every uncovered table cell without replacing authored biomes. */
export function fillUnexploredSquares(tiles: BiomeTileState[]) {
  const half = Math.floor(CLEAR_AREA_CELLS / 2);
  const occupied = new Set<string>();
  for (const tile of tiles) {
    const anchor = TABLE_GRID.atWorld(tile.position);
    for (let x = 0; x < tile.gridSize.columns; x++) for (let y = 0; y < tile.gridSize.rows; y++)
      occupied.add(`${anchor.column - Math.floor(tile.gridSize.columns / 2) + x},${anchor.row - Math.floor(tile.gridSize.rows / 2) + y}`);
  }
  const next = [...tiles];
  for (let row = -half; row <= half; row++) for (let column = -half; column <= half; column++)
    if (!occupied.has(`${column},${row}`)) next.push(createRoadTile(`unexplored-${column}-${row}`, column, row));
  return next;
}

