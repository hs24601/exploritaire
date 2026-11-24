import { describe, expect, it } from 'vitest';
import { apCap, createCombatSandboxScenario, defaultStrike, receiveCard, returnPlayerTurn, type BattleState } from './battle';
import { tutorialById } from './battleTutorialScenarios';
import { tutorialEnemyTurn } from './battleTutorials';
import { feedKeru, feedReason, invokeCost, invokeKeru, keruTier, pourIntoSeal, pourReason, wardenAfterTurn, SEAL_STEP, WARDEN_TITHE } from './keruInvoke';
import { FEED_COSTS, RARITY_VALUES, guardedDamage, keruMods, type InvokeKeruId } from './keruInvokeData';
import { absorbTempHp } from './cirCompanion';
import { breathTurn, chokeIfBroken } from './battleDeadRun';

const hero = (state: BattleState) => state.party.find(actor => actor.id === 'hero')!;
const withAP = (state: BattleState, charge: number): BattleState => ({ ...state, party: state.party.map(actor => actor.id === 'hero' ? { ...actor, charge } : actor) });
/** Feeds `n` AP, topping Hero up so AP is never the limit. */
const feed = (state: BattleState, keru: InvokeKeruId, n: number) => { let next = state; for (let i = 0; i < n; i++) next = feedKeru(withAP(next, Math.max(1, hero(next).charge)), keru); return next; };
const toTier = (state: BattleState, keru: InvokeKeruId, tier: number) => feed(state, keru, FEED_COSTS.slice(0, tier).reduce((a, b) => a + b, 0));
const scenario = (id: '1006' | '1007' | '1008' | '1009' | '1010') => createCombatSandboxScenario(id);
const noStatuses = (state: BattleState): BattleState => ({ ...state, foes: state.foes.map(foe => ({ ...foe, statuses: [] })) });

describe('rarity tiers and feeding', () => {
  it('needs 1, then 2, then 3 AP to reach Rare, Epic and Legendary', () => {
    let state = scenario('1006');
    expect(FEED_COSTS).toEqual([1, 2, 3]);
    expect(keruTier(state, 'cir')).toBe(0);
    state = feed(state, 'cir', 1); expect(keruTier(state, 'cir')).toBe(1);
    state = feed(state, 'cir', 1); expect(keruTier(state, 'cir')).toBe(1); expect(state.keruInvoke!.fed!.cir).toBe(1);
    state = feed(state, 'cir', 1); expect(keruTier(state, 'cir')).toBe(2);
    state = feed(state, 'cir', 3); expect(keruTier(state, 'cir')).toBe(3);
    expect(feedReason(state, 'cir')).toBe('Already Legendary');
  });

  it('spends 1 Hero AP per feed and refuses without AP or off-turn', () => {
    const state = withAP(scenario('1007'), 2);
    const fed = feedKeru(state, 'dem');
    expect(hero(fed).charge).toBe(1);
    expect(feedKeru(withAP(state, 0), 'dem')).toEqual(withAP(state, 0));
    expect(feedReason({ ...state, turn: 'enemy' }, 'dem')).toBe('Player turn required');
    expect(feedReason(createCombatSandboxScenario('1005'), 'dem')).toBe('Not in this scenario');
  });

  it('keeps a Keru’s tier when it is swapped off Hero', () => {
    let state = toTier(withAP(scenario('1006'), 6), 'banks', 2);
    state = invokeKeru(withAP(state, 6), 'banks');
    expect(hero(state).harness).toEqual({ banks: 2 });
    state = invokeKeru(withAP(state, 6), 'cir');
    expect(hero(state).harness).toEqual({ cir: 0 });
    expect(keruTier(state, 'banks')).toBe(2);
    state = invokeKeru(withAP(state, 6), 'banks');
    expect(hero(state).harness).toEqual({ banks: 2 });
  });

  it('upgrades Hero’s buff live when the Keru on her is fed', () => {
    let state = invokeKeru(withAP(scenario('1006'), 6), 'dem');
    const base = hero(scenario('1006')).maxHp;
    expect(hero(state).maxHp).toBe(base + 4);
    state = feed(state, 'dem', 1);
    expect(hero(state).maxHp).toBe(base + 8);
    expect(hero(state).hp).toBe(base + 8);
  });

  it('resets on a new battle and on Restart', () => {
    const fed = toTier(scenario('1006'), 'riv', 3);
    expect(keruTier(fed, 'riv')).toBe(3);
    expect(keruTier(scenario('1006'), 'riv')).toBe(0);
    expect(scenario('1006').keruInvoke!.fed!.riv).toBe(0);
  });

  it('costs a flat 1 AP per invoke, with no free first invoke', () => {
    const state = withAP(scenario('1007'), 3);
    expect(invokeCost(state)).toBe(1);
    const first = invokeKeru(state, 'cir');
    expect(hero(first).charge).toBe(2);
    expect(invokeCost(first)).toBe(1);
    expect(invokeCost(createCombatSandboxScenario('1005'))).toBe(0);
  });
});

