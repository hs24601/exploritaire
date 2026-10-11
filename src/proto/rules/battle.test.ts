import { describe, expect, it } from 'vitest';
import type { Card } from '../protoState';
import { SPIRITS, attackFor, comboPower, nextBreakpoint } from './battleAbilities';
import {
  MAX_COLUMN, SLIME, addSlime, applyAttack, canDeal, canPlay, createBattle, dealRow, eligibleActors, enemyTarget, playCard,
  previewAttack, removeSlime, setMochi, setSpirit, tickBattle, type BattleState,
} from './battle';
import { createSeededSmallWoodsDeal } from './setup';

const SIM_TABLE = (globalThis as { process?: { env: Record<string, string | undefined> } }).process?.env.SIM_TABLE;
const card = (rank: number, id = `c${rank}-${Math.random()}`): Card => ({ id, rank });
/** A table whose columns run up from the hero's 2, so each play is legal: 3, 4, 5, ... */
const runDeal = (length: number) => ({ tableau: [Array.from({ length }, (_, i) => card(((2 + length - i - 1) % 13) + 1))], stock: [] });
const withCharge = (state: BattleState, actorId: string, charge: number) => ({ ...state, party: state.party.map((a) => (a.id === actorId ? { ...a, charge } : a)) });
const foe = (state: BattleState, id = 'dark-slime') => state.foes.find((f) => f.id === id)!;

