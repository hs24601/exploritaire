import { describe, expect, it } from 'vitest';
import { apCap, createCombatSandboxScenario, createPlayableSandboxScenario, returnPlayerTurn, type BattleState } from './battle';
import { tutorialById } from './battleTutorialScenarios';
import { tutorialEnemyTurn } from './battleTutorials';
import { KERU_DISMISS_COOLDOWN, dismissKeru, dismissReason, feedKeru, feedReason, harnessOrder, invokeCost, invokeKeru, invokeReason, keruCooldown, keruTier, payKeruUpkeep, upkeepOf, upkeepPips, upkeepPlan } from './keruInvoke';
import { FEED_COSTS, RARITY_VALUES, guardedDamage, keruMods, type InvokeKeruId } from './keruInvokeData';
import { absorbTempHp } from './cirCompanion';

// 1012 Keru Upkeep: a bigger AP pool, per-turn upkeep instead of a load cap, dismissal and farewells.

const hero = (state: BattleState) => state.party.find(actor => actor.id === 'hero')!;
const withAP = (state: BattleState, charge: number): BattleState => ({ ...state, party: state.party.map(actor => actor.id === 'hero' ? { ...actor, charge } : actor) });
const feed = (state: BattleState, keru: InvokeKeruId, n: number) => { let next = state; for (let i = 0; i < n; i++) next = feedKeru(withAP(next, Math.max(1, hero(next).charge)), keru); return next; };
const toTier = (state: BattleState, keru: InvokeKeruId, tier: number) => feed(state, keru, FEED_COSTS.slice(0, tier).reduce((a, b) => a + b, 0));
const stack = (state: BattleState, build: [InvokeKeruId, number][]) => {
  let next = build.reduce((s, [keru, tier]) => toTier(s, keru, tier), state);
  for (const [keru] of build) next = invokeKeru(withAP(next, Math.max(1, hero(next).charge)), keru);
  return next;
};
const s1012 = () => createCombatSandboxScenario('1012');
/** The dragon without its armor or breath statuses, so stagger lands. */
const bare = (state: BattleState): BattleState => ({ ...state, foes: state.foes.map(foe => ({ ...foe, statuses: [], stagger: 0 })) });
/** Ends an enemy turn's countdowns: the next party turn opens. */
const nextTurn = (state: BattleState) => returnPlayerTurn({ ...state, turn: 'enemy' });

describe('1012 setup and AP pool', () => {
  it('opens against the armored Dusk Dragon with 0 AP, flat 1 AP invokes and upkeep on', () => {
    const state = s1012();
    expect(tutorialById('1012')?.name).toBe('1012: Keru Upkeep');
    expect(state.foes[0].name).toBe('Dusk Dragon');
    expect(state.tutorial!.breath).toBe('armored');
    expect(hero(state).charge).toBe(0);
    expect(state.keruInvoke).toMatchObject({ upkeep: true, kit: 'upkeep', cost: 1, slots: 5 });
    expect(state.keruInvoke!.load).toBeUndefined();
    expect(invokeCost(stack(state, [['riv', 0], ['cir', 0]]), 'mochi')).toBe(1);
  });

  it('holds all five Keru at once', () => {
    const all = stack(s1012(), [['dem', 0], ['cir', 0], ['mochi', 0], ['riv', 0], ['banks', 0]]);
    expect(harnessOrder(all)).toEqual(['dem', 'cir', 'mochi', 'riv', 'banks']);
  });

  it('Banks raises the AP cap by 3/6/9/12 and Riv generates every 3/2/1 hits', () => {
    const base = apCap(hero(s1012()));
    expect(base).toBe(6);
    expect([0, 1, 2, 3].map(t => apCap(hero(stack(s1012(), [['banks', t]]))) - base)).toEqual([3, 6, 9, 12]);
    expect([0, 1, 2, 3].map(t => keruMods(hero(stack(s1012(), [['riv', t]]))).rivEvery)).toEqual([3, 2, 1, 1]);
    expect(keruMods(hero(stack(s1012(), [['riv', 3]]))).rivStaggerAP).toBe(1);
    expect(keruMods(hero(stack(s1012(), [['riv', 2]]))).rivStaggerAP).toBe(0);
    // Dem, Cir and Mochi keep their rarity buffs.
    expect(keruMods(hero(stack(s1012(), [['cir', 1]]))).chipDamage).toBe(RARITY_VALUES.cir[1]);
  });
});

