import { useId } from 'react';
import { TABLE_GRID } from '../gridCoordinates';
import type { AutotilePlacement } from '../terrainAutotile';
import { useTileDiscovery } from './TileDiscoveryArt';

type Region = { x: number; y: number; width: number; height: number;
  tiles: readonly { id: string; position: { x: number; y: number } }[] };

/** A connected print has one outer boundary. Overlapping rock faces cover the
 * cell seams; solid interior rock prevents holes revealing the table grid.
 * Each cell's peak takes its neighbour-aware piece (terrainAutotile.ts):
 * interior massifs draw larger and on top, edges lean into the range, and a
 * per-cell flip and nudge keep neighbours from reading as copies.
 * Without `peaks` (the tilted view, where peaks stand as solids) it is the
 * range's rock floor: every member cell filled edge to edge with scree, so no
 * table ground shows between the standing peaks. */
export function ConnectedTerrainArt({ region, sprite, rockColor, floorSprite, pieces, peaks: showPeaks = true }: { region: Region; sprite: string; rockColor: string; floorSprite?: string;
  pieces?: ReadonlyMap<string, AutotilePlacement>; peaks?: boolean }) {
  const clipId = useId().replace(/:/g, '');
  const discovery = useTileDiscovery();
  const cell = TABLE_GRID.cellSize;
  const base = Math.min(cell * 1.5, region.width, region.height);
  const left = region.x - region.width / 2, top = region.y - region.height / 2;
  const clamp = (value: number, extent: number, size: number) => Math.max(0, Math.min(extent - size, value));
  const peaks = region.tiles.map(tile => {
    const piece = pieces?.get(tile.id), size = base * (piece?.scale ?? 1);
    const x = clamp(tile.position.x - left + (piece?.dx ?? 0) - size / 2, region.width, size);
    const y = clamp(tile.position.y - top + (piece?.dy ?? 0) - size / 2, region.height, size);
    return { id: tile.id, size, x, y, flip: piece?.flip ?? false, shape: piece?.shape };
  }).sort((a, b) => a.size - b.size);
  if (!showPeaks) return <svg aria-hidden="true" data-terrain-floor="mountains" data-terrain-cell-count={region.tiles.length}
    className="absolute pointer-events-none" width={region.width} height={region.height}
    viewBox={`0 0 ${region.width} ${region.height}`}
    style={{ left: `calc(50% + ${left}px)`, top: `calc(50% + ${top}px)`, imageRendering: floorSprite?'auto':'pixelated', pointerEvents: 'none' }}>
    <defs>{floorSprite ? <pattern id={`${clipId}-scree`} width={cell} height={cell} patternUnits="userSpaceOnUse">
      <image href={floorSprite} width={cell} height={cell} />
    </pattern> : <pattern id={`${clipId}-scree`} width="12" height="12" patternUnits="userSpaceOnUse">
      <rect width="12" height="12" fill={rockColor} />
      <rect x="1" y="2" width="2" height="2" fill="#4a566a" /><rect x="7" y="1" width="2" height="2" fill="#262e3b" />
      <rect x="4" y="7" width="2" height="2" fill="#5b677c" /><rect x="9" y="8" width="2" height="2" fill="#262e3b" />
      <rect x="0" y="10" width="2" height="2" fill="#2c3542" />
    </pattern>}</defs>
    {region.tiles.map(tile => <rect key={tile.id} x={tile.position.x - left - cell / 2} y={tile.position.y - top - cell / 2}
      width={cell} height={cell} fill={`url(#${clipId}-scree)`} filter={discovery.filter(tile.id)} data-discovery-art={tile.id} />)}
  </svg>;
  return <svg aria-hidden="true" data-connected-terrain="mountains" data-terrain-cell-count={region.tiles.length}
    className="absolute pointer-events-none" width={region.width} height={region.height}
    viewBox={`0 0 ${region.width} ${region.height}`}
    style={{ left: `calc(50% + ${left}px)`, top: `calc(50% + ${top}px)`, overflow: 'hidden', imageRendering: floorSprite?'auto':'pixelated', pointerEvents: 'none' }}>
    <defs>{floorSprite && <pattern id={`${clipId}-floor`} width={cell} height={cell} patternUnits="userSpaceOnUse">
      <image href={floorSprite} width={cell} height={cell} />
    </pattern>}<clipPath id={clipId}>{region.tiles.map(tile => <rect key={tile.id}
      x={tile.position.x - left - cell / 2} y={tile.position.y - top - cell / 2} width={cell} height={cell} />)}</clipPath></defs>
    <g id={`${clipId}-drawing`} clipPath={`url(#${clipId})`}>
    {floorSprite && region.tiles.map(tile=><rect key={`${tile.id}-floor`} x={tile.position.x-left-cell/2} y={tile.position.y-top-cell/2}
      width={cell} height={cell} fill={`url(#${clipId}-floor)`} />)}
    {!floorSprite && region.width > cell && region.height > cell && <rect x={cell / 2} y={cell / 2}
      width={region.width - cell} height={region.height - cell} fill={rockColor} />}
    {peaks.map(peak => <image key={peak.id} href={sprite} data-terrain-piece={peak.shape} data-terrain-flip={peak.flip || undefined}
      x={peak.x} y={peak.y} width={peak.size} height={peak.size}
      transform={peak.flip ? `translate(${2 * peak.x + peak.size} 0) scale(-1 1)` : undefined} />)}
    </g>
    {/* Only a newly discovered cell is repainted; its shared mountain print
        can grow without replaying the already known part of the range. */}
    {region.tiles.map((tile, index) => {
      const filter = discovery.filter(tile.id);
      if (!filter) return null;
      const x = tile.position.x - left - cell / 2, y = tile.position.y - top - cell / 2;
      return <g key={tile.id}>
        <defs><clipPath id={`${clipId}-discover-${index}`}><rect x={x} y={y} width={cell} height={cell} /></clipPath></defs>
        <g clipPath={`url(#${clipId}-discover-${index})`}>
          <rect x={x} y={y} width={cell} height={cell} fill="#0b1211" />
          <use href={`#${clipId}-drawing`} filter={filter} data-discovery-art={tile.id} />
        </g>
      </g>;
    })}
  </svg>;
}
