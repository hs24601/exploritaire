import { expect, it } from 'vitest';
import { canPlay, createCombatSandboxScenario, newActor, returnPlayerTurn } from './battle';
import { tutorialById } from './battleTutorialScenarios';

it('creates one random foundation and advances eight columns', () => {
  const state = createCombatSandboxScenario('1004');
  expect(tutorialById('1004')?.name).toBe('1004: truefourstar');
  expect(state.party.map(actor => actor.id)).toEqual(['hero']);
  expect(state.keruExpedition).toBeUndefined();
  expect(state.columns.map(column => column.length)).toEqual([4, 4, 4, 4, 4, 4, 4, 4]);
  for (const actor of state.party) {
    expect(actor.rank).toBeGreaterThanOrEqual(1);
    expect(actor.rank).toBeLessThanOrEqual(13);
    expect(actor.foundationCards?.[0].rank).toBe(actor.rank);
  }
  expect(new Set(state.party.map(actor => actor.foundationCards![0].id)).size).toBe(1);
  const next = returnPlayerTurn({ ...state, turn: 'enemy' });
  expect(next.reposition?.removedIds).toHaveLength(8);
  expect(next.columns.every(column => column.length === 4)).toBe(true);
});

it('requires rank adjacency even when a card matches a foundation element', () => {
  const state = createCombatSandboxScenario('1004');
  const cir = { ...newActor('cir'), rank: 10 };
  const fixed = { ...state, party: [...state.party, cir] };
  expect(state.rules.elementSuits).toBe(false);
  expect(canPlay(fixed, cir.id, { id: 'fire', rank: 3 })).toBe(false);
  expect(canPlay(fixed, cir.id, { id: 'fire', rank: 9 })).toBe(true);
});
