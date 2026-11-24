/**
 * POC lighting model: computed only when puzzle state changes, then rendered by CSS.
 * Coordinates are percentage points from the hearth at 50, 50.
 */
export const CARD_DISCOVERY_THRESHOLD = 0.45;
/** Rebased scale: the opening hearth begins at a deliberately dim 0.5u. */
export const DEFAULT_LUMINOSITY = 0.5;
export const LUMINOSITY_CALIBRATION_OFFSET = 11;

export function lightReachForProgress(progress: number) {
  return 14 + progress * 3.4;
}

/** Cosmetic light stays local even at 16/16; discovery range may be larger. */
export function visualLightReachForProgress(progress: number) {
  return 1 + Math.max(0, progress - 1) * (31 / 15);
}

export function cardIllumination(progress: number, x: number, y: number) {
  const distance = Math.hypot(x - 50, y - 50);
  const naturalLight = Math.min(1, Math.max(0.06, (lightReachForProgress(progress) - distance + 11) / 12));
  return naturalLight;
}
