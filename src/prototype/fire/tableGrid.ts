export type TableGridPosition = { x: number; y: number };

// The hearth uses percentage-based world coordinates. Keeping the grid in the
// same coordinate system makes snapping stable through camera pan and zoom.
export const TABLE_GRID = {
  // A 16 x 9 board produces physically square cells on the 16:9 canvas.
  columns: 16,
  rows: 9,
  xStep: 100 / 16,
  yStep: 100 / 9,
  minX: 100 / 32,
  maxX: 100 - 100 / 32,
  minY: 100 / 18,
  maxY: 100 - 100 / 18,
} as const;

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

/** Snaps interactive world objects to the center of a square table cell. */
export const snapToTableGrid = ({ x, y }: TableGridPosition): TableGridPosition => ({
  x: clamp(Math.floor(x / TABLE_GRID.xStep) * TABLE_GRID.xStep + TABLE_GRID.xStep / 2, TABLE_GRID.minX, TABLE_GRID.maxX),
  y: clamp(Math.floor(y / TABLE_GRID.yStep) * TABLE_GRID.yStep + TABLE_GRID.yStep / 2, TABLE_GRID.minY, TABLE_GRID.maxY),
});