describe('tier buffs', () => {
  const atTier = (keru: InvokeKeruId, tier: number) => { const state = toTier(withAP(scenario('1006'), 6), keru, tier); return invokeKeru(withAP(state, 6), keru); };
  it('scales Dem HP, Banks guard, Cir damage, Mochi stagger and Riv generation by tier', () => {
    for (const tier of [0, 1, 2, 3]) {
      const t = tier as 0 | 1 | 2 | 3;
      expect(keruMods(hero(atTier('dem', tier))).maxHp).toBe(RARITY_VALUES.dem[t]);
      expect(keruMods(hero(atTier('banks', tier))).guard).toBe(RARITY_VALUES.banks[t]);
      expect(keruMods(hero(atTier('cir', tier))).chipDamage).toBe(RARITY_VALUES.cir[t]);
      expect(keruMods(hero(atTier('mochi', tier))).chipStagger).toBe(RARITY_VALUES.mochi[t]);
      expect(keruMods(hero(atTier('riv', tier))).rivEvery).toBe(RARITY_VALUES.riv[t]);
    }
    expect([4, 8, 12]).toEqual(RARITY_VALUES.dem.slice(0, 3));
    expect(apCap(hero(atTier('riv', 3)))).toBe(apCap(hero(scenario('1006'))) + 1);
    expect(keruMods(hero(atTier('cir', 3))).chipFire).toBe(1);
  });

  it('Legendary Banks halves the breath, guards 8 and reflects a quarter of what it stops', () => {
    const banks = hero(atTier('banks', 3));
    expect(guardedDamage(banks, 55)).toBe(20);
    expect(guardedDamage(hero(atTier('banks', 2)), 55)).toBe(47);
  });

  it('Legendary Dem’s Ward absorbs one enemy hit, once per battle', () => {
    let state = atTier('dem', 3);
    expect(hero(state).keruWard).toBe(true);
    const hit = absorbTempHp(hero(state), 55);
    expect(hit.hp).toBe(hero(state).hp);
    expect(hit.keruWard).toBe(false);
    expect(absorbTempHp(hit, 5).hp).toBe(hit.hp - 5);
    // Swapping Dem off and back does not grant a second Ward.
    state = { ...state, party: state.party.map(a => a.id === 'hero' ? hit : a) };
    state = invokeKeru(withAP(invokeKeru(withAP(state, 6), 'cir'), 6), 'dem');
    expect(hero(state).keruWard).toBeFalsy();
  });

  it('Riv banks a bonus AP every few chip hits', () => {
    const state = noStatuses(withAP(atTier('riv', 2), 0)); // every 2 hits
    const one = defaultStrike(state, 'hero');
    expect(hero(one).charge).toBe(0);
    const two = defaultStrike(one, 'hero');
    expect(hero(two).charge).toBe(1);
  });

  it('Legendary Mochi’s stagger ignores Duskscale Armor and Deep Breath, and breaking it backfires the breath', () => {
    let state = scenario('1009');
    expect(state.foes[0].statuses?.some(s => s.id === 'deep-breath')).toBe(true);
    const plain = defaultStrike(state, 'hero');
    expect(plain.foes[0].stagger).toBe(state.foes[0].stagger);
    const epic = defaultStrike(atTierOn(state, 'mochi', 2), 'hero');
    expect(epic.foes[0].stagger).toBe(state.foes[0].stagger);
    state = atTierOn(state, 'mochi', 3);
    const once = defaultStrike(state, 'hero');
    expect(once.foes[0].stagger).toBe(3);
    const broken = defaultStrike(once, 'hero');
    expect(broken.foes[0].staggered).toBeGreaterThan(0);
    const backfired = chokeIfBroken(broken);
    expect(backfired.tutorial!.breath).toBe('choked');
    expect(backfired.foes[0].hp).toBeLessThan(broken.foes[0].hp);
  });
});

