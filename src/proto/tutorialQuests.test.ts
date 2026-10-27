import { expect, it } from 'vitest';
import { createDayScenario, dayOnePlan } from './dayScenarios';
import { beginJourney, bestTravelMove, playTravelCard, prepareTravelTableau } from './travelJourney';
import { dayOneTutorialQuest, firstUnfinishedSubtask, questCardTransition } from './tutorialQuests';

it('counts accepted den receipts and the harvested berry without crediting rejected plays', () => {
  let state = createDayScenario('day01');
  state = prepareTravelTableau({ ...state, journey: beginJourney(dayOnePlan(state), 2) });
  const progress = (id: string) => dayOneTutorialQuest(state).steps.find(step => step.id === id)!.progress;
  expect(progress('simple-steps')).toMatchObject({ current: 0, total: 6 });
  expect(progress('first-berry')).toMatchObject({ current: 0, total: 1 });
  const paused = { ...state, journey: { ...state.journey!, paused: true } };
  expect(playTravelCard(paused, bestTravelMove(state.journey!)!)).toBe(paused);
  for (let i = 0; i < 12; i++) {
    state = playTravelCard(state, bestTravelMove(state.journey!)!);
    expect(progress('simple-steps')?.current).toBe(Math.min(6, i + 1));
    expect(progress('first-berry')?.current).toBe(i === 11 ? 1 : 0);
  }
});

it('uses distinct immutable cards and real den/sparse-card completion milestones', () => {
  let state = createDayScenario('day01');
  const initial = dayOneTutorialQuest(state);
  expect(initial.steps).toHaveLength(8); expect(new Set(initial.steps.map(step => step.id)).size).toBe(8);
  expect(firstUnfinishedSubtask(initial)).toBe(0);
  expect(initial.steps.some(step => step.id === 'leave-den')).toBe(false);
  expect(initial.steps[0].id).toBe('navigate-den');
  expect(initial.awaitingDiscovery).toBe(true);
  state = prepareTravelTableau({ ...state, journey: beginJourney(dayOnePlan(state), 2) });
  expect(firstUnfinishedSubtask(dayOneTutorialQuest(state))).toBe(0);
  for (let i = 0; i < 6; i++) { const column = bestTravelMove(state.journey!); expect(column).not.toBeNull(); state = playTravelCard(state, column!); }
  expect(firstUnfinishedSubtask(dayOneTutorialQuest(state))).toBe(2);
  for (let i = 0; i < 6; i++) { const column = bestTravelMove(state.journey!); expect(column).not.toBeNull(); state = playTravelCard(state, column!); }
  const after = dayOneTutorialQuest(state);
  expect(firstUnfinishedSubtask(after)).toBe(3);
  expect(after.steps[3]).toMatchObject({ id: 'denser-patch', title: 'Khad Roots', text: 'Dark vines with dangerous-looking thorns have wrapped around parts of the bushes. Look elsewhere for more manaberries.' });
  expect(after.awaitingDiscovery).toBe(true);
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
it('paints, turns face-down, and receives before revealing the next card', () => {
  expect(questCardTransition(325)).toMatchObject({ phase: 'check', check: .5, receive: 0 });
  expect(questCardTransition(650)).toMatchObject({ phase: 'tap', check: 1, tap: 0 });
  expect(questCardTransition(950)).toMatchObject({ phase: 'receive', tap: 1, receive: 0 });
  expect(questCardTransition(1599).phase).toBe('receive');
  expect(questCardTransition(1600)).toMatchObject({ phase: 'flip', receive: 1, flip: 0 });
  expect(questCardTransition(2250)).toMatchObject({ phase: 'idle', flip: 1 });
  expect(questCardTransition(270, true).phase).toBe('flip');
  expect(questCardTransition(390, true).phase).toBe('idle');
});