describe('upkeep', () => {
  it('costs each Keru its tier number', () => {
    const state = stack(s1012(), [['dem', 0], ['cir', 1], ['mochi', 2], ['riv', 3]]);
    expect(['dem', 'cir', 'mochi', 'riv'].map(keru => upkeepOf(state, keru as InvokeKeruId))).toEqual([1, 2, 3, 4]);
    expect(upkeepPlan(state).total).toBe(10);
  });

  it('pays oldest first and starves the ones Hero can’t pay', () => {
    const three = stack(s1012(), [['riv', 0], ['cir', 1], ['banks', 0]]);
    expect(upkeepPlan(withAP(three, 3))).toMatchObject({ paid: ['riv', 'cir'], starved: ['banks'], cost: 3 });
    // Greedy in order: a dearer Keru it can't afford doesn't stop a cheaper later one.
    expect(upkeepPlan(withAP(three, 2))).toMatchObject({ paid: ['riv', 'banks'], starved: ['cir'], cost: 2 });
    const paid = payKeruUpkeep(withAP(three, 3));
    expect(harnessOrder(paid)).toEqual(['riv', 'cir']);
    expect(hero(paid).charge).toBe(0);
    expect(hero(paid).farewellHalve).toBe(2);
    expect(paid.keruInvoke!.farewells!.slice(-1)[0]).toMatchObject({ keru: 'banks', starved: true });
  });

  it('is charged as the party turn ends', () => {
    const three = withAP(stack(s1012(), [['riv', 0], ['cir', 1], ['banks', 0]]), 3);
    const after = tutorialEnemyTurn({ ...three, turn: 'party' });
    expect(harnessOrder(after)).toEqual(['riv', 'cir']);
    expect(keruTier(after, 'banks')).toBe(0);
  });

  it('splits the AP pips into free, reserved and short', () => {
    const three = stack(s1012(), [['riv', 0], ['cir', 1], ['banks', 0]]);
    expect(upkeepPips(withAP(three, 6))).toMatchObject({ ap: 6, total: 4, free: 2, reserved: 4, short: 0, overflow: 0 });
    // Reserved is what upkeep will actually take, so a free pip can sit beside a shortfall.
    expect(upkeepPips(withAP(three, 2))).toMatchObject({ free: 0, reserved: 2, short: 2, overflow: 0 });
    const four = stack(s1012(), [['dem', 0], ['cir', 1], ['mochi', 2], ['riv', 3]]), cap = apCap(hero(four));
    const broke = upkeepPips(withAP(four, 0))!;
    expect(broke).toMatchObject({ ap: 0, free: 0, reserved: 0, short: Math.min(10, cap), overflow: Math.max(0, 10 - cap) });
    expect(upkeepPips({ ...three, keruInvoke: { ...three.keruInvoke!, upkeep: false } })).toBeNull();
  });
});

describe('dismissal', () => {
  it('is free, keeps the Keru’s tier and value, and it can be invoked again for 1 AP once its cooldown ends', () => {
    const state = withAP(stack(s1012(), [['cir', 2], ['dem', 0]]), 5);
    const value = state.keruInvoke!.values.cir;
    const gone = dismissKeru(state, 'cir');
    expect(harnessOrder(gone)).toEqual(['dem']);
    expect(hero(gone).charge).toBe(5);
    expect(keruTier(gone, 'cir')).toBe(2);
    expect(gone.keruInvoke!.values.cir).toBe(value);
    expect(dismissReason(gone, 'cir')).toBe('Not on Hero');
    const back = withAP(nextTurn(nextTurn(nextTurn(gone))), 5);
    expect(hero(invokeKeru(back, 'cir')).charge).toBe(4);
    expect(dismissReason(createCombatSandboxScenario('1007'), 'cir')).toBe('Not in this scenario');
  });
});

describe('dismissal cooldown', () => {
  /** Opens the next party turn with plenty of AP, so only the cooldown can block an invoke. */
  const turn = (state: BattleState) => withAP(nextTurn(state), 6);

  it('blocks an intentionally dismissed Keru for the rest of the turn and the next 2 party turns', () => {
    expect(KERU_DISMISS_COOLDOWN).toBe(2);
    const gone = dismissKeru(withAP(stack(s1012(), [['cir', 1]]), 6), 'cir');
    expect(invokeReason(gone, 'cir')).toBe('Back in 3 turns');
    expect(invokeKeru(gone, 'cir')).toBe(gone);
    const t1 = turn(gone), t2 = turn(t1), t3 = turn(t2);
    expect([keruCooldown(t1, 'cir'), keruCooldown(t2, 'cir'), keruCooldown(t3, 'cir')]).toEqual([2, 1, 0]);
    expect(invokeReason(t1, 'cir')).toBe('Back in 2 turns');
    expect(invokeReason(t2, 'cir')).toBe('Back in 1 turn');
    expect(invokeReason(t3, 'cir')).toBeNull();
    expect(harnessOrder(invokeKeru(t3, 'cir'))).toEqual(['cir']);
    // Other Keru are unaffected.
    expect(invokeReason(gone, 'dem')).toBeNull();
  });

  it('a Keru starved at the end of turn N is blocked for N+1 and N+2 and back on N+3', () => {
    const starved = payKeruUpkeep(withAP(stack(s1012(), [['banks', 0]]), 0));
    expect(harnessOrder(starved)).toEqual([]);
    const n1 = turn(starved), n2 = turn(n1), n3 = turn(n2);
    expect(invokeReason(n1, 'banks')).toBe('Back in 2 turns');
    expect(invokeReason(n2, 'banks')).toBe('Back in 1 turn');
    expect(invokeReason(n3, 'banks')).toBeNull();
    expect(keruCooldown(n3, 'banks')).toBe(0);
  });

  it('still lets Hero feed a cooling Keru', () => {
    const gone = dismissKeru(withAP(stack(s1012(), [['mochi', 0]]), 6), 'mochi');
    expect(feedReason(gone, 'mochi')).toBeNull();
    const fed = feedKeru(gone, 'mochi');
    expect(keruTier(fed, 'mochi')).toBe(1);
    expect(hero(fed).charge).toBe(5);
    expect(invokeReason(fed, 'mochi')).toBe('Back in 3 turns');
  });

  it('Restart clears every cooldown', () => {
    const gone = dismissKeru(dismissKeru(withAP(stack(s1012(), [['cir', 0], ['dem', 0]]), 6), 'cir'), 'dem');
    expect(keruCooldown(gone, 'cir')).toBeGreaterThan(0);
    const restarted = createPlayableSandboxScenario('1012');
    expect(restarted.keruInvoke!.cooldown).toBeUndefined();
    expect(hero(restarted).charge).toBe(0);
    expect(invokeReason(withAP(restarted, 1), 'cir')).toBeNull();
    expect(invokeReason(withAP(restarted, 1), 'dem')).toBeNull();
  });
});

