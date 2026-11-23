import { TABLE_GRID } from '../proto/gridCoordinates';
import type { TableLight } from '../proto/protoLighting';

/** The only emitters in Roam. Hero carries no light and the sky emits none. */
export const ROAM_LIGHTS: TableLight[] = [
  { id: 'roam-home-light', position: TABLE_GRID.center(TABLE_GRID.cell(0, 2)), radius: 1.7, strength: 1, height: 45, color: '#ffd48c', flicker: .15, fromPiece: true },
  { id: 'roam-berry-light', position: TABLE_GRID.center(TABLE_GRID.cell(0, 1)), radius: 1.35, strength: .9, height: 24, color: '#9cdeff', flicker: 0, fromPiece: true },
];
