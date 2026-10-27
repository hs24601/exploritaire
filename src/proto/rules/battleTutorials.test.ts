import { describe, expect, it } from 'vitest';
import { canPlay, canUseMomentumSkill, createCombatSandboxScenario, eligibleActors, endPlayerTurn, playCard, useMomentumSkill, withdrawPlayer, type BattleState } from './battle';
import { hasStatus, statusOf } from './battleStatuses';
import { tutorialIntent, tutorialRounds, upcomingRefills } from './battleTutorials';
import { barkDamage, foeMomentumGain } from './battleStatuses';
import { AP_CAP, RAGE_AP_CAP, rageBonus } from './battle';
import { TUTORIAL_SCENARIOS, type TutorialScenarioId } from './battleTutorialScenarios';
import { STATUS_SKILLS } from './battleStatusData';

const wrap = (rank: number) => ((rank - 1) % 13 + 13) % 13 + 1;
/** Puts a card one above the actor's value on column 0 and plays it there. */
const feed = (state: BattleState, actorId: string): BattleState => {
  const actor = state.party.find(unit => unit.id === actorId)!;
  const columns = state.columns.map((cards, i) => i === 0 ? [...cards.slice(0, -1), { id: `test-${state.nextEventId}-${state.dealt}-${actorId}`, rank: wrap(actor.rank + 1) }] : cards);
  const next = playCard({ ...state, columns }, 0, actorId);
  expect(next).not.toBe(state);
  return next;
};
/** Banks AP on every Kin (and the same shared Momentum) so ability cards are affordable. */
const rich = (state: BattleState, value = 40): BattleState => ({ ...state, momentum: { ...state.momentum!, value, decayEnabled: false }, party: state.party.map(actor => ({ ...actor, charge: value })) });
const ap = (state: BattleState, id: string) => state.party.find(actor => actor.id === id)!.charge;
const foe = (state: BattleState, index = 0) => state.foes[index];
const create = (id: TutorialScenarioId) => createCombatSandboxScenario(id);

describe('tutorial scenarios', () => {
  it('each scenario starts on the party turn with notes, a legal opening and its own hand', () => {
    for (const def of TUTORIAL_SCENARIOS) {
      const state = create(def.id);
      expect(state.tutorial?.id).toBe(def.id);
      expect(state.turn).toBe('party');
      // 018 opens locked on purpose (Focus Fire is the way in); random-deal ranges may open dead, which the pity flip covers.
      if (def.id !== '018' && !def.randomSeed) expect(state.columns.some(cards => eligibleActors(state, cards[cards.length - 1]).length > 0)).toBe(true);
      expect(state.foes.map(unit => unit.name)).toEqual(def.foes.map(entry => entry.name));
      for (const id of def.skills) expect(canUseMomentumSkill(rich(state), id as never)).toBe(true);
      for (const insight of [def.insight.intent, def.insight.solve, def.insight.why]) expect(insight.length).toBeGreaterThan(0);
    }
  });
  it('the playground offers every ability and starts with banked Momentum and no decay', () => {
    const state = create('009');
    expect(state.momentum).toMatchObject({ value: 30, decayEnabled: false });
    expect(state.party.every(actor => actor.maxHp === 40)).toBe(true);
    for (const id of Object.keys(STATUS_SKILLS)) expect(canUseMomentumSkill(state, id as never)).toBe(true);
  });
  it('restricts abilities to the scenario hand', () => {
    expect(canUseMomentumSkill(rich(create('008')), 'bash')).toBe(false);
    expect(canUseMomentumSkill(rich(create('008')), 'haste')).toBe(false);
    expect(canUseMomentumSkill(rich(create('011')), 'haste')).toBe(false);
    expect(canUseMomentumSkill(rich(create('011')), 'frost-fang')).toBe(true);
  });
});

