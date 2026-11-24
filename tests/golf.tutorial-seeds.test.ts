import { describe, expect, it } from 'vitest';
import {
  buildTutorialSceneState,
  choosePlayerAutoAction,
  getTutorialRailAuditIssues,
  getTutorialVisibleLegalActions,
  getTutorialVisibleTopRanks,
  refillClearedTableauForState,
  simulateTutorialAuditAction,
} from '../src/golf/GolfGame';
import { TUTORIAL_ROUTE_SEEDS, TUTORIAL_SCENE_SEEDS, getTutorialSceneSeed } from '../src/golf/tutorialSeeds';
import { runTutorialRouteValidation, validateTutorialSceneSeed } from '../src/golf/tutorialRailValidation';

describe('golf tutorial scene seeds', () => {
  const adapter = {
    loadScene: (sceneId: string) => buildTutorialSceneState(sceneId as Parameters<typeof buildTutorialSceneState>[0]),
    getLegalActions: getTutorialVisibleLegalActions,
    applyAction: simulateTutorialAuditAction,
    getTopRanks: getTutorialVisibleTopRanks,
  };

  it('keeps all authored tutorial scene seeds loadable and within their expected contracts', () => {
    const issues = TUTORIAL_SCENE_SEEDS.flatMap((seed) => validateTutorialSceneSeed(seed, adapter));
    expect(issues).toEqual([]);
  });

  it('keeps all authored tutorial routes on rails', () => {
    const issues = TUTORIAL_ROUTE_SEEDS.flatMap((route) =>
      runTutorialRouteValidation(route, (seedId) => getTutorialSceneSeed(seedId as Parameters<typeof getTutorialSceneSeed>[0]).sceneId, adapter)
    );
    expect(issues).toEqual([]);
  });

  it('keeps the runtime rail audit clean', () => {
    expect(getTutorialRailAuditIssues()).toEqual([]);
  });

  it('locks slice 02 deadlock with no legal actions', () => {
    const deadlockState = buildTutorialSceneState('slice-02-deadlock');
    expect(getTutorialVisibleTopRanks(deadlockState)).toEqual([null, 4, 5, 5, 4, 2, 3]);
    expect(getTutorialVisibleLegalActions(deadlockState)).toEqual([]);
  });

  it('keeps slice 02 step 6 on a single legal continuation', () => {
    const route = TUTORIAL_ROUTE_SEEDS.find((entry) => entry.routeId === 'tutorial.slice02.main.v1');
    expect(route).toBeTruthy();
    let state = buildTutorialSceneState('slice-02');
    for (const action of route!.expectedActions.slice(0, 6)) {
      state = simulateTutorialAuditAction(state, action);
    }
    expect(getTutorialVisibleTopRanks(state)).toEqual([null, 8, 5, 11, 13, 2, 3]);
    expect(getTutorialVisibleLegalActions(state)).toEqual([{ kind: 'tableau', columnIndex: 1 }]);
  });

  it('drives autoplay from slice start and bookmarks using the seed route', () => {
    const slice02Start = buildTutorialSceneState('slice-02');
    expect(choosePlayerAutoAction(slice02Start, 'full')).toEqual({
      type: 'move',
      columnIndex: 0,
      stockId: slice02Start.playerStock.id,
    });

    expect(choosePlayerAutoAction(buildTutorialSceneState('slice-02-ready'), 'full')).toEqual({
      type: 'swap',
      starterPackIndex: 0,
    });

    expect(choosePlayerAutoAction(buildTutorialSceneState('slice-02-deadlock'), 'full')).toBeNull();
  });

  it('never random-refills emptied tutorial tableau columns', () => {
    const tutorialState = buildTutorialSceneState('slice-01');
    const emptiedTableau = tutorialState.tableau.map((column, columnIndex) =>
      columnIndex === 0 ? [] : column
    );
    expect(refillClearedTableauForState(tutorialState, emptiedTableau, 0)).toEqual({
      tableau: emptiedTableau,
      tableCleared: false,
    });
  });
});
