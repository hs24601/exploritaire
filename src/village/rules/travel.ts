import type { GameState } from './game';
import { featureAt, fogged, isGate, isSapling, neighboursOf, tileAt, validTileIndex } from './map';
import { tileHeight, WATER_BELOW } from './terrain';

/** Shortest walking route, including departure and arrival. Sites can be
 * approached for interaction, but are never used as shortcuts through land. */
export function villageRoute(game: GameState, from: number, to: number, enterSite = false): number[] | null {
  if (!validTileIndex(from) || !validTileIndex(to)) return null;
  const passable = (index: number) => {
    const { x, y } = tileAt(index);
    if (fogged(x, y, game.rankReached) || tileHeight(x, y) < WATER_BELOW) return false;
    if (index === to && enterSite) return true;
    return !game.village.plots[index] && game.den?.tile !== index && !featureAt(x, y) && !isSapling(x, y) && !isGate(x, y);
  };
  if (from === to) return [from];
  if (!passable(to)) return null;
  const queue = [from];
  const previous = new Map([[from, from]]);
  for (let i = 0; i < queue.length; i++) {
    const current = queue[i];
    for (const next of neighboursOf(current)) {
      if (previous.has(next) || !passable(next)) continue;
      previous.set(next, current);
      if (next === to) {
        const route = [to];
        while (route[route.length - 1] !== from) route.push(previous.get(route[route.length - 1])!);
        return route.reverse();
      }
      queue.push(next);
    }
  }
  return null;
}
