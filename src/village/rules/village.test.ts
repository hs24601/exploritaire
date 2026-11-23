import { describe, expect, it } from 'vitest';
import { DAYLIGHT } from './daylight';
import { newGame, reduce, type Action, type GameState } from './game';
import { canPlay, draw, legalPlays, play, rng, runEnd } from './golf';
import { planner } from './players';
import { SURFACES } from './surfaces';
import { BUILDINGS, activeCombos, appeal, nightfall, newVillage, rank, welcomeBlocker, type BuildingId, type VillageState } from './village';

const last = <T,>(xs: T[]): T | undefined => xs[xs.length - 1];

describe('golf surfaces', () => {
  it('forest deals 7 trees of 5 with one card on the foundation', () => {
    const run = SURFACES.forest.deal(1);
    expect(run.piles.map(p => p.cards.length)).toEqual([5, 5, 5, 5, 5, 5, 5]);
    expect(run.foundation).toHaveLength(1);
    expect(run.stock).toHaveLength(52 - 35 - 1);
  });

  it('only plays a card one rank away, King and Ace connect', () => {
    const run = SURFACES.forest.deal(3);
    for (let i = 0; i < run.piles.length; i++) {
      const t = last(run.piles[i].cards)!.rank;
      const b = last(run.foundation)!.rank;
      const d = Math.abs(t - b);
      expect(canPlay(run, i)).toBe(d === 1 || d === 12);
    }
  });

  it('felling a whole tree pays the bundle', () => {
    let run = SURFACES.forest.deal(5);
    run = { ...run, piles: [{ cards: [{ id: 99, rank: 5, yield: 1 }] }, ...run.piles.slice(1)], foundation: [{ id: 98, rank: 4, yield: 1 }] };
    const after = play(run, 0);
    expect(after.felled).toBe(1);
    expect(after.earned).toBe(1 + run.fellBonus);
  });

  it('picking a berry ripens the neighbours, and unripe berries cannot be played', () => {
    let run = SURFACES.berries.deal(7);
    run = {
      ...run,
      piles: run.piles.map((p, i) => ({ ...p, cards: [{ id: 100 + i, rank: (i === 4 ? 6 : 6) as 6, yield: 1, unripe: i !== 4 }] })),
      foundation: [{ id: 1, rank: 5, yield: 1 }],
    };
    expect(canPlay(run, 1)).toBe(false);
    const after = play(run, 4);
    for (const n of [1, 3, 5, 7]) expect(last(after.piles[n].cards)?.unripe).toBe(false);
    expect(last(after.piles[0].cards)?.unripe).toBe(true);
  });

  it('quarry rock is hidden until dug to, and deeper rock pays more', () => {
    const run = SURFACES.quarry.deal(11);
    for (const p of run.piles) {
      expect(last(p.cards)!.hidden).toBe(false);
      expect(p.cards.slice(0, -1).every(c => c.hidden)).toBe(true);
      expect(p.cards[0].yield).toBeGreaterThan(last(p.cards)!.yield);
    }
  });

  it('a run always ends', () => {
    for (let s = 1; s < 40; s++) for (const id of ['forest', 'berries', 'quarry'] as const) {
      let r = SURFACES[id].deal(s);
      const p = planner(3);
      for (let k = 0; k < 400 && !runEnd(r); k++) { const m = p(r); r = m === 'draw' ? draw(r) : play(r, m); }
      expect(runEnd(r)).not.toBeNull();
      if (runEnd(r) === 'stuck') expect(legalPlays(r)).toHaveLength(0);
    }
  });
});

describe('daylight', () => {
  it('tableau plays cost little and stock draws cost much more', () => {
    expect(DAYLIGHT.drawMinutes).toBeGreaterThanOrEqual(DAYLIGHT.playMinutes * 5);
    let g = reduce(newGame(9), { type: 'start', surface: 'forest' });
    expect(g.minutes).toBe(DAYLIGHT.startMinutes);
    g = reduce(g, { type: 'draw' });
    expect(g.minutes).toBe(DAYLIGHT.startMinutes + DAYLIGHT.drawMinutes);
  });

  it('the stock refuses a draw the light cannot pay for, and dusk ends the run and the day', () => {
    let seed = 1;
    while (legalPlays(SURFACES.forest.deal(seed)).length === 0) seed++;
    let g = { ...newGame(seed), minutes: DAYLIGHT.dayMinutes - DAYLIGHT.startMinutes - DAYLIGHT.playMinutes };
    g = reduce(g, { type: 'start', surface: 'forest' });
    expect(reduce(g, { type: 'draw' })).toBe(g);
    g = reduce(g, { type: 'play', pile: legalPlays(g.active!.run)[0] });
    expect(g.active).toBeNull();
    expect(g.night).not.toBeNull();
  });
});

