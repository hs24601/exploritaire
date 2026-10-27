/** Cosmetic discovery timing. Gameplay discovers the tile immediately. */
export const DISCOVERY_ETCH_MS = 1100;
export const DISCOVERY_FILL_MS = 6200;
export const DISCOVERY_DURATION_MS = DISCOVERY_ETCH_MS + DISCOVERY_FILL_MS;

export type DiscoveryTile = { id: string; flags?: readonly string[]; unlocked?: boolean; traversalProgress?: number };
export const discoveryVisible = (tile: DiscoveryTile) => !tile.flags?.includes('unexplored') && tile.unlocked !== false;

/** Only transitions animate: startup/load, camera changes and edits to known
 * tiles never replay discovery. Prune removed/concealed/finished tiles. */
export function advanceDiscoveryAnimations(previous: ReadonlyMap<string, boolean>, active: ReadonlyMap<string, number>,
  tiles: readonly DiscoveryTile[], now: number, reducedMotion: boolean): Map<string, number> {
  const next = new Map<string, number>();
  if (reducedMotion) return next;
  for (const tile of tiles) {
    if (!discoveryVisible(tile)) continue;
    const started = active.get(tile.id);
    if (started !== undefined && now - started < DISCOVERY_DURATION_MS) next.set(tile.id, started);
    else if (previous.get(tile.id) === false) next.set(tile.id, now);
  }
  return next;
}
