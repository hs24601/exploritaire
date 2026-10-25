import type { BiomeTileState, Card } from './protoState';

/** Required fruit first; the remaining, blocked fruit belongs to the right Khad branch.
 * Shared by map and tableau so harvests and later scene checkpoints agree. */
export const SPARSE_BERRY_POINTS = [{ x: .59, y: .47 }, { x: .76, y: .42 }];

/** Fruit is session state, never inferred from foliage density or discovery. */
export function tileHasBerries(tile: Pick<BiomeTileState, 'tileType' | 'berryPatchVariant' | 'berryHarvested' | 'tableau' | 'stock'>, tableau = tile.tableau, stock = tile.stock): boolean {
  if (tile.tileType !== 'berry-patch' || tile.berryHarvested) return false;
  if (tile.berryPatchVariant === 'sparse') return true;
  return [...tableau.flat(), ...stock].some((card: Card) => card.foodSource === 'berries' || card.resource === 'mana');
}

const emptySprites: Record<string, string> = {
  'berry-bush.svg': 'berry-bush-empty-v1.svg',
  'berry-patch-topdown.svg': 'berry-patch-topdown-empty-v1.svg',
  'berry-patch-sprite-v2.png': 'berry-patch-sprite-empty-v1.png',
  'berry-patch-overhead-v2.png': 'berry-patch-overhead-empty-v1.png',
  'manaberry-sparse-standee-v1.png': 'manaberry-sparse-standee-empty-v1.png',
  'manaberry-sparse-overhead-v1.png': 'manaberry-sparse-overhead-empty-v1.png',
};

/** Resolve berry-free foliage for the independent fruit renderer. */
export function berryScenerySprite(src: string, hasBerries: boolean): string {
  if (hasBerries) return src;
  return src.replace(/[^/]+$/, name => emptySprites[name] ?? name);
}
