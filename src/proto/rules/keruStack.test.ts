import { describe, expect, it } from 'vitest';
import { createCombatSandboxScenario, defaultStrike, returnPlayerTurn, type BattleState } from './battle';
import { tutorialById } from './battleTutorialScenarios';
import { feedKeru, feedReason, harnessOrder, heroLoad, invokeCost, invokeKeru, invokeReason } from './keruInvoke';
import { FEED_COSTS, FORTRESS_WARD, LOAD_CAP, RARITY_VALUES, activeSynergies, keruLoad, keruMods, type InvokeKeruId } from './keruInvokeData';
import { absorbTempHp } from './cirCompanion';

// Keru stacking (1011 Keru Stack): load budget, mounting invoke cost, replacement, stacked buffs and pair synergies.
// PARKED (Eric, 2026-10-28): 1011 is out of the scenario list and 1010 keeps its 3-slot harness, so these are skipped.

const hero = (state: BattleState) => state.party.find(actor => actor.id === 'hero')!;
const withAP = (state: BattleState, charge: number): BattleState => ({ ...state, party: state.party.map(actor => actor.id === 'hero' ? { ...actor, charge } : actor) });
const feed = (state: BattleState, keru: InvokeKeruId, n: number) => { let next = state; for (let i = 0; i < n; i++) next = feedKeru(withAP(next, Math.max(1, hero(next).charge)), keru); return next; };
const toTier = (state: BattleState, keru: InvokeKeruId, tier: number) => feed(state, keru, FEED_COSTS.slice(0, tier).reduce((a, b) => a + b, 0));
/** Feeds each Keru to its tier off Hero, then invokes them in order with AP to spare. */
const stack = (state: BattleState, build: [InvokeKeruId, number][]) => {
  let next = build.reduce((s, [keru, tier]) => toTier(s, keru, tier), state);
  for (const [keru] of build) next = invokeKeru(withAP(next, 9), keru);
  return next;
};
const s1011 = () => createCombatSandboxScenario('1011' as never); // parked: no longer a listed scenario
/** No armor, and a gauge too deep to break, so chip damage compares cleanly. */
const calm = (state: BattleState, staggerMax = 999): BattleState => ({ ...state, foes: state.foes.map(foe => ({ ...foe, statuses: [], stagger: 0, profile: { ...foe.profile, staggerMax } })) });

describe.skip('load budget', () => {
  it('uses load equal to rarity, capacity 6', () => {
    expect([0, 1, 2, 3].map(t => keruLoad(t as 0 | 1 | 2 | 3))).toEqual([1, 2, 3, 4]);
    expect(LOAD_CAP).toBe(6);
    expect(heroLoad(stack(s1011(), [['banks', 1], ['mochi', 0]]))).toBe(3);
  });

  it('blocks an invoke past 6 load with the load it needs', () => {
    const full = stack(s1011(), [['mochi', 3], ['cir', 1]]);
    expect(heroLoad(full)).toBe(6);
    const ready = withAP(full, 9);
    expect(invokeReason(ready, 'dem')).toBe('Needs 1 more load');
    expect(invokeKeru(ready, 'dem')).toBe(ready);
    const epic = withAP(toTier(full, 'banks', 2), 9);
    expect(invokeReason(epic, 'banks')).toBe('Needs 3 more load');
  });

  it('blocks feeding a Keru on Hero toward a tier the load can’t carry, but not one off Hero', () => {
    const full = stack(s1011(), [['banks', 1], ['dem', 1], ['cir', 1]]);
    expect(heroLoad(full)).toBe(6);
    expect(feedReason(withAP(full, 3), 'banks')).toBe('Load full · the next tier needs 1 more load');
    expect(feedKeru(withAP(full, 3), 'banks')).toEqual(withAP(full, 3));
    expect(feedReason(withAP(full, 3), 'riv')).toBeNull();
    // With room, feeding the Keru on Hero raises her load.
    const room = stack(s1011(), [['banks', 1], ['dem', 0]]);
    expect(heroLoad(feed(room, 'dem', 2))).toBe(heroLoad(room) + 1);
  });

  it('replaces a Keru dropped onto its badge: its load and buff leave', () => {
    const full = withAP(stack(s1011(), [['mochi', 3], ['cir', 1]]), 9);
    const replaced = invokeKeru(full, 'dem', 'cir');
    expect(harnessOrder(replaced)).toEqual(['mochi', 'dem']);
    expect(hero(replaced).harness).toEqual({ mochi: 3, dem: 0 });
    expect(heroLoad(replaced)).toBe(5);
    expect(keruMods(hero(replaced)).chipDamage).toBe(0);
    expect(invokeReason(full, 'dem', 'riv')).toBe('That Keru is not on Hero');
    expect(invokeReason(full, 'mochi', 'cir')).toBe('Already on Hero');
    // A replacement that still doesn't fit names the load it needs.
    expect(invokeReason(withAP(toTier(full, 'banks', 3), 9), 'banks', 'cir')).toBe('Needs 2 more load');
  });
});

