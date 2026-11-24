import { describe, expect, it } from 'vitest';
import { apCap, createCombatSandboxScenario, createPlayableSandboxScenario, type BattleState } from './battle';
import { expireEnemyTurn, weakenedHit } from './battleStatuses';
import { castKeru, castReason, feedKeru, feedReason, feedToNextTier, harnessOrder, invokeKeru, invokeReason, isExhausted, keruCooldown, keruFed, keruJumboActions as keruJumboActionList, keruTier, pourStep } from './keruInvoke';
import { FEED_COSTS, castAmount, type InvokeKeruId, type RarityTier } from './keruInvokeData';

// Keru pour (1006–1012: a held drag from Hero's AP meter, one committed pip at a time)
// and immediate casts (1006, 1012: one per Keru, free, exhausting it for the battle).

const hero = (state: BattleState) => state.party.find(actor => actor.id === 'hero')!;
const withAP = (state: BattleState, charge: number): BattleState => ({ ...state, party: state.party.map(actor => actor.id === 'hero' ? { ...actor, charge } : actor) });
const toTier = (state: BattleState, keru: InvokeKeruId, tier: number) => {
  let next = state;
  for (let i = 0; i < FEED_COSTS.slice(0, tier).reduce((a, b) => a + b, 0); i++) next = feedKeru(withAP(next, Math.max(1, hero(next).charge)), keru);
  return next;
};
const s1006 = () => createCombatSandboxScenario('1006');
const s1012 = () => createCombatSandboxScenario('1012');
const dummy = (state: BattleState) => state.foes[0];

describe('pour from Hero’s AP meter', () => {
  it('commits exactly 1 AP per pip and raises the tier mid-pour', () => {
    let state = withAP(s1006(), 6);
    const ups: boolean[] = [];
    for (let i = 0; i < 3; i++) { const step = pourStep(state, 'cir'); expect(step.stopped).toBeNull(); ups.push(step.tierUp); state = step.state; expect(hero(state).charge).toBe(6 - (i + 1)); }
    // 1 AP reaches Rare, 2 more Epic: the flourish fires on pips 1 and 3.
    expect(ups).toEqual([true, false, true]);
    expect(keruTier(state, 'cir')).toBe(2);
    expect(keruFed(state, 'cir')).toBe(0);
  });

  it('stops at 0 AP without changing the state', () => {
    let state = withAP(s1006(), 2);
    state = pourStep(pourStep(state, 'dem').state, 'dem').state;
    const stop = pourStep(state, 'dem');
    expect(stop.stopped).toBe('Needs 1 Hero AP');
    expect(stop.state).toBe(state);
    expect(hero(state).charge).toBe(0);
  });

  it('stops at Legendary after 6 AP', () => {
    let state = withAP(s1006(), 6);
    for (let i = 0; i < 6; i++) state = pourStep(withAP(state, 6), 'mochi').state;
    expect(keruTier(state, 'mochi')).toBe(3);
    expect(pourStep(withAP(state, 6), 'mochi').stopped).toBe('Already Legendary');
  });

  it('pours into 1010’s seal one pip at a time', () => {
    const state = withAP(createCombatSandboxScenario('1010'), 3), step = pourStep(state, 'seal');
    expect(step.stopped).toBeNull();
    expect(step.state.keruInvoke!.seal!.poured).toBe(1);
    expect(hero(step.state).charge).toBe(2);
  });
});

describe('jumbo feed buttons', () => {
  it('offers Feed 1 AP, and Feed to next tier when more than 1 AP is due and Hero can pay it', () => {
    const fresh = withAP(s1006(), 6);
    expect(keruJumboActionList(fresh, 'cir').map(a => a.kind)).toEqual(['one', 'cast']);
    const rare = toTier(fresh, 'cir', 1);
    expect(keruJumboActionList(withAP(rare, 5), 'cir').map(a => a.label)).toEqual(['Feed to next tier (2 AP)', 'Feed 1 AP', 'Cast Flare (12 fire)']);
    expect(keruJumboActionList(withAP(rare, 1), 'cir').map(a => a.kind)).toEqual(['one', 'cast']);
    const legendary = toTier(fresh, 'cir', 3);
    expect(keruJumboActionList(legendary, 'cir').map(a => a.kind)).toEqual(['cast']);
    // No casts outside 1006 and 1012.
    expect(keruJumboActionList(withAP(createCombatSandboxScenario('1007'), 3), 'cir').map(a => a.kind)).toEqual(['one']);
  });

  it('Feed to next tier spends exactly what the tier needs', () => {
    const rare = withAP(toTier(s1006(), 'dem', 1), 5), epic = feedToNextTier(rare, 'dem');
    expect(keruTier(epic, 'dem')).toBe(2);
    expect(hero(epic).charge).toBe(3);
    expect(keruFed(epic, 'dem')).toBe(0);
  });
});

