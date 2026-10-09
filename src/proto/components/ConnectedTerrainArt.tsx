import { useId } from 'react';
import { TABLE_GRID } from '../gridCoordinates';

type Region = { x: number; y: number; width: number; height: number;
  tiles: readonly { id: string; position: { x: number; y: number } }[] };

/** A connected print has one outer boundary. Overlapping rock faces cover the
 * cell seams; solid interior rock prevents holes revealing the table grid. */
export function ConnectedTerrainArt({ region, sprite, rockColor }: { region: Region; sprite: string; rockColor: string }) {
  const clipId = useId().replace(/:/g, '');
  const cell = TABLE_GRID.cellSize;
  const size = Math.min(cell * 1.5, region.width, region.height);
  const left = region.x - region.width / 2, top = region.y - region.height / 2;
  const clamp = (value: number, extent: number) => Math.max(0, Math.min(extent - size, value));
  return <svg aria-hidden="true" data-connected-terrain="mountains" data-terrain-cell-count={region.tiles.length}
    className="absolute pointer-events-none" width={region.width} height={region.height}
    viewBox={`0 0 ${region.width} ${region.height}`}
    style={{ left: `calc(50% + ${left}px)`, top: `calc(50% + ${top}px)`, overflow: 'hidden', imageRendering: 'pixelated', pointerEvents: 'none' }}>
    <defs><clipPath id={clipId}>{region.tiles.map(tile => <rect key={tile.id}
      x={tile.position.x - left - cell / 2} y={tile.position.y - top - cell / 2} width={cell} height={cell} />)}</clipPath></defs>
    <g clipPath={`url(#${clipId})`}>
    {region.width > cell && region.height > cell && <rect x={cell / 2} y={cell / 2}
      width={region.width - cell} height={region.height - cell} fill={rockColor} />}
    {region.tiles.map(tile => <image key={tile.id} href={sprite}
      x={clamp(tile.position.x - left - size / 2, region.width)}
      y={clamp(tile.position.y - top - size / 2, region.height)}
      width={size} height={size} />)}
    </g>
  </svg>;
}
