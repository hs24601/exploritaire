import { useSyncExternalStore } from 'react';

const listeners = new Set<() => void>();
let visible = true;
export const getHeroBobtail = () => visible;
export function setHeroBobtail(value: boolean) {
  visible = value;
  listeners.forEach(listener => listener());
}
export const useHeroBobtail = () => useSyncExternalStore(
  listener => { listeners.add(listener); return () => listeners.delete(listener); },
  getHeroBobtail, () => true,
);

/** Tail canvases retain the body's exact source registration. */
export function restBobtailSprite(sprite: string) {
  return /hero-sleeping(?:-topdown)?-body-v3\.png$/.test(sprite)
    ? sprite.replace('-body-v3.png', '-bobtail-layer-v3.png') : undefined;
}
