import { describe, expect, it } from 'vitest';
import { build, clearZone, combine, createCity, explore, gather, kinOf, maxStamina, receiptYield, rest, spendStamina } from './cityRules';
import { canPlay, dealGolf, drawStock, playColumn } from './golfRules';
import { createBattle, endPartyTurn, enemyStep, playOnFighter, playOnIntent, partyHasMove, useAbility, type Battle } from './combatRules';

describe('city rules', () => {
  it('starts small: Hero and Mochi, the den only', () => {
    const s = createCity();
    expect(s.kin.map(k => k.id)).toEqual(['hero', 'mochi']);
    expect(s.zones.filter(z => z.revealed).map(z => z.id)).toEqual(['den']);
    expect(kinOf(s, 'hero')!.stamina).not.toBe(kinOf(s, 'mochi')!.stamina);
  });

  it('gathers up to the card yield and spends stamina per foundation', () => {
    let s = createCity();
    const card = s.cards.find(c => c.zone === 'den' && c.kind === 'tree')!;
    s = gather(s, card.id, 50).state;
    expect(s.tokens.wood).toBe(10);
    expect(s.cards.find(c => c.id === card.id)!.yield).toBe(0);
    expect(spendStamina(createCity(), 'mochi', 4)).toBeNull();
  });

  it('streak bonus is every 5th card, every 3rd on an affinity resource', () => {
    expect([1, 2, 3, 4, 5].map(n => receiptYield(n, 'hero', 'berry'))).toEqual([1, 1, 1, 1, 2]);
    expect([1, 2, 3].map(n => receiptYield(n, 'mochi', 'berry'))).toEqual([1, 1, 2]);
  });

  it('rest feeds kin; a shortfall leaves the last kin malnourished with lower stamina', () => {
    let s = createCity();
    s = { ...s, tokens: { ...s.tokens, berry: 2 } };
    s = rest(s);
    expect(s.day).toBe(2);
    expect(kinOf(s, 'hero')!.malnourished).toBe(false);
    expect(kinOf(s, 'mochi')!.malnourished).toBe(true);
    expect(maxStamina(s, kinOf(s, 'mochi')!)).toBe(1);
    expect(kinOf(s, 'mochi')!.stamina).toBe(1);
  });

  it('discovers recipes by combining token stacks and builds them', () => {
    let s = createCity();
    s = { ...s, tokens: { ...s.tokens, wood: 12, stone: 2 } };
    const r = combine(s, 'wood', 'stone');
    expect(r.found).toBe('burrow');
    const built = build(r.state, 'burrow')!;
    expect(built.buildings).toEqual(['burrow']);
    expect(built.tokens.wood).toBe(6);
  });

  it('clearing the Thicket rescues Banks into free housing', () => {
    const s = clearZone(createCity(), 'thicket');
    expect(kinOf(s, 'banks')!.housed).toBe(false);
    const roomy = clearZone({ ...createCity(), buildings: ['burrow'] }, 'thicket');
    expect(kinOf(roomy, 'banks')!.housed).toBe(true);
  });

  it('the Stream needs a Dam', () => {
    expect(explore(createCity(), 'stream', 'hero')).toBeNull();
    const s = explore({ ...createCity(), buildings: ['dam'], kin: [...createCity().kin] }, 'stream', 'hero')!;
    expect(s.zones.find(z => z.id === 'stream')!.revealed).toBe(true);
    expect(kinOf(s, 'riv')).toBeTruthy();
  });
});

describe('gathering golf', () => {
  it('plays exposed ±1 cards and draws foundations from stock', () => {
    let g = drawStock(dealGolf(7))!;
    expect(g.foundation).toBeTruthy();
    const col = g.columns.findIndex((_, c) => canPlay(g, c));
    if (col >= 0) { g = playColumn(g, col)!; expect(g.receipts).toBe(1); expect(g.streak).toBe(1); }
    expect(drawStock(g)!.streak).toBe(0);
  });
});

const fixed = (b: Battle, exposed: number[]): Battle => ({ ...b, columns: exposed.map(r => [1, 1, 1, r]) });

describe('Rally and Break combat', () => {
  it('receipts chip the target, earn AP and build stagger into a break', () => {
    let b = createBattle(3, [{ id: 'hero', hp: 12, maxHp: 12 }], ['slime']);
    b = fixed({ ...b, fighters: [{ ...b.fighters[0], rank: 5 }] }, [6, 6, 6, 6, 6, 6, 6]);
    b = playOnFighter(b, 0, 0)!;
    expect(b.foes[0].hp).toBe(5);
    expect(b.fighters[0].ap).toBe(1);
    expect(b.foes[0].stagger).toBe(1);
  });

  it('a broken enemy loses its next turn', () => {
    let b = createBattle(3, [{ id: 'mochi', hp: 9, maxHp: 9 }], ['slime']);
    b = { ...b, fighters: [{ ...b.fighters[0], ap: 6 }] };
    b = useAbility(b, 0, { foe: 0 })!;
    b = useAbility(b, 0, { foe: 0 })!;
    expect(b.foes[0].broken).toBe(true);
    b = enemyStep(endPartyTurn(b));
    expect(b.last!.kind).toBe('broken');
    const hp = b.fighters[0].hp;
    b = enemyStep(b);
    expect(b.turn).toBe('party');
    expect(b.fighters[0].hp).toBe(hp);
  });

  it('playing onto Thorn Whip erodes it; the last pip breaks the root', () => {
    let b = createBattle(5, [{ id: 'hero', hp: 12, maxHp: 12 }], ['root']);
    const intent = { ...b.foes[0].intent!, rank: 5, pips: 0, capacity: 1 };
    b = fixed({ ...b, foes: [{ ...b.foes[0], intent }] }, [6, 1, 1, 1, 1, 1, 1]);
    b = playOnIntent(b, 0, 0)!;
    expect(b.foes[0].intent).toBeNull();
    expect(b.foes[0].broken).toBe(true);
  });

  it('enemy turns resolve one action per step and hand back to the party', () => {
    let b = endPartyTurn(createBattle(11, [{ id: 'hero', hp: 12, maxHp: 12 }], ['slime', 'root']));
    let steps = 0;
    while (b.turn === 'enemy' && !b.result && steps < 50) { b = enemyStep(b); steps++; }
    expect(steps).toBeGreaterThan(1);
    expect(b.turn).toBe('party');
    expect(b.round).toBe(2);
    expect(partyHasMove(b)).toBe(true);
  });
});