describe('chip tutorial', () => {
  it('Nip chips HP without stagger; Scratch staggers without damage; stagger doubles Nip', () => {
    let state = create('008');
    state = feed(state, 'hero');
    expect(foe(state)).toMatchObject({ hp: 5, stagger: 0 });
    for (let i = 0; i < 3; i++) state = feed(state, 'mochi');
    expect(foe(state)).toMatchObject({ hp: 5, stagger: 4.5, staggered: 0 });
    state = feed(state, 'mochi');
    expect(foe(state).staggered).toBeGreaterThan(0);
    state = feed(state, 'hero');
    expect(foe(state).hp).toBe(3);
  });
  it('backfills a tougher foe immediately and counts rounds completed', () => {
    let state = create('008');
    expect(tutorialRounds(state)).toBe(0);
    state = { ...state, foes: state.foes.map(unit => ({ ...unit, hp: 1 })) };
    state = feed(state, 'hero');
    expect(state.result).toBeNull();
    expect(tutorialRounds(state)).toBe(1);
    expect(foe(state)).toMatchObject({ id: 'training-root-2', hp: 8, profile: { maxHp: 8, damage: 2, staggerMax: 6 } });
    expect(state.party.every(actor => actor.targetId === 'training-root-2')).toBe(true);
    for (let wave = 3; wave <= 5; wave++) { state = { ...state, foes: state.foes.map(unit => ({ ...unit, hp: 1 })) }; state = feed(state, 'hero'); }
    expect(tutorialRounds(state)).toBe(4);
    expect(foe(state)).toMatchObject({ hp: 14, profile: { damage: 3, staggerMax: 8 } });
  });
  it('a party loss keeps the rounds reached', () => {
    let state = create('008');
    state = { ...state, tutorial: { ...state.tutorial!, cleared: 3 }, party: state.party.map(actor => ({ ...actor, hp: 1, charge: actor.id === 'hero' ? 1 : 0 })) };
    state = endPlayerTurn(state);
    state = endPlayerTurn(state);
    expect(state.result).toBe('lost');
    expect(tutorialRounds(state)).toBe(3);
  });
  it('the foe strikes every enemy turn and skips while staggered', () => {
    let state = create('008');
    state = endPlayerTurn(state);
    expect(state.turn).toBe('party');
    expect(state.party.find(actor => actor.id === 'hero')!.hp).toBe(10);
    state = { ...state, foes: state.foes.map(unit => ({ ...unit, staggered: 20, stagger: 0, staggerStage: 1 })) };
    const after = endPlayerTurn(state);
    expect(after.party.map(actor => actor.hp)).toEqual(state.party.map(actor => actor.hp));
    expect(foe(after).staggered).toBe(0);
  });
});

