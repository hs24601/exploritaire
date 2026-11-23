import { describe, expect, it } from 'vitest';
import { canUseMomentumSkill, createCombatSandboxScenario, createPlayableSandboxScenario, endPlayerTurn, playCard, tableauWidth, tickBattle, useMomentumSkill, withdrawPlayer, type BattleState } from './battle';
import { advanceIntent, intentEnemyPlayOne, canPityFlip, hasHoldSlot, hasPityDraw, heldCard, heldReceivers, holdCard, INTENT_RECEIVER, openPartyTurn, pityFlip, playHeld, playOnIntent, tableauReceivers } from './battleDeadRun';
import { DEEP_BREATH } from './battleTutorialScenarios';
import { anyLegalPlay } from './battleDeadRun';
import type { Card } from '../protoState';

const card = (id: string, rank: number): Card => ({ id, rank });
/** Six authored columns with the given exposed ranks (buried cards are Kings). */
const table = (state: BattleState, tops: number[]): BattleState => ({ ...state,
  columns: tops.map((rank, c) => state.rules.spatialLanes ? [card(`k${c}a`, 13), card(`top${c}`, rank), card(`rear${c}`, rank)] : [card(`k${c}a`, 13), card(`k${c}b`, 13), card(`k${c}c`, 13), card(`top${c}`, rank)]) });
const withIntent = (state: BattleState, rank: number, pips = 0): BattleState => ({ ...state, tutorial: { ...state.tutorial!, intent: { id: 'intent-test', rank, pips, fired: 0, cards: [] } } });
const charging = (state: BattleState): BattleState => ({ ...state, tutorial: { ...state.tutorial!, breath: 'charging' } });
const hero = (state: BattleState) => state.party.find(actor => actor.id === 'hero')!;