function atTierOn(state: BattleState, keru: InvokeKeruId, tier: number) { return invokeKeru(withAP(toTier(withAP(state, 6), keru, tier), 6), keru); }

describe('rarity scenarios', () => {
  it('1006 Rarity Showcase: harmless dummy, 6 AP that refills each turn', () => {
    const state = scenario('1006');
    expect(tutorialById('1006')?.name).toBe('1006: Rarity Showcase');
    expect(state.foes[0].name).toBe('Training Dummy');
    expect(state.foes[0].profile.damage).toBe(0);
    expect(state.tutorial!.intent).toBeUndefined();
    expect(hero(state).charge).toBe(6);
    const spent = returnPlayerTurn({ ...withAP(state, 0), turn: 'enemy' });
    expect(hero(spent).charge).toBe(apCap(hero(spent)));
  });

  it('1007 Opening Pull: Dusk Dragon behind its armor, Hero with 3 AP', () => {
    const state = scenario('1007');
    expect(state.foes[0].name).toBe('Dusk Dragon');
    expect(state.tutorial!.breath).toBe('armored');
    expect(hero(state).charge).toBe(3);
    expect(state.keruInvoke!.cost).toBe(1);
  });

  it('1008 Brace for Deep Breath: full charge that lands on the third enemy turn', () => {
    const state = scenario('1008');
    expect(state.tutorial!.breath).toBe('charging');
    expect(state.tutorial!.intent!.pips).toBe(4);
    expect(hero(state).charge).toBe(2);
    let next = tutorialEnemyTurn({ ...state, turn: 'party' });
    expect(next.tutorial!.breath).toBe('readied');
    next = tutorialEnemyTurn(next);
    expect(next.tutorial!.breath).toBe('inhaled');
    const hp = hero(next).hp;
    next = tutorialEnemyTurn(next);
    expect(hero(next).hp).toBeLessThan(hp);
  });

  it('1008: a Legendary Dem’s Ward or Legendary Banks lets Hero survive the breath', () => {
    const inhaled = (s: BattleState): BattleState => ({ ...s, tutorial: { ...s.tutorial!, breath: 'inhaled' } });
    const dem = breathTurn(inhaled(atTierOn(scenario('1008'), 'dem', 3))).state;
    expect(hero(dem).hp).toBe(hero(atTierOn(scenario('1008'), 'dem', 3)).hp);
    const banksStart = atTierOn(scenario('1008'), 'banks', 3), banks = breathTurn(inhaled(banksStart)).state;
    expect(hero(banks).hp).toBe(hero(banksStart).hp - 20);
    expect(banks.foes[0].hp).toBe(banksStart.foes[0].hp - Math.round(35 * 0.25));
  });

  it('1009 Break the Dragon: the dragon opens charging, Hero with 4 AP', () => {
    const state = scenario('1009');
    expect(state.tutorial!.breath).toBe('charging');
    expect(state.tutorial!.intent!.pips).toBe(0);
    expect(hero(state).charge).toBe(4);
  });

  it('keeps 1005 on its free-first untiered invoke', () => {
    const state = createCombatSandboxScenario('1005');
    expect(state.keruInvoke!.tiers).toBeUndefined();
    expect(hero(invokeKeru(state, 'riv')).harness).toBeUndefined();
    expect(apCap(hero(invokeKeru(state, 'riv')))).toBe(apCap(hero(state)) + 1);
  });
});

