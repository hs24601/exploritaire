import { describe, expect, it } from 'vitest';
import { redeemActiveQuest } from './questProgress';

describe('quest reward redemption', () => {
  it('does not grant rewards or advance an unfinished top quest', () => {
    const state = { questClaims: 0, questAccomplished: [], stamina: 2 };
    expect(redeemActiveQuest(state, [false, true])).toBe(state);
  });
  it('grants a latched accomplishment once, including at full stamina', () => {
    const state = { questClaims: 0, questAccomplished: [true], stamina: 6 };
    const claimed = redeemActiveQuest(state, [false, false]);
    expect(claimed.questClaims).toBe(1);
    expect(claimed.stamina).toBe(7);
    expect(redeemActiveQuest(claimed, [false, false])).toBe(claimed);
    expect(state.stamina).toBe(6);
  });
  it('stops granting rewards after the chain is fully redeemed', () => {
    const state = { questClaims: 1, questAccomplished: [true], stamina: 3 };
    expect(redeemActiveQuest(state, [true])).toBe(state);
  });
});
