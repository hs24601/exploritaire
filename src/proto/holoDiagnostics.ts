/** Temporary local-only diagnostics; no card traces are retained without the flag. */
export const GYRO_LOG_ENABLED = new URLSearchParams(window.location.search).has('gyrolog');
type Pose = { x: number; y: number; lift: number };
export type HoloSensorTrace = { events: number; calibrations: number; status: string; target: Pose | null };
export type HoloCardTrace = {
  sensor: HoloSensorTrace | null; input: string; target: Pose; frames: number; queued: boolean;
};
const cards = new WeakMap<HTMLElement, HoloCardTrace>();
export function traceHoloCard(card: HTMLElement | null, trace: HoloCardTrace) {
  if (GYRO_LOG_ENABLED && card) cards.set(card, trace);
}
export function readHoloCardTrace(card: HTMLElement | null) { return card ? cards.get(card) : undefined; }
