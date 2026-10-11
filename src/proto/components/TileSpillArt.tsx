import type { SpillDecal } from '../tileSpill';

/** Decals one tile scatters over its edge onto an unlike neighbour
 * (tileSpill.ts). They lie on the table in both cameras, above the tiles'
 * ground art (tilted, lifted a hair off the plane so standing pieces still
 * cover them), never take input, and are placed clear of tile labels.
 * Rendered straight into the world layer: a full-world wrapper is too large
 * a 3D layer for the browser to composite in the tilted camera. */
export function TileSpillArt({ decals, raised = false }: { decals: readonly SpillDecal[]; raised?: boolean }) {
  return <>{decals.map(decal => <img key={decal.id} alt="" aria-hidden="true" draggable={false} data-tile-spill={decal.id} data-spill-from={decal.from} data-spill-onto={decal.onto}
    src={`${import.meta.env.BASE_URL}assets/biomes/spill/${decal.art}`}
    className="proto-tile-spill absolute pointer-events-none"
    style={{ left: `calc(50% + ${decal.x}px)`, top: `calc(50% + ${decal.y}px)`, width: decal.size, height: decal.size, objectFit: 'contain', pointerEvents: 'none',
      imageRendering: 'pixelated', transform: `translate(-50%,-50%)${raised ? ' translateZ(.3px)' : ''} rotate(${decal.turn}deg)${decal.flip ? ' scaleX(-1)' : ''}` }} />)}</>;
}
