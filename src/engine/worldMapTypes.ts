// src/engine/worldMapTypes.ts
import type { Direction } from '../components/Compass';

/**
 * Defines a Point of Interest (POI) on the world map.
 * This is the content that exists at a specific grid cell.
 */
export interface PointOfInterest {
  id: string; // Unique ID, e.g., 'poi_start', 'poi_battle_1', 'poi_village_A'
  name: string;
  description: string;
  type: 'biome' | 'village' | 'shop' | 'empty';
  /** If the POI is a biome, this links to the specific BiomeDefinition ID from biomes.ts */
  biomeId?: string;
  /** Optional deterministic tableau preset used when this POI is active. */
  tableauPresetId?: string;
}

/**
 * Represents a single cell on the overworld grid.
 */
export interface WorldMapCell {
  gridPosition: { col: number; row: number };
  /** The ID of the PointOfInterest at this location. */
  poiId: string;
  /** The difficulty of traversing this cell, influencing the challenge. */
  traversalDifficulty: number;
}

/**
 * Defines an entire overworld map, including its dimensions and all its cells/POIs.
 */
export interface WorldMapDefinition {
  id: string; // e.g., 'main_world'
  name: string;
  size: { cols: number; rows: number };
  /** The default position to spawn the player on a new game. */
  defaultSpawnPosition: { col: number; row: number };
  /** All the cells that make up this map. */
  cells: WorldMapCell[];
  /** All the points of interest that can be referenced by cells. */
  pointsOfInterest: PointOfInterest[];
}
