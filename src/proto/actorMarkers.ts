/** Presentation data for an actor's floating object; independent of battle rules and input. */
export type ActorMarkerMeter = { current: number; max: number; preview?: number; label?: string; color?: string };
export type ActorMarkerRow =
  | { id: string; kind: 'meter'; meter: ActorMarkerMeter }
  | { id: string; kind: 'label'; text: string; color?: string };
export type ActorMarkerContent = {
  health?: ActorMarkerMeter;
  /** Ordered extension slots for AP meters, debuff labels, or other markers. */
  rows?: readonly ActorMarkerRow[];
};
export const markerFraction = (meter: ActorMarkerMeter) => Number.isFinite(meter.current) && Number.isFinite(meter.max) && meter.max > 0 ? Math.max(0, Math.min(1, meter.current / meter.max)) : 0;
export const markerRows = (content: ActorMarkerContent): ActorMarkerRow[] => [
  ...(content.health ? [{ id: 'health', kind: 'meter' as const, meter: { label: 'HP', ...content.health } }] : []),
  ...(content.rows ?? []),
];
/** Bounded perspective scaling keeps a world-space panel readable at distant views. */
export const markerScale = (projectedWidth: number, min = 104, max = 156) => projectedWidth > 0 && Number.isFinite(projectedWidth) ? Math.max(min, Math.min(max, projectedWidth)) / projectedWidth : 1;
