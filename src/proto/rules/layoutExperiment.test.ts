import { expect, it } from 'vitest';
import { createLayoutExperiment, canPlay, playCard, playExperimentReserve, returnPlayerTurn, endPlayerTurn } from './battle';
import { LAYOUT_EXPERIMENTS, enemyLaneDepths, moveExperiment, rotateExperiment } from './layoutExperiment';
import { intentEnemyPlayOne } from './battleDeadRun';

it('all six interpretations have exactly the same opening deal and resource banks', () => {
  const first = createLayoutExperiment();
  for (const { id } of LAYOUT_EXPERIMENTS) {
    const state = createLayoutExperiment(id);
    expect(state.columns).toEqual(first.columns);
    expect(state.seed).toBe(1001);
    expect(state.party[0].charge).toBe(3);
    expect(state.momentum!.value).toBe(3);
    expect(state.party[0].rank).toBe(first.party[0].rank);
  }
});

it('the authored opening makes each reach rule light a different set of cards', () => {
  const legal = (id: Parameters<typeof createLayoutExperiment>[0]) => { const state = createLayoutExperiment(id);
    return state.columns.flatMap((cards, c) => cards.map((card, d) => canPlay(state, 'hero', card) ? `${c}:${d}` : '')).filter(Boolean); };
  expect(legal('two-deep')).toEqual(['0:2', '1:1', '4:1']);
  expect(legal('position')).toEqual(['1:1']);
  expect(legal('reserve')).toEqual(['0:2']);
  expect(moveExperiment(moveExperiment(createLayoutExperiment('position'), 1), 1).experiment!.position).toBe(4);
  const dragon = (id: Parameters<typeof createLayoutExperiment>[0]) => { const state = createLayoutExperiment(id);
    return state.columns.flatMap((cards, c) => enemyLaneDepths(state.experiment).filter(d => Math.abs(cards[d].rank - 9) === 1).map(d => `${c}:${d}`)); };
  expect(dragon('two-deep')).toEqual(['0:0', '3:0']);
  expect(dragon('contested')).toEqual(['0:0', '3:0', '5:1']);
});

it('position restricts reach and spends distance in Momentum without generating cards', () => {
  const state = createLayoutExperiment('position');
  state.columns = state.columns.map((cards, c) => cards.map((card, d) => ({ ...card, rank: d === 1 ? 3 : 9 })));
  expect(canPlay(state, 'hero', state.columns[0][1])).toBe(false);
  expect(canPlay(state, 'hero', state.columns[1][1])).toBe(true);
  expect(canPlay(state, 'hero', state.columns[2][2])).toBe(false);
  const shifted = moveExperiment(state, -2);
  expect(shifted.experiment!.position).toBe(0);
  expect(shifted.momentum!.value).toBe(1);
  expect(shifted.columns).toBe(state.columns);
  expect(canPlay(shifted, 'hero', shifted.columns[0][1])).toBe(true);
  expect(moveExperiment(shifted, -1)).toBe(shifted);
  expect(moveExperiment({ ...state, turn: 'enemy' }, 1).experiment!.position).toBe(2);
});

it('fanned lower cards debit one AP before granting their receipt', () => {
  const state = createLayoutExperiment('fanned');
  state.columns[0][1] = { id: 'lower', rank: 3 };
  const played = playCard(state, 0, 'hero', false, 1);
  expect(played.party[0].charge).toBe(3);
  expect(played.party[0].rank).toBe(3);
  const empty = { ...state, party: state.party.map(actor => ({ ...actor, charge: 0 })) };
  expect(playCard(empty, 0, 'hero', false, 1)).toBe(empty);
});

it('reserve cards use rank matching, are consumed, and refresh on the next party turn', () => {
  const state = createLayoutExperiment('reserve');
  expect(state.experiment!.reserve).toHaveLength(3);
  state.experiment!.reserve[0] = { id: 'reserve-legal', rank: 3 };
  const played = playExperimentReserve(state, 'reserve-legal');
  expect(played.experiment!.reserve).toHaveLength(2);
  expect(played.party[0].rank).toBe(3);
  expect(played.columns).toBe(state.columns);
  expect(playExperimentReserve(played, 'reserve-legal')).toBe(played);
  expect(returnPlayerTurn({ ...played, turn: 'enemy' }).experiment!.reserve).toHaveLength(3);
});

it('rotating rows cycle deterministically without discarding or drawing cards', () => {
  const state = createLayoutExperiment('rotating'), next = rotateExperiment(state);
  expect(next.columns[0]).toEqual([state.columns[0][1], state.columns[0][2], state.columns[0][0]]);
  expect(next.dealt).toBe(state.dealt);
  expect(endPlayerTurn(state).experiment!.rotations).toBe(1);
});

it('the contested tab gives the dragon access to the shared frontier', () => {
  const state = createLayoutExperiment('two-deep');
  state.tutorial = { ...state.tutorial!, intent: { id: 'intent', rank: 4, pips: 0, fired: 0, cards: [] } };
  state.columns = state.columns.map(cards => cards.map((card, depth) => ({ ...card, rank: depth === 1 ? 3 : 9 })));
  expect(intentEnemyPlayOne(state)).toBeNull();
  expect(intentEnemyPlayOne({ ...state, experiment: { ...state.experiment!, layout: 'contested' } })).not.toBeNull();
});
