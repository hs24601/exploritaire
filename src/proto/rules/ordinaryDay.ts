import type { BiomeTileState, Card, ProtoState } from '../protoState';
import { createRuntimeId } from '../runtimeId';

export const BERRY_PATCH_ROWS = 4;
export const BERRY_PATCH_RESOURCE_CARDS = Math.round(7 * BERRY_PATCH_ROWS * 0.2);
export const isBerryInfinifill = (state: ProtoState) => !state.dayScenario && state.scene === 'exploration' &&
  state.biomeTiles.some(tile => tile.id === state.selectedBiomeId && tile.tileType === 'berry-patch' && tile.berryPatchVariant !== 'sparse');

export const createBerryInfinifillCard = (resource: boolean): Card => ({
  id: `berry-infinifill-${createRuntimeId()}`,
  rank: 1 + Math.floor(Math.random() * 13),
  ...(resource ? { resource: 'mana' as const, foodSource: 'berries' as const } : {}),
});

export const SUPPER_MANA = 2;
export const OVERNIGHT_LIGHT_MANA = 1;
export const isHome = (state: ProtoState) => state.worldActors.some(actor => actor.id === 'hero' &&
  Math.abs(actor.position.x) < 1 && Math.abs(actor.position.y - 96) < 1);
export const isOrdinaryForage = (id: string | null) => id === 'day-one-berries' || id === 'day-one-tree';
export const isDayForage = (state: ProtoState) => isOrdinaryForage(state.selectedBiomeId) || Boolean(state.dayScenario && state.selectedBiomeId &&
  [state.dayScenarioTiles?.patchId, state.dayScenarioTiles?.woodsId].includes(state.selectedBiomeId));

/** Reliable rank walks; exactly two of ten Berry Patch cards yield mana. */
export function createOrdinaryPlaces(seed: number): BiomeTileState[] {
  return [
    { id: 'day-one-berries', title: 'Manaberry Patch', position: { x: -48, y: 48 } },
    { id: 'day-one-tree', title: 'Old Tree', position: { x: 48, y: 0 } },
  ].map((place, index) => {
    const size = index === 0 ? 10 : 7;
    const tableau: Card[][] = Array.from({ length: 7 }, () => []);
    for (let step = 0; step < size; step++) {
      tableau[step % 7].unshift({
        id: `${place.id}-${step}`, rank: ((step + 2) % 13) + 1, questStep: step,
        ...(index === 0 && step === 8 ? { inspirationResource: true } : {}),
        ...(index !== 0 || step % 5 === 0 ? { resource: 'mana' as const, ...(index === 0 ? { foodSource: 'berries' as const } : {}) } : {}),
      });
    }
    // Array end is exposed: random ranks follow the seeded Queen, beneath the rank walk.
    if (index === 0) {
      // Randomize reward placement while guaranteeing the rounded 20% quota.
      const rewards = Array.from({ length: 7 * BERRY_PATCH_ROWS - size }, (_, i) =>
        i < BERRY_PATCH_RESOURCE_CARDS - 2);
      for (let i = rewards.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [rewards[i], rewards[j]] = [rewards[j], rewards[i]];
      }
      for (const column of tableau) {
        while (column.length < BERRY_PATCH_ROWS) column.unshift(createBerryInfinifillCard(rewards.pop()!));
      }
    }
    return { ...place, tileType: index === 0 ? 'berry-patch' : undefined, sizeLabel: 'Small', gridSize: { columns: 1, rows: 1 }, terrain: 'woods',
      resourceDensity: index === 0 ? 0.2 : 1, tableauSize: index === 0 ? 28 : size, tableau, stock: [], dealt: index === 0 ? 28 : size, seed: seed + index,
      unlocked: true, travelCost: 1, threat: 'none', flags: ['unexplored'] };
  });
}

export function eatSupper(state: ProtoState): ProtoState {
  if (!state.ordinaryDay || state.ordinaryDay.supper || !isHome(state) || state.haul.mana < SUPPER_MANA) return state;
  if (state.dayScenario === 'day01' && state.haul.mana < SUPPER_MANA + OVERNIGHT_LIGHT_MANA) return state;
  return { ...state, ordinaryDay: { ...state.ordinaryDay, supper: true },
    haul: { ...state.haul, mana: state.haul.mana - SUPPER_MANA },
    settledHaul: { ...state.settledHaul, mana: Math.max(0, state.settledHaul.mana - SUPPER_MANA) },
    heroBuffs: state.heroBuffs.map((buffs, index) => index === 0
      ? [...buffs.filter(buff => buff.id !== 'well_fed'), { id: 'well_fed', value: 2, turnsRemaining: 8 }] : buffs),
  };
}

export const ordinaryHour = (state: ProtoState) => !state.ordinaryDay ? 0
  : state.ordinaryDay.complete ? 23 : state.ordinaryDay.bedtime ? 21
  : state.ordinaryDay.supper ? 18.5 : state.haul.mana >= SUPPER_MANA ? 16 : state.totalWorkCompleted ? 12 : 0;

export function ordinaryThought(state: ProtoState): string {
  if (state.ordinaryDay?.complete) return 'A full belly, a familiar hollow. Tomorrow can wait.';
  if (state.ordinaryDay?.bedtime) return 'The rocks are still warm. Time to curl up. Finish resting whenever you like.';
  if (state.ordinaryDay?.supper) return 'That hit the spot. One last look outside, then bed.';
  if (state.haul.mana >= SUPPER_MANA) return isHome(state)
    ? 'Home again. Two mana for supper; the rest can keep.'
    : 'Enough for supper. I could head home, or nose around the old tree.';
  return 'Breakfast first. The manaberry patch is just northwest of home. Drag Hero there and play a few food cards.';
}