describe('1010 AP Engine', () => {
  it('opens against the sealed Vault Warden with 3 AP and a 12 AP seal', () => {
    const state = scenario('1010');
    expect(state.foes[0].name).toBe('Vault Warden');
    expect(hero(state).charge).toBe(3);
    expect(state.keruInvoke!.seal).toMatchObject({ poured: 0, threshold: 12, stunned: 0 });
    expect(state.keruInvoke!.slots).toBe(3);
  });

  it('takes no chip damage while sealed', () => {
    const state = scenario('1010');
    expect(defaultStrike(state, 'hero').foes[0].hp).toBe(state.foes[0].hp);
  });

  it('breaks at the threshold within one turn: stun, double damage, then reseal 4 higher', () => {
    let state = scenario('1010');
    for (let i = 0; i < 11; i++) state = pourIntoSeal(withAP(state, 1));
    expect(state.keruInvoke!.seal!.poured).toBe(11);
    state = pourIntoSeal(withAP(state, 1));
    expect(state.keruInvoke!.seal).toMatchObject({ stunned: 2, breaks: 1 });
    expect(pourReason(state)).toBe('The seal is already broken');
    const hp = state.foes[0].hp;
    expect(hp - defaultStrike(state, 'hero').foes[0].hp).toBe(2);
    state = wardenAfterTurn(state, state.foes[0].id);
    expect(state.keruInvoke!.seal!.stunned).toBe(1);
    state = wardenAfterTurn(state, state.foes[0].id);
    expect(state.keruInvoke!.seal).toMatchObject({ stunned: 0, threshold: 12 + SEAL_STEP });
  });

  it('loses a short pour when the party turn ends', () => {
    let state = scenario('1010');
    for (let i = 0; i < 5; i++) state = pourIntoSeal(withAP(state, 1));
    expect(state.keruInvoke!.seal!.poured).toBe(5);
    const next = returnPlayerTurn({ ...state, turn: 'enemy' });
    expect(next.keruInvoke!.seal!.poured).toBe(0);
  });

  it('Tithe drains 2 Hero AP and the strike grows each enemy turn', () => {
    const state = withAP(scenario('1010'), 5), damage = state.foes[0].profile.damage;
    const next = wardenAfterTurn(state, state.foes[0].id);
    expect(hero(next).charge).toBe(5 - WARDEN_TITHE);
    expect(next.foes[0].profile.damage).toBe(damage + 1);
  });

  it('the harness holds three Keru and a fourth replaces the oldest', () => {
    let state = scenario('1010');
    for (const keru of ['banks', 'riv', 'cir'] as const) state = invokeKeru(withAP(state, 6), keru);
    expect(Object.keys(hero(state).harness!)).toEqual(['banks', 'riv', 'cir']);
    state = invokeKeru(withAP(state, 6), 'dem');
    expect(Object.keys(hero(state).harness!)).toEqual(['riv', 'cir', 'dem']);
    expect(state.keruInvoke!.order).toEqual(['riv', 'cir', 'dem']);
    expect(hero(state).invokedKeru).toBe('dem');
  });

  it('engine buffs per tier: Riv generator, Banks capacitor, Cir multiplier and refund', () => {
    const engine = (keru: InvokeKeruId, tier: number) => hero(atTierOn(scenario('1010'), keru, tier));
    const base = apCap(hero(scenario('1010')));
    expect([0, 1, 2, 3].map(t => keruMods(engine('riv', t)).rivEvery)).toEqual([4, 3, 2, 1]);
    expect([0, 1, 2, 3].map(t => apCap(engine('banks', t)) - base)).toEqual([2, 4, 6, 8]);
    expect([0, 1, 2, 3].map(t => keruMods(engine('cir', t)).apMultiplier)).toEqual([1, 1, 2, 2]);
    expect(keruMods(engine('cir', 3)).pourRefund).toBe(true);
    // Cir ×2: one received card banks 2 AP.
    const cir = noStatuses(withAP(atTierOn(scenario('1010'), 'cir', 2), 0));
    const column = cir.columns.findIndex(col => col.length);
    const received = receiveCard(cir, 'hero', { card: cir.columns[column][cir.columns[column].length - 1], columns: cir.columns, stock: cir.stock, dealt: cir.dealt });
    expect(hero(received).charge).toBe(2);
    // Legendary Cir refunds 1 AP for every 4 poured.
    let pour = withAP(atTierOn(scenario('1010'), 'cir', 3), 4);
    for (let i = 0; i < 4; i++) pour = pourIntoSeal(pour);
    expect(hero(pour).charge).toBe(1);
  });
});
