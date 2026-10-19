import { useSyncExternalStore } from 'react';

const key = 'exploritaire.flickPhysics';
let enabled = true;
try { enabled = localStorage.getItem(key) !== 'false'; } catch { /* Storage is optional. */ }
const listeners = new Set<() => void>();
export function setFlickPhysics(value: boolean) {
  enabled = value;
  try { localStorage.setItem(key, String(value)); } catch { /* Keep the session preference. */ }
  listeners.forEach(listener => listener());
}
export const useFlickPhysics = () => useSyncExternalStore(
  listener => { listeners.add(listener); return () => listeners.delete(listener); },
  () => enabled, () => true,
);

export type FlickSample = { x: number; y: number; t: number };
/** Recent motion only: holding still before release must not launch a card. */
export function flickVelocity(samples: FlickSample[]) {
  const last = samples[samples.length - 1];
  const first = last && samples.find(sample => sample.t >= last.t - 90 && sample.t < last.t);
  if (!last || !first || last.t - first.t < 8) return { x: 0, y: 0 };
  const dt = (last.t - first.t) / 1000;
  const x = (last.x - first.x) / dt, y = (last.y - first.y) / dt;
  const speed = Math.hypot(x, y), scale = Math.min(1, 3200 / speed);
  return speed < 250 ? { x: 0, y: 0 } : { x: x * scale, y: y * scale };
}
/** Exponential friction gives frame-rate independent displacement in CSS pixels. */
export function flickPosition(start: FlickSample, velocity: { x: number; y: number }, seconds: number) {
  const distance = (1 - Math.exp(-5 * seconds)) / 5;
  return { x: start.x + velocity.x * distance, y: start.y + velocity.y * distance };
}
