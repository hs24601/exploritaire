import { useSyncExternalStore } from 'react';
const KEY = 'exploritaire.story-cinematics.first-pass';
let enabled = true;
try { enabled = localStorage.getItem(KEY) !== 'off' && new URLSearchParams(location.search).get('cinema') !== 'off'; } catch { /* Defaults work without storage. */ }
const listeners = new Set<() => void>();
export const storyCinematicsEnabled = () => enabled;
export function setStoryCinematicsEnabled(value: boolean) { enabled = value; try { localStorage.setItem(KEY, value ? 'on' : 'off'); } catch {} listeners.forEach(fn => fn()); }
export const useStoryCinematicsEnabled = () => useSyncExternalStore(fn => { listeners.add(fn); return () => { listeners.delete(fn); }; }, storyCinematicsEnabled);
