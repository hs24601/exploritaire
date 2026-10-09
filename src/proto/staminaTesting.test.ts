import { describe, expect, it } from 'vitest';
import { canSpendStamina, spendStamina } from './staminaTesting';
import { applyFoundationPlay } from './rules/play';
import { createInitialState, createFoundations } from './rules/setup';
import { ACTOR_STAMINA_MAX } from './protoState';
describe('temporary stamina override', () => {
  it('allows costs even at zero and preserves available stamina', () => {
    expect(canSpendStamina(0, 8)).toBe(true);
    expect(spendStamina(0, 8)).toBe(0);
    expect(spendStamina(4, 1)).toBe(4);
  });
  it('preserves actor stamina while awarding a completed work cycle', () => {
    const base = createInitialState();
    const foundations = createFoundations([{id:'f',rank:5}]);
    foundations[0]!.count = ACTOR_STAMINA_MAX - 1;
    const state = {...base, scene: 'combat' as const, worldActors: [], foundations,
      tableau: [[{id:'c',rank:6}]], actorStamina: [0,4,4]};
    const result = applyFoundationPlay(state, {columnIndex:0, foundationIndex:0})!;
    expect(result).not.toBeNull();
    expect(result.state.actorStamina).toEqual(state.actorStamina);
    expect(result.workCycleCompleted).toBe(true);
    expect(result.state.actorWorkCompleted[0]).toBe(state.actorWorkCompleted[0]+1);
  });
});
