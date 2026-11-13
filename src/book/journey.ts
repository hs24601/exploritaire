export const MAP_INDEX = 4;
export type Journey = { from: number; to: number; insert: boolean; rapid: boolean; leaves: number; duration: number };
export function planJourney(from: number, to: number, reduced = false): Journey | null {
  if (!Number.isInteger(from) || !Number.isInteger(to) || from < 0 || from > MAP_INDEX || to < 0 || to > MAP_INDEX || from === to) return null;
  const rapid = Math.abs(to-from)>1;
  return { from, to, insert: false, rapid, leaves: rapid ? Math.max(4, Math.abs(to-from)*2) : 1, duration: reduced ? 100 : rapid ? 2600 : 2400 };
}
