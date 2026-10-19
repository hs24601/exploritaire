import { expect, it } from 'vitest';
import { createDayScenario, dayOnePlan } from './dayScenarios';
import { beginJourney, bestTravelMove, playTravelCard, prepareTravelTableau } from './travelJourney';
import { dayOneTutorialQuest, firstUnfinishedSubtask, questCardTransition } from './tutorialQuests';

it('uses distinct immutable cards and real den/sparse-card completion milestones', () => {
  let state = createDayScenario('day01');
  const initial = dayOneTutorialQuest(state);
  expect(initial.steps).toHaveLength(8); expect(new Set(initial.steps.map(step => step.id)).size).toBe(8);
  expect(firstUnfinishedSubtask(initial)).toBe(0);
  state = prepareTravelTableau({ ...state, journey: beginJourney(dayOnePlan(state), 2) });
  expect(firstUnfinishedSubtask(dayOneTutorialQuest(state))).toBe(1);
  for (let i = 0; i < 6; i++) { const column = bestTravelMove(state.journey!); expect(column).not.toBeNull(); state = playTravelCard(state, column!); }
  expect(firstUnfinishedSubtask(dayOneTutorialQuest(state))).toBe(2);
  for (let i = 0; i < 6; i++) { const column = bestTravelMove(state.journey!); expect(column).not.toBeNull(); state = playTravelCard(state, column!); }
  const after = dayOneTutorialQuest(state);
  expect(firstUnfinishedSubtask(after)).toBe(3);
  expect(after.steps.map(({ id, title, text }) => ({ id, title, text }))).toEqual(initial.steps.map(({ id, title, text }) => ({ id, title, text })));
});
it('keeps completed requirements satisfied after supper spends the collected mana', () => {
  const state = createDayScenario('day01');
  const supper = { ...state, haul: { ...state.haul, mana: 0 }, ordinaryDay: { ...state.ordinaryDay!, supper: true } };
  expect(firstUnfinishedSubtask(dayOneTutorialQuest(supper))).toBe(7);
  const rested = { ...supper, ordinaryDay: { ...supper.ordinaryDay, complete: true } };
  const snapshot = JSON.stringify(rested);
  expect(firstUnfinishedSubtask(dayOneTutorialQuest(rested))).toBe(8);
  expect(JSON.stringify(rested)).toBe(snapshot);
});
it('burns before flipping and keeps reduced-motion transitions brief', () => {
  expect(questCardTransition(500)).toMatchObject({ phase: 'burn', flip: 0 });
  expect(questCardTransition(2000)).toMatchObject({ phase: 'burn', burn: .5, flip: 0 });
  expect(questCardTransition(3999).phase).toBe('burn');
  expect(questCardTransition(4000)).toMatchObject({ phase: 'flip', burn: 1 });
  expect(questCardTransition(4650)).toMatchObject({ phase: 'idle', flip: 1 });
  expect(questCardTransition(180, true).phase).toBe('flip');
  expect(questCardTransition(300, true).phase).toBe('idle');
});
