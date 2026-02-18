// src/data/worldMap.ts
import type { WorldMapDefinition } from '../engine/worldMapTypes';

/**
 * Hand-authored test world map.
 * Coordinates are world-space and can be negative.
 */
export const mainWorldMap: WorldMapDefinition = {
  id: 'main_world',
  name: 'Exploritaire World',
  size: { cols: 11, rows: 11 },
  defaultSpawnPosition: { col: 0, row: 2 },
  tutorialRail: {
    path: [
      { col: 0, row: 2 },
      { col: 0, row: 1 },
      { col: 0, row: 0 },
    ],
    lockUntilPathComplete: true,
    label: 'Tutorial Path',
  },
  pointsOfInterest: [
    {
      id: 'poi_start',
      name: 'Tutorial A',
      description: 'Initial actions row 0,0.',
      type: 'biome',
      biomeId: 'random_wilds',
      tableauPresetId: 'initial_actions_00',
      rewards: [
        {
          id: 'tutorial-a-aspects',
          type: 'aspect-jumbo',
          amount: 1,
          description: 'Choose 1: Lupus, Ursus, or Felis jumbo card aspect',
          options: ['wolf', 'bear', 'cat'],
        },
      ],
    },
    {
      id: 'poi_initial_01',
      name: 'Tutorial B',
      description: 'Initial actions row 0,1.',
      type: 'biome',
      biomeId: 'random_wilds',
      tableauPresetId: 'initial_actions_01',
    },
    {
      id: 'poi_initial_02',
      name: 'Tutorial C',
      description: 'Initial actions row 0,2.',
      type: 'biome',
      biomeId: 'random_wilds',
      tableauPresetId: 'initial_actions_02',
    },
    {
      id: 'poi_oasis_a',
      name: 'Oasis A',
      description: 'Tutorial oasis that introduces sequencing and golf transitions.',
      type: 'biome',
      biomeId: 'random_wilds',
      tableauPresetId: 'oasis_a_tutorial',
    },
    {
      id: 'poi_battle_arena',
      name: 'Goblin Outpost',
      description: 'A goblin stands guard. A battle is imminent.',
      type: 'biome',
      biomeId: 'battle_biome',
    },
    {
      id: 'poi_supply_cache',
      name: 'Hidden Satchel',
      description: 'You found a satchel of supplies!',
      type: 'biome',
      biomeId: 'supply_cache_biome',
    },
    {
      id: 'poi_random_wilds',
      name: 'Whispering Wilds',
      description: 'An untamed wilderness stretches before you.',
      type: 'biome',
      biomeId: 'random_wilds',
    },
    {
      id: 'poi_empty',
      name: 'Empty Field',
      description: 'There is nothing of interest here.',
      type: 'empty',
    },
  ],
  cells: [
    { gridPosition: { col: 0, row: 0 }, poiId: 'poi_initial_02', traversalDifficulty: 1 },
    { gridPosition: { col: 0, row: 1 }, poiId: 'poi_initial_01', traversalDifficulty: 1 },
    { gridPosition: { col: 0, row: 2 }, poiId: 'poi_start', traversalDifficulty: 1 },
    { gridPosition: { col: 0, row: -2 }, poiId: 'poi_oasis_a', traversalDifficulty: 1 },
    { gridPosition: { col: 1, row: 0 }, poiId: 'poi_random_wilds', traversalDifficulty: 2 },
  ],
  blockedCells: [
    {
      gridPosition: { col: -2, row: 0 },
      reason: 'Canyon wall',
      terrain: 'canyon',
      lightBlocker: { castHeight: 5, softness: 4 },
    },
    {
      gridPosition: { col: -1, row: 0 },
      reason: 'Canyon wall',
      terrain: 'canyon',
      lightBlocker: { castHeight: 5, softness: 4 },
    },
    {
      gridPosition: { col: 1, row: 0 },
      reason: 'Canyon wall',
      terrain: 'canyon',
      lightBlocker: { castHeight: 5, softness: 4 },
    },
    {
      gridPosition: { col: 2, row: 0 },
      reason: 'Canyon wall',
      terrain: 'canyon',
      lightBlocker: { castHeight: 5, softness: 4 },
    },
    {
      gridPosition: { col: -2, row: 1 },
      reason: 'Mountain pass',
      terrain: 'mountain',
      lightBlocker: { castHeight: 8, softness: 6 },
    },
    {
      gridPosition: { col: -1, row: 1 },
      reason: 'Mountain pass',
      terrain: 'mountain',
      lightBlocker: { castHeight: 8, softness: 6 },
    },
    {
      gridPosition: { col: 1, row: 1 },
      reason: 'Mountain pass',
      terrain: 'mountain',
      lightBlocker: { castHeight: 8, softness: 6 },
    },
    {
      gridPosition: { col: 2, row: 1 },
      reason: 'Mountain pass',
      terrain: 'mountain',
      lightBlocker: { castHeight: 8, softness: 6 },
    },
    {
      gridPosition: { col: -2, row: 2 },
      reason: 'Canyon wall',
      terrain: 'canyon',
      lightBlocker: { castHeight: 5, softness: 4 },
    },
    {
      gridPosition: { col: -1, row: 2 },
      reason: 'Canyon wall',
      terrain: 'canyon',
      lightBlocker: { castHeight: 5, softness: 4 },
    },
    {
      gridPosition: { col: 1, row: 2 },
      reason: 'Canyon wall',
      terrain: 'canyon',
      lightBlocker: { castHeight: 5, softness: 4 },
    },
    {
      gridPosition: { col: 2, row: 2 },
      reason: 'Canyon wall',
      terrain: 'canyon',
      lightBlocker: { castHeight: 5, softness: 4 },
    },
    {
      gridPosition: { col: -2, row: 3 },
      reason: 'Mountain ridge',
      terrain: 'mountain',
      lightBlocker: { castHeight: 9, softness: 7 },
    },
    {
      gridPosition: { col: -1, row: 3 },
      reason: 'Mountain ridge',
      terrain: 'mountain',
      lightBlocker: { castHeight: 9, softness: 7 },
    },
    {
      gridPosition: { col: 0, row: 3 },
      reason: 'Mountain ridge',
      terrain: 'mountain',
      lightBlocker: { castHeight: 9, softness: 7 },
    },
    {
      gridPosition: { col: 1, row: 3 },
      reason: 'Mountain ridge',
      terrain: 'mountain',
      lightBlocker: { castHeight: 9, softness: 7 },
    },
    {
      gridPosition: { col: 2, row: 3 },
      reason: 'Mountain ridge',
      terrain: 'mountain',
      lightBlocker: { castHeight: 9, softness: 7 },
    },
  ],
  blockedEdges: [
    { from: { col: 0, row: 0 }, to: { col: 0, row: -1 }, reason: 'Collapsed bridge' },
  ],
  conditionalEdges: [
    { from: { col: 0, row: 2 }, to: { col: 0, row: 1 }, requirement: 'source_tableau_cleared', reason: 'Clear tableau at 0,2 first' },
    { from: { col: 0, row: 1 }, to: { col: 0, row: 0 }, requirement: 'source_tableau_cleared', reason: 'Clear tableau at 0,1 first' },
  ],
};