describe('village', () => {
  const place = (v: VillageState, at: Record<number, BuildingId>): VillageState => {
    const plots = v.plots.slice();
    for (const [i, b] of Object.entries(at)) plots[+i] = b;
    return { ...v, plots };
  };

  it('adjacent buildings form combos', () => {
    const v = place(newVillage(), { 6: 'campfire', 7: 'bench' });
    expect(activeCombos(v.plots).map(c => c.combo.id)).toEqual(['hearth']);
    expect(appeal(v)).toBe(2 + 1 + 2);
    const apart = place(newVillage(), { 0: 'campfire', 9: 'bench' });
    expect(activeCombos(apart.plots)).toHaveLength(0);
  });

  it('wanderers need a bed, and later ones need something they like', () => {
    let v = newVillage();
    expect(welcomeBlocker(v, 'mochi')).toBe('Needs a free bed');
    v = place(v, { 0: 'leanto' });
    expect(welcomeBlocker(v, 'mochi')).toBeNull();
    v = { ...place(v, { 1: 'leanto' }), residents: [{ kin: 'mochi', hungry: 0 }] };
    expect(welcomeBlocker(v, 'banks')).toMatch(/Wants something/);
    v = place(v, { 2: 'bench' });
    expect(welcomeBlocker(v, 'banks')).toBeNull();
  });

  it('kin eat at night, go hungry, then leave', () => {
    let v: VillageState = { ...place(newVillage(), { 0: 'leanto' }), residents: [{ kin: 'mochi', hungry: 0 }], resources: { lumber: 0, food: 0, stone: 0 } };
    let night = nightfall(v);
    expect(night.report.hungry).toEqual(['mochi']);
    night = nightfall(night.village);
    expect(night.report.left).toEqual(['mochi']);
    expect(night.village.residents).toHaveLength(0);
  });

  it('food spoils overnight unless there is a drying rack', () => {
    const v = { ...newVillage(), resources: { lumber: 0, food: 40, stone: 0 } };
    expect(nightfall(v).village.resources.food).toBe(30);
    expect(nightfall(place(v, { 0: 'rack' })).village.resources.food).toBe(40);
  });
});

/** A plain bot that plays the whole slice through the reducer. */
function playSlice(seed: number, maxDays = 20): GameState {
  let g = newGame(seed);
  const rand = rng(seed);
  const act = (a: Action) => { g = reduce(g, a); };
  const order: BuildingId[] = ['leanto', 'campfire', 'bench', 'leanto', 'stall', 'rack', 'burrow', 'lantern', 'well'];
  const plotFor: Partial<Record<number, number>> = { 0: 6, 1: 7, 2: 8, 3: 5, 4: 11, 5: 12, 6: 1, 7: 13, 8: 14 };
  let next = 0;
  const p = planner(4);
  while (g.day <= maxDays && rank(g.village) < 3) {
    // Gather toward the next building, keeping a food buffer for the kin.
    const want = order[next] ? BUILDINGS[order[next]].cost : {};
    const eats = g.village.residents.length * 9 + 10;
    const surface = g.village.resources.food < eats ? 'berries'
      : (want.stone ?? 0) > g.village.resources.stone && g.rankReached >= 2 ? 'quarry'
        : (want.food ?? 0) > g.village.resources.food ? 'berries' : 'forest';
    act({ type: 'start', surface });
    let draws = 0;
    while (g.active) {
      const m = p(g.active.run);
      if (m === 'draw') { if (++draws > 12 + Math.floor(rand() * 3)) { act({ type: 'leave' }); break; } act({ type: 'draw' }); } else act({ type: 'play', pile: m });
    }
    while (order[next] && g.rankReached >= BUILDINGS[order[next]].rank) {
      const before = g.village.plots.slice();
      act({ type: 'build', building: order[next], plot: plotFor[next]! });
      if (g.village.plots[plotFor[next]!] === before[plotFor[next]!]) break;
      next++;
    }
    for (const w of g.village.gate) act({ type: 'welcome', kin: w.kin });
    if (g.night) act({ type: 'dawn' });
    else if (!g.active && g.minutes > DAYLIGHT.dayMinutes - 60) { act({ type: 'rest' }); act({ type: 'dawn' }); }
  }
  return g;
}

describe('the slice loop', () => {
  it('a plain player reaches Town in about a week', () => {
    const days = [1, 2, 3, 4, 5, 6, 7, 8].map(seed => playSlice(seed)).map(g => (rank(g.village) === 3 ? g.day : Infinity));
    for (const d of days) expect(d).toBeLessThanOrEqual(12);
    expect(Math.min(...days)).toBeGreaterThanOrEqual(3);
  });
});
