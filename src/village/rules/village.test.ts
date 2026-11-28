import { describe, expect, it } from 'vitest';
import { DAYLIGHT, RECEIPT_MINUTES } from './daylight';
import { dealSapling, INSPIRATION_COLUMN } from './sapling';
import { planVillageReceipts } from './autoSolve';
import { activeAspen, aspenSeed, aspenSpill } from './aspen';
import { dailyMaxApBonus, migrate, newGame, reduce, type Action, type GameState } from './game';
import { type Pile, type Rank, type Run, canPlay, draw, fall, heldLumber, tableauLeft, legalPlays, play, rng, runEnd } from './golf';
import { FEATURES, GATE, MAP_COLS, MAP_ROWS, SAPLING, WORLD_TILES, fogged, gridReference, neighboursOf, parseGridReference, tileAt, tileIndex, worldCoordinate } from './map';
import { planner, step } from './players';
import { BIRCH_CROWN, BIRCH_DEPTH, SURFACES } from './surfaces';
import {
  BUILDINGS, REFUND_RATE, activeCombos, appeal, demolishBlocker, nightfall, newVillage, placeBlocker, placementPreview, rank, refundFor,
  siteBonuses, welcomeBlocker, type BuildingId, type VillageState,
} from './village';

const last = <T,>(xs: T[]): T | undefined => xs[xs.length - 1];

it('starts Hero five squares south of the sapling and updates the old opening spawn', () => {
  const game = newGame(42);
  const { x, y } = tileAt(game.parties[0].tile);
  expect(worldCoordinate(x, y)).toEqual({ x: 0, y: -5 });
  const old = { ...game, parties: [{ tile: tileIndex(4, 7), members: ['hero'] }] };
  expect(migrate(old)?.parties).toEqual(game.parties);
  expect(migrate({ ...old, minutes: 5 })?.parties).toEqual(old.parties);
});

it('places, digs, houses, and upgrades a den across multiple days', () => {
  let game = newGame(42);
  expect(game.parties.flatMap(party => party.members)).toEqual(['hero']);
  game = reduce(game, { type: 'dev-place-kin', kin: 'banks', tile: tileIndex(3, 3) });
  const hero = game.parties.find(party => party.members.includes('hero'))!;
  const banks = game.parties.find(party => party.members.includes('banks'))!;
  const plot = tileIndex(1, 4);
  const act = (action: Action) => { game = reduce(game, action); };
  expect(reduce(game, { type: 'den-place', tile: plot, improve: false })).toBe(game);
  act({ type: 'sapling-open', from: hero.tile });
  expect(game.sapling?.piles.map(pile => pile.length)).toEqual(Array(7).fill(4));
  for (let remaining = 3; remaining >= 0; remaining--) {
    const receipt = planVillageReceipts(game)[0];
    expect(receipt).toEqual({ type: 'sapling-play', column: INSPIRATION_COLUMN });
    act(receipt);
    expect(game.sapling?.inspiration).toBe(remaining);
    expect(game.minutes).toBe((4 - remaining) * RECEIPT_MINUTES.sapling);
    expect(game.sapling?.piles.map(pile => pile.length)).toEqual(Array(7).fill(4));
  }
  game = migrate(JSON.parse(JSON.stringify(game)))!;
  expect(game.sapling?.inspiration).toBe(0);
  expect(game.sapling?.collected).toBe(false);
  act({ type: 'sapling-collect' });
  act({ type: 'den-place', tile: plot, improve: false });
  expect(game.den?.dig?.piles.map(pile => pile.length)).toEqual(Array(7).fill(4));
  expect(reduce(game, { type: 'den-start', from: banks.tile })).toBe(game);
  act({ type: 'den-start', from: tileIndex(SAPLING.x, SAPLING.y) });
  const plan = planVillageReceipts(game);
  expect(plan).toHaveLength(14);
  for (const move of plan) act(move);
  expect(game.den?.dig?.piles.map(pile => pile.length)).toEqual(Array(7).fill(4));
  expect(game.den?.level).toBe(0);
  expect(game.stamina.hero).toBe(6);
  for (let draw = 0; draw < 6; draw++) {
    act({ type: 'den-draw' });
    expect(planVillageReceipts(game)).toEqual([]);
  }
  act({ type: 'rest' }); act({ type: 'dawn' });
  expect(game.day).toBe(2);
  expect(game.stamina.hero).toBe(5);
  expect(dailyMaxApBonus(game, 'hero')).toBe(0);
  act({ type: 'den-start', from: plot });
  act({ type: 'den-draw' });
  const deep = planVillageReceipts(game);
  expect(deep).toHaveLength(10);
  for (const move of deep) act(move);
  expect(game.den?.level).toBe(1);
  expect(game.den?.residents).toEqual(['hero']);
  expect(game.stamina.hero).toBe(4);
  expect(reduce(game, { type: 'den-house', kin: 'banks' })).toBe(game);
  act({ type: 'rest' }); act({ type: 'dawn' });
  expect(game.day).toBe(3);
  expect(game.stamina.hero).toBe(7);
  expect(dailyMaxApBonus(game, 'hero')).toBe(1);
  expect(reduce(game, { type: 'den-place', tile: plot, improve: true })).toBe(game);
  act({ type: 'dev-config', resources: { lumber: 3, stone: 0, food: 10 } });
  act({ type: 'den-place', tile: plot, improve: true });
  expect(game.village.resources.lumber).toBe(0);
  act({ type: 'den-start', from: plot });
  for (let move = 0; move < 7; move++) act({ type: 'den-play', column: move % 3 });
  expect(game.den?.dig?.piles.flat()).toHaveLength(2);
  game = migrate(JSON.parse(JSON.stringify(game)))!;
  act({ type: 'rest' }); act({ type: 'dawn' });
  act({ type: 'den-start', from: plot });
  act({ type: 'den-play', column: 1 }); act({ type: 'den-play', column: 2 });
  expect(game.den?.level).toBe(2);
  act({ type: 'den-house', kin: 'banks' });
  act({ type: 'rest' }); act({ type: 'dawn' });
  expect(game.stamina).toMatchObject({ hero: 8, banks: 8, demi: 6 });
  expect(dailyMaxApBonus(game, 'banks')).toBe(1);
});

