import type { SpillDecal } from '../tileSpill';
import { useArtStyle } from '../artStyle';
import { scenerySprite } from '../sceneryArt';
import { STANDEE_OVERSAMPLE } from './SpriteStandee';
import { heightToWorld, MIN_SPILL_HEIGHT } from '../sceneryHeight';
import { standeeLighting, type TableLight } from '../protoLighting';
import { useTileDiscovery } from './TileDiscoveryArt';

/** Raised spills use the same ground-anchored painted cutout convention as
 * bushes/mountains. Their footprint and vertical relief are independent.
 * No full-world wrapper, per-frame raster work or duplicate slice layers. */
export function TileSpillArt({ decals, raised = false, hours = 9, lights = [], danger = false, discoveryTileIds }: {
  discoveryTileIds?: readonly string[];
  danger?: boolean; decals: readonly SpillDecal[]; raised?: boolean; hours?: number; lights?: readonly TableLight[];
}) {
  const style = useArtStyle();
  const discovery = useTileDiscovery();
  // Keep slate stones legible above foliage in the printed view. Immersion
  // continues to use the world's physical depth sorting.
  const ordered = raised ? decals : [...decals].sort((a,b)=>Number(a.art.startsWith('pebble-'))-Number(b.art.startsWith('pebble-')));
  return <>{ordered.map(decal => {
    const sprite = scenerySprite(`${import.meta.env.BASE_URL}assets/biomes/spill/${decal.art}`, style);
    const relief = raised ? Math.max(MIN_SPILL_HEIGHT, decal.relief) : 0;
    const height = heightToWorld(relief);
    const sampling = relief ? STANDEE_OVERSAMPLE : 1;
    const lighting = raised && relief ? standeeLighting(hours, decal, height, lights) : null;
    return <img key={decal.id} alt="" aria-hidden="true" draggable={false}
      data-tile-spill={decal.id} data-spill-relief={relief} data-spill-height-world={height}
      data-spill-from={decal.from} data-spill-onto={decal.onto}
      src={sprite} data-art-style={style} className="proto-tile-spill absolute pointer-events-none"
      style={{ left: `calc(50% + ${decal.x}px)`, top: `calc(50% + ${decal.y}px)`, width: decal.size * sampling, height: (relief ? height : decal.size) * sampling,
        objectFit: relief ? 'fill' : 'contain', pointerEvents: 'none', imageRendering: style === 'paint' ? 'auto' : 'pixelated',
        filter: [lighting ? `brightness(${lighting.brightness}) sepia(${lighting.warmth * .45})` : '', danger ? 'url(#combat-scenery-tint)' : '', discovery.filter(discoveryTileIds ?? [decal.sourceTileId ?? '', decal.targetTileId ?? ''], true)].filter(Boolean).join(' ') || undefined,
        transformOrigin: relief ? '50% 100%' : '50% 50%',
        transform: relief ? `translate(-50%,-100%) rotateZ(calc(-1 * var(--camera-yaw, 0deg))) rotateX(calc(-1 * var(--table-tilt))) scale(${1 / sampling}) scaleY(var(--standee-rise, 1))${decal.flip ? ' scaleX(-1)' : ''}`
          : `translate(-50%,-50%)${raised ? ' translateZ(.3px)' : ''} rotate(${decal.turn}deg)${decal.flip ? ' scaleX(-1)' : ''}` }} />;
  })}</>;
}
