import type { TutorialActionSpec, TutorialRouteSeed, TutorialSceneSeed } from './tutorialSeeds';

export const formatTutorialActionSpec = (action: TutorialActionSpec) => {
  if (action.kind === 'tableau') return `tableau:T${action.columnIndex + 1}R1`;
  if (action.kind === 'rescue') return `rescue:T${action.columnIndex + 1}R1`;
  if (action.kind === 'swap') return `swap:${action.starterPackIndex}`;
  if (action.kind === 'ability') return `ability:${action.effect}`;
  return 'end-turn';
};

export const tutorialActionSpecEquals = (left: TutorialActionSpec, right: TutorialActionSpec) => {
  if (left.kind !== right.kind) return false;
  if (left.kind === 'tableau' || left.kind === 'rescue') return left.columnIndex === right.columnIndex;
  if (left.kind === 'swap') return left.starterPackIndex === right.starterPackIndex;
  if (left.kind === 'ability') return left.effect === right.effect;
  return true;
};

export interface TutorialRailAdapter<TState> {
  loadScene: (sceneId: string) => TState;
  getLegalActions: (state: TState) => TutorialActionSpec[];
  applyAction: (state: TState, action: TutorialActionSpec) => TState;
  getTopRanks?: (state: TState) => Array<number | null>;
}

export const validateTutorialSceneSeed = <TState>(
  seed: TutorialSceneSeed,
  adapter: TutorialRailAdapter<TState>
) => {
  const issues: string[] = [];
  const state = adapter.loadScene(seed.sceneId);
  if (seed.expectedLegalActions) {
    const actual = adapter.getLegalActions(state);
    const expected = seed.expectedLegalActions;
    const matches =
      actual.length === expected.length
      && actual.every((action, index) => tutorialActionSpecEquals(action, expected[index]));
    if (!matches) {
      issues.push(`${seed.seedId}: expected [${expected.map(formatTutorialActionSpec).join(', ')}], got [${actual.map(formatTutorialActionSpec).join(', ')}]`);
    }
  }
  if (seed.expectedTopRanks && adapter.getTopRanks) {
    const actualTopRanks = adapter.getTopRanks(state);
    const matches = actualTopRanks.length === seed.expectedTopRanks.length
      && actualTopRanks.every((rank, index) => rank === seed.expectedTopRanks?.[index]);
    if (!matches) {
      issues.push(`${seed.seedId}: expected tops [${seed.expectedTopRanks.join(', ')}], got [${actualTopRanks.join(', ')}]`);
    }
  }
  return issues;
};

export const runTutorialRouteValidation = <TState>(
  route: TutorialRouteSeed,
  seedToSceneId: (seedId: string) => string,
  adapter: TutorialRailAdapter<TState>
) => {
  const issues: string[] = [];
  let state = adapter.loadScene(seedToSceneId(route.seedId));
  route.expectedActions.forEach((expectedAction, stepIndex) => {
    const actualActions = adapter.getLegalActions(state);
    const exactMatch =
      actualActions.length === 1
      && tutorialActionSpecEquals(actualActions[0], expectedAction);
    if (!exactMatch) {
      issues.push(
        `${route.routeId} step ${stepIndex + 1}: expected ${formatTutorialActionSpec(expectedAction)}, got [${actualActions.map(formatTutorialActionSpec).join(', ')}]`
      );
    }
    state = adapter.applyAction(state, expectedAction);
    const checkpoint = route.checkpoints?.find((entry) => entry.afterStep === stepIndex + 1);
    if (checkpoint?.expectedLegalActions) {
      const actual = adapter.getLegalActions(state);
      const expected = checkpoint.expectedLegalActions;
      const matches = actual.length === expected.length && actual.every((action, index) => tutorialActionSpecEquals(action, expected[index]));
      if (!matches) {
        issues.push(
          `${route.routeId} checkpoint ${checkpoint.afterStep}: expected [${expected.map(formatTutorialActionSpec).join(', ')}], got [${actual.map(formatTutorialActionSpec).join(', ')}]`
        );
      }
    }
    if (checkpoint?.expectedTopRanks && adapter.getTopRanks) {
      const actual = adapter.getTopRanks(state);
      const matches = actual.length === checkpoint.expectedTopRanks.length
        && actual.every((rank, index) => rank === checkpoint.expectedTopRanks?.[index]);
      if (!matches) {
        issues.push(
          `${route.routeId} checkpoint ${checkpoint.afterStep}: expected tops [${checkpoint.expectedTopRanks.join(', ')}], got [${actual.join(', ')}]`
        );
      }
    }
  });
  return issues;
};