describe('tempo statuses', () => {
  it('Haste costs Mochi 2 AP; the next 4 cards on that foundation earn double AP and Momentum, this turn only', () => {
    let state = useMomentumSkill({ ...rich(create('010'), 0), party: create('010').party.map(actor => ({ ...actor, charge: actor.id === 'mochi' ? 2 : 0 })) }, 'haste', 'hero');
    expect(ap(state, 'mochi')).toBe(0);
    expect(statusOf(state.party[0], 'haste')?.stacks).toBe(4);
    state = feed(state, 'hero');
    expect(ap(state, 'hero')).toBe(2);
    expect(state.momentum!.value).toBe(2);
    state = feed(state, 'mochi');
    expect(ap(state, 'mochi')).toBe(1);
    expect(state.momentum!.value).toBe(3);
    for (let i = 0; i < 3; i++) state = feed(state, 'hero');
    expect(ap(state, 'hero')).toBe(6);
    expect(state.momentum!.value).toBe(9);
    expect(hasStatus(state.party[0], 'haste')).toBe(false);
    const handoff = endPlayerTurn(useMomentumSkill(rich(create('010'), 3), 'haste', 'hero'));
    expect(hasStatus(handoff.party[0], 'haste')).toBe(false);
  });
  it('enemies bank 2 Momentum per turn and spend 4 on a double-damage Heavy Strike', () => {
    let state = { ...create('008'), party: create('008').party.map(actor => ({ ...actor, charge: actor.id === 'hero' ? 5 : 0 })) };
    expect(foe(state).momentum).toBe(0);
    expect(tutorialIntent(foe(state), 'Hero')).toMatchObject({ heavy: false, summary: 'Hero' });
    state = endPlayerTurn(state);
    expect(foe(state).momentum).toBe(2);
    expect(state.party[0].hp).toBe(10);
    expect(tutorialIntent(foe(state), 'Hero')).toMatchObject({ heavy: true, summary: 'Heavy · Hero' });
    state = endPlayerTurn(state);
    expect(foe(state).momentum).toBe(0);
    expect(state.party[0].hp).toBe(6);
    expect(state.events.some(event => event.label === 'Training Khad Root · Heavy Strike' && event.amount === 4)).toBe(true);
  });
  it('a Hasted enemy banks double; Slow halves its gain, rounded down; both together cancel', () => {
    let state = create('010');
    expect(foeMomentumGain(foe(state))).toBe(4);
    expect(tutorialIntent(foe(state), 'Hero')?.heavy).toBe(true);
    state = useMomentumSkill(rich(state, 2), 'mire', 'sap-root');
    expect(foeMomentumGain(foe(state))).toBe(2);
    state = endPlayerTurn(state);
    expect(foe(state).momentum).toBe(2);
    const plain = { ...foe(create('008')), statuses: [{ id: 'slow' as const, turns: 2 }] };
    expect(foeMomentumGain(plain)).toBe(1);
    expect(foeMomentumGain({ ...plain, statuses: [{ id: 'chill' as const, stacks: 2 }] })).toBe(0);
  });
  it('Slow on a Kin halves the Momentum its receipts earn', () => {
    let state = { ...create('009'), party: create('009').party.map(actor => actor.id === 'hero' ? { ...actor, statuses: [{ id: 'slow' as const, turns: 1 }] } : actor) };
    const before = state.momentum!.value;
    state = feed(state, 'hero');
    expect(state.momentum!.value).toBe(before + 0.5);
    state = endPlayerTurn({ ...state, foes: state.foes.map(unit => ({ ...unit, inflicts: undefined })) });
    expect(hasStatus(state.party[0], 'slow')).toBe(false);
  });
  it('enemy Haste wears off after its turns', () => {
    let state = create('010');
    for (let turn = 0; turn < 3; turn++) state = endPlayerTurn({ ...state, party: state.party.map(actor => ({ ...actor, hp: 99 })) });
    expect(hasStatus(foe(state), 'haste')).toBe(false);
  });
  it('Sap forbids two receipts in a row on the struck foundation for two party turns', () => {
    let state = { ...create('010'), party: create('010').party.map(actor => ({ ...actor, charge: actor.id === 'mochi' ? 5 : 0 })) };
    state = endPlayerTurn(state);
    const mochi = state.party.find(actor => actor.id === 'mochi')!;
    expect(statusOf(mochi, 'sap')?.turns).toBe(2);
    state = feed(state, 'mochi');
    const card = { id: 'next', rank: wrap(state.party.find(actor => actor.id === 'mochi')!.rank + 1) };
    expect(canPlay(state, 'mochi', card)).toBe(false);
    state = feed(state, 'hero');
    expect(canPlay(state, 'mochi', card)).toBe(true);
    state = endPlayerTurn(endPlayerTurn({ ...state, foes: state.foes.map(unit => ({ ...unit, inflicts: undefined })) }));
    expect(hasStatus(state.party.find(actor => actor.id === 'mochi'), 'sap')).toBe(false);
  });
});

describe('frost and shatter', () => {
  it('Frost Fang chills and Rime adds Chill per Hero hit; three stacks freeze; Frozen skips a turn', () => {
    let state = useMomentumSkill(rich(create('011')), 'frost-fang', 'frostbound-root');
    expect(statusOf(foe(state), 'chill')?.stacks).toBe(1);
    expect(foe(state).hp).toBe(23);
    state = feed(state, 'hero');
    expect(statusOf(foe(state), 'chill')?.stacks).toBe(2);
    expect(foeMomentumGain(foe(state))).toBe(0);
    state = feed(state, 'hero');
    expect(hasStatus(foe(state), 'frozen')).toBe(true);
    const hp = state.party.map(actor => actor.hp);
    state = endPlayerTurn(state);
    expect(state.party.map(actor => actor.hp)).toEqual(hp);
    expect(hasStatus(foe(state), 'frozen')).toBe(false);
    expect(hasStatus(state.party[0], 'rime')).toBe(false);
  });
  it('Chill thaws one stack per enemy turn and costs 1 enemy Momentum gain per stack', () => {
    let state = useMomentumSkill(rich(create('011')), 'frost-fang', 'frostbound-root');
    state = endPlayerTurn(state);
    expect(hasStatus(foe(state), 'chill')).toBe(false);
    expect(foe(state).momentum).toBe(1);
  });
  it('Takedown on a Frozen foe Shatters it: double damage and a full gauge; otherwise it stuns', () => {
    let state = useMomentumSkill(rich(create('011')), 'puddle-pounce', 'frostbound-root');
    state = useMomentumSkill(state, 'frost-fang', 'frostbound-root');
    expect(hasStatus(foe(state), 'frozen')).toBe(true);
    state = useMomentumSkill(state, 'takedown', 'frostbound-root');
    expect(foe(state).hp).toBe(23 - 4);
    expect(foe(state).staggered).toBeGreaterThan(0);
    expect(hasStatus(foe(state), 'frozen')).toBe(false);
    const stunned = useMomentumSkill(rich(create('011')), 'takedown', 'frostbound-root');
    expect(foe(stunned).hp).toBe(22);
    expect(hasStatus(foe(stunned), 'stun')).toBe(true);
    const hp = stunned.party.map(actor => actor.hp);
    expect(endPlayerTurn(stunned).party.map(actor => actor.hp)).toEqual(hp);
  });
  it('Soaking a Chilled foe also freezes it', () => {
    let state = useMomentumSkill(rich(create('011')), 'frost-fang', 'frostbound-root');
    state = useMomentumSkill(state, 'puddle-pounce', 'frostbound-root');
    expect(hasStatus(foe(state), 'frozen')).toBe(true);
    expect(hasStatus(foe(state), 'soaked')).toBe(false);
  });
});

