import { memo } from 'react';

type Footprint = { x: number; y: number; width: number; height: number };

/** Neutral terrain shares one filtered ground surface. Individual transparent
 * tile buttons above it retain cell identity and exploration interactions. */
export const UnexploredGround = memo(function UnexploredGround({ cells }: { cells: readonly Footprint[] }) {
  if (!cells.length) return null;
  const left = Math.min(...cells.map(cell => cell.x - cell.width / 2));
  const top = Math.min(...cells.map(cell => cell.y - cell.height / 2));
  const width = Math.max(...cells.map(cell => cell.x + cell.width / 2)) - left;
  const height = Math.max(...cells.map(cell => cell.y + cell.height / 2)) - top;
  const path = cells.map(cell => `M${cell.x-cell.width/2},${cell.y-cell.height/2}h${cell.width}v${cell.height}h${-cell.width}z`).join('');
  return <svg aria-hidden="true" data-unexplored-ground="true" data-ground-cell-count={cells.length} className="absolute pointer-events-none"
    viewBox={`${left} ${top} ${width} ${height}`} width={width} height={height}
    style={{ left: `calc(50% + ${left}px)`, top: `calc(50% + ${top}px)`, opacity: .65,
      filter: 'var(--silhouette-filter) grayscale(1) brightness(0.45)' }}>
    <path d={path} fill="#182221" />
  </svg>;
});
