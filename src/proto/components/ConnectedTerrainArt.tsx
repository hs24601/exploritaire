import { useId } from 'react';
import { TABLE_GRID } from '../gridCoordinates';
import type { AutotilePlacement } from '../terrainAutotile';

type Region = { x: number; y: number; width: number; height: number;
  tiles: readonly { id: string; position: { x: number; y: number } }[] };

/** A connected print has one outer boundary. Overlapping rock faces cover the
 * cell seams; solid interior rock prevents holes revealing the table grid.
 * Each cell's peak takes its neighbour-aware piece (terrainAutotile.ts):
 * interior massifs draw larger and on top, edges lean into the range, and a
 * per-cell flip and nudge keep neighbours from reading as copies. */
export function ConnectedTerrainArt({ region, sprite, rockColor, pieces }: { region: Region; sprite: string; rockColor: string;
  pieces?: ReadonlyMap<string, AutotilePlacement> }) {
  const clipId = useId().replace(/:/g, '');
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
  return <svg aria-hidden="true" data-connected-terrain="mountains" data-terrain-cell-count={region.tiles.length}
    className="absolute pointer-events-none" width={region.width} height={region.height}
    viewBox={`0 0 ${region.width} ${region.height}`}
    style={{ left: `calc(50% + ${left}px)`, top: `calc(50% + ${top}px)`, overflow: 'hidden', imageRendering: 'pixelated', pointerEvents: 'none' }}>
    <defs><clipPath id={clipId}>{region.tiles.map(tile => <rect key={tile.id}
      x={tile.position.x - left - cell / 2} y={tile.position.y - top - cell / 2} width={cell} height={cell} />)}</clipPath></defs>
    <g clipPath={`url(#${clipId})`}>
    {region.width > cell && region.height > cell && <rect x={cell / 2} y={cell / 2}
      width={region.width - cell} height={region.height - cell} fill={rockColor} />}
    {peaks.map(peak => <image key={peak.id} href={sprite} data-terrain-piece={peak.shape} data-terrain-flip={peak.flip || undefined}
      x={peak.x} y={peak.y} width={peak.size} height={peak.size}
      transform={peak.flip ? `translate(${2 * peak.x + peak.size} 0) scale(-1 1)` : undefined} />)}
    </g>
  </svg>;
}
