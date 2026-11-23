import type { BattleState } from './battle';
import type { Card } from '../protoState';

// Pros and cons are design considerations for the Insight panel, not measured results for these layouts.
export const LAYOUT_EXPERIMENTS = [
  { id: 'two-deep', name: 'Two-deep reach', detail: 'Hero reaches both lower lanes. Dragon uses its rear only.',
    pros: ['Simplest rule to read: Hero plays anything on her side of the frontier.', 'Roughly doubles the playable set, like the top-two-playable table the Monte Carlo study matched to 14 columns.', "The dragon's private rear keeps its threat easy to read."],
    cons: ['No positional decision; reach is the same every turn.', 'With a second foundation it behaves like 2×14, which ran away in about 13% of simulated turns.', 'The dragon never contests the frontier, so the middle lane carries no tension.'] },
  { id: 'position', name: 'Reach by position', detail: 'Reach the frontier column in front of Hero and its neighbours. Shift for 1 Momentum per column.',
    pros: ['Turns reach into a movement decision paid in Momentum.', "Hero's board column matches her arena position, so board and scene tell one story.", 'A three-card window keeps the playable set small and readable.'],
    cons: ['Only three frontier cells are in reach, so dead turns are likelier unless shifting stays cheap.', 'Shifts compete with Withdraw and other Momentum skills for the same pool.', "Hero's foundation sits over her window, so the reachable columns depend on the dimming cue."] },
  { id: 'fanned', name: 'Fanned stacks', detail: 'Each frontier card fans behind its party-rear card. Both are playable; the back (frontier) card costs 1 AP before its normal receipt.',
    pros: ['Reads most like physical cards on a table.', 'Reaching deeper becomes a resource decision instead of a free extra card.', 'Same playable set as Two-deep, with a price on half of it.'],
    cons: ['Folds the party rear into the frontier, so the three-lane story is harder to see.', 'The AP toll drains ability fuel; Kin bank a median of only 2–3 AP per turn.', 'Overlapping cards need careful hit areas and stay cramped at small card widths.'] },
  { id: 'contested', name: 'Contested frontier', detail: 'Both sides reach the frontier and their own private rear.',
    pros: ['Creates denial: take a frontier card before the dragon can.', "The dragon's options are visible on the board, so its next play can be anticipated.", 'Makes the frontier the lane that matters.'],
    cons: ["The dragon gets more legal plays, so its intent fills faster; balance is untested.", 'A planned line can vanish on the enemy turn, which may feel random.', 'One more thing to track every turn.'] },
  { id: 'reserve', name: 'Reserve hand', detail: 'Hero reaches her rear plus a three-card reserve. Reserve cards follow rank matching and refresh each party turn.',
    pros: ['Closest to a familiar hand of cards: three guaranteed extra options each turn.', 'Works as a dead-run fix; hand rows cut dead deals in the Monte Carlo study (5 cards: 31% to 13% on one foundation).', "Reserve cards never compete with the dragon's reach."],
    cons: ['Hero never uses the frontier, so the spatial board matters less.', 'Leftovers are discarded at refresh, so there is no carry-over planning.', 'Adds a fourth card area to lay out and read.'] },
  { id: 'rotating', name: 'Rotating rows', detail: 'At party turn end: party rear becomes frontier, frontier becomes dragon rear, dragon rear becomes party rear.',
    pros: ["Rewards planning across turns: you can see the dragon's rear that becomes yours next.", 'Every card eventually passes through every lane.', 'Costs no extra resource.'],
    cons: ['Hard to predict without strong cues; the rotation is a mental load.', 'Cards Hero leaves in the frontier become the dragon rear, so turns can swing.', 'Only moves at the turn handoff, never mid-turn.'] },
] as const;
export type LayoutExperimentId = typeof LAYOUT_EXPERIMENTS[number]['id'];
export type LayoutExperiment = { layout: LayoutExperimentId; position: number; reserve: Card[]; rotations: number };

/** Layouts whose dragon keeps to its own rear lane; the others also let it take frontier cards. */
const ENEMY_PRIVATE: readonly LayoutExperimentId[] = ['two-deep', 'reserve'];
export const enemyLaneDepths = (experiment: LayoutExperiment | undefined) => experiment && ENEMY_PRIVATE.includes(experiment.layout) ? [0] : [0, 1];

/** Who may take a lane cell under the layout, ignoring rank and AP. Rules, reach cues and lane labels all read this. */
export function laneReach(experiment: LayoutExperiment, column: number, depth: number) {
  const party = depth > 0 && (experiment.layout === 'position' ? depth === 1 && Math.abs(column - experiment.position) <= 1 : experiment.layout === 'reserve' ? depth === 2 : true);
  return { party, enemy: enemyLaneDepths(experiment).includes(depth), cost: experiment.layout === 'fanned' && depth === 1 ? 1 : 0 };
}

const LANE_NAMES = ['Dragon rear', 'Frontier', 'Party rear'];
/** Lane label lines: name, who reaches it, and (Rotating) the lane it becomes next turn. */
export function laneLabel(experiment: LayoutExperiment, depth: number): string[] {
  const { party, enemy, cost } = laneReach(experiment, experiment.position, depth);
  const hero = experiment.layout === 'position' && depth === 1 ? 'Hero ±1 column' : cost ? `Hero · ${cost} AP` : 'Hero';
  const who = [party && hero, enemy && 'Dragon'].filter(Boolean).join(' + ') || 'Out of reach';
  return experiment.layout === 'rotating' ? [LANE_NAMES[depth], who, `↻ next: ${LANE_NAMES[(depth + 2) % 3].toLowerCase()}`] : [LANE_NAMES[depth], who];
}

export function experimentCanReach(state: BattleState, actorId: string, card: Card): boolean {
  const experiment = state.experiment;
  if (!experiment) return true;
  const column = state.columns.findIndex(cards => cards.some(item => item.id === card.id));
  if (column < 0) return true;
  const reach = laneReach(experiment, column, state.columns[column].findIndex(item => item.id === card.id));
  return reach.party && (!reach.cost || Boolean(state.maxAP) || (state.party.find(actor => actor.id === actorId)?.charge ?? 0) >= reach.cost);
}

export function moveExperiment(state: BattleState, delta: number): BattleState {
  if (!state.experiment || state.experiment.layout !== 'position' || state.turn !== 'party' || state.result || !Number.isInteger(delta) || !delta) return state;
  const position = state.experiment.position + delta, cost = Math.abs(delta);
  if (position < 0 || position >= state.columns.length || (state.momentum?.value ?? 0) < cost || !state.party.some(actor => actor.id === 'hero' && actor.hp > 0)) return state;
  return { ...state, experiment: { ...state.experiment, position }, momentum: { ...state.momentum!, value: state.momentum!.value - cost, spent: state.momentum!.spent + cost, lastSpend: cost } };
}

export function rotateExperiment(state: BattleState): BattleState {
  return state.experiment?.layout === 'rotating' ? { ...state, columns: state.columns.map(cards => [cards[1], cards[2], cards[0]]), experiment: { ...state.experiment, rotations: state.experiment.rotations + 1 } } : state;
}
