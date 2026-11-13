import { expect, it } from 'vitest';
import { apCap, createCombatSandboxScenario, defaultStrike, returnPlayerTurn, type BattleState } from './battle';
import { tutorialById } from './battleTutorialScenarios';
import { invokeCost, invokeKeru, invokeReason } from './keruInvoke';
import { INVOKE_KERU } from './keruInvokeData';
import { absorbTempHp } from './cirCompanion';

const hero = (state: BattleState) => state.party.find(actor => actor.id === 'hero')!;
const withAP = (state: BattleState, charge: number): BattleState => ({ ...state, party: state.party.map(actor => actor.id === 'hero' ? { ...actor, charge } : actor) });

it('copies 1004 and seeds a stored value on every Keru', () => {
  const state = createCombatSandboxScenario('1005');
  expect(tutorialById('1005')?.name).toBe('1005: Keru Invoke');
  expect(state.party.map(actor => actor.id)).toEqual(['hero']);
  expect(state.columns.map(column => column.length)).toEqual([4, 4, 4, 4, 4, 4, 4, 4]);
  expect(Object.keys(state.keruInvoke!.values)).toEqual([...INVOKE_KERU]);
  for (const keru of INVOKE_KERU) expect(state.keruInvoke!.values[keru]).toBeGreaterThanOrEqual(1);
  expect(createCombatSandboxScenario('1004').keruInvoke).toBeUndefined();
});

it('swaps the Keru value with Hero’s foundation top and is not a card play', () => {
  const state = createCombatSandboxScenario('1005');
  const before = hero(state), stored = state.keruInvoke!.values.cir;
  const next = invokeKeru(state, 'cir');
  expect(hero(next).rank).toBe(stored);
  expect(hero(next).foundationCards![hero(next).foundationCards!.length - 1].rank).toBe(stored);
  expect(hero(next).foundationCards).toHaveLength(before.foundationCards!.length);
  expect(next.keruInvoke!.values.cir).toBe(before.rank);
  expect(hero(next).count).toBe(before.count);
  expect(hero(next).charge).toBe(before.charge);
  expect(next.momentum).toEqual(state.momentum);
  expect(next.foes).toEqual(state.foes);
  // Re-invoking the same Keru just swaps the values back.
  const again = invokeKeru(withAP(next, 1), 'cir');
  expect(hero(again).rank).toBe(before.rank);
  expect(again.keruInvoke!.values.cir).toBe(stored);
});

it('makes the first invoke each party turn free, then charges 1 Hero AP', () => {
  const state = withAP(createCombatSandboxScenario('1005'), 1);
  expect(invokeCost(state)).toBe(0);
  const first = invokeKeru(state, 'dem');
  expect(hero(first).charge).toBe(1);
  expect(invokeCost(first)).toBe(1);
  const second = invokeKeru(first, 'mochi');
  expect(hero(second).charge).toBe(0);
  expect(invokeReason(second)).toBe('Needs 1 Hero AP');
  expect(invokeKeru(second, 'riv')).toBe(second);
});

it('resets the free invoke when the party turn returns', () => {
  const used = invokeKeru(createCombatSandboxScenario('1005'), 'banks');
  expect(invokeCost(used)).toBe(1);
  const next = returnPlayerTurn({ ...used, turn: 'enemy' });
  expect(next.keruInvoke!.used).toBe(0);
  expect(invokeCost(next)).toBe(0);
  expect(invokeReason({ ...used, turn: 'enemy' })).toBe('Player turn required');
});

it('keeps one Keru on Hero; a new invoke replaces the earlier buff', () => {
  const state = withAP(createCombatSandboxScenario('1005'), 6);
  const base = hero(state);
  const dem = invokeKeru(state, 'dem');
  expect(hero(dem).invokedKeru).toBe('dem');
  expect(hero(dem).maxHp).toBe(base.maxHp + 4);
  expect(hero(dem).hp).toBe(base.hp + 4);
  const riv = invokeKeru(dem, 'riv');
  expect(hero(riv).invokedKeru).toBe('riv');
  expect(hero(riv).maxHp).toBe(base.maxHp);
  expect(hero(riv).hp).toBe(base.hp);
  expect(apCap(hero(riv))).toBe(apCap(base) + 1);
  const banks = invokeKeru({ ...riv, party: riv.party.map(a => a.id === 'hero' ? { ...a, charge: 7 } : a) }, 'banks');
  expect(apCap(hero(banks))).toBe(apCap(base));
  expect(hero(banks).charge).toBe(apCap(base));
  expect(absorbTempHp(hero(banks), 5).hp).toBe(hero(banks).hp - 3);
});

it('sharpens Hero’s chip hit while Cir or Mochi is invoked', () => {
  const state = { ...createCombatSandboxScenario('1005'), foes: createCombatSandboxScenario('1005').foes.map(foe => ({ ...foe, statuses: [] })) };
  const hp = state.foes[0].hp;
  const plain = defaultStrike(state, 'hero');
  const cir = defaultStrike(invokeKeru(state, 'cir'), 'hero');
  expect(hp - cir.foes[0].hp).toBe(hp - plain.foes[0].hp + 1);
  const mochi = defaultStrike(invokeKeru(state, 'mochi'), 'hero');
  expect(mochi.foes[0].stagger).toBe(plain.foes[0].stagger + 1);
});
