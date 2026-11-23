import { expect, it } from 'vitest';
import { createCombatSandboxScenario } from './battle';
import { tutorialStrike } from './battleTutorials';

it('starts partycomp with three equivalent playable foundations and five columns', () => {
  const state = createCombatSandboxScenario('111');
  expect(state.columns).toHaveLength(5);
  expect(state.party.map(actor => actor.id)).toEqual(['dem', 'hero', 'banks']);
  for (const actor of state.party) {
    expect(actor.hp).toBe(32);
    expect(actor.charge).toBe(0);
    expect(actor.foundationCards).toHaveLength(1);
    expect(actor.rank).toBeGreaterThanOrEqual(1);
    expect(tutorialStrike(state, actor.id)).toEqual(tutorialStrike(state, 'hero'));
  }
  expect(state.keruInvoke?.upkeep).toBeTruthy();
});
