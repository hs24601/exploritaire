import { describe, expect, it } from 'vitest';
import { canSpendInspiration, spendInspiration } from './inspirationTesting';
import { applyFoundationPlay } from './rules/play';
import { createInitialState, createFoundations } from './rules/setup';
import { WORK_CYCLE_CARDS } from './protoState';
describe('temporary inspiration override', () => {
  it('allows costs even at zero and preserves available inspiration', () => {
    expect(canSpendInspiration(0, 8)).toBe(true);
    expect(spendInspiration(0, 8)).toBe(0);
    expect(spendInspiration(4, 1)).toBe(4);
  });
});
describe('tableau plays', () => {
  it('cost no inspiration and still award a completed work cycle', () => {
    const base = createInitialState();
    const foundations = createFoundations([{id:'f',rank:5}]);
    foundations[0]!.count = WORK_CYCLE_CARDS - 1;
    const state = {...base, scene: 'combat' as const, worldActors: [], foundations,
      tableau: [[{id:'c',rank:6}]], actorInspiration: [0,4,4]};
    const result = applyFoundationPlay(state, {columnIndex:0, foundationIndex:0})!;
    expect(result).not.toBeNull();
    expect(result.state.actorInspiration).toEqual(state.actorInspiration);
    expect(result.workCycleCompleted).toBe(true);
    expect(result.state.actorWorkCompleted[0]).toBe(state.actorWorkCompleted[0]+1);
  });
});
