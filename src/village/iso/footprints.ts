// Placement metadata for the isometric map: how many tiles each piece covers,
// as width (along grid x, east) × depth (along grid y, south). This is game
// data, kept apart from the art: a sprite only declares its pivot (see
// sprites.ts), so swapping a placeholder block for a painting never moves a
// footprint, and resizing a footprint never needs new art metadata.
import { FEATURES, type MapSurfaceId } from '../rules/map';
import type { BuildingId } from '../rules/village';

export interface Footprint { w: number; d: number }

const ONE: Footprint = { w: 1, d: 1 };

/** Every building takes one plot today (game rules place them one per tile). */
export const BUILDING_FOOTPRINT: Record<BuildingId, Footprint> = {
  leanto: ONE, burrow: ONE, campfire: ONE, bench: ONE, stall: ONE, rack: ONE, woodshed: ONE, lantern: ONE, well: ONE,
};

/** Land features use their fixed rectangle from the map rules. */
export const featureFootprint = (id: MapSurfaceId): Footprint => ({ w: FEATURES[id].rect.w, d: FEATURES[id].rect.h });

export const SAPLING_FOOTPRINT = ONE;
export const DEN_FOOTPRINT = ONE;
export const GATE_FOOTPRINT = ONE;

/**
 * Placeholder massing, in world units (one tile edge = 1). Height is the eave
 * or top of the box; roof adds a ridge above it. Inset shrinks the box inside
 * its footprint so neighbours read as separate objects.
 */
export interface Massing { h: number; inset: number; color: string; roof?: 'gable' | 'pyramid'; roofColor?: string; roofH?: number }

export const BUILDING_MASSING: Record<BuildingId, Massing> = {
  leanto: { h: 0.32, inset: 0.18, color: '#9c7a52', roof: 'gable', roofColor: '#6d5a3a', roofH: 0.34 },
  burrow: { h: 0.18, inset: 0.16, color: '#7d6448', roof: 'pyramid', roofColor: '#5f7a45', roofH: 0.22 },
  campfire: { h: 0.08, inset: 0.32, color: '#5a4634', roof: 'pyramid', roofColor: '#f0a640', roofH: 0.26 },
  bench: { h: 0.14, inset: 0.26, color: '#8f6a43' },
  stall: { h: 0.4, inset: 0.18, color: '#b88a58', roof: 'gable', roofColor: '#b9503f', roofH: 0.2 },
  rack: { h: 0.42, inset: 0.3, color: '#a27c4f' },
  woodshed: { h: 0.36, inset: 0.14, color: '#7f5f3c', roof: 'gable', roofColor: '#57483a', roofH: 0.24 },
  lantern: { h: 0.62, inset: 0.42, color: '#55504a', roof: 'pyramid', roofColor: '#ffd27a', roofH: 0.12 },
  well: { h: 0.22, inset: 0.24, color: '#8d8c86', roof: 'pyramid', roofColor: '#6d5a3a', roofH: 0.28 },
};
