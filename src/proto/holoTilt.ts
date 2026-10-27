/** Shared gentle limit for pointer, touch and calibrated device input.
 * Keep foil coordinates and spring timing independent of the clickable face. */
export const HOLO_TILT_MAX_DEGREES = 4;
export function holoTiltAngles({ x, y }: { x: number; y: number }) {
  const clamp = (value: number) => Math.max(0, Math.min(100, value));
  return { x: (50 - clamp(y)) / 50 * HOLO_TILT_MAX_DEGREES,
    y: (clamp(x) - 50) / 50 * HOLO_TILT_MAX_DEGREES };
}