describe('water, shock and fire reactions', () => {
  it('Thunder Bark conducts to every other Soaked foe only', () => {
    let state = rich(create('012'));
    state = useMomentumSkill(state, 'puddle-pounce', 'bramble-rootling');
    state = useMomentumSkill(state, 'puddle-pounce', 'thorn-rootling');
    state = useMomentumSkill(state, 'thunder-bark', 'bramble-rootling');
    expect(state.foes.map(unit => unit.hp)).toEqual([6, 6, 8]);
    const dry = useMomentumSkill(rich(create('012')), 'thunder-bark', 'bramble-rootling');
    expect(dry.foes.map(unit => unit.hp)).toEqual([6, 8, 8]);
  });
  it('Soaked lasts two enemy turns', () => {
    let state = useMomentumSkill(rich(create('012')), 'puddle-pounce', 'briar-rootling');
    state = endPlayerTurn(state);
    expect(statusOf(state.foes[2], 'soaked')?.turns).toBe(1);
    state = endPlayerTurn(state);
    expect(hasStatus(state.foes[2], 'soaked')).toBe(false);
  });
  it('fire on a Soaked foe makes Steam: Blinded, no Burn; Blind can make its strike miss', () => {
    let state = useMomentumSkill(rich(create('013')), 'puddle-pounce', 'thornlash-root');
    state = useMomentumSkill(state, 'ember-swipe', 'thornlash-root');
    expect(hasStatus(foe(state), 'blind')).toBe(true);
    expect(hasStatus(foe(state), 'burn')).toBe(false);
    const outcomes = new Set<number>();
    for (let seed = 1; seed < 40; seed++) {
      const after = endPlayerTurn({ ...state, effectSeed: seed });
      outcomes.add(after.events.filter(event => event.kind === 'enemy-hit' && event.sourceId === 'thornlash-root').map(event => event.amount ?? 0)[0]);
      expect(hasStatus(after.foes[0], 'blind')).toBe(false);
    }
    expect([...outcomes].sort()).toEqual([0, 4]);
  });
  it('Burn deals 2 at the start of each of the next 2 enemy turns', () => {
    let state = useMomentumSkill(rich(create('013')), 'ember-swipe', 'thornlash-root');
    expect(foe(state).hp).toBe(17);
    state = endPlayerTurn(state);
    expect(foe(state).hp).toBe(15);
    state = endPlayerTurn(state);
    expect(foe(state).hp).toBe(13);
    state = endPlayerTurn(state);
    expect(foe(state).hp).toBe(13);
  });
});

describe('bleed then burn', () => {
  it('Bleed ticks once per tableau receipt; Exposed hits add Bleed', () => {
    let state = useMomentumSkill(rich(create('014')), 'lacerate', 'bramble-root');
    expect(foe(state)).toMatchObject({ hp: 21 });
    expect(statusOf(foe(state), 'bleed')?.stacks).toBe(4);
    state = feed(state, 'hero');
    expect(foe(state).hp).toBe(19);
    expect(statusOf(foe(state), 'bleed')?.stacks).toBe(3);
    state = useMomentumSkill(state, 'bite', 'bramble-root');
    expect(statusOf(foe(state), 'bleed')?.stacks).toBe(4);
    expect(hasStatus(foe(state), 'exposed')).toBe(true);
    const before = foe(state).hp;
    state = feed(state, 'mochi');
    expect(foe(state).hp).toBe(before - 2);
    expect(statusOf(foe(state), 'bleed')?.stacks).toBe(4);
  });
  it('fire on a Bleeding foe Cauterizes: the remaining Bleed lands at once and no Burn is set', () => {
    let state = useMomentumSkill(rich(create('014')), 'lacerate', 'bramble-root');
    state = useMomentumSkill(state, 'ember-swipe', 'bramble-root');
    expect(foe(state).hp).toBe(21 - 1 - 4);
    expect(hasStatus(foe(state), 'bleed')).toBe(false);
    expect(hasStatus(foe(state), 'burn')).toBe(false);
    expect(state.events.some(event => event.label === 'Cauterize' && event.amount === 4)).toBe(true);
  });
});

