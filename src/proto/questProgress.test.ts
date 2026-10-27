import { describe, expect, it } from 'vitest';
import { redeemActiveQuest } from './questProgress';

describe('quest reward redemption', () => {
  it('does not grant rewards or advance an unfinished top quest', () => {
    const state = { questClaims: 0, questAccomplished: [], inspiration: 2, actorInspiration: [1], energy: 0 };
    expect(redeemActiveQuest(state, [false, true])).toBe(state);
  });
  it('grants a latched accomplishment once, including at full inspiration', () => {
    const state = { questClaims: 0, questAccomplished: [true], inspiration: 6, actorInspiration: [2, 4], energy: 3 };
    const claimed = redeemActiveQuest(state, [false, false], 1, 4);
    expect(claimed.questClaims).toBe(1);
    expect(claimed.inspiration).toBe(7);
    expect(claimed.actorInspiration).toEqual([3, 4]);
    expect(claimed.energy).toBe(4);
    expect(redeemActiveQuest(claimed, [false, false])).toBe(claimed);
    expect(state.inspiration).toBe(6);
  });
  it('stops granting rewards after the chain is fully redeemed', () => {
    const state = { questClaims: 1, questAccomplished: [true], inspiration: 3, actorInspiration: [1], energy: 0 };
    expect(redeemActiveQuest(state, [true])).toBe(state);
  });
});
