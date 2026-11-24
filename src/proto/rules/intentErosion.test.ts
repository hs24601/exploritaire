import { expect, it } from 'vitest';
import { createCombatSandboxScenario, endPlayerTurn, tickBattle, type BattleState } from './battle';
import { advanceIntent, breathTurn, intentCapacity, intentDamage, intentPassiveAndFire, playOnIntent } from './battleDeadRun';

it('removes filled pips first, then permanently erodes empty capacity and scales damage', () => {
  const initial = createCombatSandboxScenario('1004');
  const state = { ...initial, columns: [[{ id: 'test-seven', rank: 7 }]], tutorial: { ...initial.tutorial!, breath: 'charging' as const, intent: { id: 'breath', rank: 6, pips: 1, fired: 0, cards: [] } } };
  const drained = playOnIntent(state, 0);
  expect(drained.tutorial!.intent!.pips).toBe(0);
  expect(intentCapacity(drained)).toBe(4);
  const eroded = playOnIntent({ ...drained, columns: [[{ id: 'test-eight', rank: 8 }]] }, 0);
  expect(intentCapacity(eroded)).toBe(3);
  expect(intentDamage(eroded)).toBe(41);
  const readied = intentPassiveAndFire({ ...eroded, tutorial: { ...eroded.tutorial!, intent: { ...eroded.tutorial!.intent!, pips: 3 } } });
  expect(readied.tutorial!.breath).toBe('readied');
  const recast = breathTurn({ ...eroded, tutorial: { ...eroded.tutorial!, breath: 'armored', intent: undefined } }).state;
  expect(intentCapacity(recast)).toBe(3);
});

it('keeps a broken ability playable and staggers its owner only once', () => {
  const initial = createCombatSandboxScenario('1004');
  const state = { ...initial, columns: [[{ id: 'last-seven', rank: 7 }]], tutorial: { ...initial.tutorial!, intentCap: 1, breath: 'charging' as const, intent: { id: 'breath', rank: 6, pips: 0, fired: 0, cards: [] } } };
  const next = playOnIntent(state, 0);
  expect(next.tutorial!.intent).toMatchObject({ rank: 7, pips: 0 });
  expect(next.tutorial!.breath).toBe('disabled');
  expect(next.foes[0].staggered).toBeGreaterThan(0);
  expect(next.foes[0].hp).toBe(state.foes[0].hp);
  expect(breathTurn(next).state.tutorial!.intent).toBeDefined();
  const again = playOnIntent({ ...next, columns: [[{ id: 'next-eight', rank: 8 }]], foes: next.foes.map(foe => ({ ...foe, staggered: 0 })) }, 0);
  expect(again.tutorial!.intent).toMatchObject({ rank: 8, pips: 0 });
  expect(again.foes[0].staggered).toBe(0);
  expect(again.momentum!.value).toBe(next.momentum!.value + 1);
  expect(intentPassiveAndFire(again).tutorial!.intent).toEqual(again.tutorial!.intent);
});

it('resets the progress allowance on each enemy turn while counterplay remains unrestricted', () => {
  const initial = createCombatSandboxScenario('1004');
  const state = { ...initial, columns: [[{ id: 'seven', rank: 7 }], [{ id: 'eight', rank: 8 }]], tutorial: { ...initial.tutorial!, breath: 'charging' as const, intent: { id: 'breath', rank: 6, pips: 0, fired: 0, cards: [] } } };
  const first = advanceIntent(state, false);
  expect(first.tutorial!.intent!.pips).toBe(1);
  const second = advanceIntent(first, false);
  expect(second.tutorial!.intent!.pips).toBe(2);
  const reduced = playOnIntent({ ...second, columns: [[{ id: 'nine', rank: 9 }]], turn: 'party' }, 0);
  expect(reduced.tutorial!.intent!.pips).toBe(1);
});

it('keeps the broken target until the player turn after the skipped enemy turn ends', () => {
  const initial = createCombatSandboxScenario('1004');
  const setup: BattleState = { ...initial, columns: [[{ id: 'break-seven', rank: 7 }]], tutorial: { ...initial.tutorial!, intentCap: 1, breath: 'charging', intent: { id: 'breath', rank: 6, pips: 0, fired: 0, cards: [] } } };
  const broken = playOnIntent(setup, 0);
  let skipped = endPlayerTurn(broken);
  for (let i = 0; i < 40 && skipped.turn === 'enemy'; i++) skipped = tickBattle(skipped, 2);
  expect(skipped.turn).toBe('party');
  expect(skipped.foes[0].staggered).toBeGreaterThan(0);
  expect(skipped.tutorial!.intent).toBeDefined();
  const followup = playOnIntent({ ...skipped, columns: [[{ id: 'follow-eight', rank: 8 }]] }, 0);
  expect(followup.tutorial!.intent!.rank).toBe(8);
  const recovery = endPlayerTurn(followup);
  expect(recovery.foes[0].staggered).toBe(0);
  expect(recovery.tutorial!.intent).toBeUndefined();
});
