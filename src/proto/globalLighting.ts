import { useSyncExternalStore } from 'react';

const key = 'exploritaire-global-lights';
const listeners = new Set<() => void>();
let enabled = true;
try { enabled = localStorage.getItem(key) !== 'off'; } catch { /* Storage is optional. */ }
export const globalLightsEnabled = () => enabled;
export const setGlobalLightsEnabled = (value: boolean) => {
  enabled = value;
  try { localStorage.setItem(key, value ? 'on' : 'off'); } catch { /* Keep the session setting. */ }
  listeners.forEach(listener => listener());
};
export const useGlobalLights = () => useSyncExternalStore(listener => {
  listeners.add(listener); return () => { listeners.delete(listener); };
}, globalLightsEnabled, () => true);
