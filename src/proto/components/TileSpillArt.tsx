import type { SpillDecal } from '../tileSpill';

/** Decals one tile scatters over its edge onto an unlike neighbour
 * (tileSpill.ts). They lie on the table in both cameras, above the tiles'
 * ground art, never take input, and are placed clear of tile labels. */
export function TileSpillArt({ decals, brightness = 1 }: { decals: readonly SpillDecal[]; brightness?: number }) {
  return <div aria-hidden="true" data-tile-spill-layer="true" className="absolute inset-0 pointer-events-none">
    {decals.map(decal => <img key={decal.id} alt="" draggable={false} data-tile-spill={decal.id} data-spill-from={decal.from} data-spill-onto={decal.onto}
      src={`${import.meta.env.BASE_URL}assets/biomes/spill/${decal.art}`}
      className="absolute pointer-events-none"
      style={{ left: `calc(50% + ${decal.x}px)`, top: `calc(50% + ${decal.y}px)`, width: decal.size, height: decal.size, objectFit: 'contain',
        imageRendering: 'pixelated', transform: `translate(-50%,-50%) rotate(${decal.turn}deg)${decal.flip ? ' scaleX(-1)' : ''}`,
        filter: brightness === 1 ? undefined : `brightness(${brightness.toFixed(3)})` }} />)}
  </div>;
}
