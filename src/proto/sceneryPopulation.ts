import type { EdgeProp } from './biomeEdgeScenery';
import { sceneryFileName } from './proceduralWoods';

export const populationDensity = (value: number | undefined, woods = true) => value ?? (woods ? 3 : 2);

/** One small plant on the approach edge, just beside the walking lane. */
export function sparseBerryBush(src: string, width: number, height: number, approach: { horizontal: boolean; sign: number }): EdgeProp {
  return { id: 'population-sparse-bush', edge: 'front', src, width: 18, height: 22, flip: false,
    x: width * (approach.horizontal ? approach.sign * .28 : .18),
    y: height * (approach.horizontal ? .18 : approach.sign * .28) };
}

/** Stable interior planting: density changes count, never the seed.
 * Ten supports twenty props per cell; a sketch uses the approach half. */
export function populateScenery(prototype: EdgeProp, density: number, width: number, height: number, approach?: { horizontal: boolean; sign: number }): EdgeProp[] {
  const count = Math.round(Math.max(0, Math.min(10, density)) * (approach ? 1 : 2));
  return Array.from({length:count}, (_,i) => {
    // Low-discrepancy planting covers the interior even at low densities.
    let x = ((i * .61803398875 + .19) % 1 - .5) * .76;
    let y = ((i * .41421356237 + .32) % 1 - .5) * .76;
    // Small trunk clearance, rather than an empty cross through the forest.
    if (Math.abs(x) < .085) x = (x < 0 ? -1 : 1) * .085;
    if (Math.abs(y) < .085) y = (y < 0 ? -1 : 1) * .085;
    if (approach) {
      if (approach.horizontal) x = approach.sign * .36;
      else y = approach.sign * .36;
    }
    return {...prototype,id:`population-${i}`,x:width*x,y:height*y,flip:i%2===1};
  });
}

/** Raise tree crowns while retaining their contained ground width. */
export const sceneryReliefRise = (src: string | undefined) => /(?:pine(?:-edge)?|woods-cluster)-sprite-v1\.png|pine-edge-relief-v1\.png/.test(sceneryFileName(src) ?? '') ? 3 : 1;

export const populationOwner = (foot: {x:number;y:number}, area: {x:number;y:number;width:number;height:number}, population: boolean) =>
  population ? { ...area, x: foot.x, y: foot.y, width: Math.min(22, area.width), height: Math.min(22, area.height) } : undefined;
