import type { EdgeProp } from './biomeEdgeScenery';

type Point = { x: number; y: number };
type Area = Point & { width: number; height: number };

/** Adjacency contributes ink only, never traversal or pigment. Derived from
 * persistent earned progress, so pausing and returning cannot erase it. */
export function adjacentSketchProgress(tile: { id: string; position: Point; traversalProgress?: number },
  tiles: readonly { id: string; position: Point; traversalProgress?: number; flags?: readonly string[]; unlocked?: boolean }[], cellSize: number) {
  return tiles.reduce((best, neighbor) => {
    if (neighbor.id === tile.id || neighbor.unlocked === false || neighbor.flags?.includes('unexplored')) return best;
    const dx = Math.abs(neighbor.position.x-tile.position.x), dy = Math.abs(neighbor.position.y-tile.position.y);
    return (Math.abs(dx-cellSize)<.01 && dy<.01 || Math.abs(dy-cellSize)<.01 && dx<.01)
      ? Math.max(best, neighbor.traversalProgress ?? 0) : best;
  }, 0);
}

/** World-space approach edge; camera rotation never changes the planting. */
export function sketchApproach(area: Area, traveler: Point) {
  const dx = traveler.x - area.x, dy = traveler.y - area.y;
  const horizontal = Math.abs(dx / area.width) > Math.abs(dy / area.height);
  return { horizontal, sign: (horizontal ? dx : dy) < 0 ? -1 : 1 };
}

export function sketchBorderProps(props: readonly EdgeProp[], area: Area, traveler: Point): EdgeProp[] {
  const { horizontal, sign } = sketchApproach(area, traveler);
  // Two separate corner groups leave the orthogonal approach lane open.
  return props.slice(0, 2).map((prop, index) => ({ ...prop,
    x: area.width * .38 * (horizontal ? sign : index === 0 ? -1 : 1),
    y: area.height * .38 * (horizontal ? index === 0 ? -1 : 1 : sign),
  }));
}
