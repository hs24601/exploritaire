import { useSyncExternalStore } from 'react';
import { mobileLightingEnabled } from './mobileLighting';

export type MapLightingRenderer = 'off' | 'mobile' | 'full';
const storageKey = 'exploritaire-map-lighting-renderer';
const listeners = new Set<() => void>();
let selected: MapLightingRenderer | undefined;
let darknessStrength: number | undefined;
let localLightsOnly = false;
export const DEFAULT_DARKNESS_STRENGTH = 25;
const darknessKey = 'exploritaire-darkness-strength';

/** Scene lighting, independent of renderer choice and visual exposure. */
export function configureMapLightingEnvironment(options: { localLightsOnly: boolean }) {
  localLightsOnly = options.localLightsOnly;
}
export const mapHasSkyLight = () => !localLightsOnly;
export function getDarknessStrength() {
  if (darknessStrength !== undefined) return darknessStrength;
  try {
    const saved = localStorage.getItem(darknessKey);
    if (saved !== null && Number.isFinite(Number(saved))) return darknessStrength = Math.max(0, Math.min(200, Number(saved)));
  } catch { /* Storage is optional. */ }
  return darknessStrength = DEFAULT_DARKNESS_STRENGTH;
}
export function setDarknessStrength(value: number) {
  if (!Number.isFinite(value)) return;
  darknessStrength = Math.max(0, Math.min(200, value));
  try { localStorage.setItem(darknessKey, String(darknessStrength)); } catch { /* Keep the session choice. */ }
  listeners.forEach(listener => listener());
}
const subscribe = (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener); }; };
export const useDarknessStrength = () => useSyncExternalStore(subscribe, getDarknessStrength, () => DEFAULT_DARKNESS_STRENGTH);
const parse = (value: string | null): MapLightingRenderer | undefined =>
  value === 'desktop' ? 'full' : value === 'off' || value === 'mobile' || value === 'full' ? value : undefined;

function initialRenderer(): MapLightingRenderer {
  if (typeof window === 'undefined') return 'full';
  const override = parse(new URLSearchParams(window.location.search).get('lightingRenderer'));
  if (override) return override;
  try { const saved = parse(localStorage.getItem(storageKey)); if (saved) return saved; } catch { /* Storage is optional. */ }
  return mobileLightingEnabled() ? 'mobile' : 'full';
}

// Sprite lighting samples this frequently; resolve URL/storage/device only once.
export const getMapLightingRenderer = (): MapLightingRenderer => selected ??= initialRenderer();

export function setMapLightingRenderer(value: MapLightingRenderer) {
  selected = value;
  try { localStorage.setItem(storageKey, value); } catch { /* Keep the session choice. */ }
  // Keep explicit comparison links consistent with the current selection,
  // without navigation or rebuilding the world/camera.
  try {
    const url = new URL(window.location.href);
    url.searchParams.set('lightingRenderer', value === 'full' ? 'desktop' : value);
    window.history.replaceState(window.history.state, '', url);
  } catch { /* Embedded previews may disallow URL changes. */ }
  listeners.forEach(listener => listener());
}

export const nextMapLightingRenderer = (value: MapLightingRenderer): MapLightingRenderer =>
  value === 'off' ? 'mobile' : value === 'mobile' ? 'full' : 'off';

export const useMapLightingRenderer = () => useSyncExternalStore(subscribe, getMapLightingRenderer, () => 'full' as const);
