import { describe, expect, it } from 'vitest';
import { CONSTELLATIONS, initialSky, motifDegrees, skyReceipt, skyRunEnd, type Constellation } from './constellations';

const figures: Constellation[] = [
  { id: 'a', name: 'A', stars: [{ x: 0, y: 0 }, { x: 1, y: 0 }] },
  { id: 'b', name: 'B', stars: [{ x: 0, y: 1 }, { x: 1, y: 1 }, { x: 1, y: 0 }] },
];

describe('constellation sky', () => {
  it('lights stars in order and completes a figure with the run as its motif', () => {
    let step = skyReceipt(initialSky(), 4, figures);
    expect(step.effects).toEqual([{ kind: 'light', figure: 0, star: 0 }]);
    step = skyReceipt(step.state, 5, figures);
    expect(step.effects).toEqual([{ kind: 'complete', figure: 0, star: 1, notes: [4, 5] }]);
    expect(step.state).toMatchObject({ figure: 1, lit: 0, notes: [], completed: [0] });
  });
  it('fades a partial figure at turn end and retries the same figure', () => {
    const lit = skyReceipt(skyReceipt(initialSky(), 4, figures).state, 5, figures).state;
    const half = skyReceipt(lit, 9, figures).state;
    const ended = skyRunEnd(half);
    expect(ended.effects).toEqual([{ kind: 'fade', figure: 1, stars: 1 }]);
    expect(ended.state).toMatchObject({ figure: 1, lit: 0, completed: [0] });
    expect(skyRunEnd(ended.state).effects).toEqual([]);
  });
  it('starts a new cycle after every figure is complete', () => {
    let state = initialSky();
    for (const rank of [1, 2, 3, 4, 5]) state = skyReceipt(state, rank, figures).state;
    expect(state.completed).toEqual([0, 1]);
    const next = skyReceipt(state, 6, figures);
    expect(next.effects[0]).toEqual({ kind: 'reset', cycle: 1 });
    expect(next.state).toMatchObject({ cycle: 1, figure: 0, lit: 1, completed: [] });
  });
  it('authors small figures first and keeps every star on the sky', () => {
    const sizes = CONSTELLATIONS.map(figure => figure.stars.length);
    expect(sizes[0]).toBeLessThanOrEqual(sizes[sizes.length - 1]);
    for (const figure of CONSTELLATIONS) for (const star of figure.stars) {
      expect(star.x).toBeGreaterThanOrEqual(0); expect(star.x).toBeLessThanOrEqual(1);
      expect(star.y).toBeGreaterThanOrEqual(0); expect(star.y).toBeLessThanOrEqual(1);
    }
  });
  it('resolves the motif to the octave root', () => {
    expect(motifDegrees([5, 6, 7])).toEqual([4, 5, 6, 7]);
  });
});