it('charges 1 AP for a den foundation draw and allows sequences at zero AP', () => {
  let game = newGame(42);
  game.sapling = { ...dealSapling(game.seed), inspiration: 0, collected: true };
  const hero = game.parties.find(party => party.members.includes('hero'))!;
  game = reduce(game, { type: 'den-place', tile: tileIndex(1, 4), improve: false });
  game = reduce(game, { type: 'den-start', from: hero.tile });
  const opening = planVillageReceipts(game);
  const nextRank = game.den!.dig!.foundation;
  game = { ...game, stamina: { ...game.stamina, hero: 1 }, den: {
    ...game.den!, dig: { ...game.den!.dig!, stock: [nextRank] },
  } };
  const drawn = reduce(game, { type: 'den-draw' });
  expect(drawn.stamina.hero).toBe(0);
  expect(drawn.minutes).toBe(game.minutes + DAYLIGHT.drawMinutes);
  expect(drawn.den?.dig?.stock).toEqual([nextRank]);
  expect(reduce(drawn, { type: 'den-draw' })).toBe(drawn);
  expect(planVillageReceipts(drawn)).toEqual(opening);
  const excavated = reduce(drawn, opening[0]);
  expect(excavated.stamina.hero).toBe(0);
  expect(excavated.minutes - drawn.minutes).toBe(RECEIPT_MINUTES.den);
});

it('uncovering Sunny Hedge leaves preserves berry ranks and upgrades old saves', () => {
  const game = reduce(newGame(42), { type: 'open', surface: 'berries' });
  const run = game.active!.run;
  run.foundation = [{ id: 90, rank: 5, yield: 1 }];
  for (const [index, pile] of run.piles.entries()) {
    pile.cards = [{ id: 100 + index, rank: 6, yield: 1, unripe: index !== 4 }];
  }
  const sunny = migrate(game)!.active!.run;
  expect(canPlay(sunny, 1)).toBe(false);
  expect(last(sunny.piles[1].cards)).toMatchObject({ rank: 6, leafCovered: true, unripe: false });
  const revealed = play(sunny, 4);
  for (const index of [1, 3, 5, 7]) expect(last(revealed.piles[index].cards)).toMatchObject({ rank: 6, leafCovered: false });
  expect(last(revealed.piles[0].cards)?.leafCovered).toBe(true);
  expect(SURFACES.berries.deal(42, 1).piles.some(pile => pile.cards.some(card => card.unripe))).toBe(true);
});

