import type { BiomeTileState } from './protoState';
import { createRoadTile } from './roadTiles';
import { TABLE_GRID } from './gridCoordinates';

/** Plain earth is crossable ground without an exploration deal. */
export function createDirtTile(id: string, column: number, row: number): BiomeTileState {
  return {
    ...createRoadTile(id, column, row),
    title: 'Dirt',
    tileType: 'dirt',
    tableau: [], stock: [], tableauSize: 0, dealt: 0,
    position: TABLE_GRID.center(TABLE_GRID.cell(column, row)),
  };
}
