import type { CSSProperties } from 'react';
import { layoutEdgeScenery, type EdgeScenery, type LabelBox } from '../biomeEdgeScenery';
import type { StandeeLighting } from '../protoLighting';

/** Tilted camera only: the scenery lining a biome tile's sides and front,
 * each prop standing upright on the table like the tile's pop-up, lit like
 * it, and never covering the tile's label (see biomeEdgeScenery.ts). */
export function BiomeEdgeScenery({ tileId, centre, size, scenery, label, tiltDeg, lighting, standee }: {
  tileId: string;
  /** The tile's centre in table px. */
  centre: { x: number; y: number };
  size: { width: number; height: number };
  scenery: EdgeScenery;
  label: LabelBox | null;
  tiltDeg: number;
  lighting: StandeeLighting;
  /** The table's upright-standee transform and pop-up motion. */
  standee: CSSProperties | null;
}) {
  const filter = `brightness(${lighting.brightness.toFixed(3)}) sepia(${(lighting.warmth * 0.45).toFixed(3)})`;
  return <>{layoutEdgeScenery(size, scenery, label, tiltDeg).map((prop) => (
    <div
      key={prop.id}
      aria-hidden="true"
      className="proto-biome-edge"
      data-board-piece="biome-edge"
      data-biome-edge={tileId}
      data-edge={prop.edge}
      style={{ left: `calc(50% + ${centre.x + prop.x}px)`, top: `calc(50% + ${centre.y + prop.y}px)`, width: prop.width, height: prop.height, ...standee }}
    >
      <span className="proto-biome-edge__art" style={{ backgroundImage: `url("${prop.src}")`, filter, transform: prop.flip ? 'scaleX(-1)' : undefined }} />
    </div>
  ))}</>;
}