describe('immediate casts scale with tier', () => {
  const tiers: RarityTier[] = [0, 1, 2, 3];
  it('Surge gives the ally 2n AP, up to the cap', () => {
    for (const tier of tiers) {
      const state = withAP(toTier(s1006(), 'riv', tier), 0), cast = castKeru(state, 'riv', 'hero');
      expect(hero(cast).charge).toBe(Math.min(apCap(hero(cast)), 2 * (tier + 1)));
    }
  });
  it('Mend heals the ally 6n', () => {
    for (const tier of tiers) {
      const base = toTier(s1006(), 'dem', tier), state = { ...base, party: base.party.map(actor => actor.id === 'hero' ? { ...actor, hp: 1 } : actor) };
      expect(hero(castKeru(state, 'dem', 'hero')).hp).toBe(Math.min(hero(state).maxHp, 1 + 6 * (tier + 1)));
    }
  });
  it('Flare deals 6n fire to the enemy', () => {
    for (const tier of tiers) { const state = toTier(s1006(), 'cir', tier); expect(dummy(castKeru(state, 'cir', dummy(state).id)).hp).toBe(dummy(state).hp - 6 * (tier + 1)); }
  });
  it('Pounce adds 3n stagger; only a Legendary gets through Duskscale Armor', () => {
    const common = s1006(), hit = castKeru(common, 'mochi', dummy(common).id);
    expect(dummy(hit).stagger).toBe(3);
    const rare = toTier(s1006(), 'mochi', 1), broke = castKeru(rare, 'mochi', dummy(rare).id);
    expect(dummy(broke).staggerStage).toBe(1);
    const armored = toTier(s1012(), 'mochi', 2);
    expect(dummy(armored).statuses?.some(s => s.id === 'duskscale')).toBe(true);
    expect(dummy(castKeru(armored, 'mochi', dummy(armored).id)).stagger).toBe(0);
    const legendary = toTier(s1012(), 'mochi', 3);
    const pierced = dummy(castKeru(legendary, 'mochi', dummy(legendary).id));
    expect(castAmount('mochi', 3)).toBe(12);
    expect(pierced.stagger > 0 || (pierced.staggerStage ?? 0) > 0).toBe(true);
  });
  it('Hex Weakens the enemy for n enemy turns, halving its hits', () => {
    for (const tier of tiers) {
      const state = toTier(s1012(), 'banks', tier), cast = castKeru(state, 'banks', dummy(state).id);
      expect(dummy(cast).statuses?.find(s => s.id === 'weakened')?.turns).toBe(tier + 1);
    }
    const rare = toTier(s1012(), 'banks', 1), hexed = castKeru(rare, 'banks', dummy(rare).id);
    expect(weakenedHit(dummy(hexed), 55)).toBe(28);
    const once = expireEnemyTurn(hexed), twice = expireEnemyTurn(once);
    expect(dummy(once).statuses?.find(s => s.id === 'weakened')?.turns).toBe(1);
    expect(dummy(twice).statuses?.some(s => s.id === 'weakened')).toBe(false);
    expect(weakenedHit(dummy(twice), 55)).toBe(55);
  });
  it('needs the right kind of target and costs no AP', () => {
    const state = withAP(s1006(), 2);
    expect(castReason(state, 'riv', dummy(state).id)).toBe('Choose an ally');
    expect(castReason(state, 'cir', 'hero')).toBe('Choose an enemy');
    expect(castKeru(state, 'riv', dummy(state).id)).toBe(state);
    expect(hero(castKeru(state, 'cir', dummy(state).id)).charge).toBe(2);
  });
  it('is only in 1006 and 1012', () => {
    expect(castReason(createCombatSandboxScenario('1007'), 'cir')).toBe('Not in this scenario');
    expect(castReason(s1012(), 'cir')).toBeNull();
  });
});

describe('a cast exhausts the Keru for the battle', () => {
  it('blocks invoke, feed and a second cast', () => {
    const state = withAP(s1006(), 6), cast = castKeru(state, 'cir', dummy(state).id);
    expect(isExhausted(cast, 'cir')).toBe(true);
    expect(invokeReason(cast, 'cir')).toBe('Exhausted');
    expect(feedReason(cast, 'cir')).toBe('Exhausted');
    expect(castReason(cast, 'cir')).toBe('Exhausted');
    expect(pourStep(cast, 'cir').stopped).toBe('Exhausted');
    expect(keruJumboActionList(cast, 'cir')).toEqual([]);
    expect(invokeKeru(cast, 'cir')).toBe(cast);
    // The other Keru are untouched.
    expect(castReason(cast, 'dem')).toBeNull();
  });

  it('cast from a Hero square leaves her without a farewell or cooldown, and its buff goes', () => {
    const base = withAP(s1012(), 6), banked = invokeKeru(base, 'banks');
    expect(harnessOrder(banked)).toEqual(['banks']);
    const capped = apCap(hero(banked));
    const cast = castKeru(banked, 'banks', dummy(banked).id);
    expect(harnessOrder(cast)).toEqual([]);
    expect(hero(cast).harness).toEqual({});
    expect(apCap(hero(cast))).toBeLessThan(capped);
    expect(keruCooldown(cast, 'banks')).toBe(0);
    expect(cast.keruInvoke!.farewells).toEqual([]);
    expect(hero(cast).farewellHalve ?? 0).toBe(0);
    expect(isExhausted(cast, 'banks')).toBe(true);
  });

  it('Restart clears the exhaust', () => {
    const state = s1006(), cast = castKeru(state, 'dem', 'hero');
    expect(isExhausted(cast, 'dem')).toBe(true);
    const restarted = createPlayableSandboxScenario('1006');
    expect(isExhausted(restarted, 'dem')).toBe(false);
    expect(restarted.keruInvoke!.exhausted).toEqual({});
  });
});
