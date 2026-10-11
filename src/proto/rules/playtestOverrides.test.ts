import { expect, it } from 'vitest';
import { createInitialState } from './setup';
import { applySleepPlay } from './rest';
import { activateBiome } from '../biomeArrival';
it('rest respects session overrides above and below authored caps', () => {
  for (const cap of [2, 12]) {
    const state = activateBiome({ ...createInitialState(), ordinaryDay: undefined }, 'hero-den');
    state.actorMaxStamina = [cap]; state.actorStamina[0] = cap - 1;
    state.maxStamina = cap; state.stamina = cap - 1;
    const next = applySleepPlay(state, 0, 0, false);
    expect(next.actorStamina[0]).toBe(cap); expect(next.stamina).toBe(cap);
    const capped = applySleepPlay(next, 0, 0, false);
    expect(capped.actorStamina[0]).toBe(cap); expect(capped.stamina).toBe(cap);
  }
});
