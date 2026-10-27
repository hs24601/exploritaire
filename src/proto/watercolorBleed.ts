import { useSyncExternalStore } from 'react';

/** Presentation config shared by settings and every sketch-to-paint surface. */
export const watercolorConfig = { bleed: true };
const listeners = new Set<() => void>();
export function setWatercolorBleed(enabled: boolean) {
  watercolorConfig.bleed = enabled;
  listeners.forEach(listener => listener());
}
export const useWatercolorBleed = () => useSyncExternalStore(
  listener => { listeners.add(listener); return () => listeners.delete(listener); },
  () => watercolorConfig.bleed, () => true,
);