describe('silence, guard and support cards', () => {
  it('the Hush Root silences the Kin it strikes; Silenced Kin still bank Momentum but cannot cast', () => {
    let state = { ...create('015'), party: create('015').party.map(actor => ({ ...actor, charge: actor.id === 'mochi' ? 3 : 0 })) };
    state = endPlayerTurn(state);
    expect(statusOf(state.party[1], 'silence')?.turns).toBe(1);
    state = rich(state, 10);
    expect(canUseMomentumSkill(state, 'pounce')).toBe(false);
    expect(canUseMomentumSkill(state, 'bash')).toBe(true);
    const banked = feed(state, 'mochi');
    expect(banked.momentum!.value).toBe(11);
    const next = endPlayerTurn({ ...banked, foes: banked.foes.map(unit => ({ ...unit, inflicts: undefined })) });
    expect(hasStatus(next.party[1], 'silence')).toBe(false);
  });
  it('Guard absorbs the next hit and the debuff it carries', () => {
    let state = useMomentumSkill(rich(create('015')), 'guard', 'hero');
    state = { ...state, party: state.party.map(actor => ({ ...actor, charge: actor.id === 'hero' ? 5 : 0 })) };
    const after = endPlayerTurn(state);
    expect(after.party[0].hp).toBe(state.party[0].hp);
    expect(hasStatus(after.party[0], 'silence')).toBe(false);
    expect(hasStatus(after.party[0], 'guard')).toBe(false);
  });
  it('Wild Card plays one card of any rank', () => {
    let state = useMomentumSkill(rich(create('009')), 'wild', 'hero');
    const odd = { id: 'odd', rank: wrap(state.party[0].rank + 6) };
    expect(canPlay(state, 'hero', odd)).toBe(true);
    state = { ...state, columns: state.columns.map((cards, i) => i === 0 ? [...cards.slice(0, -1), odd] : cards) };
    state = playCard(state, 0, 'hero');
    expect(state.party[0].rank).toBe(odd.rank);
    expect(hasStatus(state.party[0], 'wild')).toBe(false);
    expect(canPlay(state, 'hero', { id: 'odd-2', rank: wrap(odd.rank + 6) })).toBe(false);
  });
  it('Second Wind heals 1 per card received', () => {
    let state = useMomentumSkill(rich(create('009')), 'regen', 'mochi');
    state = { ...state, party: state.party.map(actor => ({ ...actor, hp: 30 })) };
    state = feed(feed(state, 'mochi'), 'mochi');
    expect(state.party[1].hp).toBe(32);
    expect(state.party[0].hp).toBe(30);
  });
  it('Foresight lists the next refill cards in deal order', () => {
    const state = useMomentumSkill(rich(create('009')), 'foresight', 'hero');
    expect(statusOf(state.party[0], 'foresight')?.turns).toBe(2);
    const upcoming = upcomingRefills(state, 3);
    const column = state.columns.findIndex(cards => eligibleActors(state, cards[cards.length - 1]).length > 0);
    const actor = eligibleActors(state, state.columns[column][state.columns[column].length - 1])[0];
    const played = playCard(state, column, actor.id);
    expect(played.columns[column][0]).toEqual(upcoming[0]);
  });
});

