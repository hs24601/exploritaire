import { expect, it } from 'vitest';
import { canPlay, createCombatSandboxScenario, createLayoutExperiment, playCard, returnPlayerTurn, takeLaneCard, type BattleState } from './battle';
import { anyLegalPlay, intentEnemyPlayOne } from './battleDeadRun';

function board(enemy = 3, shared = 1, rear = 7): BattleState {
  const base = createLayoutExperiment('contested');
  return { ...base, columns: base.columns.map((_, c) => [enemy, shared, rear].map((rank, d) => ({ id: `cell-${c}-${d}`, rank }))),
    tutorial: { ...base.tutorial!, breath: 'charging', intent: { id: 'test-intent', rank: 4, pips: 0, fired: 0, cards: [] } } };
}

it('explicit inward mode pulls party frontier receipts from the party rear', () => {
  const start = createLayoutExperiment('contested'); start.rules={...start.rules,inwardBackfill:true};
  expect(start.columns).toHaveLength(6);
  expect(start.columns.every(cards => cards.length === 3)).toBe(true);
  const state = { ...board(), rules: start.rules, experiment: undefined };
  const next = playCard(state, 0, 'hero', false, 1);
  expect(next.party[0].rank).toBe(1);
  expect(next.columns[0][1]).toBe(state.columns[0][2]);
  expect(next.columns[0][0]).toBe(state.columns[0][0]);
  expect(next.columns[0][2].id).not.toBe(state.columns[0][2].id);
  expect(next.columns.slice(1)).toEqual(state.columns.slice(1));
});

it('enemy frontier plays pull inward from the enemy rear and leave the party rear alone', () => {
  const start = createLayoutExperiment('contested'); start.rules={...start.rules,inwardBackfill:true};
  const state = { ...board(9, 3, 7), rules: start.rules, experiment: undefined };
  const next = intentEnemyPlayOne(state)!;
  const column = state.columns.findIndex(cards => cards[1].id === next.tutorial!.intent!.cards[0].id);
  expect(column).toBeGreaterThanOrEqual(0);
  expect(next.columns[column][1]).toBe(state.columns[column][0]);
  expect(next.columns[column][2]).toBe(state.columns[column][2]);
  expect(next.columns[column][0].id).not.toBe(state.columns[column][0].id);
});

it('taking either rear card directly refills only that rear cell', () => {
  const start = createLayoutExperiment('contested'); start.rules={...start.rules,inwardBackfill:true};
  for (const depth of [0, 2]) {
    const next = takeLaneCard(start, 0, depth, depth === 0 ? 'enemy' : 'party')!;
    expect(next.columns[0][1]).toBe(start.columns[0][1]);
    expect(next.columns[0][2 - depth]).toBe(start.columns[0][2 - depth]);
    expect(next.columns[0][depth].id).not.toBe(start.columns[0][depth].id);
  }
});

it('Hero reaches the frontier and party rear but never the matching enemy rear', () => {
  const state = board();
  expect(canPlay(state, 'hero', state.columns[0][0])).toBe(false);
  expect(canPlay(state, 'hero', state.columns[0][1])).toBe(true);
  expect(playCard(state, 0, 'hero', false, 0)).toBe(state);
  expect(anyLegalPlay(state)).toBe(true);
  expect(anyLegalPlay(board(3, 8, 7))).toBe(false);
  expect(canPlay(board(9, 8, 3), 'hero', board(9, 8, 3).columns[0][2])).toBe(true);
});

it('a frontier receipt refills only its cell and awards the normal receipt', () => {
  const state = board(), next = playCard(state, 0, 'hero', false, 1);
  expect(next.columns[0][1].id).not.toBe(state.columns[0][1].id);
  expect(next.columns[0][0]).toBe(state.columns[0][0]);
  expect(next.columns[0][2]).toBe(state.columns[0][2]);
  expect(next.columns.slice(1)).toEqual(state.columns.slice(1));
  expect(next.columns.every(cards => cards.length === 3)).toBe(true);
  expect(next.party[0].rank).toBe(1);
  expect(next.party[0].charge).toBe(state.party[0].charge + 1);
  expect(next.momentum!.value).toBe(state.momentum!.value + 1);
});

it('Deep Breath reaches its rear and the frontier, never the party rear', () => {
  const privateParty = board(9, 9, 3);
  expect(intentEnemyPlayOne(privateParty)).toBeNull();
  for (const state of [board(3, 9, 9), board(9, 3, 9)]) {
    const next = intentEnemyPlayOne(state)!;
    expect(next.tutorial!.intent!.pips).toBe(1);
    expect(next.columns.map(cards => cards[2])).toEqual(state.columns.map(cards => cards[2]));
    expect(next.columns.every(cards => cards.length === 3)).toBe(true);
    expect(next.columns.flat().filter(card => !state.columns.flat().some(old => old.id === card.id))).toHaveLength(1);
  }
});

it('delayed party Withdraw refreshes the two party-accessible lanes without touching the enemy rear', () => {
  const state = board();
  const next = returnPlayerTurn({ ...state, turn: 'enemy', pendingRedeal: {} });
  expect(next.pendingRedeal).toBeUndefined();
  expect(next.columns.map(cards => cards[0])).toEqual(state.columns.map(cards => cards[0]));
  expect(next.columns.flatMap(cards => cards.slice(1)).every(card => !state.columns.flat().some(old => old.id === card.id))).toBe(true);
});