describe('dead-run scenarios', () => {
  it('counts S1002 ability-only plays as legal and resolves them without a party foundation move',()=>{
    const initial=createCombatSandboxScenario('1002');
    const state:BattleState={...initial,columns:[[{id:'only-ability',rank:7}]],tutorial:{...initial.tutorial!,breath:'charging',intent:{id:'counterplay',rank:6,pips:2,fired:0,cards:[]}}};
    expect(tableauReceivers(state,state.columns[0][0],false)).toEqual([INTENT_RECEIVER]);
    expect(anyLegalPlay(state)).toBe(true);
    const next=playOnIntent(state,0);
    expect(next.tutorial?.intent).toMatchObject({rank:7,pips:1,cards:[{id:'only-ability',rank:7}]});
    expect(next.party).toEqual(state.party);
    expect(next.momentum?.value).toBe((state.momentum?.value ?? 0)+1);
    for(const breath of ['readied','inhaled'] as const)expect(tableauReceivers({...state,tutorial:{...state.tutorial!,breath}},state.columns[0][0],false)).toEqual([]);
    expect(tableauReceivers({...state,turn:'enemy'},state.columns[0][0],false)).toEqual([]);
  });
  it('019–024 put Hero alone on six columns with their own fixes', () => {
    const fixes = { '019': [false, false, false], '020': [true, false, false], '021': [true, false, false], '022': [true, true, false], '023': [true, false, true], '024': [true, true, true] } as const;
    for (const [id, [intent, pity, hold]] of Object.entries(fixes)) {
      const state = createCombatSandboxScenario(id as '019');
      expect(state.party.map(actor => actor.id)).toEqual(['hero']);
      expect(tableauWidth(state)).toBe(6);
      expect(state.columns).toHaveLength(6);
      expect(Boolean(state.tutorial?.intent)).toBe(intent);
      expect(state.tutorial?.intent?.pips ?? 0).toBe(0);
      expect([hasPityDraw(state), hasHoldSlot(state)]).toEqual([true, hold]);
      // Every opening has a legal play, so no scenario starts on a pity flip.
      expect(state.columns.some(cards => tableauReceivers(state, cards[cards.length - 1], false).length > 0)).toBe(true);
    }
  });

  it('a card on the intent removes a pip and earns Momentum but no AP or hit; golf intents take its rank', () => {
    const base = withIntent(table(createCombatSandboxScenario('020'), [7, 13, 13, 13, 13, 13]), 6, 2);
    const next = playOnIntent(base, 0);
    expect(next.tutorial!.intent).toMatchObject({ pips: 1, rank: 7 });
    expect(next.momentum!.value).toBe(base.momentum!.value + 1);
    expect(hero(next).charge).toBe(hero(base).charge);
    expect(next.foes[0].hp).toBe(base.foes[0].hp);
    expect(next.columns[0].map(c => c.id)).not.toContain('top0');
    const fixed = playOnIntent(withIntent(table(createCombatSandboxScenario('021'), [7, 13, 13, 13, 13, 13]), 6, 2), 0);
    expect(fixed.tutorial!.intent).toMatchObject({ pips: 1, rank: 6 });
    expect(playOnIntent(base, 1)).toBe(base);
  });

  it('Deep Breath limits card and passive progress to one pip and fires at full pips', () => {
    const base = withIntent(table(createCombatSandboxScenario('020'), [5, 4, 3, 13, 13, 13]), 6, 0);
    const turn = advanceIntent(base, false);
    // The card play uses the turn allowance, so passive progress waits.
    expect(turn.tutorial!.intent).toMatchObject({ pips: 1, rank: 5 });
    expect(turn.tutorial!.intent!.cards.map(c => c.id)).toEqual(['top0']);
    const fire = advanceIntent(withIntent(table(createCombatSandboxScenario('020'), [13, 13, 13, 13, 13, 13]), 6, DEEP_BREATH.pips - 1), false);
    expect(hero(fire).hp).toBe(hero(base).hp - DEEP_BREATH.damage);
    expect(fire.tutorial!.intent).toMatchObject({ pips: 0, fired: 1 });
    expect(fire.events.some(event => event.kind === 'enemy-hit' && event.label?.includes('Deep Breath'))).toBe(true);
  });

  it('a staggered root leaves Deep Breath alone on its turn', () => {
    const base = withIntent(table(createCombatSandboxScenario('020'), [5, 13, 13, 13, 13, 13]), 6, 3);
    const staggered = { ...base, foes: base.foes.map(foe => ({ ...foe, staggered: 1 })) };
    const after = endPlayerTurn(staggered);
    expect(after.tutorial!.intent).toMatchObject({ pips: 3, fired: 0 });
    expect(hero(after).hp).toBe(hero(base).hp);
  });

  it('Every Dog Has Her Day spends three charges without receipts or turn recharge', () => {
    const start = createCombatSandboxScenario('022');
    const charges = (state: BattleState) => hero(state).statuses?.find(status => status.id === 'every-dog-has-her-day')?.stacks ?? 0;
    expect(charges(start)).toBe(3);
    expect(canPityFlip(start)).toBe(true);
    let state = start;
    for (let left = 2; left >= 0; left--) {
      const before = state;
      state = pityFlip(state);
      expect(charges(state)).toBe(left);
      expect(hero(state).foundationCards!.length).toBe(hero(before).foundationCards!.length + 1);
      expect(hero(state).rank).toBe(hero(state).foundationCards!.slice(-1)[0].rank);
      expect(hero(state).charge).toBe(hero(before).charge);
      expect(state.momentum!.value).toBe(before.momentum!.value);
      expect(state.foes).toEqual(before.foes);
    }
    expect(hero(state).statuses?.some(status => status.id === 'every-dog-has-her-day')).toBe(false);
    expect(canPityFlip(state)).toBe(false);
    expect(pityFlip(state)).toBe(state);
    expect(charges(openPartyTurn(state))).toBe(0);
    expect(charges(endPlayerTurn(state))).toBe(0);
    expect(charges(createCombatSandboxScenario('022'))).toBe(3);
    expect(canPityFlip({ ...start, turn: 'enemy' })).toBe(false);
    expect(canPityFlip({ ...start, party: start.party.map(actor => ({ ...actor, hp: 0 })) })).toBe(false);
    expect(canPityFlip(createCombatSandboxScenario('020'))).toBe(true);
  });

  it('the hold parks one playable card, keeps it across turns and plays it later', () => {
    const base = withIntent(table(createCombatSandboxScenario('023'), [3, 9, 1, 13, 13, 13]), 11);
    // Hero starts on 2: the 9 is not playable, so it cannot be parked.
    expect(holdCard(base, 1, 'hero')).toBe(base);
    const parked = holdCard(base, 0, 'hero');
    expect(heldCard(parked, 'hero')?.rank).toBe(3);
    expect(hero(parked).rank).toBe(hero(base).rank);
    expect(hero(parked).charge).toBe(hero(base).charge);
    expect(holdCard(parked, 2, 'hero')).toBe(parked);
    const later = endPlayerTurn(parked);
    expect(heldCard(later, 'hero')?.rank).toBe(3);
    expect(heldReceivers(later, 'hero')).toContain('hero');
    const played = playHeld(later, 'hero', 'hero');
    expect(heldCard(played, 'hero')).toBeUndefined();
    expect(hero(played)).toMatchObject({ rank: 3, charge: hero(later).charge + 1 });
    expect(played.foes[0].hp).toBeLessThan(later.foes[0].hp);
    expect(playHeld(played, 'hero', INTENT_RECEIVER)).toBe(played);
  });

  it('1000 is a 100-HP Dusk Dragon boss with a fresh deal per start and a paced enemy turn', () => {
    const a = createPlayableSandboxScenario('1000'), b = createPlayableSandboxScenario('1000');
    expect(a.foes[0]).toMatchObject({ name: 'Dusk Dragon', hp: 100, momentum: undefined });
    expect([hasPityDraw(a), hasHoldSlot(a), Boolean(a.tutorial?.intent), tableauWidth(a), a.party.length]).toEqual([true, false, false, 6, 1]);
    expect(a.columns.flat().map(card => card.id)).not.toEqual(b.columns.flat().map(card => card.id));
    const pending = withdrawPlayer(a, 1);
    expect(pending.turn).toBe('enemy');expect(pending.columns).toBe(a.columns);
    const waiting = tickBattle(pending, 0.5);
    expect(waiting.turn).toBe('enemy');expect(waiting.columns).toBe(a.columns);
    let back = waiting;
    for (let i = 0; i < 20 && back.turn === 'enemy'; i++) back = tickBattle(back, 1);
    expect(back.turn).toBe('party');expect(back.pendingRedeal).toBeUndefined();expect(back.reposition?.by).toBe('party');
    expect(hero(back).hp).toBe(hero(a).hp);
  });

  it('a paced enemy turn plays one action per step: strike, each intent play, then the handoff', () => {
    const base = createPlayableSandboxScenario('1000');
    const s = charging(withIntent(table(base, [5, 4, 13, 13, 13, 13]), 6));
    const steps: BattleState[] = [];
    let next = endPlayerTurn(s);
    for (let i = 0; i < 20 && next.turn === 'enemy'; i++) { next = tickBattle(next, 2); steps.push(next); }
    const cards = steps.map(step => step.tutorial!.intent!.cards.length), pips = steps.map(step => step.tutorial!.intent!.pips);
    // Strike, ability step, one card, passive step, and handoff.
    expect(cards).toEqual([0, 0, 1, 1, 1]);
    expect(pips).toEqual([0, 0, 1, 1, 1]);
    expect(steps.map(step => step.turn)).toEqual(['enemy', 'enemy', 'enemy', 'enemy', 'party']);
  });

  it('in 1000 the 6-AP Summon: Dem card adds a friendly Ace foundation once per fight', () => {
    const start = createCombatSandboxScenario('1000');
    expect(canUseMomentumSkill(start, 'hold', 'new-foundation')).toBe(false);
    const rich: BattleState = { ...start, party: start.party.map(actor => ({ ...actor, charge: 6 })) };
    expect(canUseMomentumSkill(rich, 'hold', 'new-foundation')).toBe(true);
    const open = useMomentumSkill(rich, 'hold', 'new-foundation');
    expect(hasHoldSlot(open, 'hero')).toBe(false);
    const dem = open.party.find(actor => actor.id === 'dem')!;
    expect(open.party.map(actor => actor.id)).toEqual(['hero', 'dem']);
    expect(dem.name).toBe('Dem');
    expect(dem.rank).toBe(1);
    expect(dem.foundationCards?.map(card => card.rank)).toEqual([1]);
    expect(dem.hp).toBe(dem.maxHp);
    expect(dem.targetId).toBe(open.foes[0].id);
    const withTwo = table(open, [2, 9, 9, 9, 9, 9]);
    expect(tableauReceivers(withTwo, withTwo.columns[0][withTwo.columns[0].length - 1])).toContain('dem');
    const played = playCard(withTwo, 0, 'dem');
    expect(played.party.find(actor => actor.id === 'dem')?.rank).toBe(2);
    expect(played.party.find(actor => actor.id === 'dem')?.charge).toBe(1);
    expect(hero(open).charge).toBe(0);
    expect(canUseMomentumSkill({ ...open, party: open.party.map(actor => ({ ...actor, charge: 6 })) }, 'hold', 'new-foundation')).toBe(false);
    expect(endPlayerTurn(open).party.some(actor => actor.id === 'dem')).toBe(true);
    const downed = { ...open, party: open.party.map(actor => ({ ...actor, hp: actor.id === 'dem' ? 0 : actor.hp, charge: 6 })) };
    expect(canUseMomentumSkill(downed, 'hold', 'new-foundation')).toBe(false);
    expect(createCombatSandboxScenario('1000').party.some(actor => actor.id === 'dem')).toBe(false);
  });

  it('every playable scenario steps its enemy turn; tests and tools can still resolve it at once', () => {
    for (const id of ['006', '010', '012', '020'] as const) {
      const instant = endPlayerTurn(createCombatSandboxScenario(id));
      expect(instant.turn).toBe('party');
      const paced = endPlayerTurn(createPlayableSandboxScenario(id));
      expect(paced.turn).toBe('enemy');
      expect(paced.party.map(actor => actor.hp)).toEqual(createPlayableSandboxScenario(id).party.map(actor => actor.hp));
      let next = paced, steps = 0;
      for (; steps < 30 && next.turn === 'enemy'; steps++) next = tickBattle(next, 0.5);
      expect(next.turn).toBe('party');
      expect(steps).toBeGreaterThan(1);
    }
    expect(createPlayableSandboxScenario('007').rules.pacedEnemyTurns).toBeUndefined();
  });

  it('three rootlings strike one step apart', () => {
    let next = endPlayerTurn(createPlayableSandboxScenario('012'));
    const hits: number[] = [];
    for (let i = 0; i < 30 && next.turn === 'enemy'; i++) { next = tickBattle(next, 0.5); hits.push(next.events.filter(event => event.kind === 'enemy-hit').length); }
    expect([...new Set(hits)]).toEqual([0, 1, 2, 3]);
  });

  it('1000 Deep Breath is caster-built: the party can only deny it, and the dummy picks matching cards at random', () => {
    const base = withIntent(table(createCombatSandboxScenario('1000'), [5, 7, 13, 5, 13, 7]), 6);
    expect(tableauReceivers(base, base.columns[0][base.columns[0].length - 1], false)).not.toContain(INTENT_RECEIVER);
    expect(playOnIntent(base, 0)).toBe(base);
    const picks = new Set(Array.from({ length: 24 }, (_, seed) => intentEnemyPlayOne({ ...base, effectSeed: seed })!.tutorial!.intent!.cards[0].id));
    expect([...picks].sort()).toEqual(['top0', 'top1', 'top3', 'top5']);
    expect(intentEnemyPlayOne(base)!.tutorial!.intent!.cards[0].id).toBe(intentEnemyPlayOne(base)!.tutorial!.intent!.cards[0].id);
    // Denied: with no card one rank from it exposed, it gains nothing.
    const denied = withIntent(table(createCombatSandboxScenario('1000'), [9, 9, 9, 9, 9, 9]), 6);
    expect(advanceIntent(denied, false).tutorial!.intent!.pips).toBe(0);
  });

  it('the Dusk Dragon casts Deep Breath from behind its armor, readies it, skips a turn, then breathes 55', () => {
    const start = createCombatSandboxScenario('1000');
    const dragon = (state: BattleState) => state.foes[0];
    expect(dragon(start).statuses?.map(status => status.id)).toEqual(['duskscale']);
    expect(start.tutorial?.breath).toBe('armored');
    // Armored: Nips deal damage but build no stagger.
    const nipped = playCard({ ...start, columns: start.columns.map((cards, c) => c === 0 ? [...cards.slice(0, -1), card('nip', 3)] : cards) }, 0, 'hero');
    expect(dragon(nipped).stagger).toBe(0);expect(dragon(nipped).hp).toBeLessThan(dragon(start).hp);
    // Its first turn: cast, armor off, then its plays.
    const cast = endPlayerTurn(start);
    expect(cast.tutorial?.breath).toBe('charging');expect(Boolean(cast.tutorial?.intent)).toBe(true);
    expect(dragon(cast).statuses?.map(status => status.id)).toEqual(['deep-breath']);
    expect(hero(cast).hp).toBe(hero(start).hp);
    // Full: readied, no damage yet; then a skipped turn; then the breath and the armor back.
    const full = { ...cast, tutorial: { ...cast.tutorial!, intent: { ...cast.tutorial!.intent!, pips: 3 } } };
    const readied = endPlayerTurn(table(full, [cast.tutorial!.intent!.rank % 13 + 1, 13, 13, 13, 13, 13]));
    expect(readied.tutorial?.breath).toBe('readied');expect(hero(readied).hp).toBe(hero(start).hp);
    const inhaled = endPlayerTurn(readied);
    expect(inhaled.tutorial?.breath).toBe('inhaled');expect(hero(inhaled).hp).toBe(hero(start).hp);
    const breathed = endPlayerTurn(inhaled);
    expect(hero(breathed).hp).toBe(hero(start).hp - 55);
    expect(breathed.tutorial?.breath).toBe('armored');expect(breathed.tutorial?.intent).toBeUndefined();
    expect(dragon(breathed).statuses?.map(status => status.id)).toEqual(['duskscale']);
  });

  it('keeps the charging dragon immune to stagger while still taking damage', () => {
    const cast = endPlayerTurn(createCombatSandboxScenario('1000'));
    const state: BattleState = { ...cast, foes: cast.foes.map(foe => ({ ...foe, stagger: 5 })) };
    const next = playCard({ ...state, columns: state.columns.map((cards, c) => c === 0 ? [...cards.slice(0, -1), card('hit', hero(state).rank % 13 + 1)] : cards) }, 0, 'hero');
    expect(next.tutorial?.breath).toBe('charging');
    expect(next.foes[0].stagger).toBe(5);
    expect(next.foes[0].staggered).toBe(0);
    expect(next.foes[0].hp).toBe(state.foes[0].hp - 1);
  });

});
