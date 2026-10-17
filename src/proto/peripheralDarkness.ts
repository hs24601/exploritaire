/** Optional screen-space lighting composition. Values are fractions (0–1).
 * This is presentation only, independent of world-light/discovery sampling. */
export type PeripheralDarkness = {
  strength?: number;
  /** Clear ellipse radius relative to the viewport's half axes. */
  clearRadius?: number;
  /** Distance from the clear ellipse to full darkness. */
  softness?: number;
  centerX?: number;
  centerY?: number;
};

export const CLAUSTROPHOBIC_DARKNESS: Readonly<PeripheralDarkness> = Object.freeze({
  strength: .96, clearRadius: .28, softness: .68, centerX: .5, centerY: .56,
});

const bounded = (value: number | undefined, fallback: number, min = 0, max = 1) =>
  Number.isFinite(value) ? Math.max(min, Math.min(max, value!)) : fallback;

/** CSS handles resize and camera movement without measurements, animation
 * subscriptions, extra WebGL passes, blur filters or per-frame allocations. */
export function peripheralDarknessBackground(config: PeripheralDarkness): string {
  const strength = bounded(config.strength, .9);
  const radius = bounded(config.clearRadius, .28);
  const end = Math.min(1.5, radius + bounded(config.softness, .68, .01, 1.5));
  const x = +(bounded(config.centerX, .5) * 100).toFixed(2), y = +(bounded(config.centerY, .5) * 100).toFixed(2);
  const stop = (fraction: number) => `${((radius + (end - radius) * fraction) * 100).toFixed(2)}%`;
  return `radial-gradient(ellipse 50% 50% at ${x}% ${y}%, rgba(1,3,8,0) ${(radius * 100).toFixed(2)}%, rgba(1,3,8,${strength * .3}) ${stop(.4)}, rgba(1,3,8,${strength * .75}) ${stop(.75)}, rgba(1,3,8,${strength}) ${stop(1)})`;
}
