import { describe, expect, it } from 'vitest';
import { FIGHT_FILL, FIGHT_LIMIT, FIGHT_NOTCHES, FIGHT_START_PROGRESS, createFight, fishInZone, playReelCard, rankDown, rankUp, reach, reelDirection, solveFight, stepFight, temperFor, type FightState } from './fishFight';

const DT = 1 / 60;
// A simulated angler: sees where the fish is heading `reaction` seconds late,
// needs `gap` seconds between taps, and plays the card that answers it.
// reaction 0 is the auto-solve.
const angle = (seed: number, rank: number, reaction: number, gap: number, onFrame?: (fight: FightState) => void) => {
  const seen: FightState[] = [];
  let fight = createFight(seed, rank);
  let lastTap = -Infinity;
  while (!fight.result) {
    seen.push(fight);
    const view = seen[Math.max(0, seen.length - 1 - Math.round(reaction / DT))];
    const card = fight.time - lastTap >= gap ? solveFight({ ...fight, fish: { ...fight.fish, target: view.fish.target } }) : null;
    if (card) { fight = playReelCard(fight, card.id); lastTap = fight.time; }
    fight = stepFight(fight, DT);
    onFrame?.(fight);
  }
  return fight;
};
const landRate = (rank: number, reaction: number, gap: number) => {
  let landed = 0;
  for (let seed = 1; seed <= 200; seed++) if (angle(seed * 7919, rank, reaction, gap).result === 'landed') landed++;
  return landed / 200;
};

describe('fish fight', () => {
  it('opens with the fish in the zone and a playable card in hand', () => {
    const fight = createFight(5, 13);
    expect(createFight(5, 13)).toEqual(fight);
    expect(fishInZone(fight)).toBe(true);
    expect(fight.line).toBe(13);
    expect(fight.hand.some((card) => reelDirection(13, card.rank))).toBe(true);
  });

  it('a +1 card lifts the zone a notch, a -1 card drops it, and other cards are refused', () => {
    const base = createFight(9, 7);
    const fight = { ...base, hand: [{ id: 'a', rank: 8 }, { id: 'b', rank: 7 }, { id: 'c', rank: 2 }, { id: 'd', rank: 6 }] };
    const lifted = playReelCard(fight, 'a');
    expect(lifted.zone.goal).toBe(fight.zone.goal + 1);
    expect(lifted.line).toBe(8);
    expect(playReelCard(lifted, 'b').zone.goal).toBe(fight.zone.goal);
    expect(playReelCard(fight, 'c')).toBe(fight);
    expect(playReelCard({ ...fight, zone: { ...fight.zone, goal: 0 } }, 'd').zone.goal).toBe(0);
  });

  it('A and K wrap', () => {
    expect([rankUp(13), rankDown(1)]).toEqual([1, 13]);
    expect([reelDirection(13, 1), reelDirection(1, 13)]).toEqual([1, -1]);
  });

  it('every move the fish makes is answered by the hand: one card, or a two-card run for a dash', () => {
    for (const rank of [3, 8, 12, 13]) {
      let previous = createFight(rank * 31, rank);
      angle(rank * 31, rank, 0.4, 0.3, (fight) => {
        if (fight.fish.target !== previous.fish.target || fight.fish.beatIn > previous.fish.beatIn) {
          const move = fight.fish.target - fight.zone.goal;
          if (move) expect(reach(fight.line, fight.hand, move > 0 ? 1 : -1)).toBeGreaterThanOrEqual(Math.abs(move));
          expect(fight.fish.target).toBeGreaterThanOrEqual(0);
          expect(fight.fish.target).toBeLessThanOrEqual(FIGHT_NOTCHES);
        }
        previous = fight;
      });
    }
  });

  it('the auto-solve keeps the fish in the zone every frame and lands it as fast as the bar fills', () => {
    for (const rank of [1, 6, 11, 13]) for (const seed of [1, 2, 3, 4]) {
      // It answers on the frame after the fish turns (two for a dash), so the zone trails by at most two frames of glide.
      const trail = temperFor(rank).glide * DT * 2 + 1e-9;
      let out = 0;
      const fight = angle(seed, rank, 0, 0, (frame) => { if (!fishInZone(frame) || Math.abs(frame.fish.pos - frame.zone.pos) > trail) out++; });
      expect(out).toBe(0);
      expect(fight.result).toBe('landed');
      expect(fight.time).toBeCloseTo((1 - FIGHT_START_PROGRESS) / FIGHT_FILL, 1);
    }
  });

  it('the zone tightens for a player who keeps up and widens for one who falls behind', () => {
    const temper = temperFor(13);
    expect(angle(1, 13, 0, 0).zone.size).toBeLessThan(temper.zone);
    expect(angle(1, 13, 99, 99).zone.size).toBe(temper.zoneMax);
    expect(temper.zoneMax).toBeLessThan(2);
  });

  it('every fight ends within the time limit', () => {
    for (const rank of [1, 6, 12, 13]) for (const seed of [1, 2, 3]) expect(angle(seed, rank, 99, 99).time).toBeLessThanOrEqual(FIGHT_LIMIT + 0.02);
  });

  // Balance: quick readers land everything, a typical player lands every fish
  // and most Kingsfish, a slow reader handles the small fish, and an idle
  // angler rarely lands anything.
  it('rewards reading the hand quickly', () => {
    for (const rank of [2, 7, 11, 13]) expect(landRate(rank, 0.25, 0.2)).toBeGreaterThanOrEqual(0.95);
    for (const rank of [2, 7, 11]) expect(landRate(rank, 0.35, 0.3)).toBeGreaterThanOrEqual(0.95);
    expect(landRate(13, 0.35, 0.3)).toBeGreaterThanOrEqual(0.55);
    expect(landRate(13, 0.5, 0.4)).toBeLessThan(0.3);
    expect(landRate(2, 0.5, 0.4)).toBeGreaterThanOrEqual(0.9);
    for (const rank of [2, 7, 11, 13]) expect(landRate(rank, 99, 99)).toBeLessThan(0.15);
  });
});
