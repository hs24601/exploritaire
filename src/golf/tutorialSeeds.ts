export type TutorialSliceId = 'slice-01' | 'slice-02' | 'slice-03' | 'slice-04';

export type TutorialSceneId =
  | 'slice-01'
  | 'post-mochi'
  | 'slice-02'
  | 'slice-02-ready'
  | 'slice-02-deadlock'
  | 'slice-03'
  | 'slice-03-combat'
  | 'slice-04';

export type TutorialSceneSeedId =
  | 'tutorial.s01.start.v1'
  | 'tutorial.s01.post_mochi.v1'
  | 'tutorial.s02.start.v1'
  | 'tutorial.s02.swap.v1'
  | 'tutorial.s02.deadlock.v1'
  | 'tutorial.s03.start.v1'
  | 'tutorial.s03.combat.v1'
  | 'tutorial.s04.start.v1';

export type TutorialActionSpec =
  | { kind: 'tableau'; columnIndex: number }
  | { kind: 'swap'; starterPackIndex: number }
  | { kind: 'ability'; effect: string }
  | { kind: 'rescue'; columnIndex: number }
  | { kind: 'end-turn' };

export type TutorialSceneSeed = {
  seedId: TutorialSceneSeedId;
  sceneId: TutorialSceneId;
  sliceId: TutorialSliceId;
  label: string;
  detail: string;
  expectedTopRanks?: Array<number | null>;
  expectedLegalActions?: TutorialActionSpec[];
};

export type TutorialRouteSeed = {
  routeId: string;
  seedId: TutorialSceneSeedId;
  sliceId: TutorialSliceId;
  expectedActions: TutorialActionSpec[];
  checkpoints?: Array<{
    afterStep: number;
    expectedTopRanks?: Array<number | null>;
    expectedLegalActions?: TutorialActionSpec[];
  }>;
};

export const TUTORIAL_SCENE_SEEDS: TutorialSceneSeed[] = [
  {
    seedId: 'tutorial.s01.start.v1',
    sceneId: 'slice-01',
    sliceId: 'slice-01',
    label: 'Slice 01 Start',
    detail: 'Hero begins the excavation route from Ace.',
    expectedLegalActions: [{ kind: 'tableau', columnIndex: 0 }],
  },
  {
    seedId: 'tutorial.s01.post_mochi.v1',
    sceneId: 'post-mochi',
    sliceId: 'slice-02',
    label: 'Post-Mochi',
    detail: 'Reward checkpoint. Hero 2 AP, Mochi 2 AP hidden until claimed.',
  },
  {
    seedId: 'tutorial.s02.start.v1',
    sceneId: 'slice-02',
    sliceId: 'slice-02',
    label: 'Slice 02 Start',
    detail: 'Origin: Hero 2 AP, Mochi 2 AP. Calm Mochi while something stalks the buried row.',
    expectedTopRanks: [2, 8, 3, 11, 4, 6, 5],
    expectedLegalActions: [{ kind: 'tableau', columnIndex: 0 }],
  },
  {
    seedId: 'tutorial.s02.swap.v1',
    sceneId: 'slice-02-ready',
    sliceId: 'slice-02',
    label: 'Slice 02 Swap',
    detail: 'Hero 8, Mochi support 9. Only the Mochi swap should advance the route.',
    expectedTopRanks: [null, 10, 5, 11, 13, 2, 3],
    expectedLegalActions: [{ kind: 'swap', starterPackIndex: 0 }],
  },
  {
    seedId: 'tutorial.s02.deadlock.v1',
    sceneId: 'slice-02-deadlock',
    sliceId: 'slice-02',
    label: 'Slice 02 Deadlock',
    detail: 'Mochi is max AP with no legal line and no Hero tap-in yet.',
    expectedTopRanks: [null, 4, 5, 5, 4, 2, 3],
    expectedLegalActions: [],
  },
  {
    seedId: 'tutorial.s03.start.v1',
    sceneId: 'slice-03',
    sliceId: 'slice-03',
    label: 'Slice 03 Start',
    detail: 'Origin: Hero 2 AP, Mochi 2 AP. Rotate to Mochi, poke twice, then return to Hero for Guard.',
    expectedLegalActions: [{ kind: 'tableau', columnIndex: 0 }],
  },
  {
    seedId: 'tutorial.s03.combat.v1',
    sceneId: 'slice-03-combat',
    sliceId: 'slice-03',
    label: 'Slice 03 Combat',
    detail: 'The pursuer reaches the front row and combat begins.',
  },
  {
    seedId: 'tutorial.s04.start.v1',
    sceneId: 'slice-04',
    sliceId: 'slice-04',
    label: 'Slice 04',
    detail: 'Origin: Mochi 2, Banks 2, Hero 2, Jet 2 AP. Jet rewire and reclaim tutorial state.',
  },
];