describe('haste and vice grip', () => {
  it('Vice Grip commits all of Hero’s AP and holds 1 enemy turn per 2', () => {
    let state = useMomentumSkill(rich(create('016'), 6), 'vice-grip', 'bramble-brute');
    expect(ap(state, 'hero')).toBe(0);
    expect(ap(state, 'mochi')).toBe(6);
    expect(statusOf(foe(state), 'grip')?.turns).toBe(3);
    const hp = state.party.map(actor => actor.hp);
    for (let turn = 0; turn < 3; turn++) state = endPlayerTurn(state);
    expect(state.party.map(actor => actor.hp)).toEqual(hp);
    expect(hasStatus(foe(state), 'grip')).toBe(false);
    state = endPlayerTurn(state);
    expect(state.party.reduce((sum, actor) => sum + actor.hp, 0)).toBeLessThan(hp.reduce((a, b) => a + b, 0));
  });
  it("Mochi's Pounce keeps the hold; Hero's other abilities release it", () => {
    let state = useMomentumSkill(rich(create('016'), 6), 'vice-grip', 'bramble-brute');
    state = useMomentumSkill(rich(state, 6), 'pounce', 'bramble-brute');
    expect(hasStatus(foe(state), 'grip')).toBe(true);
    let released = useMomentumSkill(rich(create('009'), 6), 'vice-grip', 'sparring-root');
    released = useMomentumSkill(rich(released, 6), 'frost-fang', 'sap-root');
    expect(released.foes.some(unit => hasStatus(unit, 'grip'))).toBe(false);
  });
  it('Haste on Hero fills her to the cap for a full Vice Grip', () => {
    let state = useMomentumSkill(rich(create('016'), 2), 'haste', 'hero');
    state = { ...state, party: state.party.map(actor => ({ ...actor, charge: 0 })) };
    for (let i = 0; i < 3; i++) state = feed(state, 'hero');
    expect(ap(state, 'hero')).toBe(6);
    state = feed(state, 'hero');
    expect(ap(state, 'hero')).toBe(6);
    state = useMomentumSkill(state, 'vice-grip', 'bramble-brute');
    expect(statusOf(foe(state), 'grip')?.turns).toBe(3);
  });
});

describe('AP: each Kin’s own ability currency', () => {
  it('each receipt banks 1 AP on the receiving Kin up to the cap of 6, plus 1 shared Momentum', () => {
    let state = create('015');
    for (let i = 0; i < 8; i++) state = feed(state, 'hero');
    expect(ap(state, 'hero')).toBe(AP_CAP.hero);
    expect(ap(state, 'mochi')).toBe(0);
    expect(state.momentum!.earned).toBe(8);
  });
  it('abilities cost their owner’s AP, never Momentum', () => {
    let state: BattleState = { ...create('015'), momentum: { ...create('015').momentum!, value: 0 } };
    expect(canUseMomentumSkill(state, 'bash')).toBe(false);
    state = feed(state, 'hero');
    expect(canUseMomentumSkill(state, 'bash')).toBe(true);
    expect(canUseMomentumSkill(state, 'pounce')).toBe(false);
    const momentum = state.momentum!.value;
    state = useMomentumSkill(state, 'bash', 'hush-root');
    expect(ap(state, 'hero')).toBe(0);
    expect(state.momentum!.value).toBe(momentum);
  });
  it('AP persists across turns and Withdraw; a downed Kin loses its AP', () => {
    let state = rich(create('015'), 4);
    state = endPlayerTurn({ ...state, foes: state.foes.map(unit => ({ ...unit, inflicts: undefined })) });
    expect(ap(state, 'mochi')).toBe(4);
    state = withdrawPlayer(state);
    expect(ap(state, 'mochi')).toBe(4);
    state = endPlayerTurn({ ...state, party: state.party.map(actor => actor.id === 'hero' ? { ...actor, hp: 1, charge: 6 } : actor) });
    expect(state.party[0].hp).toBe(0);
    expect(ap(state, 'hero')).toBe(0);
  });
});

