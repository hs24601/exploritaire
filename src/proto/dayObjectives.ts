import type { ProtoState } from './protoState';
import { dayOneDestination } from './dayScenarios';
import { TABLE_GRID } from './gridCoordinates';

export type DayObjective = {
  biomeId: string;
  label: string;
  position: { x: number; y: number };
  reference: string;
};

/** A story landmark, independent of discovery and the player's editable travel route. */
export function dayObjective(state: ProtoState): DayObjective | null {
  if (!state.dayScenario || state.dayTwoAmbush) return null;
  const biomeId = state.dayScenario === 'day03' ? 'hero-den' : dayOneDestination(state);
  if (!biomeId) return null;
  const tile = state.biomeTiles.find(candidate => candidate.id === biomeId);
  if (!tile) return null;
  const label = biomeId === 'hero-den'
    ? state.dayScenario === 'day03' ? 'Home with Banks'
      : state.ordinaryDay?.complete ? 'Safe until morning'
      : state.ordinaryDay?.supper ? 'Rest in the den' : 'Home before dark'
    : biomeId === state.dayScenarioTiles?.woodsId ? 'Search the darker woods'
    : biomeId === state.dayScenarioTiles?.sparsePatchId ? 'Check the nearby bush' : 'Gather manaberries';
  return { biomeId, label, position: { ...tile.position }, reference: TABLE_GRID.reference(TABLE_GRID.atWorld(tile.position)) };
}