describe.skip('mounting invoke cost', () => {
  it('costs Keru on Hero + 1: 1, 2, then 3 AP', () => {
    let state = withAP(s1011(), 6); // her AP cap
    expect(invokeCost(state, 'riv')).toBe(1);
    state = invokeKeru(state, 'riv'); expect(hero(state).charge).toBe(5);
    expect(invokeCost(state, 'cir')).toBe(2);
    state = invokeKeru(state, 'cir'); expect(hero(state).charge).toBe(3);
    expect(invokeCost(state, 'mochi')).toBe(3);
    state = invokeKeru(state, 'mochi'); expect(hero(state).charge).toBe(0);
    expect(harnessOrder(state)).toEqual(['riv', 'cir', 'mochi']);
  });

  it('a replacement (or re-invoke) doesn’t count the outgoing Keru', () => {
    const two = withAP(stack(s1011(), [['riv', 0], ['cir', 0]]), 6);
    expect(invokeCost(two, 'dem')).toBe(3);
    expect(invokeCost(two, 'dem', 'riv')).toBe(2);
    expect(invokeCost(two, 'cir')).toBe(2);
    expect(hero(two).charge - hero(invokeKeru(two, 'dem', 'riv')).charge).toBe(2);
  });

  it('blocks an invoke Hero can’t afford with its cost', () => {
    const two = withAP(stack(s1011(), [['riv', 0], ['cir', 0]]), 2);
    expect(invokeReason(two, 'dem')).toBe('Needs 3 Hero AP');
    expect(invokeReason(two, 'dem', 'riv')).toBeNull();
  });
});

describe.skip('stacked buffs and the value swap', () => {
  it('adds up every Keru on Hero', () => {
    const state = stack(s1011(), [['cir', 1], ['mochi', 1], ['banks', 0]]);
    const mods = keruMods(hero(state));
    expect(mods.chipDamage).toBe(RARITY_VALUES.cir[1]);
    expect(mods.chipStagger).toBe(RARITY_VALUES.mochi[1]);
    expect(mods.guard).toBe(RARITY_VALUES.banks[0]);
    const base = hero(s1011()).maxHp, both = stack(s1011(), [['dem', 1], ['banks', 0]]);
    expect(hero(both).maxHp).toBe(base + RARITY_VALUES.dem[1]);
  });

  it('swaps Hero’s value with the Keru just invoked', () => {
    const one = withAP(stack(s1011(), [['riv', 0]]), 9);
    const heroRank = hero(one).rank, cirValue = one.keruInvoke!.values.cir;
    const two = invokeKeru(one, 'cir');
    expect(hero(two).rank).toBe(cirValue);
    expect(two.keruInvoke!.values.cir).toBe(heroRank);
    expect(hero(two).invokedKeru).toBe('cir');
  });
});

