import { Fragment, type CSSProperties } from 'react';
import { layoutEdgeScenery, type EdgeScenery, type LabelBox } from '../biomeEdgeScenery';
import { standeeLighting, type TableLight } from '../protoLighting';
import type { FxQuality } from '../atmosphere';
import { LightWash, SpriteStandeeShadows } from './SpriteStandee';

/** Tilted camera only: the scenery lining a biome tile's sides and front,
 * each prop standing upright on the table like the tile's pop-up and never
 * covering the tile's label (see biomeEdgeScenery.ts). Each prop is lit where
 * it stands: shaded by the light reaching it, washed in the colour of the
 * nearest lamp on the side facing it and, on the high tier, casting its own
 * shadows away from the sun or moon and each lamp. */
export function BiomeEdgeScenery({ tileId, centre, size, scenery, label, tiltDeg, hours, lights, quality, standee }: {
  tileId: string;
  /** The tile's centre in table px. */
  centre: { x: number; y: number };
  size: { width: number; height: number };
  scenery: EdgeScenery;
  label: LabelBox | null;
  tiltDeg: number;
  hours: number;
  lights: readonly TableLight[];
  quality: FxQuality;
  /** The table's upright-standee transform and pop-up motion. */
  standee: CSSProperties | null;
}) {
  return <>{layoutEdgeScenery(size, scenery, label, tiltDeg).map((prop) => {
    const foot = { x: centre.x + prop.x, y: centre.y + prop.y };
    const lit = standeeLighting(hours, foot, prop.height, lights);
    const filter = `brightness(${lit.brightness.toFixed(3)}) sepia(${(lit.warmth * 0.45).toFixed(3)})`;
    return <Fragment key={prop.id}>
      {quality === 'high' ? <SpriteStandeeShadows sprite={prop.src} position={foot} shadows={lit.shadows} size={prop.height} owner="biome-edge" /> : null}
      <div
        aria-hidden="true"
        className="proto-biome-edge"
        data-board-piece="biome-edge"
        data-biome-edge={tileId}
        data-edge={prop.edge}
        style={{ left: `calc(50% + ${foot.x}px)`, top: `calc(50% + ${foot.y}px)`, width: prop.width, height: prop.height, ...standee }}
      >
        <span className="proto-biome-edge__art" style={{ backgroundImage: `url("${prop.src}")`, filter, transform: prop.flip ? 'scaleX(-1)' : undefined }}>
          <LightWash sprite={prop.src} lighting={lit} maskSize="100% 100%" maskPosition="0 0" flip={prop.flip} />
        </span>
      </div>
    </Fragment>;
  })}</>;
}
