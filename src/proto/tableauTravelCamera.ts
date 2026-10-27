import type { TravelSegment } from './travelJourney';

/** Follow physical, card-earned walking, including the final buffered step. */
export function tableauDepartureProgress(segment: TravelSegment | undefined, walkedProgress: number): number {
  if (!segment || segment.traversalStage !== 'exit' && segment.kind !== 'den-exit' || segment.end <= segment.start) return 0;
  return Math.max(0, Math.min(1, (walkedProgress - segment.start) / (segment.end - segment.start)));
}

/** Incoming traversal reverses the departure dolly, arriving at gathering scale. */
export function tableauApproachProgress(segment: TravelSegment | undefined, walkedProgress: number): number {
  const incoming = segment?.traversalStage === 'enter' || segment?.traversalStage === undefined && segment?.sparseBerry !== undefined;
  if (!segment || !incoming || segment.end <= segment.start) return 0;
  return 1 - Math.max(0, Math.min(1, (walkedProgress - segment.start) / (segment.end - segment.start)));
}

export function tableauDepartureEye(progress: number, woods: boolean) {
  const step = Math.max(0, Math.min(1, progress));
  return { y: (woods ? 3.2 : 5.2) + step * 3, z: 10 + step * 24 };
}
