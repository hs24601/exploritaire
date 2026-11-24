import { describe, expect, it } from 'vitest';
import { DAYLIGHT } from './daylight';
import { migrate, newGame, reduce, type Action, type GameState } from './game';
import { type Pile, type Rank, type Run, canPlay, draw, heldLumber, legalPlays, play, rng, runEnd } from './golf';
import { FEATURES, GATE, MAP_COLS, MAP_ROWS, fogged, neighboursOf, tileIndex } from './map';
import { planner } from './players';
import { SURFACES } from './surfaces';
import {
  BUILDINGS, REFUND_RATE, activeCombos, appeal, demolishBlocker, nightfall, newVillage, placeBlocker, placementPreview, rank, refundFor,
  siteBonuses, welcomeBlocker, type BuildingId, type VillageState,
} from './village';

const last = <T,>(xs: T[]): T | undefined => xs[xs.length - 1];

describe('golf surfaces', () => {
  it('Birch Stand deals 7 columns of 5; Old Oaks deals 8 columns of 4 (4 trees)', () => {
    const birch = SURFACES.forest.deal(1, 0);
    expect(birch.piles.map(p => p.cards.length)).toEqual([5, 5, 5, 5, 5, 5, 5]);
    expect(birch.piles.every(p => p.tree === undefined)).toBe(true);
    expect(birch.stock).toHaveLength(52 - 35 - 1);
    const run = SURFACES.forest.deal(1, 1);
    expect(run.piles.map(p => p.cards.length)).toEqual([4, 4, 4, 4, 4, 4, 4, 4]);
    expect(run.foundation).toHaveLength(1);
    expect(run.stock).toHaveLength(52 - 32 - 1);
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

  it('a forest column pays only when finished, and finishing both columns fells the tree', () => {
    const run = SURFACES.forest.deal(5, 1);
    expect(run.piles).toHaveLength(8);
    expect(run.piles.map(p => p.tree)).toEqual([0, 0, 1, 1, 2, 2, 3, 3]);
    const col = (ranks: number[], held = 0): Pile => ({ cards: ranks.map((r, k) => ({ id: 200 + r * 10 + k, rank: r as Rank, yield: 1 })), tree: 0, held });
    // Column 0 has two logs (5 under 6), column 1 one log (7).
    let r: Run = { ...run, piles: [col([5, 6]), { ...col([7]), tree: 0 }, ...run.piles.slice(2)], foundation: [{ id: 98, rank: 5, yield: 1 }] };
    r = play(r, 0); // cut the 6: held, not paid
    expect(r.earned).toBe(0);
    expect(r.piles[0].held).toBe(1);
    r = play(r, 0); // cut the 5: column finished, pays both logs, tree still standing
    expect(r.earned).toBe(2);
    expect(r.felled).toBe(0);
    r = { ...r, foundation: [...r.foundation, { id: 97, rank: 6, yield: 1 }] };
    r = play(r, 1); // the other column: tree falls
    expect(r.felled).toBe(1);
    expect(r.earned).toBe(3 + run.fellBonus);
  });

  it('Birch Stand pays each log as it is cut, and a cleared column fells', () => {
    let run = SURFACES.forest.deal(5, 0);
    run = { ...run, piles: [{ cards: [{ id: 99, rank: 5, yield: 1 }] }, ...run.piles.slice(1)], foundation: [{ id: 98, rank: 4, yield: 1 }] };
    const after = play(run, 0);
    expect(after.felled).toBe(1);
    expect(after.earned).toBe(1 + run.fellBonus);
  });

  it('an Old Oaks half-cut column pays nothing if the run ends', () => {
    let r = SURFACES.forest.deal(5, 1);
    const pile = r.piles[0];
    const t = pile.cards[pile.cards.length - 1].rank;
    r = { ...r, foundation: [{ id: 99, rank: ((t % 13) + 1) as 1, yield: 1 }] };
    const after = play(r, 0);
    expect(after.earned).toBe(0);
    expect(heldLumber(after)).toBe(1);
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

/** Put buildings straight onto map tiles, keyed "x,y". */
const place = (v: VillageState, at: Record<string, BuildingId>): VillageState => {
  const plots = v.plots.slice();
  for (const [k, b] of Object.entries(at)) { const [x, y] = k.split(',').map(Number); plots[tileIndex(x, y)] = b; }
  return { ...v, plots };
};

describe('village', () => {
  it('buildings sharing an edge form combos, diagonals do not', () => {
    const v = place(newVillage(), { '3,3': 'campfire', '4,3': 'bench' });
    expect(activeCombos(v.plots).map(c => c.combo.id)).toEqual(['hearth']);
    expect(appeal(v)).toBe(2 + 1 + 2);
    const diagonal = place(newVillage(), { '3,3': 'campfire', '4,4': 'bench' });
    expect(activeCombos(diagonal.plots)).toHaveLength(0);
    const wrapped = place(newVillage(), { '8,2': 'campfire', '0,3': 'bench' });
    expect(activeCombos(wrapped.plots)).toHaveLength(0);
  });

  it('wanderers need a bed, and later ones need something they like', () => {
    let v = newVillage();
    expect(welcomeBlocker(v, 'mochi')).toBe('Needs a free bed');
    v = place(v, { '2,3': 'leanto' });
    expect(welcomeBlocker(v, 'mochi')).toBeNull();
    v = { ...place(v, { '3,3': 'leanto' }), residents: [{ kin: 'mochi', hungry: 0 }] };
    expect(welcomeBlocker(v, 'banks')).toMatch(/Wants/);
    v = place(v, { '4,3': 'bench' });
    expect(welcomeBlocker(v, 'banks')).toBeNull();
  });

  it('kin eat at night, go hungry, then leave', () => {
    let v: VillageState = { ...place(newVillage(), { '2,3': 'leanto' }), residents: [{ kin: 'mochi', hungry: 0 }], resources: { lumber: 0, food: 0, stone: 0 } };
    let night = nightfall(v);
    expect(night.report.hungry).toEqual(['mochi']);
    night = nightfall(night.village);
    expect(night.report.left).toEqual(['mochi']);
    expect(night.village.residents).toHaveLength(0);
  });

  it('a drying rack halves spoilage, and stops it beside the Berry Patch', () => {
    const v = { ...newVillage(), resources: { lumber: 0, food: 40, stone: 0 } };
    expect(nightfall(v).village.resources.food).toBe(30);
    expect(nightfall(place(v, { '3,4': 'rack' })).village.resources.food).toBe(35);
    expect(nightfall(place(v, { '5,1': 'rack' })).village.resources.food).toBe(40);
    // Only an edge counts: diagonal to the patch is just "elsewhere".
    expect(nightfall(place(v, { '5,2': 'rack' })).village.resources.food).toBe(35);
  });
});

describe('the map', () => {
  it('has fixed features, a gate and the quarry under fog', () => {
    expect(MAP_COLS * MAP_ROWS).toBe(54);
    expect(FEATURES.forest.rect).toEqual({ x: 0, y: 0, w: 3, h: 2 });
    for (const f of Object.values(FEATURES)) {
      const { x, y } = f.node;
      expect(x >= f.rect.x && x < f.rect.x + f.rect.w && y >= f.rect.y && y < f.rect.y + f.rect.h).toBe(true);
    }
    expect(fogged(FEATURES.quarry.node.x, FEATURES.quarry.node.y, 1)).toBe(true);
    expect(fogged(FEATURES.quarry.node.x, FEATURES.quarry.node.y, 2)).toBe(false);
    expect(neighboursOf(tileIndex(0, 0)).sort((a, b) => a - b)).toEqual([1, MAP_COLS]);
  });

  it('only lets buildings onto open, revealed, empty land', () => {
    const v = place(newVillage(), { '3,3': 'bench' });
    expect(placeBlocker(v, 1, 'bench', tileIndex(1, 1))).toMatch(/Forest/);
    expect(placeBlocker(v, 1, 'bench', tileIndex(6, 0))).toMatch(/Berry Patch/);
    expect(placeBlocker(v, 1, 'bench', tileIndex(GATE.x, GATE.y))).toMatch(/gate/);
    expect(placeBlocker(v, 1, 'bench', tileIndex(8, 3))).toMatch(/fog/);
    expect(placeBlocker(v, 2, 'bench', tileIndex(8, 3))).toBeNull();
    expect(placeBlocker(v, 1, 'bench', tileIndex(3, 3))).toMatch(/Already/);
    expect(placeBlocker(v, 1, 'bench', -1)).toMatch(/Off the map/);
    expect(placeBlocker(v, 1, 'bench', MAP_COLS * MAP_ROWS)).toMatch(/Off the map/);
  });

  it('keeps a campfire off the Forest edge', () => {
    const v = newVillage();
    expect(placeBlocker(v, 1, 'campfire', tileIndex(1, 2))).toMatch(/campfire/);
    expect(placeBlocker(v, 1, 'campfire', tileIndex(3, 1))).toMatch(/campfire/);
    expect(placeBlocker(v, 1, 'campfire', tileIndex(3, 2))).toBeNull();
    expect(placeBlocker(v, 1, 'bench', tileIndex(1, 2))).toBeNull();
  });

  it('turns on site bonuses only for an edge with the right feature', () => {
    expect(siteBonuses(place(newVillage(), { '1,2': 'woodshed' }).plots).map(s => s.bonus.id)).toEqual(['woodshed']);
    expect(siteBonuses(place(newVillage(), { '4,3': 'woodshed' }).plots)).toHaveLength(0);
    expect(siteBonuses(place(newVillage(), { '8,1': 'rack' }).plots).map(s => s.bonus.id)).toEqual(['rack']);
    expect(siteBonuses(place(newVillage(), { '5,4': 'lantern' }).plots).map(s => s.bonus.id)).toEqual(['lantern']);
    expect(siteBonuses(place(newVillage(), { '5,3': 'lantern' }).plots)).toHaveLength(0);
  });

  it('previews appeal, combos and site bonuses before the drop', () => {
    const v = place(newVillage(), { '3,3': 'campfire', '4,2': 'stall' });
    const p = placementPreview(v, 1, 'bench', tileIndex(4, 3));
    expect(p.blocker).toBeNull();
    expect(p.appeal).toBe(1 + 2);
    expect(p.combos.map(c => c.id)).toEqual(['hearth']);
    const rack = placementPreview(v, 1, 'rack', tileIndex(5, 2));
    expect(rack.combos.map(c => c.id)).toEqual(['pantry']);
    expect(rack.bonuses).toHaveLength(0);
    expect(placementPreview(v, 1, 'rack', tileIndex(7, 2)).bonuses.map(b => b.id)).toEqual(['rack']);
    expect(placementPreview(v, 1, 'campfire', tileIndex(3, 1)).blocker).toMatch(/campfire/);
  });
});

describe('building on the map', () => {
  const rich = (g: GameState): GameState => ({ ...g, village: { ...g.village, resources: { lumber: 500, food: 500, stone: 500 } } });

  it('builds only where placement allows, and charges the cost', () => {
    let g = rich(newGame(3));
    g = reduce(g, { type: 'build', building: 'campfire', tile: tileIndex(1, 2) });
    expect(g.village.resources.lumber).toBe(500);
    g = reduce(g, { type: 'build', building: 'campfire', tile: tileIndex(3, 3) });
    expect(g.village.plots[tileIndex(3, 3)]).toBe('campfire');
    expect(g.village.resources.lumber).toBe(500 - 25);
  });

  it('takes a building down for a partial refund, then it can be rebuilt elsewhere', () => {
    expect(REFUND_RATE).toBe(0.5);
    expect(refundFor('burrow')).toEqual({ lumber: 25, stone: 20 });
    expect(refundFor('campfire')).toEqual({ lumber: 12 });
    let g = rich(newGame(3));
    g = reduce(g, { type: 'build', building: 'campfire', tile: tileIndex(3, 3) });
    g = reduce(g, { type: 'demolish', tile: tileIndex(3, 3) });
    expect(g.village.plots[tileIndex(3, 3)]).toBeNull();
    expect(g.village.resources.lumber).toBe(500 - 25 + 12);
    g = reduce(g, { type: 'build', building: 'campfire', tile: tileIndex(4, 4) });
    expect(g.village.plots[tileIndex(4, 4)]).toBe('campfire');
  });

  it("won't take down shelter a resident needs", () => {
    let g = rich(newGame(3));
    g = reduce(g, { type: 'build', building: 'leanto', tile: tileIndex(2, 3) });
    g = reduce(g, { type: 'welcome', kin: 'mochi' });
    expect(demolishBlocker(g.village, tileIndex(2, 3))).toMatch(/sleeps/);
    expect(reduce(g, { type: 'demolish', tile: tileIndex(2, 3) })).toBe(g);
    g = reduce(g, { type: 'build', building: 'leanto', tile: tileIndex(3, 3) });
    expect(demolishBlocker(g.village, tileIndex(2, 3))).toBeNull();
  });

  it('a woodshed by the Forest pays +1 lumber per felled tree', () => {
    let seed = 1;
    while (legalPlays(SURFACES.forest.deal(seed)).length === 0) seed++;
    const fell = (g: GameState) => {
      g = reduce(g, { type: 'open', surface: 'forest' });
      const run = g.active!.run;
      const i = legalPlays(run)[0];
      // Leave one card in the column and clear its partner, so this play fells the tree.
      const tree = run.piles[i].tree;
      const piles = run.piles.map((p, k) => (k === i ? { ...p, cards: p.cards.slice(-1) } : tree !== undefined && p.tree === tree ? { ...p, cards: [] } : p));
      g = { ...g, active: { ...g.active!, run: { ...run, piles } } };
      return reduce(g, { type: 'play', pile: i });
    };
    const plain = fell(newGame(seed));
    const shed = fell(place2(newGame(seed), { '1,2': 'woodshed' }));
    expect(shed.village.resources.lumber - plain.village.resources.lumber).toBe(1);
    expect(shed.active?.siteBonus ?? shed.lastRun?.siteBonus).toBe(1);
  });

  it('a lantern by the Quarry pays +1 for deep rock only', () => {
    const quarryGame = (at: Record<string, BuildingId>, yieldOf: number) => {
      let g = place2({ ...newGame(5), rankReached: 2 as const }, at);
      g = reduce(g, { type: 'open', surface: 'quarry' });
      const run = g.active!.run;
      const base = run.foundation[run.foundation.length - 1].rank;
      const rankUp = (base % 13) + 1;
      const piles = run.piles.map((p, k) => (k === 0 ? { ...p, cards: [{ id: 900, rank: rankUp as 1, yield: 9 }, { id: 901, rank: rankUp as 1, yield: yieldOf }] } : p));
      g = { ...g, active: { ...g.active!, run: { ...run, piles } } };
      return reduce(g, { type: 'play', pile: 0 }).village.resources.stone;
    };
    expect(quarryGame({ '5,4': 'lantern' }, 3) - quarryGame({}, 3)).toBe(1);
    expect(quarryGame({ '5,4': 'lantern' }, 2) - quarryGame({}, 2)).toBe(0);
    expect(quarryGame({ '3,3': 'lantern' }, 3) - quarryGame({}, 3)).toBe(0);
  });
});

describe('working a node', () => {
  it('tapping a feature deals at once with no walking cost, and leaving returns to the map', () => {
    let g = reduce(newGame(4), { type: 'open', surface: 'forest' });
    expect(g.view).toBe('forest');
    expect(g.active?.surface).toBe('forest');
    expect(g.minutes).toBe(0);
    g = reduce(g, { type: 'view', view: 'village' });
    expect(g.active?.surface).toBe('forest');
    g = reduce(g, { type: 'open', surface: 'forest' });
    expect(g.active?.surface).toBe('forest');
    g = reduce(g, { type: 'leave' });
    expect(g.view).toBe('village');
    expect(g.active).toBeNull();
  });

  it('one run at a time: opening another feature banks the first', () => {
    let g = reduce(newGame(4), { type: 'open', surface: 'forest' });
    g = reduce(g, { type: 'open', surface: 'berries' });
    expect(g.active?.surface).toBe('berries');
    expect(g.lastRun).toBeNull();
    expect(reduce(newGame(4), { type: 'open', surface: 'quarry' }).active).toBeNull();
  });

  it('an untouched run re-deals when the location changes; a played one keeps it', () => {
    let g = { ...newGame(4), mastery: { forest: 200, berries: 0, quarry: 0 } };
    g = reduce(g, { type: 'open', surface: 'forest' });
    g = reduce(g, { type: 'location', surface: 'forest', location: 1 });
    expect(g.active?.location).toBe(1);
    g = reduce(g, { type: 'draw' });
    expect(reduce(g, { type: 'location', surface: 'forest', location: 0 }).active?.location).toBe(1);
  });

  it('moves version 1 saves onto the map with their combos', () => {
    const plots = Array(15).fill(null);
    plots[6] = 'campfire'; plots[7] = 'bench';
    const old = { ...newGame(1), version: 1, village: { ...newVillage(), plots } };
    const g = migrate(old)!;
    expect(g.version).toBe(2);
    expect(g.village.plots).toHaveLength(54);
    expect(activeCombos(g.village.plots).map(c => c.combo.id)).toEqual(['hearth']);
    for (const [i, b] of g.village.plots.entries()) if (b) expect(placeBlocker({ ...g.village, plots: g.village.plots.map((p, k) => (k === i ? null : p)) }, 1, b, i)).toBeNull();
    expect(migrate({ version: 9 })).toBeNull();
  });
});

function place2(g: GameState, at: Record<string, BuildingId>): GameState {
  return { ...g, village: place(g.village, at) };
}

/** A plain bot that plays the whole slice through the reducer. */
function playSlice(seed: number, maxDays = 20): GameState {
  let g = newGame(seed);
  const rand = rng(seed);
  const act = (a: Action) => { g = reduce(g, a); };
  const order: BuildingId[] = ['leanto', 'campfire', 'bench', 'leanto', 'stall', 'rack', 'burrow', 'lantern', 'well'];
  const at: [number, number][] = [[2, 3], [3, 3], [4, 3], [2, 4], [4, 2], [5, 2], [3, 4], [5, 4], [4, 4]];
  const plotFor: Partial<Record<number, number>> = Object.fromEntries(at.map(([x, y], i) => [i, tileIndex(x, y)]));
  let next = 0;
  const p = planner(4);
  while (g.day <= maxDays && rank(g.village) < 3) {
    // Gather toward the next building, keeping a food buffer for the kin.
    const want = order[next] ? BUILDINGS[order[next]].cost : {};
    const eats = g.village.residents.length * 9 + 10;
    const surface = g.village.resources.food < eats ? 'berries'
      : (want.stone ?? 0) > g.village.resources.stone && g.rankReached >= 2 ? 'quarry'
        : (want.food ?? 0) > g.village.resources.food ? 'berries' : 'forest';
    act({ type: 'open', surface });
    let draws = 0;
    while (g.active) {
      const m = p(g.active.run);
      if (m === 'draw') { if (++draws > 12 + Math.floor(rand() * 3)) { act({ type: 'leave' }); break; } act({ type: 'draw' }); } else act({ type: 'play', pile: m });
    }
    while (order[next] && g.rankReached >= BUILDINGS[order[next]].rank) {
      const before = g.village.plots.slice();
      act({ type: 'build', building: order[next], tile: plotFor[next]! });
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
