/** Pure state for the musical tableaus sky: party runs light constellations.
 *
 * Each party receipt lights the next star of the current figure and draws the
 * line from the previous one. Lighting every star in one party turn completes
 * the figure: it stays lit and replays the run's own notes as a motif. A turn
 * that ends early leaves a partial figure that fades and is retried. This is
 * presentation only; nothing in the rules reads it. */
export type SkyPoint = { x: number; y: number };
export type Constellation = {
  id: string; name: string;
  /** Stars in lighting order, in sky coordinates (0–1 of the sky canvas). */
  stars: readonly SkyPoint[];
  /** Extra lines drawn once the figure completes, as star index pairs. */
  closing?: readonly (readonly [number, number])[];
};

const shift = (dx: number, dy: number, scale: number, points: readonly (readonly [number, number])[]): SkyPoint[] => points.map(([x, y]) => ({ x: dx + x * scale, y: dy + y * scale }));

/** Small figures first so an early turn can finish one; later ones need longer runs.
 * Placed in the margins clear of the scenario picker, notes panel, foes, rack and foundation. */
export const CONSTELLATIONS: readonly Constellation[] = [
  { id: 'den', name: 'The Den', stars: shift(0.05, 0.14, 0.12, [[0, 0.9], [0.35, 0.2], [0.75, 0.15], [1.05, 0.85]]), closing: [[0, 3]] },
  { id: 'lantern', name: 'The Lantern', stars: shift(0.82, 0.4, 0.12, [[0.45, 0], [0.45, 0.35], [0.05, 0.6], [0.45, 1.05], [0.85, 0.6]]), closing: [[4, 1]] },
  { id: 'fish', name: 'The Fish', stars: shift(0.06, 0.66, 0.14, [[0, 0.3], [0.35, 0.05], [0.8, 0.25], [1.05, 0.55], [0.8, 0.85], [0.35, 0.65]]), closing: [[5, 0]] },
  { id: 'fox', name: 'The Fox', stars: shift(0.8, 0.62, 0.14, [[0, 0], [0.25, 0.3], [0.5, 0.05], [0.55, 0.45], [0.9, 0.7], [1.1, 1.05]]) },
  { id: 'crane', name: 'The Crane', stars: shift(0.4, 0.02, 0.16, [[0, 0.55], [0.3, 0.35], [0.55, 0.45], [0.8, 0.1], [1.1, 0.05], [0.8, 0.55], [0.6, 0.95]]) },
  { id: 'bear', name: 'The Bear', stars: shift(0.58, 0.78, 0.16, [[0, 0.45], [0.25, 0.2], [0.55, 0.15], [0.8, 0.35], [1.15, 0.3], [1.3, 0.6], [0.95, 0.7], [0.5, 0.7]]), closing: [[7, 0]] },
];

export type SkyState = {
  /** Index of the figure the current run is lighting. */
  figure: number;
  /** Stars lit so far by the current run. */
  lit: number;
  /** Ranks played in the current run, replayed as the completion motif. */
  notes: number[];
  /** Figures completed this cycle, in order. */
  completed: number[];
  /** Bumps each time every figure is complete and the sky starts over. */
  cycle: number;
};

export type SkyEffect =
  | { kind: 'light'; figure: number; star: number }
  | { kind: 'complete'; figure: number; star: number; notes: number[] }
  | { kind: 'fade'; figure: number; stars: number }
  | { kind: 'reset'; cycle: number };

export const initialSky = (): SkyState => ({ figure: 0, lit: 0, notes: [], completed: [], cycle: 0 });

const nextOpen = (completed: readonly number[], from: number, count: number) => {
  for (let step = 1; step <= count; step++) { const index = (from + step) % count; if (!completed.includes(index)) return index; }
  return -1;
};

/** One party receipt of the given rank. */
export function skyReceipt(state: SkyState, rank: number, figures: readonly Constellation[] = CONSTELLATIONS): { state: SkyState; effects: SkyEffect[] } {
  const effects: SkyEffect[] = [];
  let current = state;
  if (current.completed.length >= figures.length) {
    current = { ...initialSky(), cycle: current.cycle + 1 };
    effects.push({ kind: 'reset', cycle: current.cycle });
  }
  const figure = figures[current.figure], star = current.lit, notes = [...current.notes, rank];
  if (star + 1 < figure.stars.length) {
    effects.push({ kind: 'light', figure: current.figure, star });
    return { state: { ...current, lit: star + 1, notes }, effects };
  }
  const completed = [...current.completed, current.figure];
  effects.push({ kind: 'complete', figure: current.figure, star, notes });
  const next = nextOpen(completed, current.figure, figures.length);
  return { state: { ...current, figure: next < 0 ? current.figure : next, lit: 0, notes: [], completed }, effects };
}

/** The party turn ended (or the run broke): a partial figure fades and waits for the next run. */
export function skyRunEnd(state: SkyState): { state: SkyState; effects: SkyEffect[] } {
  if (state.lit === 0) return { state, effects: [] };
  return { state: { ...state, lit: 0, notes: [] }, effects: [{ kind: 'fade', figure: state.figure, stars: state.lit }] };
}

/** Degrees for the completion motif: the run's own ranks, then a resolve to the root an octave up. */
export const motifDegrees = (ranks: readonly number[]) => [...ranks.map(rank => ((Math.round(rank) - 1) % 13 + 13) % 13), 7];
