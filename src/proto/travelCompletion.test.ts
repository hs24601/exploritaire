import { expect, it } from 'vitest';
import { createSceneCheckpoint } from './sceneCheckpoints';
import { bestTravelMove, paintTravelProgress, playTravelCard } from './travelJourney';
import { finishTravelPresentation } from './travelCompletion';
import { pendingTutorialQuest } from './tutorialQuests';
import { arriveActorAtBiome } from './biomeArrival';

it('retains the rooted tableau through arrival and quest collection', () => {
  let state = createSceneCheckpoint('day01.khad-roots-exposed');
  for (let i = 0; i < 2; i++) {
    const column = bestTravelMove(state.journey!);
    expect(column).not.toBeNull();
    state = playTravelCard(state, column!, 'hero');
    state = paintTravelProgress(state, state.journey!.progress);
  }
  expect(pendingTutorialQuest(state)?.id).toBe('denser-patch');
  const journey = state.journey!;
  expect(journey.completed).toBe(journey.cards);
  expect(finishTravelPresentation(state)).toBe(state);
  const tile = state.biomeTiles.find(t => t.id === journey.arrival.biomeId)!;
  state = arriveActorAtBiome(state, 'hero', tile.id, tile.position);
  expect(state.journey).toBe(journey);
  expect(state.journey!.columns.flat().filter(c => c.khadRoot)).toHaveLength(2);
  const collected = { ...state, discoveredTutorialQuests: [...state.discoveredTutorialQuests!, 'denser-patch'] };
  expect(finishTravelPresentation(collected).journey).toBe(journey);
});

it('clears ordinary completed travel presentation', () => {
  const state = createSceneCheckpoint('day01.navigate-den');
  expect(finishTravelPresentation(state).journey).toBeUndefined();
});
