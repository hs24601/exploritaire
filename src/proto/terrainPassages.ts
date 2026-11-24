import type { BiomeTileState } from './protoState';
import { TABLE_GRID } from './gridCoordinates';

export type TerrainPassage = { axis: 'east-west' | 'north-south'; title: string; tags: string[]; columns: number; breachAP: number };
type Terrain = Pick<BiomeTileState, 'position' | 'gridSize' | 'flags'> & { passage?: TerrainPassage; tileType?: string };
export function terrainAtCell<T extends Terrain>(tiles: readonly T[], column: number, row: number): T | undefined {
  return tiles.find(t => { const a=TABLE_GRID.atWorld(t.position); return column>=a.column-Math.floor(t.gridSize.columns/2)&&column<a.column-Math.floor(t.gridSize.columns/2)+t.gridSize.columns&&row>=a.row-Math.floor(t.gridSize.rows/2)&&row<a.row-Math.floor(t.gridSize.rows/2)+t.gridSize.rows; });
}
/** The passage connects opposite faces, in both directions, never the other axis.
 * Unknown geometry must not influence routes. Shared by A* and checkpoints. */
export function passageStepAllowed(tiles: readonly Terrain[], x: number, y: number, nx: number, ny: number) {
  return [[x,y],[nx,ny]].every(([c,r])=>{
    const tile=terrainAtCell(tiles,c,r);
    if(tile?.tileType==='hero-den' && !tile.flags?.includes('unexplored')){
      const leaving=c===x&&r===y;
      if(x!==nx || (leaving ? ny!==y-1 : y!==ny-1))return false;
    }
    return !tile?.passage || tile.flags?.includes('unexplored') || (tile.passage.axis==='east-west' ? y===ny : x===nx);
  });
}
