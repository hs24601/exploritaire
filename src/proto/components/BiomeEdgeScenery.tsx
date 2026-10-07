import { Fragment, type CSSProperties } from 'react';
import type { EdgeProp } from '../biomeEdgeScenery';
import { standeeLighting, type TableLight } from '../protoLighting';
import type { FxQuality } from '../atmosphere';
import { LightWash, Oversample, SpriteStandeeShadows } from './SpriteStandee';
import { Reveal } from './Reveal';

/** Tilted camera only: the scenery lining a biome tile's edges, laid out
 * with its neighbours' (layoutTableScenery in biomeEdgeScenery.ts), each prop
 * standing upright on the table like the tile's pop-up and never covering a
 * label. Each prop is lit where it stands: shaded by the light reaching it,
 * washed in the colour of the nearest lamp on the side facing it and, on the
 * high tier, casting its own shadows away from the sun or moon and each lamp.
 * Unexplored, props are silhouettes; partly explored, that share is in colour. */
export function BiomeEdgeScenery({ tileId, centre, props, exploration = 1, yaw = 0, hours, lights, quality, standee, oversample = 1 }: {
  tileId: string;
  /** The tile's centre in table px. */
  centre: { x: number; y: number };
  /** The tile's props, from its centre. */
  props: readonly EdgeProp[];
  /** How explored the tile is, 0-1. */
  exploration?: number;
  /** Camera spin: props face it, and light them in its frame. */
  yaw?: number;
  hours: number;
  lights: readonly TableLight[];
  quality: FxQuality;
  /** The table's upright-standee transform and pop-up motion. */
  standee: CSSProperties | null;
  /** Layout scale the standee transform shrinks back down (STANDEE_OVERSAMPLE). */
  oversample?: number;
}) {
  return <>{props.map((prop) => {
    const foot = { x: centre.x + prop.x, y: centre.y + prop.y };
    const lit = standeeLighting(hours, foot, prop.height, lights, yaw);
    const filter = `brightness(${lit.brightness.toFixed(3)}) sepia(${(lit.warmth * 0.45).toFixed(3)})`;
    return <Fragment key={prop.id}>
      {quality === 'high' ? <SpriteStandeeShadows sprite={prop.src} position={foot} shadows={lit.shadows} size={prop.height} owner="biome-edge" yaw={yaw} /> : null}
      <div
        aria-hidden="true"
        className="proto-biome-edge"
        data-board-piece="biome-edge"
        data-biome-edge={tileId}
        data-edge={prop.edge}
        style={{ left: `calc(50% + ${foot.x}px)`, top: `calc(50% + ${foot.y}px)`, width: prop.width * oversample, height: prop.height * oversample, ...standee }}
      >
        <Oversample width={prop.width} height={prop.height} factor={oversample}>
          <Reveal fraction={exploration} width={prop.width} height={prop.height}>
            <span className="proto-biome-edge__art" style={{ backgroundImage: `url("${prop.src}")`, filter, transform: prop.flip ? 'scaleX(-1)' : undefined }}>
              <LightWash sprite={prop.src} lighting={lit} maskSize="100% 100%" maskPosition="0 0" flip={prop.flip} />
            </span>
          </Reveal>
        </Oversample>
      </div>
    </Fragment>;
  })}</>;
}
