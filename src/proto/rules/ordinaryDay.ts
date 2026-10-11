import type { BiomeTileState, Card, ProtoState } from '../protoState';

export const SUPPER_BERRIES = 2;
export const isHome = (state: ProtoState) => state.worldActors.some(actor => actor.id === 'hero' &&
  Math.abs(actor.position.x) < 1 && Math.abs(actor.position.y - 96) < 1);
export const isOrdinaryForage = (id: string | null) => id === 'day-one-berries' || id === 'day-one-tree';

/** Short, reliable rank walks; food arrives before the optional full clear. */
export function createOrdinaryPlaces(seed: number): BiomeTileState[] {
  return [
    { id: 'day-one-berries', title: 'Berry Patch', position: { x: -48, y: 48 } },
    { id: 'day-one-tree', title: 'Old Tree', position: { x: 48, y: 0 } },
  ].map((place, index) => {
    const tableau: Card[][] = Array.from({ length: 7 }, (_, step) => [{
      id: `${place.id}-${step}`, rank: step + 3, questStep: step,
      resource: index === 0 || step % 2 === 0 ? 'berries' : 'herbs',
    }]);
    return { ...place, tileType: index === 0 ? 'berry-patch' : undefined, sizeLabel: 'Small', gridSize: { columns: 1, rows: 1 }, terrain: 'woods',
      resourceDensity: 1, tableauSize: 7, tableau, stock: [], dealt: 7, seed: seed + index,
      unlocked: true, travelCost: 1, threat: 'none', flags: ['unexplored'] };
  });
}

export function eatSupper(state: ProtoState): ProtoState {
  if (!state.ordinaryDay || state.ordinaryDay.supper || !isHome(state) || state.haul.berries < SUPPER_BERRIES) return state;
  return { ...state, ordinaryDay: { ...state.ordinaryDay, supper: true },
    haul: { ...state.haul, berries: state.haul.berries - SUPPER_BERRIES },
    settledHaul: { ...state.settledHaul, berries: Math.max(0, state.settledHaul.berries - SUPPER_BERRIES) },
    heroBuffs: state.heroBuffs.map((buffs, index) => index === 0
      ? [...buffs.filter(buff => buff.id !== 'well_fed'), { id: 'well_fed', value: 2, turnsRemaining: 8 }] : buffs),
  };
}

export const ordinaryHour = (state: ProtoState) => !state.ordinaryDay ? 9
  : state.ordinaryDay.complete ? 23 : state.ordinaryDay.bedtime ? 21
  : state.ordinaryDay.supper ? 18.5 : state.haul.berries >= SUPPER_BERRIES ? 16 : state.totalWorkCompleted ? 12 : 9;

export function ordinaryThought(state: ProtoState): string {
  if (state.ordinaryDay?.complete) return 'A full belly, a familiar hollow. Tomorrow can wait.';
  if (state.ordinaryDay?.bedtime) return 'The rocks are still warm. Time to curl up. Finish resting whenever you like.';
  if (state.ordinaryDay?.supper) return 'That hit the spot. One last look outside, then bed.';
  if (state.haul.berries >= SUPPER_BERRIES) return isHome(state)
    ? 'Home again. Two berries for supper; the rest can keep.'
    : 'Enough for supper. I could head home, or nose around the old tree.';
  return 'Breakfast first. The berry patch is just northwest of home. Drag Hero there and play a few food cards.';
}
