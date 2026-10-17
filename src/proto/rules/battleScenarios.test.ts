import { describe, expect, it } from 'vitest';
import type { Card } from '../protoState';
import {
  EYE_SECONDS, FORAGE_REST, SLIME, TRAP_BONUS, applyAttack, applyTrap, canDeal, createBattle, dealRow, eligibleActors, enemyTarget,
  playCard, previewAttack, previewTrap, tickBattle, type BattleState,
} from './battle';
import { attackFor } from './battleAbilities';
import { BATTLE_SCENARIOS, scenarioById } from './battleScenarios';
import { createSeededSmallWoodsDeal } from './setup';

const card = (rank: number, id: string): Card => ({ id, rank });
/** One column whose top (last) card is a 10, next to the Dark Slime's 9; under it a 4 the hero (2) can't play but a 3 can. */
const hungryDeal = () => ({ tableau: [[card(3, 'under'), card(10, 'ten')], [card(7, 'seven')]], stock: [] });
const started = (state: BattleState) => ({ ...state, started: true });
const dark = (state: BattleState) => state.foes.find((f) => f.id === 'dark-slime')!;

describe('hungry slimes', () => {
  const setup = () => started(createBattle(hungryDeal(), { mochi: false, slimes: 1, rules: { hungry: true } }));
  it('eyes an adjacent card after resting, then eats it and grows hungrier', () => {
    let state = tickBattle(setup(), 1.01);
    expect(dark(state).eye).toMatchObject({ cardId: 'ten', column: 0 });
    state = tickBattle(state, EYE_SECONDS);
    expect(dark(state)).toMatchObject({ rank: 10, fed: 1, eye: null });
    expect(state.columns[0].map((c) => c.id)).toEqual(['under']);
    expect(state.events.some((e) => e.kind === 'take')).toBe(true);
  });
  it('hits harder for every card fed, then the meal is spent', () => {
    let state = { ...setup(), foes: setup().foes.map((f) => ({ ...f, fed: 2, timer: 0.99, rest: 99 })) };
    state = tickBattle(state, 0.1);
    expect(state.party[0].hp).toBe(state.party[0].maxHp - SLIME.damage - 2);
    expect(dark(state).fed).toBe(0);
  });
  it('lets the party snatch the eyed card for a bonus charge', () => {
    let state = createBattle({ tableau: [[card(3, 'three')]], stock: [] }, { mochi: false, slimes: 1, rules: { hungry: true } });
    state = { ...started(state), foes: state.foes.map((f) => ({ ...f, rank: 4, eye: { cardId: 'three', column: 0, left: 1, total: EYE_SECONDS } })) };
    state = playCard(state, 0, 'hero');
    expect(state.party[0].charge).toBe(2);
    expect(dark(state).eye).toBeNull();
    expect(state.events.some((e) => e.kind === 'snatch')).toBe(true);
  });
  it('turns up a stock card when nothing on the table fits', () => {
    let state = createBattle({ tableau: [[card(1, 'ace')]], stock: [card(5, 's5')] }, { mochi: false, slimes: 1, rules: { hungry: true } });
    state = tickBattle(started(state), 1.01);
    expect(dark(state)).toMatchObject({ rank: 5, eye: null, rest: FORAGE_REST });
  });
  it('stops foraging while staggered', () => {
    let state = tickBattle(setup(), 1.01);
    state = { ...state, foes: state.foes.map((f) => ({ ...f, staggered: 3 })) };
    expect(dark(tickBattle(state, 0.1)).eye).toBeNull();
  });
  it('leaves basic battles untouched', () => {
    const state = started(createBattle(hungryDeal(), { mochi: false, slimes: 1 }));
    expect(tickBattle(state, 5).columns).toBe(state.columns);
  });
});

