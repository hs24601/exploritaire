export type SplatterPatternArc = {
  offsetDeg: number;
  spreadDeg: number;
  weight: number;
  distanceMin: number;
  distanceMax: number;
};

export type SplatterPattern = {
  id: string;
  label: string;
  splotchArcs: SplatterPatternArc[];
  drizzleArcs: SplatterPatternArc[];
};

export const SPLATTER_PATTERNS: SplatterPattern[] = [
  {
    id: 'splatter_fan_left',
    label: 'Fan Left',
    splotchArcs: [
      { offsetDeg: -140, spreadDeg: 90, weight: 0.7, distanceMin: 90, distanceMax: 160 },
      { offsetDeg: 20, spreadDeg: 40, weight: 0.3, distanceMin: 50, distanceMax: 110 },
    ],
    drizzleArcs: [
      { offsetDeg: -155, spreadDeg: 120, weight: 1, distanceMin: 60, distanceMax: 180 },
    ],
  },
  {
    id: 'splatter_streak_right',
    label: 'Streak Right',
    splotchArcs: [
      { offsetDeg: 0, spreadDeg: 28, weight: 0.8, distanceMin: 130, distanceMax: 230 },
      { offsetDeg: 15, spreadDeg: 35, weight: 0.2, distanceMin: 80, distanceMax: 150 },
    ],
    drizzleArcs: [
      { offsetDeg: 0, spreadDeg: 40, weight: 1, distanceMin: 90, distanceMax: 210 },
    ],
  },
  {
    id: 'splatter_drip_down',
    label: 'Drip Down',
    splotchArcs: [
      { offsetDeg: 90, spreadDeg: 55, weight: 0.7, distanceMin: 90, distanceMax: 150 },
      { offsetDeg: 120, spreadDeg: 30, weight: 0.3, distanceMin: 60, distanceMax: 120 },
    ],
    drizzleArcs: [
      { offsetDeg: 95, spreadDeg: 25, weight: 1, distanceMin: 130, distanceMax: 240 },
    ],
  },
  {
    id: 'splatter_round_burst',
    label: 'Round Burst',
    splotchArcs: [
      { offsetDeg: -10, spreadDeg: 60, weight: 0.45, distanceMin: 80, distanceMax: 140 },
      { offsetDeg: 140, spreadDeg: 55, weight: 0.35, distanceMin: 70, distanceMax: 130 },
      { offsetDeg: -150, spreadDeg: 45, weight: 0.2, distanceMin: 60, distanceMax: 110 },
    ],
    drizzleArcs: [
      { offsetDeg: 30, spreadDeg: 120, weight: 1, distanceMin: 50, distanceMax: 160 },
    ],
  },
  {
    id: 'splatter_blob_drip',
    label: 'Blob Drip',
    splotchArcs: [
      { offsetDeg: 20, spreadDeg: 45, weight: 0.6, distanceMin: 70, distanceMax: 120 },
      { offsetDeg: 100, spreadDeg: 35, weight: 0.4, distanceMin: 50, distanceMax: 100 },
    ],
    drizzleArcs: [
      { offsetDeg: 105, spreadDeg: 25, weight: 1, distanceMin: 130, distanceMax: 220 },
    ],
  },
  {
    id: 'splatter_crown',
    label: 'Crown',
    splotchArcs: [
      { offsetDeg: -30, spreadDeg: 35, weight: 0.5, distanceMin: 90, distanceMax: 150 },
      { offsetDeg: 30, spreadDeg: 35, weight: 0.5, distanceMin: 90, distanceMax: 150 },
    ],
    drizzleArcs: [
      { offsetDeg: 90, spreadDeg: 20, weight: 1, distanceMin: 120, distanceMax: 210 },
    ],
  },
];

export function getSplatterPattern(id?: string | null): SplatterPattern | null {
  if (!id) return null;
  return SPLATTER_PATTERNS.find((pattern) => pattern.id === id) ?? null;
}
