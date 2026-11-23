import { describe, expect, it } from 'vitest';
import { canPlay, createCombatSandboxScenario, eligibleActors, endPlayerTurn, playCard, type BattleState } from './battle';
import { ELEMENTS, actorElements, cardElement, elementPlayReady, kinElement, OPPOSED, type Element } from './elementSuits';
import { initialCir } from './cirCompanion';
import { stockCard } from './skirmish';
import { scenarioHand } from './abilityCatalog';
import { tutorialById } from './battleTutorialScenarios';
import { canPityFlip } from './battleDeadRun';
import { FOUNDATION_SUMMON_SLOT, STATUS_META } from './battleStatusData';
import { useMomentumSkill } from './battle';

/** A card id whose seeded element is `element`. */
const idOf = (element: Element, tag = 'x') => { for (let i = 0; ; i++) if (cardElement({ id: `${tag}-${i}` }) === element) return `${tag}-${i}`; };
/** Explicit two-Kin rules fixture: Hero on `heroRank`, Mochi on 9, and `top` exposed. */
const setup = (heroRank: number, top: { rank: number; element: Element }): BattleState => {
  const seeded = createCombatSandboxScenario('1002');
  const state = {...seeded,keruExpedition:undefined,party:seeded.party.filter(a=>a.id==='hero')};
  const mochi = createCombatSandboxScenario('008').party.find(actor => actor.id === 'mochi')!;
  return { ...state, cirCompanion: {...initialCir(),form:'familiar',host:'hero',pips:3,awakened:true}, party: [...state.party, mochi].map(actor => ({ ...actor, rank: actor.id === 'hero' ? heroRank : 9 })),
    columns: state.columns.map((cards, c) => c ? cards.map(card => ({ ...card, rank: 13 })) : [...cards.slice(0, -1), { id: idOf(top.element), rank: top.rank }]) };
};
const hero = (state: BattleState) => state.party.find(actor => actor.id === 'hero')!;