describe('booby traps', () => {
  const setup = () => started(createBattle(hungryDeal(), { mochi: false, slimes: 1, rules: { hungry: true, traps: true } }));
  const charged = (state: BattleState, charge: number) => ({ ...state, party: state.party.map((a) => ({ ...a, charge })) });
  it('arms the top card with the ability, and the slime that eats it takes the bonus', () => {
    let state = charged(setup(), 4);
    expect(previewTrap(state, 'hero', 0)).toMatchObject({ cardId: 'ten', damage: Math.round(attackFor('hero', 4)!.damage * TRAP_BONUS) });
    state = applyTrap(state, 'hero', 0);
    expect(state.traps.ten).toMatchObject({ name: 'Nip' });
    expect(state.party[0].charge).toBe(3);
    state = tickBattle(tickBattle(state, 1.01), EYE_SECONDS);
    expect(dark(state).hp).toBe(SLIME.maxHp - Math.round(attackFor('hero', 4)!.damage * TRAP_BONUS));
    expect(dark(state).fed).toBe(0);
    expect(state.traps).toEqual({});
    expect(state.events.some((e) => e.kind === 'trap')).toBe(true);
  });
  it('keeps a trapped card for the slimes, and is refused outside trap battles', () => {
    let state = charged(createBattle({ tableau: [[card(3, 'three')]], stock: [] }, { mochi: false, slimes: 1, rules: { hungry: true, traps: true } }), 2);
    state = applyTrap(state, 'hero', 0);
    expect(playCard(state, 0, 'hero')).toBe(state);
    const basic = charged(createBattle(hungryDeal(), { mochi: false }), 3);
    expect(applyTrap(basic, 'hero', 0)).toBe(basic);
    expect(previewTrap(basic, 'hero', 0)).toBeNull();
  });
});

describe('scenarios', () => {
  it('sets up each scenario', () => {
    expect(BATTLE_SCENARIOS.map((s) => s.id)).toEqual(['basic', 'hungry', 'traps', 'grove']);
    const grove = createBattle(createSeededSmallWoodsDeal(), scenarioById('grove').setup);
    expect(grove.foes).toHaveLength(3);
    expect(grove.party.map((a) => a.spirits)).toEqual([['wisp', 'cal'], ['moss']]);
    expect(scenarioById('nope').id).toBe('basic');
  });
  // A steady player (a card a second) who snatches eyed cards and spends at 7
  // or before a hit, setting traps on eyed cards where traps exist.
  const simulate = (id: string, pace = 1) => {
    let state = createBattle(createSeededSmallWoodsDeal(), scenarioById(id).setup);
    for (let t = 0; t < 240 && !state.result; t += pace) {
      for (const actor of state.party.filter((a) => a.hp > 0)) {
        const living = state.foes.filter((f) => f.hp > 0);
        const kill = living.find((f) => previewAttack(state, actor.id, f.id)?.ko);
        const threatened = enemyTarget(state)?.id === actor.id && living.some((f) => !f.staggered && f.timer > 1 - (pace * 1.5) / f.profile.attackSeconds);
        const eyed = state.rules.traps ? living.find((f) => f.eye && previewTrap(state, actor.id, f.eye.column)) : undefined;
        if (kill) state = applyAttack(state, actor.id, kill.id);
        else if (eyed && actor.charge >= 3) state = applyTrap(state, actor.id === 'hero' ? 'hero:Bite' : actor.id, eyed.eye!.column);
        else if ((actor.charge >= 7 || threatened) && living.length) state = applyAttack(state, actor.id, living.sort((a, b) => a.hp - b.hp)[0].id);
      }
      const tops = state.columns.map((c) => c[c.length - 1]);
      const snatch = tops.findIndex((c) => c && state.foes.some((f) => f.eye?.cardId === c.id) && eligibleActors(state, c).length);
      const column = snatch >= 0 ? snatch : tops.findIndex((c) => c && eligibleActors(state, c).length);
      if (column >= 0) state = playCard(state, column, eligibleActors(state, tops[column]).sort((a, b) => b.charge - a.charge)[0].id);
      else if (canDeal(state)) state = dealRow(state);
      state = tickBattle(state, pace);
    }
    return state;
  };
  it.each(['basic', 'hungry', 'traps', 'grove'])('%s is winnable by a steady player and lost by a slow one', (id) => {
    const steady = simulate(id, 1);
    expect(steady.result).toBe('won');
    expect(steady.time).toBeLessThan(90);
    expect(simulate(id, 1.8).result).toBe('lost');
  });
});