export const TUTORIAL_SCENE_SEED_BY_ID = Object.fromEntries(
  TUTORIAL_SCENE_SEEDS.map((seed) => [seed.seedId, seed])
) as Record<TutorialSceneSeedId, TutorialSceneSeed>;

export const TUTORIAL_ROUTE_SEEDS: TutorialRouteSeed[] = [
  {
    routeId: 'tutorial.slice01.main.v1',
    seedId: 'tutorial.s01.start.v1',
    sliceId: 'slice-01',
    expectedActions: [
      ...[0, 2, 4, 6, 5, 3, 1, 3, 5, 6, 4, 2].map((columnIndex) => ({ kind: 'tableau' as const, columnIndex })),
      { kind: 'rescue' as const, columnIndex: 1 },
    ],
  },
  {
    routeId: 'tutorial.slice02.main.v1',
    seedId: 'tutorial.s02.start.v1',
    sliceId: 'slice-02',
    expectedActions: [
      ...[0, 2, 4, 6, 5, 2, 1].map((columnIndex) => ({ kind: 'tableau' as const, columnIndex })),
      { kind: 'swap' as const, starterPackIndex: 0 },
      ...[1, 3, 3, 4].map((columnIndex) => ({ kind: 'tableau' as const, columnIndex })),
    ],
    checkpoints: [
      {
        afterStep: 6,
        expectedTopRanks: [null, 8, 5, 11, 13, 2, 3],
        expectedLegalActions: [{ kind: 'tableau', columnIndex: 1 }],
      },
      {
        afterStep: 7,
        expectedTopRanks: [null, 10, 5, 11, 13, 2, 3],
        expectedLegalActions: [{ kind: 'swap', starterPackIndex: 0 }],
      },
      {
        afterStep: 12,
        expectedTopRanks: [null, 4, 5, 5, 4, 2, 3],
        expectedLegalActions: [],
      },
    ],
  },
  {
    routeId: 'tutorial.slice03.main.v1',
    seedId: 'tutorial.s03.start.v1',
    sliceId: 'slice-03',
    expectedActions: [
      { kind: 'tableau', columnIndex: 0 },
      { kind: 'swap', starterPackIndex: 0 },
      { kind: 'tableau', columnIndex: 5 },
      { kind: 'tableau', columnIndex: 6 },
      { kind: 'swap', starterPackIndex: 1 },
    ],
  },
];

export const getTutorialSceneSeed = (seedId: TutorialSceneSeedId) => TUTORIAL_SCENE_SEED_BY_ID[seedId];

export const getTutorialSceneSeedBySceneId = (sceneId: TutorialSceneId) =>
  TUTORIAL_SCENE_SEEDS.find((seed) => seed.sceneId === sceneId) ?? null;

export const getTutorialRouteSeed = (routeId: string) =>
  TUTORIAL_ROUTE_SEEDS.find((route) => route.routeId === routeId) ?? null;

export const getTutorialRouteSeedsForSlice = (sliceId: TutorialSliceId) =>
  TUTORIAL_ROUTE_SEEDS.filter((route) => route.sliceId === sliceId);