it('collects a spilled card once and sequences it through a matching foundation', () => {
  let seed = 1;
  while (aspenSpill(aspenSeed(seed, 0)) === undefined) seed++;
  let game = newGame(seed);
  const hero = game.parties.find(p => p.members.includes('hero'))!;
  game = reduce(game, { type: 'deploy', surface: 'forest', from: hero.tile });
  game = reduce(game, { type: 'aspen-target', tree: 0 });
  const grove = game.aspen!;
  const run = activeAspen(grove)!;
  grove.trees[0] = { ...run, hp: 0, phase: 'falling' };
  game = reduce(game, { type: 'aspen-land' });
  const rank = activeAspen(game.aspen)!.spill!;
  game = reduce(game, { type: 'aspen-collect', tree: 0 });
  game = reduce(game, { type: 'aspen-gather-card', tree: 0 });
  expect(game.aspenCards).toEqual([rank]);
  expect(reduce(game, { type: 'aspen-gather-card', tree: 0 })).toBe(game);
  game = migrate(JSON.parse(JSON.stringify(game)))!;
  game = reduce(game, { type: 'aspen-target', tree: 1 });
  const target = activeAspen(game.aspen)!;
  target.piles = [[], [], [], [], [], [], []];
  target.foundations[0].rank = (rank === 1 ? 13 : rank - 1) as Rank;
  const plan = planVillageReceipts(game);
  expect(plan).toEqual([{ type: 'aspen-play-card', card: 0, foundation: 0 }]);
  const played = reduce(game, plan[0]);
  expect(played.aspenCards).toEqual([]);
  expect(activeAspen(played.aspen)!.hp).toBe(target.hp - 1);
  expect(played.stamina.hero).toBe(6);
  expect(played.minutes - game.minutes).toBe(RECEIPT_MINUTES.forest);
});

it('edits day, time, inventory, kin stamina and unlocks independently for playtesting', () => {
  const game = newGame(2);
  game.stamina.hero = 0;
  game.stamina.banks = 2;
  const edited = reduce(game, { type: 'dev-config', day: 8, minutes: 120, restoreKin: 'hero', unlock: 3,
    resources: { lumber: 10, food: 0, stone: 20 } });
  expect([edited.day, edited.minutes, edited.rankReached]).toEqual([8, 120, 3]);
  expect(edited.stamina).toMatchObject({ hero: 6, banks: 2 });
  expect(edited.village.resources).toEqual({ lumber: 10, food: 0, stone: 20 });
});

it('charges only foundation draws in Aspen Grove and Sunny Hedge', () => {
  let game = newGame(42);
  const hero = game.parties.find(p => p.members.includes('hero'))!;
  game = reduce(game, { type: 'deploy', surface: 'forest', from: hero.tile });
  game = reduce(game, { type: 'aspen-target', tree: 0 });
  const tree = activeAspen(game.aspen)!;
  tree.stock = [tree.foundations[0].rank];
  game.stamina.hero = 1;
  game = reduce(game, { type: 'aspen-draw', foundation: 0 });
  expect(game.stamina).toEqual({ hero: 0, mochi: 6, banks: 6, demi: 6 });
  expect(reduce(game, { type: 'aspen-draw', foundation: 0 })).toBe(game);
  const plan = planVillageReceipts(game);
  expect(plan).toHaveLength(tree.hp);
  game = reduce(game, plan[0]);
  expect(activeAspen(game.aspen)!.hp).toBe(tree.hp - 1);
  expect(migrate(JSON.parse(JSON.stringify(game)))!.stamina.hero).toBe(0);
  game = { ...reduce(game, { type: 'view', view: 'village' }), rankReached: 2 };
  const deployed = game.parties.find(p => p.members.includes('hero'))!;
  game = reduce(game, { type: 'deploy', surface: 'berries', from: deployed.tile });
  expect(game.active?.surface).toBe('berries');
  expect(reduce(game, { type: 'draw' })).toBe(game);
  game.stamina.hero = 1;
  const before = game.active!.run;
  game = reduce(game, { type: 'draw' });
  expect(game.stamina.hero).toBe(0);
  expect(game.active!.run.stock).toHaveLength(before.stock.length - 1);
  const berries = game.active!.run;
  berries.foundation = [{ id: 90, rank: 5, yield: 1 }];
  berries.piles[0].cards = [{ id: 91, rank: 6, yield: 1 }];
  const receipt = planVillageReceipts(game)[0];
  expect(receipt?.type).toBe('play');
  game = reduce(game, receipt);
  expect(game.stamina.hero).toBe(0);
  game = reduce(reduce(game, { type: 'rest' }), { type: 'dawn' });
  expect(game.stamina.hero).toBe(6);
  expect(activeAspen(game.aspen)!.hp).toBe(tree.hp - 1);
});

