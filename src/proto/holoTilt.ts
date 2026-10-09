/** Shared visual gain for pointer, touch and calibrated device input. Keep the
 * normalized input/foil coordinates and spring timing independent of strength. */
export const HOLO_TILT_STRENGTH = 3;
export function holoTiltAngles({ x, y }: { x: number; y: number }) {
  const clamp = (value: number) => Math.max(0, Math.min(100, value));
  return { x: (50 - clamp(y)) * .24 * HOLO_TILT_STRENGTH,
    y: (clamp(x) - 50) * .28 * HOLO_TILT_STRENGTH };
}
