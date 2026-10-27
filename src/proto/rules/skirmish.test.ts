import { describe, expect, it } from 'vitest';
import { SHADOW_WOLF, SKIRMISH_COLUMNS, SKIRMISH_OPENING, SKIRMISH_ROWS, SNAP_DAMAGE, STRIKE_DAMAGE, bestSkirmishMove, createSkirmish, heroDraw, heroPlay, playableColumns, stepSkirmish, type SkirmishState } from './skirmish';

const DT = 1 / 60;
const HERO = { hp: 11, maxHp: 14 };

// A simulated hero: acts `reaction` seconds after the table last changed
// (a play, a take, a new eye), so slower readers act less often and answer
// the wolf's eye later. `snaps` decides whether they watch the eye at all.
const fight = (seed: number, reaction: number, snaps = true) => {
  let state = createSkirmish(seed, HERO);
  let seenAt = 0;
  let seen = '';
  while (!state.result && state.time < 120) {
    const look = `${state.event?.id ?? 0}:${state.eye?.cardId ?? ''}`;
    if (look !== seen) { seen = look; seenAt = state.time; }
    if (reaction < Infinity && state.time - seenAt >= reaction) {
      const move = snaps ? bestSkirmishMove(state) : (() => { const playable = playableColumns(state); return playable.length ? { kind: 'play' as const, column: playable[0] } : { kind: 'draw' as const }; })();
      state = move.kind === 'play' ? heroPlay(state, move.column) : heroDraw(state);
      seenAt = state.time;
    }
    state = stepSkirmish(state, DT);
  }
  return state;
};
const outcomes = (reaction: number, snaps = true) => {
  const fights = Array.from({ length: 200 }, (_, index) => fight((index + 1) * 7919, reaction, snaps));
  return {
    winRate: fights.filter((entry) => entry.result === 'won').length / fights.length,
    meanTime: fights.reduce((total, entry) => total + entry.time, 0) / fights.length,
    meanHp: fights.filter((entry) => entry.result === 'won').reduce((total, entry) => total + entry.hero.hp, 0) / Math.max(1, fights.filter((entry) => entry.result === 'won').length),
  };
};

const withTops = (state: SkirmishState, ranks: number[]): SkirmishState => ({
  ...state,
  columns: ranks.map((rank, column) => [{ id: `under-${column}`, rank: 13 - rank || 13 }, { id: `top-${column}`, rank }]),
});

