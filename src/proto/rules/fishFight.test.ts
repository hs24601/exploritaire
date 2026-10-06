import { describe, expect, it } from 'vitest';
import { FIGHT_LIMIT, FIGHT_STEP, createFight, fishInZone, playReelCard, rankDown, rankUp, reelDirection, stepFight, type FightState } from './fishFight';

// A simulated angler: sees the fish `reaction` seconds late and needs `gap`
// seconds to find and tap the next card.
const angle = (seed: number, rank: number, reaction: number, gap: number) => {
  const dt = 1 / 60;
  const seen: FightState[] = [];
  let fight = createFight(seed, rank);
  let lastTap = -Infinity;
  while (!fight.result) {
    seen.push(fight);
    const view = seen[Math.max(0, seen.length - 1 - Math.round(reaction / dt))];
    const diff = view.fish.pos - fight.zone.goal;
    const want = diff > FIGHT_STEP * 0.6 ? 1 : diff < -FIGHT_STEP * 0.6 ? -1 : 0;
    const card = want && fight.time - lastTap >= gap ? fight.hand.find((entry) => reelDirection(fight.line, entry.rank) === want) : undefined;
    if (card) { fight = playReelCard(fight, card.id); lastTap = fight.time; }
    fight = stepFight(fight, dt);
  }
  return fight;
};
const landRate = (rank: number, reaction: number, gap: number) => {
  let landed = 0;
  for (let seed = 1; seed <= 200; seed++) if (angle(seed * 7919, rank, reaction, gap).result === 'landed') landed++;
  return landed / 200;
};

describe('fish fight', () => {
  it('opens with the fish in the zone and a + and - card in hand', () => {
    const fight = createFight(5, 13);
    expect(createFight(5, 13)).toEqual(fight);
    expect(fishInZone(fight)).toBe(true);
    expect(fight.line).toBe(13);
    expect(fight.hand.map((card) => card.rank)).toEqual(expect.arrayContaining([rankUp(13), rankDown(13)]));
  });

  it('a +1 card lifts the zone, a -1 card drops it, and other cards are refused', () => {
    const fight = createFight(9, 7);
    const up = fight.hand.find((card) => card.rank === 8)!;
    const lifted = playReelCard(fight, up.id);
    expect(lifted.zone.goal).toBeCloseTo(fight.zone.goal + FIGHT_STEP);
    expect(lifted.line).toBe(8);
    const down = lifted.hand.find((card) => card.rank === 7)!;
    expect(playReelCard(lifted, down.id).zone.goal).toBeCloseTo(fight.zone.goal);
    const dud = { ...fight, hand: fight.hand.map((card, index) => index === 0 ? { ...card, rank: 2 } : card) };
    expect(playReelCard(dud, dud.hand[0].id)).toBe(dud);
  });

  it('A and K wrap', () => {
    expect([rankUp(13), rankDown(1)]).toEqual([1, 13]);
    expect([reelDirection(13, 1), reelDirection(1, 13)]).toEqual([1, -1]);
  });

  it('every hand keeps a + and a - card, play after play', () => {
    let fight = createFight(77, 4);
    for (let play = 0; play < 60; play++) {
      expect(fight.hand.some((card) => reelDirection(fight.line, card.rank) === 1)).toBe(true);
      expect(fight.hand.some((card) => reelDirection(fight.line, card.rank) === -1)).toBe(true);
      fight = playReelCard(fight, fight.hand.find((card) => reelDirection(fight.line, card.rank) === (play % 3 ? 1 : -1))!.id);
    }
  });

  it('every fight ends within the time limit', () => {
    for (const rank of [1, 6, 12, 13]) for (const seed of [1, 2, 3]) expect(angle(seed, rank, 9, 99).time).toBeLessThanOrEqual(FIGHT_LIMIT + 0.02);
  });

  // Balance: quick, attentive play lands nearly everything, a typical player lands
  // most fish and a fair share of Kingsfish, and doing nothing rarely lands one.
  it('rewards attentive play without needing perfect reflexes', () => {
    for (const rank of [2, 7, 11, 13]) expect(landRate(rank, 0.25, 0.25)).toBeGreaterThanOrEqual(0.95);
    expect(landRate(2, 0.35, 0.4)).toBeGreaterThanOrEqual(0.95);
    expect(landRate(7, 0.35, 0.4)).toBeGreaterThanOrEqual(0.9);
    expect(landRate(11, 0.35, 0.4)).toBeGreaterThanOrEqual(0.75);
    expect(landRate(13, 0.35, 0.4)).toBeGreaterThanOrEqual(0.55);
    for (const rank of [7, 11, 13]) expect(landRate(rank, 9, 99)).toBeLessThan(0.15);
  });
});