describe('abilities', () => {
  it('scales damage faster than the card count', () => {
    expect([1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(comboPower)).toEqual([1, 2, 3, 5, 7, 9, 11, 14, 17, 20]);
  });
  it('upgrades in place at the charge breakpoints', () => {
    expect([1, 3, 4, 6, 7, 10].map((n) => attackFor('hero', n)!.name)).toEqual(['Nip', 'Nip', 'Bite', 'Bite', 'Takedown', 'Takedown']);
    expect([1, 4, 7].map((n) => attackFor('mochi', n)!.name)).toEqual(['Scratch', 'Claw', 'Lacerate']);
    expect(attackFor('hero', 0)).toBeNull();
    expect(attackFor('hero', 7)!.tags).toContain('Knockdown');
    expect(attackFor('mochi', 7)!.effects.map((e) => e.kind)).toEqual(['bleed']);
    expect(nextBreakpoint('hero', 2)).toEqual({ at: 4, label: 'Bite' });
  });
  it('gives Hero the damage and Mochi the stagger', () => {
    const hero = attackFor('hero', 6)!, mochi = attackFor('mochi', 6)!;
    expect(hero.damage).toBeGreaterThan(mochi.damage);
    expect(mochi.stagger).toBeGreaterThan(hero.stagger);
  });
  it('adds fire with Cal only above combo 3', () => {
    expect(attackFor('hero', 3, ['cal'])!.name).toBe('Nip');
    const inferno = attackFor('hero', 4, ['cal'])!;
    expect(inferno.name).toBe('Inferno Bite');
    expect(inferno.element).toBe('fire');
    expect(inferno.damage).toBe(Math.round(attackFor('hero', 4)!.damage * 1.5));
    expect(inferno.effects.map((e) => e.kind)).toEqual(['burn']);
    expect(attackFor('hero', 10, ['cal'])!.name).toBe('Inferno Takedown');
  });
});

describe('battle table', () => {
  it('opens with Hero, Mochi and two slimes, timers waiting for the first play', () => {
    const state = createBattle(createSeededSmallWoodsDeal());
    expect(state.party.map((a) => a.id)).toEqual(['hero', 'mochi']);
    expect(state.foes.map((f) => f.id)).toEqual(['dark-slime', 'rear-slime']);
    expect(tickBattle(state, 5)).toBe(state);
    // Later slimes start behind, so the two don't strike together.
    const fired = tickBattle({ ...state, started: true }, SLIME.attackSeconds + 0.01);
    expect(fired.events.filter((e) => e.kind === 'enemy-hit')).toHaveLength(1);
  });
  it('builds charge with each card and keeps the foundation run when attacking', () => {
    let state = createBattle(runDeal(4), { mochi: false });
    state = playCard(state, 0, 'hero');
    state = playCard(state, 0, 'hero');
    expect(state.party[0]).toMatchObject({ rank: 4, count: 2, charge: 2 });
    state = applyAttack(state, 'hero', 'dark-slime');
    expect(state.party[0]).toMatchObject({ rank: 4, count: 2, charge: 0 });
    expect(canPlay(state, 'hero', state.columns[0][state.columns[0].length - 1])).toBe(true);
  });
  it("plays Eric's split: a 1-card Nip finishes the 1 HP slime, the next 9 cards hit the other", () => {
    let state = createBattle(runDeal(10), { mochi: false });
    state = { ...state, foes: state.foes.map((f) => (f.id === 'dark-slime' ? { ...f, hp: 1 } : f)) };
    state = playCard(state, 0, 'hero');
    expect(previewAttack(state, 'hero', 'dark-slime')!.ko).toBe(true);
    state = applyAttack(state, 'hero', 'dark-slime');
    expect(foe(state).hp).toBe(0);
    for (let i = 0; i < 9; i += 1) state = playCard(state, 0, 'hero');
    expect(state.party[0]).toMatchObject({ charge: 9, count: 10 });
    expect(previewAttack(state, 'hero', 'dark-slime')).toBeNull();
    const preview = previewAttack(state, 'hero', 'rear-slime')!;
    expect(preview.attack.name).toBe('Takedown');
    state = applyAttack(state, 'hero', 'rear-slime');
    expect(foe(state, 'rear-slime').hp).toBe(preview.hp.after);
    expect(state.result).toBe('won');
  });
  it('refills an emptied column and deals a row without touching foundations', () => {
    let state = createBattle(runDeal(1), { mochi: false });
    state = playCard(state, 0, 'hero');
    expect(state.columns[0]).toHaveLength(2);
    const dealt = dealRow(state);
    expect(dealt.columns[0]).toHaveLength(3);
    expect(dealt.party).toBe(state.party);
    let full = state;
    for (let i = 0; i < MAX_COLUMN; i += 1) full = dealRow(full);
    expect(full.columns[0]).toHaveLength(MAX_COLUMN);
    expect(canDeal(full)).toBe(false);
  });
  it('lets a spirit widen legal play through the play-rule hook', () => {
    const state = createBattle(runDeal(1), { mochi: false });
    const gap = card(4);
    expect(canPlay(state, 'hero', gap)).toBe(false);
    SPIRITS.test = { id: 'test', name: 'Test', element: 'fire', from: 99, prefix: '', damageMul: 1, playRule: (a, b) => Math.abs(a - b) === 2 };
    try { expect(canPlay(setSpirit(state, 'hero', 'test', true), 'hero', gap)).toBe(true); } finally { delete SPIRITS.test; }
  });
});

describe('stagger and the attack timer', () => {
  const started = (setup = {}) => ({ ...createBattle(runDeal(1), setup), started: true });
  it('previews exactly what the drop does', () => {
    let state = withCharge(started({ spirits: { hero: ['cal'] } }), 'hero', 5);
    state = tickBattle(state, 3);
    const preview = previewAttack(state, 'hero', 'dark-slime')!;
    const after = foe(applyAttack(state, 'hero', 'dark-slime'));
    expect(preview.hp.after).toBe(after.hp);
    expect(preview.stagger.after).toBe(after.stagger);
    expect(preview.timer.after).toBe(after.timer);
    expect(preview.timer.after).toBeLessThan(preview.timer.before);
    expect(preview.effects.map((e) => e.kind)).toEqual(['burn']);
  });
  it('staggers on a full gauge: timer stops, damage taken rises, then the gauge resets', () => {
    let state = tickBattle(withCharge(started(), 'mochi', 7), 2);
    state = { ...state, foes: state.foes.map((f) => ({ ...f, hp: 50 })) };
    const preview = previewAttack(state, 'mochi', 'dark-slime')!;
    expect(preview.staggers).toBe(true);
    state = applyAttack(state, 'mochi', 'dark-slime');
    expect(foe(state).staggered).toBe(SLIME.staggerSeconds);
    const timer = foe(state).timer;
    state = tickBattle(state, 2);
    expect(foe(state).timer).toBe(timer);
    state = withCharge(state, 'hero', 4);
    const boosted = previewAttack(state, 'hero', 'dark-slime')!;
    expect(boosted.vulnerable).toBe(true);
    expect(boosted.damage).toBe(Math.round(attackFor('hero', 4)!.damage * SLIME.vulnerability));
    state = tickBattle(state, SLIME.staggerSeconds);
    expect(foe(state)).toMatchObject({ staggered: 0, stagger: 0 });
    expect(foe(tickBattle(state, 1)).timer).toBeGreaterThan(timer);
  });
  it('hits the actor holding the most charge and resets that charge only', () => {
    let state = withCharge(withCharge(started({ slimes: 1 }), 'hero', 2), 'mochi', 5);
    expect(enemyTarget(state)!.id).toBe('mochi');
    state = tickBattle(state, SLIME.attackSeconds + 0.01);
    const mochi = state.party.find((a) => a.id === 'mochi')!;
    expect(mochi.hp).toBe(mochi.maxHp - SLIME.damage);
    expect(mochi.charge).toBe(0);
    expect(state.party[0].charge).toBe(2);
  });
  it('ticks burn and bleed, with stagger raising them too', () => {
    let state = applyAttack(withCharge(started(), 'mochi', 7), 'mochi', 'dark-slime');
    const hp = foe(state).hp;
    state = tickBattle(state, 1);
    expect(foe(state).hp).toBe(hp - Math.round(1 * SLIME.vulnerability));
  });
  it('loses when the whole party is down and wins when every slime is', () => {
    let state = { ...started({ mochi: false }), party: started({ mochi: false }).party.map((a) => ({ ...a, hp: 1 })) };
    state = tickBattle(state, SLIME.attackSeconds);
    expect(state.result).toBe('lost');
    expect(eligibleActors(state, card(3))).toEqual([]);
  });
});

describe('roster controls', () => {
  it('adds and removes Mochi and slimes within limits', () => {
    let state = createBattle(createSeededSmallWoodsDeal());
    state = setMochi(state, false);
    expect(state.party.map((a) => a.id)).toEqual(['hero']);
    state = setMochi(state, true);
    expect(state.party.map((a) => a.id)).toEqual(['hero', 'mochi']);
    state = addSlime(addSlime(state));
    expect(state.foes).toHaveLength(3);
    state = removeSlime(removeSlime(removeSlime(state)));
    expect(state.foes.map((f) => f.id)).toEqual(['dark-slime']);
  });
});

describe('balance', () => {
  // A player who plays a card every `pace` seconds, spends a charge of 7 (or
  // whatever kills), and deals a row when stuck.
  const simulate = (pace: number, spend = 7, setup = {}) => {
    let state = createBattle(createSeededSmallWoodsDeal(), setup);
    for (let t = 0; t < 240 && !state.result; t += pace) {
      const living = state.party.filter((a) => a.hp > 0);
      for (const actor of living) {
        const kill = state.foes.find((f) => f.hp > 0 && (previewAttack(state, actor.id, f.id)?.ko ?? false));
        const weakest = state.foes.filter((f) => f.hp > 0).sort((a, b) => a.hp - b.hp)[0];
        // A hit wipes the target's charge, so cash in when a timer is about to fire.
        const threatened = enemyTarget(state)?.id === actor.id && state.foes.some((f) => f.hp > 0 && !f.staggered && f.timer > 1 - (pace * 1.5) / f.profile.attackSeconds);
        if (kill) state = applyAttack(state, actor.id, kill.id);
        else if ((actor.charge >= spend || (threatened && spend < 99)) && weakest) state = applyAttack(state, actor.id, weakest.id);
      }
      const column = state.columns.findIndex((c) => eligibleActors(state, c[c.length - 1]).length);
      if (column >= 0) {
        const options = eligibleActors(state, state.columns[column][state.columns[column].length - 1]);
        state = playCard(state, column, options.sort((a, b) => b.charge - a.charge)[0].id);
      } else state = canDeal(state) ? dealRow(state) : state;
      state = tickBattle(state, pace);
    }
    return state;
  };
  // Run with SIM_TABLE=1 to print pace/spend outcomes while tuning.
  it.skipIf(!SIM_TABLE)('prints a balance table', () => {
    for (const pace of [0.6, 0.8, 1, 1.2, 1.5]) for (const spend of [4, 7, 10]) {
      const s = simulate(pace, spend);
      console.log(`pace ${pace} spend ${spend}: ${s.result} at ${s.time.toFixed(0)}s, party ${s.party.map((a) => a.hp).join('/')}`);
    }
  });
  it('a steady player beats two slimes with Hero and Mochi; a slow one does not', () => {
    const steady = simulate(1);
    expect(steady.result).toBe('won');
    expect(steady.time).toBeLessThan(60);
    expect(simulate(1.5).result).toBe('lost');
  });
  it('a player who never spends charge loses', () => {
    expect(simulate(1.2, 99).result).toBe('lost');
  });
});