describe('Ember Rage', () => {
  const raging = () => useMomentumSkill(create('017'), 'ember-rage', 'hero');
  it('costs 0 AP, once per turn, and adds floor(AP/3) fire to each Hero chip hit after its AP', () => {
    let state = raging();
    expect(hasStatus(state.party[0], 'ember-rage')).toBe(true);
    expect(canUseMomentumSkill(state, 'ember-rage')).toBe(false);
    state = { ...state, party: state.party.map(actor => actor.id === 'hero' ? { ...actor, charge: 2 } : actor) };
    const hp = foe(state).hp;
    state = feed(state, 'hero');
    expect(ap(state, 'hero')).toBe(3);
    expect(hp - foe(state).hp).toBeGreaterThanOrEqual(1 + rageBonus(3));
    expect(state.events.some(event => event.label?.includes('Ember Rage'))).toBe(true);
    const stagger = foe(state).stagger;
    expect(stagger).toBe(foe(feed(create('017'), 'hero')).stagger);
  });
  it('raises Hero’s cap to 12 and burns AP above 6 off at the end of the turn', () => {
    let state = raging();
    state = { ...state, foes: state.foes.map(unit => ({ ...unit, hp: 999, profile: { ...unit.profile, maxHp: 999 } })) };
    for (let i = 0; i < 12; i++) { state = feed(state, 'hero'); expect(ap(state, 'hero')).toBe(i + 1); }
    expect(ap(state, 'hero')).toBe(RAGE_AP_CAP);
    state = endPlayerTurn(state);
    expect(hasStatus(state.party[0], 'ember-rage')).toBe(false);
    expect(ap(state, 'hero')).toBe(AP_CAP.hero);
  });
  it('locks Hero’s other abilities while raging; Mochi’s stay free', () => {
    const state = rich(raging(), 6);
    expect(canUseMomentumSkill(state, 'bash')).toBe(false);
    expect(useMomentumSkill(state, 'bash', 'ember-root')).toBe(state);
    const playground = rich(useMomentumSkill(create('009'), 'ember-rage', 'hero'), 6);
    for (const id of ['takedown', 'frost-fang', 'guard', 'cir-meteor'] as const) expect(canUseMomentumSkill(playground, id)).toBe(false);
    expect(canUseMomentumSkill(playground, 'haste')).toBe(true);
    expect(canUseMomentumSkill(playground, 'pounce')).toBe(true);
  });
});

describe('Tinder Khad (017)', () => {
  /** Plays the exposed card of this rank onto the Kin. */
  const play = (state: BattleState, actor: string, rank: number) => {
    const column = state.columns.findIndex(cards => cards[cards.length - 1]?.rank === rank);
    expect(column).toBeGreaterThanOrEqual(0);
    const next = playCard(state, column, actor);
    expect(next).not.toBe(state);
    return next;
  };
  const climb = (state: BattleState) => [3, 4, 5, 6, 7, 8, 9, 10, 11, 12].reduce((s, rank) => play(s, 'hero', rank), state);
  it('a raging ten-card Hero climb drops it under its 40% Regrowth threshold in one turn', () => {
    const raged = climb(useMomentumSkill(create('017'), 'ember-rage', 'hero'));
    expect(foe(raged).hp).toBeLessThan(40);
    expect(foe(endPlayerTurn(raged)).hp).toBe(foe(raged).hp);
  });
  it('the same climb without the rage, or spending the slot on Pounce, falls short and it regrows to full', () => {
    const plain = climb(create('017'));
    expect(foe(plain).hp).toBeGreaterThanOrEqual(40);
    expect(foe(endPlayerTurn(plain)).hp).toBe(100);
    let pounced = climb({ ...create('017'), party: create('017').party.map(actor => ({ ...actor, charge: actor.id === 'mochi' ? 3 : 0 })) });
    pounced = useMomentumSkill(pounced, 'pounce', 'tinder-khad');
    expect(foe(pounced).hp).toBeGreaterThanOrEqual(40);
    expect(foe(endPlayerTurn(pounced)).hp).toBe(100);
  });
  it('is dormant on its first turn, then strikes', () => {
    let state = create('017');
    expect(tutorialIntent(foe(state), 'Hero')?.summary).toBe('Dormant · 1 turn');
    const hp = state.party.map(actor => actor.hp);
    state = endPlayerTurn(state);
    expect(state.party.map(actor => actor.hp)).toEqual(hp);
    state = endPlayerTurn(state);
    expect(state.party.reduce((sum, actor) => sum + actor.hp, 0)).toBeLessThan(hp.reduce((a, b) => a + b, 0));
  });
  it('Heavy Bark halves physical hits of 3 or more; Dry Bark doubles fire', () => {
    const tinder = foe(create('017'));
    expect(barkDamage(tinder, 2, 0)).toBe(2);
    expect(barkDamage(tinder, 6, 0)).toBe(3);
    expect(barkDamage(tinder, 1, 3)).toBe(7);
    expect(barkDamage(foe(create('008')), 6, 3)).toBe(9);
  });
  it('Stifling Sap allows one ability per turn across the party; Withdraw is exempt; the slot resets next turn', () => {
    let state = rich(create('017'), 6);
    state = useMomentumSkill(state, 'ember-rage', 'hero');
    expect(canUseMomentumSkill(state, 'pounce')).toBe(false);
    expect(canUseMomentumSkill(state, 'withdraw')).toBe(true);
    state = endPlayerTurn(state);
    expect(canUseMomentumSkill(state, 'pounce')).toBe(true);
    const free = useMomentumSkill(rich(create('015'), 6), 'bash', 'hush-root');
    expect(canUseMomentumSkill(free, 'pounce')).toBe(true);
  });
});

