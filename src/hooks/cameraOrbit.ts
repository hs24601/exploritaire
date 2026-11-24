/** Shared mouse/touch orbit sensitivity; pitch is tilt from the overhead view. */
export const ORBIT_DEG_PER_PX = 0.4;

export function orbitPitch(start: number, dy: number, min: number, max: number) {
  return Math.max(min, Math.min(max, start - dy * ORBIT_DEG_PER_PX));
}