describe('elemental suits (1002)', () => {
  it('opens Hero’s Keru hand without granting Clover or direct foundation summoning', () => {
    const state = createCombatSandboxScenario('1002');
    expect(tutorialById('1002')?.kinRadials).toBe(true);
    expect(scenarioHand(state)).toContain('summon-riv');
    expect(scenarioHand(state)).toContain('hold');
    expect(scenarioHand(state)).toContain('summon-cir');
    expect(canPityFlip(state)).toBe(false);
    expect(hero(state).statuses?.some(status => status.id === 'every-dog-has-her-day')).toBe(false);
    expect(STATUS_META['every-dog-has-her-day'].name).toBe('4 Leaf Clover');
    const rich = { ...state, party: state.party.map(actor => ({ ...actor, charge: 6 })) };
    expect(useMomentumSkill(rich, 'hold', 'hero')).toBe(rich);
    const summoned = useMomentumSkill(rich, 'hold', FOUNDATION_SUMMON_SLOT);
    expect(summoned).toBe(rich);
    expect(scenarioHand(state)).not.toContain('cir-emerge');
    expect(canPityFlip(createCombatSandboxScenario('1000'))).toBe(true);
  });
  it('starts with the Seed foundation and Hero support on 7 columns, 4 deep, charge ready', () => {
    const state = createCombatSandboxScenario('1002');
    expect(state.columns).toHaveLength(7);
    expect(state.rules.columns).toBe(7);
    expect(state.columns.every(cards => cards.length === 4)).toBe(true);
    expect(state.party.map(actor => actor.id)).toEqual(['aldan-seed','hero','dem','cir','mochi','banks']);
    expect(state.rules.elementSuits).toBe(true);
    expect(state.elementPlay).toBe('ready');
    expect([kinElement('hero'), kinElement('mochi')]).toEqual([undefined, 'earth']);
    expect(actorElements(state,'hero')).toEqual([]);
  });

  it('accepts a legal exposed card from the seventh column', () => {
    const state = createCombatSandboxScenario('1002');
    state.columns[6] = state.columns[6].map((card, row) => row === 3 ? { ...card, rank:3 } : card);
    const playedId = state.columns[6][3].id;
    const next = playCard(state, 6, 'aldan-seed');
    expect(next.party.find(actor => actor.id === 'aldan-seed')?.count).toBe(1);
    expect(next.columns[6].some(card => card.id === playedId)).toBe(false);
  });

  it('deals the six elements uniformly and reproducibly from the seeded stock', () => {
    const counts = Object.fromEntries(ELEMENTS.map(element => [element, 0]));
    for (let n = 0; n < 6000; n++) counts[cardElement(stockCard(1002, n))]++;
    for (const element of ELEMENTS) { expect(counts[element]).toBeGreaterThan(850); expect(counts[element]).toBeLessThan(1150); }
    expect(cardElement(stockCard(77, 5))).toBe(cardElement(stockCard(77, 5)));
  });

  it('lets a card of a Kin’s element play on that Kin at any rank, and only that Kin', () => {
    const state = setup(2, { rank: 6, element: 'fire' });
    const card = state.columns[0][3];
    expect(canPlay(state, 'hero', card)).toBe(true);
    expect(canPlay(state, 'mochi', card)).toBe(false);
    const water = setup(2, { rank: 6, element: 'water' });
    expect(eligibleActors(water, water.columns[0][3])).toEqual([]);
    const earth = setup(2, { rank: 6, element: 'earth' });
    expect(eligibleActors(earth, earth.columns[0][3]).map(actor => actor.id)).toEqual(['mochi']);
  });

  it('is off without the rule: the same card is not legal in 008', () => {
    const base = createCombatSandboxScenario('008');
    const state = { ...base, party: base.party.map(actor => ({ ...actor, rank: 2 })) };
    expect(canPlay(state, 'hero', { id: idOf('fire'), rank: 6 })).toBe(false);
  });

  it('an off-sequence element play is a normal receipt that spends the charge and keeps the Kin’s element', () => {
    const state = setup(2, { rank: 6, element: 'fire' }), before = hero(state);
    const next = playCard(state, 0, 'hero');
    expect(hero(next).rank).toBe(6);
    expect(hero(next).charge).toBe(before.charge + 1);
    expect(next.momentum!.value).toBeGreaterThan(state.momentum!.value);
    expect(next.foes[0].hp).toBe(state.foes[0].hp - 2);
    expect(next.elementPlay).toBe('spent');
    expect(elementPlayReady(next)).toBe(false);
    expect(actorElements(next,'hero')).toEqual(['fire','air']);
    // The charge is team-wide: Mochi can't take an off-sequence earth card now.
    const earth = { ...next, columns: next.columns.map((cards, c) => c === 1 ? [...cards.slice(0, -1), { id: idOf('earth', 'e'), rank: 3 }] : cards) };
    expect(canPlay(earth, 'mochi', earth.columns[1][3])).toBe(false);
    // ±1 plays still work with the charge spent.
    const adjacent = { ...next, columns: next.columns.map((cards, c) => c === 1 ? [...cards.slice(0, -1), { id: idOf('water', 'w'), rank: 7 }] : cards) };
    expect(canPlay(adjacent, 'hero', adjacent.columns[1][3])).toBe(true);
  });

  it('a matching card that is also ±1 legal is a normal play and keeps the charge', () => {
    const state = setup(5, { rank: 6, element: 'fire' });
    const next = playCard(state, 0, 'hero');
    expect(hero(next).rank).toBe(6);
    expect(next.elementPlay).toBe('ready');
    const wrapped = playCard(setup(13, { rank: 1, element: 'fire' }), 0, 'hero');
    expect(wrapped.elementPlay).toBe('ready');
  });

  it('the charge resets when the next party turn opens', () => {
    const spent = playCard(setup(2, { rank: 6, element: 'fire' }), 0, 'hero');
    expect(spent.elementPlay).toBe('spent');
    const next = endPlayerTurn(spent);
    expect(next.turn).toBe('party');
    expect(next.elementPlay).toBe('ready');
  });
});