describe('Focus Fire (018)', () => {
  const king = (state: BattleState) => state.columns[0][state.columns[0].length - 1];
  it('opens on a locked board that only Focus Fire (or Withdraw) can break', () => {
    const state = create('018');
    expect(state.columns.some(cards => eligibleActors(state, cards[cards.length - 1]).length > 0)).toBe(false);
    expect(canUseMomentumSkill(state, 'focus-fire', 'card:' + king(state).id)).toBe(true);
  });
  it('burns every card of the picked rank, buried or exposed, and deals 1 fire per card to every foe', () => {
    const state = create('018');
    const kings = state.columns.flat().filter(card => card.rank === 13).length;
    const next = useMomentumSkill(state, 'focus-fire', 'card:' + king(state).id);
    expect(kings).toBe(4);
    expect(next.columns.flat().filter(card => state.columns.flat().some(old => old.id === card.id) && card.rank === 13)).toHaveLength(0);
    expect(foe(next).hp).toBe(20 - kings);
    expect(ap(next, 'hero')).toBe(0);
    expect(next.momentum!.earned).toBe(state.momentum!.earned);
    expect(next.party.map(actor => actor.count)).toEqual(state.party.map(actor => actor.count));
  });
  it('refills the burned columns to their usual depth and opens the hidden lines', () => {
    const state = create('018'), next = useMomentumSkill(state, 'focus-fire', 'card:' + king(state).id);
    expect(next.columns.slice(0, 7).every(cards => cards.length === 4)).toBe(true);
    expect(next.columns[0][3].rank).toBe(3);
    expect(eligibleActors(next, next.columns[0][3]).map(actor => actor.id)).toEqual(['hero']);
    expect(next.reposition?.removedIds).toHaveLength(4);
    expect(next.reposition?.addedIds).toHaveLength(4);
  });
  it('a buried match burns too, and the hit is fire (Dry Bark doubles it)', () => {
    const rage = create('017');
    const nine = rage.columns.flat().find(card => card.rank === 9)!;
    const count = rage.columns.flat().filter(card => card.rank === 9).length;
    const next = useMomentumSkill(rich(create('009'), 6), 'focus-fire', 'card:' + create('009').columns[1][0].id);
    expect(next.foes.every(unit => unit.hp < 30)).toBe(true);
    expect(barkDamage(foe(rage), 0, count)).toBe(count * 2);
    expect(nine).toBeDefined();
  });
  it('is blocked while Hero rages and by Stifling Sap’s one-ability limit', () => {
    const raging = rich(useMomentumSkill(create('009'), 'ember-rage', 'hero'), 6);
    expect(canUseMomentumSkill(raging, 'focus-fire', 'card:' + raging.columns[0][0].id)).toBe(false);
    const sapped = useMomentumSkill(rich(create('017'), 6), 'pounce', 'tinder-khad');
    const tinderWithFocus = { ...sapped, tutorial: { ...sapped.tutorial!, id: '009' as const } };
    expect(canUseMomentumSkill({ ...tinderWithFocus, foes: sapped.foes }, 'focus-fire', 'card:' + sapped.columns[0][0].id)).toBe(false);
  });
});

describe('tutorial turn flow', () => {
  it('Withdraw redeals from the seeded stock and the foes still act', () => {
    const state = create('008');
    const next = withdrawPlayer(state);
    expect(next.turn).toBe('party');
    expect(next.columns.flat().some(card => state.columns.flat().some(old => old.id === card.id))).toBe(false);
    expect(next.party.reduce((sum, actor) => sum + actor.hp, 0)).toBe(state.party.reduce((sum, actor) => sum + actor.hp, 0) - 2);
  });
  it('a finite scenario is won when every foe falls; actors retarget a living foe', () => {
    let state = create('012');
    state = { ...state, foes: state.foes.map(unit => ({ ...unit, hp: 1 })) };
    state = feed(state, 'hero');
    expect(state.foes[0].hp).toBe(0);
    expect(state.party.every(actor => actor.targetId === 'thorn-rootling')).toBe(true);
    state = feed(feed(state, 'hero'), 'mochi');
    expect(state.result).toBe('won');
    expect(tutorialRounds(state)).toBeNull();
  });
});
