import type { ProtoState } from './protoState';
import { createDayScenario, dayOnePlan } from './dayScenarios';
import { SAVED_TILE_DOCUMENT } from './tileEditor/runtime';
import type { TileDocument } from './tileEditor/schema';
import { arriveActorAtBiome } from './biomeArrival';
import { eatSupper } from './rules/ordinaryDay';
import { beginJourney, prepareTravelTableau, bestTravelMove, playTravelCard, paintTravelProgress } from './travelJourney';
import { pointAlongTimedPath } from './gridPathfinding';
import { discoverActorTiles } from './tileDiscovery';
import { applyFoundationPlay } from './rules/play';
import { applySleepPlay } from './rules/rest';

export const SCENE_CHECKPOINTS = [
  ['day01.opening', 'Opening conversation'],
  ['day01.find-quest', 'Discover the cave-mouth quest'],
  ['day01.leave-den', 'Start leaving the den'],
  ['day01.navigate-den', 'Clear the den exit'],
  ['day01.sparse-patch', 'Pick the first berry'],
  ['day01.patch', 'Reach the denser patch'],
  ['day01.budget', 'Gather supper · three small lights'],
  ['day01.home', 'Return home before dark'],
  ['day01.saved-light', 'Have supper · one for tomorrow'],
  ['day01.rest', 'Curl up · begin the rest tableau'],
  ['day01.complete', 'Finish resting'],
  ['day02.opening', 'Yesterday’s light'],
  ['day02.patch', 'Reach the dwindling patch'],
  ['day02.scarcity', 'Gather the last berry'],
  ['day02.woods', 'Reach the darker woods'],
  ['day02.ambush', 'Uncover the woodland mana · Banks rescue'],
  ['day03.opening', 'Home with Banks'],
] as const;
export type SceneCheckpointId = typeof SCENE_CHECKPOINTS[number][0];

/** Rebuild from the applied world, never from the player's partially used deal.
 * Travel checkpoints run the actual card, stamina, discovery and arrival rules. */
export function createSceneCheckpoint(id: SceneCheckpointId, document: TileDocument = SAVED_TILE_DOCUMENT): ProtoState {
  const day = id.split('.')[0];
  let state = createDayScenario(day, document);
  const arrive = (tileId: string | undefined) => {
    const tile = state.biomeTiles.find(t => t.id === tileId);
    if (!tile) throw new Error('This applied world has no destination for that scene.');
    state = arriveActorAtBiome({ ...state, journey: undefined }, 'hero', tile.id, tile.position);
  };
  const travel = (exitOnly = false) => {
    const plan = dayOnePlan(state);
    if (!plan.path.length) throw new Error('That scene is unreachable in the applied world.');
    state = prepareTravelTableau({ ...state, selectedBiomeId: null, tableau: [], stock: [], foundations: [],
      journey: { ...beginJourney(plan, state.travelRanks?.hero ?? 2, false), memberRanks: { hero: state.travelRanks?.hero ?? 2 } },
      biomeTiles: state.biomeTiles.map(t => t.id === state.selectedBiomeId ? { ...t, tableau: state.tableau, stock: state.stock } : t),
      worldActors: state.worldActors.map(a => a.id === 'hero' ? { ...a, location: 'table', biomeId: undefined, foundationIndex: undefined } : a) });
    const exitCards = state.journey!.segments[0]?.cards;
    for (let n = 0; n < 2000; n++) {
      const journey = state.journey!;
      if (journey.completed >= journey.cards || exitOnly && journey.completed >= exitCards) break;
      const column = bestTravelMove(journey);
      if (column === null) throw new Error('The applied travel layout cannot be solved for this checkpoint.');
      state = playTravelCard(state, column, 'hero');
      state = paintTravelProgress(state, state.journey!.progress);
      const position = pointAlongTimedPath(state.journey!.path, state.journey!.progress);
      state = discoverActorTiles({ ...state, worldActors: state.worldActors.map(a => a.id === 'hero' ? { ...a, position } : a) });
    }
    if (!exitOnly) arrive(plan.arrival.biomeId);
  };
  // Use real POI plays so all resource receipts, work and actor costs agree.
  const gather = () => {
    for (let n = 0; n < 100; n++) {
      if (!state.tableau.some(c => c.length)) return;
      const play = state.tableau.map((_, columnIndex) => applyFoundationPlay(state, { columnIndex, foundationIndex: 0 })).find(Boolean);
      if (!play) throw new Error('The applied gathering deal cannot be completed for this scene.');
      state = play.state;
    }
    throw new Error('The gathering checkpoint exceeded its finite deal.');
  };
  if (id === 'day03.opening' || id.endsWith('.opening')) return state;
  if (day === 'day01') {
    if (id === 'day01.leave-den' || id === 'day01.find-quest') {
      const plan = dayOnePlan(state);
      return prepareTravelTableau({ ...state, denQuestDiscovered:id === 'day01.leave-den', journey: { ...beginJourney(plan, 2, false), memberRanks: { hero: 2 } } });
    }
    travel(id === 'day01.navigate-den');
    if (id === 'day01.navigate-den') return state;
    if (id === 'day01.sparse-patch') {
      const patch = state.biomeTiles.find(t => t.id === state.dayScenarioTiles?.patchId);
      return patch ? { ...state, worldActors: state.worldActors.map(a => a.id === 'hero' ? { ...a, heading: Math.atan2(patch.position.x-a.position.x, patch.position.y-a.position.y) } : a) } : state;
    }
    travel();
    if (id === 'day01.patch') return state;
    gather();
    if (id === 'day01.budget') return state;
    travel();
    if (id === 'day01.home') return state;
    state = eatSupper(state);
    if (id === 'day01.saved-light') return state;
    state = { ...state, ordinaryDay: { ...state.ordinaryDay!, bedtime: true } };
    arrive('hero-den');
    if (id === 'day01.rest') return state;
    for (let column = 0; column < state.tableau.length; column++) {
      while (state.tableau[column].length) state = applySleepPlay(state, column, 0, false);
    }
    return { ...state, selectedBiomeId: null, tableau: [], stock: [], foundations: [],
      biomeTiles: state.biomeTiles.map(t => t.id === 'hero-den' ? { ...t, tableau: state.tableau, stock: state.stock } : t),
      worldActors: state.worldActors.map(a => a.id === 'hero' ? { ...a, location: 'table', biomeId: undefined, foundationIndex: undefined } : a),
      ordinaryDay: { ...state.ordinaryDay!, complete: true } };
  }
  travel();
  if (id === 'day02.patch') return state;
  gather();
  if (id === 'day02.scarcity') return state;
  travel();
  if (id === 'day02.woods') return state;
  gather();
  return { ...state, dayTwoAmbush: true };
}
