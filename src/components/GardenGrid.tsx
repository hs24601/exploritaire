import { memo } from 'react';
import { GARDEN_GRID } from '../engine/constants';

interface GardenGridProps {
  width?: number;
  height?: number;
  opacity?: number;
}

export const GardenGrid = memo(function GardenGrid({
  width = GARDEN_GRID.cols * GARDEN_GRID.cellSize,
  height = GARDEN_GRID.rows * GARDEN_GRID.cellSize,
  opacity = 1,
}: GardenGridProps) {
  const { cellSize, strokeColor, strokeWidth } = GARDEN_GRID;

  // Calculate number of lines
  const verticalLines = Math.ceil(width / cellSize) + 1;
  const horizontalLines = Math.ceil(height / cellSize) + 1;

  return (
    <svg
      width={width}
      height={height}
      className="absolute inset-0 pointer-events-none"
      style={{ opacity }}
    >
      {/* Vertical lines */}
      {Array.from({ length: verticalLines }).map((_, i) => (
        <line
          key={`v-${i}`}
          x1={i * cellSize}
          y1={0}
          x2={i * cellSize}
          y2={height}
          stroke={strokeColor}
          strokeWidth={strokeWidth}
        />
      ))}

      {/* Horizontal lines */}
      {Array.from({ length: horizontalLines }).map((_, i) => (
        <line
          key={`h-${i}`}
          x1={0}
          y1={i * cellSize}
          x2={width}
          y2={i * cellSize}
          stroke={strokeColor}
          strokeWidth={strokeWidth}
        />
      ))}
    </svg>
  );
});
