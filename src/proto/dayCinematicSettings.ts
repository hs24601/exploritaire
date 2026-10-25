import { useSyncExternalStore } from 'react';
const KEY = 'exploritaire.story-cinematics.first-pass';
let enabled = true;
const cinemaOverride = new URLSearchParams(location.search).get('cinema');
try { enabled = localStorage.getItem(KEY) !== 'off'; } catch { /* Defaults work without storage. */ }
// Explicit playtest links override this origin's saved preference for the session.
if (cinemaOverride === 'on' || cinemaOverride === 'off') enabled = cinemaOverride === 'on';
const listeners = new Set<() => void>();
export const storyCinematicsEnabled = () => enabled;
export function setStoryCinematicsEnabled(value: boolean) { enabled = value; try { localStorage.setItem(KEY, value ? 'on' : 'off'); } catch {} listeners.forEach(fn => fn()); }
export const useStoryCinematicsEnabled = () => useSyncExternalStore(fn => { listeners.add(fn); return () => { listeners.delete(fn); }; }, storyCinematicsEnabled);
