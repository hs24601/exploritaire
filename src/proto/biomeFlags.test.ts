import { describe, expect, it } from 'vitest';
import { FIRST_LOOK, arriveAt, biomeExploration, biomeOpenState, biomeTravelCost, dealClearedShare } from './biomeFlags';

describe('biome flags', () => {
  it('fully explores a pond on arrival without requiring a catch', () => {
    expect(biomeExploration(['unexplored'], 1)).toBe(0);
    expect(biomeExploration(arriveAt(['unexplored']), 1)).toBe(1);
  });

  it('blocks crossing an unexplored biome and slows rough ground', () => {
    expect(biomeTravelCost([])).toBe(1);
    expect(biomeTravelCost(['unexplored'])).toBe(Infinity);
    expect(biomeTravelCost(['rough'])).toBe(3);
    expect(biomeTravelCost(['rough', 'unexplored'])).toBe(Infinity);
  });

  it('keeps an unexplored tableau closed, with a reason', () => {
    expect(biomeOpenState(['unexplored'])).toEqual({ opens: false, reason: expect.stringContaining('Unexplored') });
    expect(biomeOpenState(['rough']).opens).toBe(true);
  });

  it('explores a first look on arrival, then the rest with progress', () => {
    expect(biomeExploration(['unexplored'], 0.8)).toBe(0);
    const flags = arriveAt(['unexplored', 'rough']);
    expect(flags).toEqual(['rough']);
    expect(biomeExploration(flags, 0)).toBeCloseTo(FIRST_LOOK);
    expect(biomeExploration(flags, 0.5)).toBeCloseTo(FIRST_LOOK + (1 - FIRST_LOOK) / 2);
    expect(biomeExploration(flags, 1)).toBe(1);
    expect(dealClearedShare(20, 5)).toBe(0.75);
    expect(dealClearedShare(0, 0)).toBe(0);
  });
});
