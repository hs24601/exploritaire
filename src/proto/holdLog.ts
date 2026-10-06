/** Opt-in diagnostics for reward holds on real devices. Off unless the page
 * URL carries `?holdlog`; nothing is recorded or shown otherwise. */
export const HOLD_LOG_ENABLED = typeof window !== 'undefined' && new URLSearchParams(window.location.search).has('holdlog');

export type HoldLogEntry = { at: number; text: string };
const entries: HoldLogEntry[] = [];
const listeners = new Set<() => void>();
const origin = typeof performance !== 'undefined' ? performance.now() : 0;

export function logHold(text: string) {
  if (!HOLD_LOG_ENABLED) return;
  entries.push({ at: Math.round(performance.now() - origin), text });
  if (entries.length > 40) entries.shift();
  listeners.forEach((listener) => listener());
}
export const holdLogEntries = () => entries.slice();
export const clearHoldLog = () => { entries.length = 0; listeners.forEach((listener) => listener()); };
export const subscribeHoldLog = (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener); }; };
