// src/data/worldMap.ts
import type { WorldMapDefinition } from '../engine/worldMapTypes';

/**
 * A hand-crafted world map for testing and initial development.
 * This defines the layout, POIs, and player start for the 'main_world'.
 */
export const mainWorldMap: WorldMapDefinition = {
  id: 'main_world',
  name: 'Exploritaire World',
  size: { cols: 3, rows: 3 },
  defaultSpawnPosition: { col: 1, row: 1 },

  // Define all Points of Interest that exist in this world
  pointsOfInterest: [
    {
      id: 'poi_start',
      name: 'Quiet Clearing',
      description: 'The journey begins here. Paths lead in all directions.',
      type: 'biome',
      biomeId: 'starting_area', // Links to the BiomeDefinition
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
    }
  ],

  // Define the grid cells and which POI they contain
  cells: [
    { gridPosition: { col: 0, row: 0 }, poiId: 'poi_empty', traversalDifficulty: 1 },
    { gridPosition: { col: 1, row: 0 }, poiId: 'poi_battle_arena', traversalDifficulty: 5 },
    { gridPosition: { col: 2, row: 0 }, poiId: 'poi_empty', traversalDifficulty: 1 },
    
    { gridPosition: { col: 0, row: 1 }, poiId: 'poi_empty', traversalDifficulty: 1 },
    { gridPosition: { col: 1, row: 1 }, poiId: 'poi_start', traversalDifficulty: 1 },
    { gridPosition: { col: 2, row: 1 }, poiId: 'poi_random_wilds', traversalDifficulty: 2 },
    
    { gridPosition: { col: 0, row: 2 }, poiId: 'poi_empty', traversalDifficulty: 1 },
    { gridPosition: { col: 1, row: 2 }, poiId: 'poi_supply_cache', traversalDifficulty: 1 },
    { gridPosition: { col: 2, row: 2 }, poiId: 'poi_empty', traversalDifficulty: 1 },
  ],
};
