import { expect, it } from 'vitest';
import { createSceneCheckpoint } from './sceneCheckpoints';
import { pendingTutorialQuest } from './tutorialQuests';

it.each([
  ['day01.find-quest','navigate-den'],['day01.navigate-den','first-berry'],
  ['day01.sparse-patch','denser-patch'],['day01.patch','gather-supper'],
  ['day01.budget','return-home'],['day01.home','supper'],['day01.saved-light','rest'],
] as const)('offers the next physical instruction at %s', (checkpoint,id)=>{
  const state=createSceneCheckpoint(checkpoint);
  expect(pendingTutorialQuest(state)?.id).toBe(id);
  expect(pendingTutorialQuest({...state,discoveredTutorialQuests:[id]})).toBeUndefined();
});
it('preserves the opening, completed tutorial, and other days',()=>{
  for(const checkpoint of ['day01.opening','day01.complete','day02.opening'] as const)
    expect(pendingTutorialQuest(createSceneCheckpoint(checkpoint))).toBeUndefined();
});
it('new scenarios and checkpoint reconstructions discard collected quest flags',()=>{
  const state=createSceneCheckpoint('day01.sparse-patch');
  state.discoveredTutorialQuests=['denser-patch'];
  expect(pendingTutorialQuest(state)).toBeUndefined();
  expect(pendingTutorialQuest(createSceneCheckpoint('day01.sparse-patch'))?.id).toBe('denser-patch');
});
