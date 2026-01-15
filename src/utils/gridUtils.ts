import { GARDEN_GRID } from '../engine/constants';

export interface GridPosition {
  col: number;
  row: number;
}

export interface PixelPosition {
  x: number;
  y: number;
}

/**
 * Snaps pixel coordinates to the nearest grid cell
 */
export function snapToGrid(x: number, y: number): PixelPosition {
  const { cellSize } = GARDEN_GRID;
  return {
    x: Math.round(x / cellSize) * cellSize,
    y: Math.round(y / cellSize) * cellSize,
  };
}

/**
 * Converts pixel coordinates to grid cell coordinates
 */
export function pixelToGrid(x: number, y: number): GridPosition {
  const { cellSize } = GARDEN_GRID;
  return {
    col: Math.floor(x / cellSize),
    row: Math.floor(y / cellSize),
  };
}

/**
 * Converts grid cell coordinates to pixel coordinates (top-left corner of cell)
 */
export function gridToPixel(col: number, row: number): PixelPosition {
  const { cellSize } = GARDEN_GRID;
  return {
    x: col * cellSize,
    y: row * cellSize,
  };
}

/**
 * Centers an object of given size within a grid cell
 */
export function centerInCell(
  col: number,
  row: number,
  objectWidth: number,
  objectHeight: number
): PixelPosition {
  const { cellSize } = GARDEN_GRID;
  const cellCenter = gridToPixel(col, row);
  return {
    x: cellCenter.x + (cellSize - objectWidth) / 2,
    y: cellCenter.y + (cellSize - objectHeight) / 2,
  };
}

/**
 * Checks if a grid position is within bounds
 */
export function isValidGridPosition(col: number, row: number): boolean {
  const { cols, rows } = GARDEN_GRID;
  return col >= 0 && col < cols && row >= 0 && row < rows;
}

/**
 * Calculates the total grid dimensions in pixels
 */
export function getGridDimensions(): { width: number; height: number } {
  const { cellSize, cols, rows } = GARDEN_GRID;
  return {
    width: cols * cellSize,
    height: rows * cellSize,
  };
}