describe('golf surfaces', () => {
  it('Birch Stand deals 7 crowned birches; Old Oaks deals 8 columns of 4 (4 trees)', () => {
    const birch = SURFACES.forest.deal(1, 0);
    expect(birch.piles.map(p => p.cards.length)).toEqual(Array(7).fill(BIRCH_DEPTH));
    expect(birch.piles.every(p => p.tree === undefined)).toBe(true);
    expect(birch.stock).toHaveLength(52 - 7 * (BIRCH_DEPTH + BIRCH_CROWN) - 1);
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

  it('a cleared birch falls the chosen way and its crown lands on that neighbour', () => {
    const base = SURFACES.forest.deal(5, 0);
    expect(base.piles.every(p => p.crown?.length === BIRCH_CROWN)).toBe(true);
    const crown = base.piles[1].crown!;
    const run: Run = { ...base, piles: [base.piles[0], { ...base.piles[1], cards: [{ id: 99, rank: 5, yield: 1 }] }, ...base.piles.slice(2)],
      foundation: [{ id: 98, rank: 4, yield: 1 }] };
    const cut = play(run, 1);
    expect(cut.earned).toBe(1); // the log pays as it's cut
    expect(cut.pendingFall).toBe(1);
    expect(legalPlays(cut)).toHaveLength(0); // nothing moves until the tree is down
    expect(runEnd(cut)).toBeNull();
    const right = fall(cut, 1);
    expect(right.felled).toBe(1);
    expect(right.earned).toBe(1 + run.fellBonus);
    expect(right.piles[2].cards.slice(-BIRCH_CROWN)).toEqual(crown);
    expect(right.piles[2].cards).toHaveLength(run.piles[2].cards.length + BIRCH_CROWN);
    expect(right.piles[1].crown).toEqual([]);
  });

  it('a birch with no standing neighbour falls into the clearing at once', () => {
    const base = SURFACES.forest.deal(5, 0);
    const run: Run = { ...base, piles: [{ ...base.piles[0], cards: [{ id: 99, rank: 5, yield: 1 }] }, { ...base.piles[1], cards: [] }, ...base.piles.slice(2)],
      foundation: [{ id: 98, rank: 4, yield: 1 }] };
    const cut = play(run, 0);
    expect(cut.pendingFall ?? null).toBeNull();
    expect(cut.felled).toBe(1);
    expect(tableauLeft(cut)).toBe(tableauLeft(run) - 1);
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
      for (let k = 0; k < 400 && !runEnd(r); k++) r = step(r, p(r));
      expect(runEnd(r)).not.toBeNull();
      if (runEnd(r) === 'stuck') expect(legalPlays(r)).toHaveLength(0);
    }
  });
});

describe('daylight', () => {
  it('starts the run for free and charges daylight for a stock draw', () => {
    let g = reduce(newGame(9), { type: 'start', surface: 'forest' });
    expect(g.minutes).toBe(DAYLIGHT.startMinutes);
    g = reduce(g, { type: 'draw' });
    expect(g.minutes).toBe(DAYLIGHT.startMinutes + DAYLIGHT.drawMinutes);
  });

  it('the stock refuses a draw the light cannot pay for, and dusk ends the run and the day', () => {
    let seed = 1;
    while (legalPlays(SURFACES.forest.deal(seed)).length === 0) seed++;
    let g = { ...newGame(seed), minutes: DAYLIGHT.dayMinutes - 1 };
    g = reduce(g, { type: 'start', surface: 'forest' });
    expect(reduce(g, { type: 'draw' })).toBe(g);
    g = reduce(g, { type: 'play', pile: legalPlays(g.active!.run)[0] });
    expect(g.minutes).toBe(DAYLIGHT.dayMinutes);
    expect(g.lastRun?.run.receipts).toBe(1);
    expect(g.lastRun?.minutes).toBe(1);
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
  it('has single-square features and stable references across the whole map', () => {
    expect(MAP_COLS * MAP_ROWS).toBe(63);
    expect(FEATURES.forest.rect).toEqual({ x: 2, y: 1, w: 1, h: 1 });
    for (const f of Object.values(FEATURES)) {
      const { x, y } = f.node;
      expect(x >= f.rect.x && x < f.rect.x + f.rect.w && y >= f.rect.y && y < f.rect.y + f.rect.h).toBe(true);
    }
    expect(fogged(8, 3, 1)).toBe(true);
    expect(fogged(8, 3, 2)).toBe(false);
    expect(gridReference(worldCoordinate(SAPLING.x, SAPLING.y))).toBe('(0, 0)');
    expect(parseGridReference('(-10000, 2048)')).toEqual({ x: -10000, y: 2048 });
    expect(parseGridReference('(9007199254740992, 0)')).toBeNull();
    for (let i = 0; i < MAP_COLS * MAP_ROWS; i++) {
      const { x, y } = tileAt(i);
      const coordinate = worldCoordinate(x, y);
      expect(parseGridReference(gridReference(coordinate))).toEqual(coordinate);
    }
    expect(neighboursOf(tileIndex(0, 0)).map(tileAt)).toEqual([{ x: 0, y: -1 }, { x: 0, y: 1 }, { x: -1, y: 0 }, { x: 1, y: 0 }]);
    expect(worldCoordinate(4, 7)).toEqual({ x: 0, y: -4 });
  });

  it('only lets buildings onto open, revealed, empty land', () => {
    const v = place(newVillage(), { '3,3': 'bench' });
    expect(placeBlocker(v, 1, 'bench', tileIndex(2, 1))).toMatch(/Forest/);
    expect(placeBlocker(v, 1, 'bench', tileIndex(6, 1))).toMatch(/Berry Patch/);
    expect(placeBlocker(v, 1, 'bench', tileIndex(SAPLING.x, SAPLING.y))).toMatch(/Sapling/);
    expect(placeBlocker(v, 1, 'bench', tileIndex(GATE.x, GATE.y))).toMatch(/gate/);
    expect(placeBlocker(v, 1, 'bench', tileIndex(8, 3))).toMatch(/fog/);
    expect(placeBlocker(v, 2, 'bench', tileIndex(8, 3))).toBeNull();
    expect(placeBlocker(v, 1, 'bench', tileIndex(3, 3))).toMatch(/Already/);
    expect(placeBlocker(v, 1, 'bench', -1)).toMatch(/Off the map/);
    expect(placeBlocker(v, 1, 'bench', WORLD_TILES)).toMatch(/Off the map/);
    expect(placeBlocker(v, 1, 'bench', tileIndex(4, 8))).toBeNull();
  });

  it('keeps a campfire off the Forest edge', () => {
    const v = newVillage();
    expect(placeBlocker(v, 1, 'campfire', tileIndex(2, 2))).toMatch(/campfire/);
    expect(placeBlocker(v, 1, 'campfire', tileIndex(3, 1))).toMatch(/campfire/);
    expect(placeBlocker(v, 1, 'campfire', tileIndex(3, 2))).toBeNull();
    expect(placeBlocker(v, 1, 'bench', tileIndex(2, 2))).toBeNull();
  });

  it('turns on site bonuses only for an edge with the right feature', () => {
    expect(siteBonuses(place(newVillage(), { '2,2': 'woodshed' }).plots).map(s => s.bonus.id)).toEqual(['woodshed']);
    expect(siteBonuses(place(newVillage(), { '4,3': 'woodshed' }).plots)).toHaveLength(0);
    expect(siteBonuses(place(newVillage(), { '7,1': 'rack' }).plots).map(s => s.bonus.id)).toEqual(['rack']);
    expect(siteBonuses(place(newVillage(), { '5,4': 'lantern' }).plots).map(s => s.bonus.id)).toHaveLength(0);
    expect(siteBonuses(place(newVillage(), { '5,3': 'lantern' }).plots)).toHaveLength(0);
  });

  it('previews appeal, combos and site bonuses before the drop', () => {
    const v = place(newVillage(), { '3,3': 'campfire', '5,3': 'stall' });
    const p = placementPreview(v, 1, 'bench', tileIndex(3, 4));
    expect(p.blocker).toBeNull();
    expect(p.appeal).toBe(1 + 2);
    expect(p.combos.map(c => c.id)).toEqual(['hearth']);
    const rack = placementPreview(v, 1, 'rack', tileIndex(5, 2));
    expect(rack.combos.map(c => c.id)).toEqual(['pantry']);
    expect(rack.bonuses).toHaveLength(0);
    expect(placementPreview(v, 1, 'rack', tileIndex(6, 2)).bonuses.map(b => b.id)).toEqual(['rack']);
    expect(placementPreview(v, 1, 'campfire', tileIndex(3, 1)).blocker).toMatch(/campfire/);
  });
});

describe('building on the map', () => {
  const rich = (g: GameState): GameState => ({ ...g, village: { ...g.village, resources: { lumber: 500, food: 500, stone: 500 } } });

  it('builds only where placement allows, and charges the cost', () => {
    let g = rich(newGame(3));
    g = reduce(g, { type: 'build', building: 'campfire', tile: tileIndex(2, 2) });
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
      g = reduce(g, { type: 'play', pile: i });
      // Birch Stand: the cleared birch waits for a fall direction.
      return g.active?.run.pendingFall != null ? reduce(g, { type: 'fall', side: i > 0 ? -1 : 1 }) : g;
    };
    const plain = fell(newGame(seed));
    const shed = fell(place2(newGame(seed), { '2,2': 'woodshed' }));
    expect(shed.village.resources.lumber - plain.village.resources.lumber).toBe(1);
    expect(shed.active?.siteBonus ?? shed.lastRun?.siteBonus).toBe(1);
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
    expect(reduce({ ...newGame(4), rankReached: 2 }, { type: 'open', surface: 'quarry' }).active).toBeNull();
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
    expect(g.village.plots).toHaveLength(63);
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
  const order: BuildingId[] = ['leanto', 'campfire', 'bench', 'leanto', 'stall', 'rack'];
  const at: [number, number][] = [[2, 3], [3, 3], [3, 4], [2, 4], [4, 2], [5, 2]];
  const plotFor: Partial<Record<number, number>> = Object.fromEntries(at.map(([x, y], i) => [i, tileIndex(x, y)]));
  let next = 0;
  const p = planner(4);
  while (g.day <= maxDays && rank(g.village) < 2) {
    // Gather toward the next building, keeping a food buffer for the kin.
    const want = order[next] ? BUILDINGS[order[next]].cost : {};
    const eats = g.village.residents.length * 9 + 10;
    const surface = g.village.resources.food < eats ? 'berries'
      : (want.food ?? 0) > g.village.resources.food ? 'berries' : 'forest';
    act({ type: 'open', surface });
    let draws = 0;
    while (g.active) {
      const m = p(g.active.run);
      if (m === 'draw') { if (++draws > 12 + Math.floor(rand() * 3)) { act({ type: 'leave' }); break; } act({ type: 'draw' }); } else if (m === 'left' || m === 'right') act({ type: 'fall', side: m === 'left' ? -1 : 1 }); else act({ type: 'play', pile: m });
    }
    while (order[next] && g.rankReached >= BUILDINGS[order[next]].rank) {
      const before = g.village.plots.slice();
      act({ type: 'build', building: order[next], tile: plotFor[next]! });
      if (g.village.plots[plotFor[next]!] === before[plotFor[next]!]) break;
      next++;
    }
    for (const w of g.village.gate) act({ type: 'welcome', kin: w.kin });
    if (g.night) act({ type: 'dawn' });
    else if (!g.active && (g.stamina.hero === 0 || g.minutes > DAYLIGHT.dayMinutes - 60)) { act({ type: 'rest' }); act({ type: 'dawn' }); }
  }
  return g;
}

describe('the slice loop', () => {
  it('a plain player reaches Village without mining', () => {
    const days = [1, 2, 3, 4, 5, 6, 7, 8].map(seed => playSlice(seed)).map(g => (rank(g.village) >= 2 ? g.day : Infinity));
    for (const d of days) expect(d).toBeLessThanOrEqual(12);
  });
});