describe('farewells by tier', () => {
  it('Dem heals 3 × tier and leaves a Ward for the next hit, lasting 2 enemy turns', () => {
    const on = stack(s1012(), [['dem', 1]]);
    const hurt = { ...on, party: on.party.map(a => a.id === 'hero' ? { ...a, hp: 10 } : a) };
    const gone = dismissKeru(hurt, 'dem');
    expect(hero(gone).maxHp).toBe(hero(s1012()).maxHp);
    expect(hero(gone).hp).toBe(10 + 3 * 2);
    expect(hero(gone).farewellWard).toBe(2);
    expect(absorbTempHp(hero(gone), 55).hp).toBe(hero(gone).hp);
    const one = nextTurn(gone), two = nextTurn(one);
    expect(hero(one).farewellWard).toBe(1);
    expect(hero(two).farewellWard ?? 0).toBe(0);
    expect(absorbTempHp(hero(two), 5).hp).toBe(hero(two).hp - 5);
  });

  it('Banks halves incoming damage for 2 enemy turns', () => {
    const gone = dismissKeru(stack(s1012(), [['banks', 0]]), 'banks');
    expect(guardedDamage(hero(gone), 55)).toBe(28);
    expect(guardedDamage(hero(nextTurn(gone)), 55)).toBe(28);
    expect(guardedDamage(hero(nextTurn(nextTurn(gone))), 55)).toBe(55);
  });

  it('Cir bolts the enemy for 4 × tier', () => {
    for (const tier of [0, 2]) {
      const on = stack(s1012(), [['cir', tier]]);
      const gone = dismissKeru(on, 'cir');
      expect(on.foes[0].hp - gone.foes[0].hp).toBe(4 * (tier + 1));
    }
  });

  it('Mochi adds 2 × tier stagger, blocked by the armor unless Legendary', () => {
    const rare = dismissKeru(bare(stack(s1012(), [['mochi', 1]])), 'mochi');
    expect(rare.foes[0].stagger).toBe(4);
    const epic = dismissKeru(bare(stack(s1012(), [['mochi', 2]])), 'mochi');
    expect(epic.foes[0].staggered).toBeGreaterThan(0);
    const armored = stack(s1012(), [['mochi', 2]]);
    expect(armored.foes[0].statuses?.some(s => s.id === 'duskscale')).toBe(true);
    expect(dismissKeru(armored, 'mochi').foes[0].stagger).toBe(armored.foes[0].stagger);
    const legendary = dismissKeru(stack(s1012(), [['mochi', 3]]), 'mochi');
    expect(legendary.foes[0].staggered).toBeGreaterThan(0);
  });

  it('Riv refunds tier + 1 AP', () => {
    const on = withAP(stack(s1012(), [['banks', 1], ['riv', 1]]), 2);
    expect(hero(dismissKeru(on, 'riv')).charge).toBe(2 + 3);
  });

  it('fires on starvation too', () => {
    const on = withAP(stack(s1012(), [['cir', 1]]), 0);
    const starved = payKeruUpkeep(on);
    expect(harnessOrder(starved)).toEqual([]);
    expect(on.foes[0].hp - starved.foes[0].hp).toBe(8);
  });
});

describe('reset', () => {
  it('Restart clears the Keru, tiers and farewell buffs', () => {
    const built = dismissKeru(stack(s1012(), [['banks', 2], ['dem', 1]]), 'dem');
    expect(hero(built).farewellWard).toBe(2);
    const fresh = s1012();
    expect(harnessOrder(fresh)).toEqual([]);
    expect(keruTier(fresh, 'banks')).toBe(0);
    expect(hero(fresh).farewellWard).toBeUndefined();
    expect(fresh.keruInvoke!.farewells).toEqual([]);
  });
});
