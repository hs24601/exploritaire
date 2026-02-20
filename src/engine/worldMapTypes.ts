// src/engine/worldMapTypes.ts
import type { Direction } from '../components/Compass';

/**
 * Defines a Point of Interest (POI) on the world map.
 * This is the content that exists at a specific grid cell.
 */
export interface PoiSparkleConfig {
  proximityRange?: number;
  starCount?: number;
  glowColor?: string;
  intensity?: number;
}

export interface PointOfInterest {
  id?: string;
  name: string;
  description: string;
  type: 'biome' | 'village' | 'shop' | 'empty';
  /** If the POI is a biome, this links to the specific BiomeDefinition ID from biomes.ts */
  biomeId?: string;
  /** Optional deterministic tableau preset used when this POI is active. */
  tableauPresetId?: string;
  rewards?: PoiReward[];
  /** Optional sparkle configuration used by the exploration map lighting. */
  sparkle?: PoiSparkleConfig;
  narration?: {
    title?: string;
    body?: string;
    tone?: 'teal' | 'orange' | 'pink' | 'white';
    autoCloseOnDeparture?: boolean;
    completion?: {
      title?: string;
      body?: string;
      tone?: 'teal' | 'orange' | 'pink' | 'white';
    };
  };
}

export type PoiRewardType = 'aspect-choice' | 'ability-choice' | 'aspect-jumbo' | 'card-choice' | 'orim-choice';

export interface PoiReward {
  id?: string;
  type: PoiRewardType;
  description?: string;
  amount: number;
  options?: string[];
  chooseCount?: number;
  drawCount?: number;
}

/**
 * Represents a single cell on the overworld grid.
 */
export interface WorldMapCell {
  gridPosition: { col: number; row: number };
  /** Optional POI metadata for this cell. */
  poi?: PointOfInterest;
  /** Difficulty of traversing this cell. */
  traversalDifficulty: number;
}

export interface WorldMapBlockedCell {
  gridPosition: { col: number; row: number };
  reason?: string;
  terrain?: 'mountain' | 'canyon' | 'ridge' | 'cliff';
  lightBlocker?: {
    castHeight?: number;
    softness?: number;
  };
}

export interface WorldMapBlockedEdge {
  from: { col: number; row: number };
  to: { col: number; row: number };
  /** Defaults to true; when false only blocks from -> to. */
  bidirectional?: boolean;
  reason?: string;
}

export interface WorldMapConditionalEdge {
  from: { col: number; row: number };
  to: { col: number; row: number };
  /** Defaults to true; when false only applies from -> to. */
  bidirectional?: boolean;
  /** Thin-slice requirement: source cell tableau must be fully cleared before traversing. */
  requirement: 'source_tableau_cleared';
  reason?: string;
}

export interface WorldMapTutorialRail {
  /** Ordered coordinates that must be followed while the rail is active. */
  path: Array<{ col: number; row: number }>;
  /** Defaults to true; rail remains active until path endpoint is reached. */
  lockUntilPathComplete?: boolean;
  /** Optional message for UI/debug contexts. */
  label?: string;
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
  /** Impassable world tiles. */
  blockedCells?: WorldMapBlockedCell[];
  /** Impassable transitions between adjacent world tiles. */
  blockedEdges?: WorldMapBlockedEdge[];
  /** Conditionally passable transitions with explicit traversal requirements. */
  conditionalEdges?: WorldMapConditionalEdge[];
  /** Optional on-rails path segment for tutorial movement. */
  tutorialRail?: WorldMapTutorialRail;
  /** (Legacy) points of interest registry. */
  pointsOfInterest?: PointOfInterest[];
}
