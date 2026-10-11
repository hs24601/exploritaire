import type { BiomeTileState } from './protoState';
import { createRoadTile } from './roadTiles';
import { TABLE_GRID } from './gridCoordinates';

/** Plain earth uses the shared resource-free ground exploration deal. */
export function createDirtTile(id: string, column: number, row: number): BiomeTileState {
  return {
    ...createRoadTile(id, column, row),
    title: 'Dirt',
    tileType: 'dirt',
    position: TABLE_GRID.center(TABLE_GRID.cell(column, row)),
  };
}
