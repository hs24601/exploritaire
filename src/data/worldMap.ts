// src/data/worldMap.ts
import type { WorldMapDefinition, PointOfInterest } from '../engine/worldMapTypes';

export const mainWorldMap: WorldMapDefinition = {
  id: 'main_world',
  name: 'Exploritaire World',
  size: { cols: 11, rows: 11 },
  defaultSpawnPosition: { col: 22, row: 22 },
  tutorialRail: {
    path: [
      { col: 22, row: 22 },
      { col: 22, row: 21 },
      { col: 22, row: 20 },
    ],
    lockUntilPathComplete: true,
    label: 'Tutorial Path',
  },
  pointsOfInterest: [], // Populated dynamically at runtime
  cells: [
    { gridPosition: { col: 22, row: 20 }, traversalDifficulty: 1, poi: undefined },
    { gridPosition: { col: 22, row: 21 }, traversalDifficulty: 1, poi: undefined },
    { gridPosition: { col: 22, row: 22 }, traversalDifficulty: 1, poi: undefined },
    { gridPosition: { col: 0, row: 0 }, traversalDifficulty: 1, poi: undefined },
    { gridPosition: { col: 0, row: 1 }, traversalDifficulty: 1, poi: undefined },
    { gridPosition: { col: 0, row: 2 }, traversalDifficulty: 1, poi: undefined },
    { gridPosition: { col: 0, row: 3 }, traversalDifficulty: 1, poi: undefined },
    { gridPosition: { col: 0, row: -2 }, traversalDifficulty: 1, poi: undefined },
    { gridPosition: { col: 1, row: 0 }, traversalDifficulty: 2, poi: undefined },
    { gridPosition: { col: 1, row: 2 }, traversalDifficulty: 1, poi: undefined },
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
    { from: { col: 22, row: 22 }, to: { col: 22, row: 21 }, requirement: 'source_tableau_cleared', reason: 'Clear tableau at 22,22 first' },
    { from: { col: 22, row: 21 }, to: { col: 22, row: 20 }, requirement: 'source_tableau_cleared', reason: 'Clear tableau at 22,21 first' },
  ],
};

/**
 * Map of cell coordinates to POI IDs
 * Defines which POI should appear at each grid position
 */
const CELL_POI_MAPPING: Array<{ col: number; row: number; poiId: string }> = [
  { col: 22, row: 20, poiId: 'poi_initial_02' },
  { col: 22, row: 21, poiId: 'poi_initial_01' },
  { col: 22, row: 22, poiId: 'poi_start' },
  { col: 0, row: 3, poiId: 'poi_wave_battle' },
  { col: 0, row: -2, poiId: 'poi_oasis_a' },
  { col: 1, row: 0, poiId: 'poi_random_wilds' },
  { col: 1, row: 2, poiId: 'poi_event_glade_test' },
];

/**
 * Initializes the world map with POI data loaded at runtime
 * Call this after fetching pois.json from the server
 */
export function initializeWorldMapPois(pois: PointOfInterest[]): void {
  // Build POI lookup by ID
  const poiLookup = new Map(pois.map((poi) => [poi.id ?? '', poi]));

  // Assign POIs to cells based on mapping
  CELL_POI_MAPPING.forEach(({ col, row, poiId }) => {
    const cell = mainWorldMap.cells.find(
      (c) => c.gridPosition.col === col && c.gridPosition.row === row
    );
    if (cell) {
      cell.poi = poiLookup.get(poiId);
    }
  });

  // Update pointsOfInterest array
  mainWorldMap.pointsOfInterest = pois;
}
