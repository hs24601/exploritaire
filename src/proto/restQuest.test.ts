import { expect, it } from 'vitest';
import { createInitialState, getExpeditionQuestSteps } from './rules/setup';
import { redeemActiveQuest } from './questProgress';

it('replaces the old route with Rest and does not complete from retired milestones', () => {
  const state = createInitialState();
  state.day = 2;
  state.city = { campBuilt: true, campUsedToday: true, restedOnce: true };
  state.deepEncounterResolved = true;
  state.battleRecovered = true;
  state.biomeTiles = state.biomeTiles.map(tile => ({ ...tile, tableau: [], stock: [] }));
  const steps = getExpeditionQuestSteps(state);
  expect(steps).toEqual([{
    label: 'Rest', text: 'solve enough tableaus for Hero to recover energy for the day',
    biomeId: 'hero-den', complete: false,
  }]);
  expect(redeemActiveQuest(state, steps.map(step => step.complete), 0)).toBe(state);
});
