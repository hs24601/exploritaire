import { arriveAt } from './biomeFlags';
import { TABLE_GRID } from './gridCoordinates';
import type { BiomeTileState, ProtoState } from './protoState';

type Point = { x: number; y: number };

/** Paths and roads reveal on entry; other terrain reveals in the occupied
 * cell and its eight neighbours. Sweeping the actor's
 * actual travel segment preserves discoveries between animation samples.
 * Discovery is permanent and never spreads from an already discovered tile. */
export function discoverTiles(tiles: BiomeTileState[], from: Point, to = from) {
  if (![from.x, from.y, to.x, to.y].every(Number.isFinite)) return tiles;
  const cellSize = TABLE_GRID.cellSize;
  let changed = false;
  const next = tiles.map(tile => {
    if (!tile.flags?.includes('unexplored')) return tile;
    const anchor = TABLE_GRID.atWorld(tile.position);
    const first = TABLE_GRID.offset(anchor, -Math.floor(tile.gridSize.columns / 2), -Math.floor(tile.gridSize.rows / 2));
    const area = TABLE_GRID.region(first, tile.gridSize.columns, tile.gridSize.rows);
    const reach = tile.road || tile.tileType === 'unexplored' || tile.tileType === 'path' ? 0 : cellSize;
    const bounds = {
      x: [area.x - area.width / 2 - reach, area.x + area.width / 2 + reach],
      y: [area.y - area.height / 2 - reach, area.y + area.height / 2 + reach],
    };
    let enter = 0, exit = 1;
    for (const axis of ['x', 'y'] as const) {
      const [low, high] = bounds[axis], delta = to[axis] - from[axis];
      if (!delta) {
        if (from[axis] < low || from[axis] >= high) return tile;
      } else {
        const a = (low - from[axis]) / delta, b = (high - from[axis]) / delta;
        enter = Math.max(enter, Math.min(a, b));
        exit = Math.min(exit, Math.max(a, b));
        if (enter > exit) return tile;
      }
    }
    // Grid boundary ties belong to the right/bottom cell. A mere touch of
    // an exclusive edge must not reveal the cell on its far side.
    if (enter === exit && (['x', 'y'] as const).some(axis => {
      const value = from[axis] + (to[axis] - from[axis]) * enter;
      return value < bounds[axis][0] || value >= bounds[axis][1];
    })) return tile;
    changed = true;
    return { ...tile, tileType: tile.tileType === 'unexplored' ? 'path' as const : tile.tileType, flags: arriveAt(tile.flags) };
  });
  return changed ? next : tiles;
}

/** Also handles stationary actors, foundation arrivals and later spawns. */
export function discoverActorTiles(state: ProtoState): ProtoState {
  const biomeTiles = state.worldActors.reduce((tiles, actor) => {
    const biome = actor.location === 'foundation' && state.biomeTiles.find(tile => tile.id === actor.biomeId);
    // Foundation actors physically occupy the footprint's first cell, just
    // like the map token; a larger biome's anchor may be several cells away.
    const position = biome ? TABLE_GRID.center(TABLE_GRID.offset(TABLE_GRID.atWorld(biome.position),
      -Math.floor(biome.gridSize.columns / 2), -Math.floor(biome.gridSize.rows / 2))) : actor.position;
    return discoverTiles(tiles, position);
  }, state.biomeTiles);
  return biomeTiles === state.biomeTiles ? state : { ...state, biomeTiles };
}
