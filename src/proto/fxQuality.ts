import { useSyncExternalStore } from 'react';
import type { FxQuality } from './atmosphere';

/** The visual effects tier, chosen once per device and kept live.
 *
 * Order of precedence: `?fx=low|high` for the session, then the player's saved
 * choice, then the device guess. On Auto, sustained slow frames step a
 * high-tier session down to low and remember it for this device; it never
 * steps back up on its own (that would oscillate). Mobile perf review,
 * 2026-10-23: phones always got the high tier before this. */
export type FxPreference = 'auto' | FxQuality;

const PREFERENCE_KEY = 'exploritaire-fx-quality';
const DOWNGRADED_KEY = 'exploritaire-fx-auto-low';
const listeners = new Set<() => void>();

const read = (key: string) => { try { return localStorage.getItem(key); } catch { return null; } };
const write = (key: string, value: string | null) => {
  try { if (value === null) localStorage.removeItem(key); else localStorage.setItem(key, value); } catch { /* Storage is optional. */ }
};

const forced = (): FxQuality | null => {
  if (typeof window === 'undefined') return null;
  const value = new URLSearchParams(window.location.search).get('fx');
  return value === 'low' || value === 'high' ? value : null;
};

/** Phones and tablets, reduced-motion players and small devices start low.
 * Safari and Firefox report no deviceMemory, so touch-first screens are
 * recognised by pointer and size rather than by memory. */
export const deviceFxQuality = (): FxQuality => {
  if (typeof window === 'undefined') return 'high';
  if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return 'low';
  const nav = navigator as Navigator & { deviceMemory?: number; userAgentData?: { mobile?: boolean } };
  if (nav.userAgentData?.mobile || /Android|iPhone|iPad|iPod|Mobile/i.test(nav.userAgent)) return 'low';
  // iPadOS reports a desktop user agent; a coarse primary pointer gives it away.
  if (window.matchMedia?.('(pointer: coarse)').matches && !window.matchMedia('(any-pointer: fine)').matches) return 'low';
  if ((nav.hardwareConcurrency ?? 8) <= 4 && (nav.deviceMemory ?? 8) < 4) return 'low';
  return 'high';
};

let preference: FxPreference = (() => {
  const saved = read(PREFERENCE_KEY);
  return saved === 'low' || saved === 'high' ? saved : 'auto';
})();
let autoDowngraded = read(DOWNGRADED_KEY) === 'true';

const resolve = (): FxQuality => forced() ?? (preference !== 'auto' ? preference : autoDowngraded ? 'low' : deviceFxQuality());
let current = resolve();
const publish = () => {
  const next = resolve();
  if (next === current) return;
  current = next;
  listeners.forEach(listener => listener());
};

export const currentFxQuality = () => current;
export const fxPreference = () => preference;
export const fxAutoDowngraded = () => autoDowngraded;

export const setFxPreference = (value: FxPreference) => {
  preference = value;
  write(PREFERENCE_KEY, value === 'auto' ? null : value);
  // Choosing Auto again forgets an earlier automatic step down.
  if (value === 'auto') { autoDowngraded = false; write(DOWNGRADED_KEY, null); }
  publish();
  watch();
};

const subscribe = (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener); }; };
export const useFxQuality = () => useSyncExternalStore(subscribe, currentFxQuality, () => 'high' as FxQuality);
export const useFxPreference = () => useSyncExternalStore(subscribe, fxPreference, () => 'auto' as FxPreference);

/** Frame governor. Ignores the first seconds after load and any hidden time,
 * then watches 4-second windows; two slow windows in a row (median frame over
 * 24ms, i.e. under ~42fps) step Auto down to low. */
const WARMUP_MS = 8000, WINDOW_MS = 4000, SLOW_MEDIAN_MS = 24, SLOW_WINDOWS = 2;
let enabled = false, running = false;
let started = 0, windowStart = 0, previous = 0, slowWindows = 0;
let frames: number[] = [];
// Only runs while there is something to decide: Auto on the high tier.
const watch = () => {
  if (!enabled || running || preference !== 'auto' || current === 'low' || forced()) return;
  running = true; started = 0; windowStart = 0; previous = 0; slowWindows = 0; frames = [];
  requestAnimationFrame(tick);
};
const tick = (now: number) => {
  if (preference !== 'auto' || current === 'low') { running = false; return; }
  if (document.hidden) { previous = 0; frames = []; windowStart = 0; requestAnimationFrame(tick); return; }
  started ||= now;
  if (previous && now - started > WARMUP_MS) {
    // Gaps over a second are stalls (tab switch, debugger), not frame pacing.
    if (now - previous < 1000) frames.push(now - previous);
    windowStart ||= now;
    if (now - windowStart >= WINDOW_MS) {
      frames.sort((a, b) => a - b);
      const median = frames[Math.floor(frames.length / 2)] ?? 0;
      slowWindows = median > SLOW_MEDIAN_MS ? slowWindows + 1 : 0;
      frames = []; windowStart = now;
      if (slowWindows >= SLOW_WINDOWS) { autoDowngraded = true; write(DOWNGRADED_KEY, 'true'); publish(); }
    }
  }
  previous = now;
  requestAnimationFrame(tick);
};
export const startFxGovernor = () => { enabled = true; watch(); };