describe.skip('pair synergies', () => {
  it('Feedback (Riv + Cir): each AP Riv generates adds +1 to the next chip hit', () => {
    const on = withAP(calm(stack(s1011(), [['riv', 2], ['cir', 0]])), 0); // Epic Riv: +1 AP every 2 hits
    expect(activeSynergies(hero(on).harness).map(s => s.id)).toEqual(['feedback']);
    const once = defaultStrike(on, 'hero'), twice = defaultStrike(once, 'hero');
    expect(twice.keruInvoke!.feedback).toBe(1);
    const plain = on.foes[0].hp - once.foes[0].hp;
    const third = defaultStrike(twice, 'hero');
    expect(twice.foes[0].hp - third.foes[0].hp).toBe(plain + 1);
    expect(third.keruInvoke!.feedback).toBe(0);
    // Without Cir, Riv's AP queues nothing.
    const off = withAP(calm(stack(s1011(), [['riv', 2], ['mochi', 0]])), 0);
    expect(defaultStrike(defaultStrike(off, 'hero'), 'hero').keruInvoke!.feedback ?? 0).toBe(0);
  });

  it('Fortress (Dem + Banks): a 10-absorb Ward that refreshes each party turn', () => {
    const fort = stack(s1011(), [['dem', 1], ['banks', 1]]);
    expect(hero(fort).keruWard).toBe(true);
    expect(hero(fort).keruWardCap).toBe(FORTRESS_WARD);
    const hit = absorbTempHp(hero(fort), 30);
    expect(hero(fort).hp - hit.hp).toBe(30 - RARITY_VALUES.banks[1] - FORTRESS_WARD);
    expect(hit.keruWard).toBe(false);
    const spent: BattleState = { ...fort, turn: 'enemy', party: fort.party.map(a => a.id === 'hero' ? hit : a) };
    expect(hero(returnPlayerTurn(spent)).keruWard).toBe(true);
    // Without the pair there is no Ward.
    expect(hero(stack(s1011(), [['dem', 1], ['cir', 1]])).keruWard).toBeFalsy();
    // Replacing Banks breaks the pair and its Ward.
    expect(hero(invokeKeru(withAP(fort, 9), 'cir', 'banks')).keruWard).toBeFalsy();
  });

  it('Fortress with a Legendary Dem absorbs the whole hit, every turn', () => {
    const fort = stack(s1011(), [['dem', 3], ['banks', 0]]);
    expect(hero(fort).keruWardCap).toBeUndefined();
    const hit = absorbTempHp(hero(fort), 55);
    expect(hit.hp).toBe(hero(fort).hp);
    const spent: BattleState = { ...fort, turn: 'enemy', party: fort.party.map(a => a.id === 'hero' ? hit : a) };
    expect(absorbTempHp(hero(returnPlayerTurn(spent)), 55).hp).toBe(hero(fort).hp);
  });

  it('Shatter (Mochi + Cir): a stagger break deals 5 × Mochi’s tier number', () => {
    for (const tier of [0, 2]) {
      const primed = (state: BattleState): BattleState => ({ ...calm(state, 6), foes: calm(state, 6).foes.map(foe => ({ ...foe, stagger: 5 })) });
      const on = primed(stack(s1011(), [['mochi', tier], ['cir', 0]]));
      const broke = defaultStrike(on, 'hero');
      expect(broke.foes[0].staggered).toBeGreaterThan(0);
      const shatter = broke.events.find(event => event.label === 'Shatter');
      expect(shatter?.amount).toBe(5 * (tier + 1));
      const off = defaultStrike(primed(stack(s1011(), [['mochi', tier], ['riv', 0]])), 'hero');
      expect(off.events.some(event => event.label === 'Shatter')).toBe(false);
    }
  });
});

describe.skip('scenarios', () => {
  it('1011 Keru Stack opens against the armored Dusk Dragon with 3 AP and a 6 load budget', () => {
    const state = s1011();
    expect(tutorialById('1011')?.name).toBe('1011: Keru Stack');
    expect(state.foes[0].name).toBe('Dusk Dragon');
    expect(state.tutorial!.breath).toBe('armored');
    expect(hero(state).charge).toBe(3);
    expect(state.keruInvoke!.load).toBe(6);
    expect(state.keruInvoke!.kit).toBe('rarity');
    expect(harnessOrder(state)).toEqual([]);
  });

  it('everything resets on Restart', () => {
    const built = stack(s1011(), [['mochi', 3], ['cir', 1]]);
    expect(heroLoad(built)).toBe(6);
    const fresh = s1011();
    expect(heroLoad(fresh)).toBe(0);
    expect(fresh.keruInvoke!.tiers!.mochi).toBe(0);
    expect(hero(fresh).harness).toBeUndefined();
  });

  it('1010’s harness is now load based with the mounting cost', () => {
    const state = withAP(createCombatSandboxScenario('1010'), 9);
    expect(state.keruInvoke!.load).toBe(6);
    expect(state.keruInvoke!.slots).toBeUndefined();
    let next = state;
    for (const keru of ['banks', 'riv', 'cir', 'dem'] as const) next = invokeKeru(withAP(next, 9), keru);
    // Four Commons fit (load 4) and keep every engine buff.
    expect(harnessOrder(next)).toEqual(['banks', 'riv', 'cir', 'dem']);
    expect(invokeCost(next, 'mochi')).toBe(5);
    expect(invokeReason(withAP(toTier(next, 'mochi', 2), 9), 'mochi')).toBe('Needs 1 more load');
    expect(keruMods(hero(next)).rivEvery).toBe(RARITY_VALUES.engineRiv[0]);
  });
});
