import { sceneryFileName } from './proceduralWoods';

/** World heights, independent of zoom, camera and ground footprint.
 * Calibrated to the existing Paint berry crown envelope: 46px footprint,
 * trimmed height/width 3/7. Five units = one current berry crown envelope.
 * Ground elevation is separate; there is no mountain-height ceiling. */
export const MIN_SPILL_HEIGHT = 1;
export const SCENERY_HEIGHT_UNIT = 46 * (3 / 7) / 5;
export const SCENERY_HEIGHTS = { ground: 0, denSpill: 1, berryBush: 5, woods: 8, mountain: 11.6 } as const;
export function heightToWorld(units: number): number {
  if (!Number.isFinite(units) || units < 0) throw new RangeError('Height must be finite and non-negative');
  return units * SCENERY_HEIGHT_UNIT;
}
export function heightFromWorld(world: number): number {
  if (!Number.isFinite(world) || world < 0) throw new RangeError('Height must be finite and non-negative');
  return world / SCENERY_HEIGHT_UNIT;
}

/** Reference heights at a fitted 46px footprint. Only immersive sprites;
 * overhead/card artwork and Pixel originals retain their existing shapes. */
export function sceneryHeightUnits(src: string | undefined): number | undefined {
  // Procedural pines and clusters take the height of the cutouts they replace.
  const name = sceneryFileName(src);
  if (name === 'curious-sapling-sprite-v1.png') return 2;
  if (name === 'woods-cluster-sprite-v1.png' || name === 'pine-sprite-v1.png') return SCENERY_HEIGHTS.woods;
  if (name === 'mountain-peak-sprite-v1.png') return SCENERY_HEIGHTS.mountain;
  return undefined;
}
export function sceneryHeightScale(src: string | undefined, width: number, height: number, aspect: number): number {
  const units = sceneryHeightUnits(src);
  if (units !== undefined) return heightToWorld(units) * (width / 46) / Math.max(.0001, Math.min(height, width / aspect));
  // Mountain connecting saddles rise by the same ratio as their peaks.
  return /mountain-ridge(?:-ns)?-sprite-v1\.png/.test(src ?? '') ? SCENERY_HEIGHTS.mountain / 8 : 1;
}

/** Woods reach their authored height by uniform scaling, retaining pine shape. */
export function sceneryWidthScale(src: string | undefined, width: number, height: number, aspect: number): number {
  return sceneryHeightUnits(src) === SCENERY_HEIGHTS.woods || /curious-sapling-sprite-v1\.png/.test(src ?? '') ? sceneryHeightScale(src, width, height, aspect) : 1;
}