describe('skirmish', () => {
  it('deals the same table for a seed, with a strike open for the hero', () => {
    const state = createSkirmish(42, HERO);
    expect(createSkirmish(42, HERO)).toEqual(state);
    expect(state.columns).toHaveLength(SKIRMISH_COLUMNS);
    expect(state.columns.every((column) => column.length === SKIRMISH_ROWS)).toBe(true);
    expect(playableColumns(state).length).toBeGreaterThan(0);
    expect(state.hero.hp).toBe(HERO.hp);
    expect(state.enemy.hp).toBe(SHADOW_WOLF.maxHp);
  });

  it('the hero strikes with a card one rank away (A and K wrap) and is refused any other', () => {
    const base = withTops({ ...createSkirmish(1, HERO), hero: { ...HERO, rank: 13 } }, [1, 12, 5, 2, 3, 4, 6]);
    const struck = heroPlay(base, 0);
    expect(struck.hero.rank).toBe(1);
    expect(struck.enemy.hp).toBe(SHADOW_WOLF.maxHp - STRIKE_DAMAGE);
    expect(struck.columns[0].map((card) => card.id)).toEqual(['under-0']);
    expect(heroPlay(base, 2)).toBe(base);
    expect(heroPlay(struck, 3).hero.rank).toBe(2);
  });

  it('an emptied column is dealt fresh cards, and drawing turns up a new foundation card', () => {
    const base = { ...createSkirmish(3, HERO), hero: { ...HERO, rank: 5 } };
    const emptied = heroPlay({ ...base, columns: [[{ id: 'only', rank: 6 }], ...base.columns.slice(1)] }, 0);
    expect(emptied.columns[0]).toHaveLength(SKIRMISH_ROWS);
    const drawn = heroDraw(base);
    expect(drawn.dealt).toBe(base.dealt + 1);
    expect(drawn.event?.kind).toBe('draw');
  });

  it('the wolf waits, eyes a card it can take, then takes it and builds fury', () => {
    let state = createSkirmish(11, HERO);
    while (!state.eye) state = stepSkirmish(state, DT);
    expect(state.time).toBeGreaterThanOrEqual(SKIRMISH_OPENING);
    const eyed = state.columns[state.eye.column].slice(-1)[0];
    expect(eyed.id).toBe(state.eye.cardId);
    expect(Math.abs(eyed.rank - state.enemy.rank) % 12).toBe(1);
    const fury = state.enemy.fury;
    while (state.eye) state = stepSkirmish(state, DT);
    expect(state.enemy.rank).toBe(eyed.rank);
    expect(state.enemy.fury).toBe(fury + 1);
    expect(state.event?.kind).toBe('take');
  });

  it('full fury makes the take a longer-telegraphed pounce that hits the hero', () => {
    let state = { ...createSkirmish(5, HERO), enemy: { ...createSkirmish(5, HERO).enemy, fury: SHADOW_WOLF.furyMax - 1 } };
    while (!state.eye) state = stepSkirmish(state, DT);
    expect(state.eye.pounce).toBe(true);
    expect(state.eye.total).toBe(SHADOW_WOLF.pounceEye);
    while (state.eye) state = stepSkirmish(state, DT);
    expect(state.event?.kind).toBe('pounce');
    expect(state.hero.hp).toBe(HERO.hp - SHADOW_WOLF.pounceDamage);
    expect(state.enemy.fury).toBe(0);
  });

  it('snapping the eyed card strikes harder, staggers the wolf and calms its fury', () => {
    let state = createSkirmish(17, HERO);
    while (!state.eye) state = stepSkirmish(state, DT);
    const eyed = state.columns[state.eye.column].slice(-1)[0];
    state = { ...state, hero: { ...state.hero, rank: eyed.rank === 13 ? 1 : eyed.rank + 1 }, enemy: { ...state.enemy, fury: 2 } };
    const snapped = heroPlay(state, state.eye!.column);
    expect(snapped.event?.kind).toBe('snap');
    expect(snapped.enemy.hp).toBe(SHADOW_WOLF.maxHp - SNAP_DAMAGE);
    expect(snapped.enemy.fury).toBe(1);
    expect(snapped.eye).toBeNull();
    expect(snapped.rest).toBe(SHADOW_WOLF.stagger);
  });

  it('when the wolf has nothing to take it prowls to a new rank instead of stalling', () => {
    let state = withTops({ ...createSkirmish(2, HERO), enemy: { rank: 7, hp: 10, fury: 0 }, rest: 0 }, [1, 2, 3, 4, 10, 11, 12]);
    state = stepSkirmish(state, DT);
    expect(state.event?.kind).toBe('prowl');
    expect(state.eye).toBeNull();
  });

  it('ends when either side falls', () => {
    const base = withTops({ ...createSkirmish(1, HERO), hero: { ...HERO, rank: 13 }, enemy: { rank: 4, hp: 1, fury: 0 } }, [1, 12, 5, 2, 3, 4, 6]);
    const won = heroPlay(base, 0);
    expect(won.result).toBe('won');
    expect(stepSkirmish(won, 1)).toBe(won);
    expect(heroPlay(won, 1)).toBe(won);
  });

  // Balance. The fight should be short, reward quick reading and punish an idle hero.
  it('balance: quick readers win comfortably, typical players win most, slow ones struggle, idle heroes lose', () => {
    const quick = outcomes(0.45);
    const typical = outcomes(0.9);
    const slow = outcomes(1.5);
    const idle = outcomes(Infinity);
    expect(quick.winRate).toBe(1);
    expect(quick.meanHp).toBeGreaterThan(7);
    expect(typical.winRate).toBeGreaterThanOrEqual(0.85);
    expect(slow.winRate).toBeLessThan(typical.winRate);
    expect(idle.winRate).toBe(0);
    // A typical fight is over in well under a minute.
    expect(typical.meanTime).toBeLessThan(40);
  });

  it('balance: watching the eye matters', () => {
    expect(outcomes(0.9, true).winRate).toBeGreaterThan(outcomes(0.9, false).winRate);
  });
});
