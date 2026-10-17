import type { Card } from '../protoState';
import { createSeededRandom } from './setup';

// The fight after a bite: a Stardew-style fishing meter played with cards. Pure:
// no React or DOM; the view steps it on animation frames.
//
// The meter has NOTCHES + 1 positions. Reel cards move the catch zone one notch:
// a card one rank above the line card (+1) lifts it, one rank below (-1) drops
// it (A and K wrap), and the played card becomes the new line card.
//
// The fish is smart about the hand. On each beat it swims to a notch that one
// card in the player's hand answers (two notches, a dash, when the hand holds a
// two-card run that way), always measured from where the zone is now. So a
// perfect player, or an auto-solve that plays the answering card the moment the
// fish turns, keeps the fish dead centre every time: fish and zone glide at the
// same speed. A human answers late by their reading time, and the fish slides
// toward the zone's edge meanwhile; the zone's size is the grace they get.
//
// The zone adapts to the player: each beat that finds them caught up tightens it
// a little (a mastery streak gets tense), each beat that finds them behind
// widens it (a struggling player gets room). Bigger fish beat faster, glide
// faster, dash more and start with a tighter zone. In the zone the catch bar
// fills; out of it, it drains. Full lands the fish; empty or the time limit
// loses it.

export const FIGHT_HAND_SIZE = 4;
/** Highest notch; the meter has NOTCHES + 1 positions. */
export const FIGHT_NOTCHES = 8;
export const FIGHT_START_PROGRESS = 0.35;
/** Catch-bar fill per second with the fish in the zone: about four seconds of good play lands it. */
export const FIGHT_FILL = 0.17;
export const FIGHT_DRAIN = 0.12;
/** The line gives after this many seconds, so a whole fishing event stays under ten. */
export const FIGHT_LIMIT = 8;
/** A beat that finds the player caught up shrinks the zone this much; one that finds them behind grows it. */
export const ZONE_TIGHTEN = 0.08;
export const ZONE_LOOSEN = 0.25;

/**
 * How each size of fish fights: seconds between turns, glide speed (notches per
 * second; slower gives more time to answer before the fish leaves the zone),
 * chance to dash two notches, and the zone's starting, smallest and largest size
 * in notches. Zones stay under 2 notches, so a fish one notch off is out.
 */
export type FishTemper = { beat: number; glide: number; dash: number; zone: number; zoneMin: number; zoneMax: number };
export const FISH_TEMPERS: Record<'small' | 'medium' | 'large' | 'king', FishTemper> = {
  small: { beat: 0.9, glide: 2, dash: 0, zone: 1.7, zoneMin: 1.2, zoneMax: 1.95 },
  medium: { beat: 0.8, glide: 2.5, dash: 0.1, zone: 1.6, zoneMin: 1.1, zoneMax: 1.95 },
  large: { beat: 0.7, glide: 3.2, dash: 0.2, zone: 1.5, zoneMin: 1, zoneMax: 1.9 },
  king: { beat: 0.62, glide: 4, dash: 0.3, zone: 1.4, zoneMin: 0.9, zoneMax: 1.8 },
};
export const temperFor = (rank: number): FishTemper =>
  rank === 13 ? FISH_TEMPERS.king : rank >= 10 ? FISH_TEMPERS.large : rank >= 5 ? FISH_TEMPERS.medium : FISH_TEMPERS.small;

export const rankUp = (rank: number) => (rank === 13 ? 1 : rank + 1);
export const rankDown = (rank: number) => (rank === 1 ? 13 : rank - 1);
/** +1 lifts the zone, -1 drops it, any other card does nothing. */
export const reelDirection = (line: number, rank: number) => (rank === rankUp(line) ? 1 : rank === rankDown(line) ? -1 : 0);

export type FightResult = 'landed' | 'escaped';
export type FightState = {
  /** Rank of the hooked fish; the bait that hooked it is the first line card. */
  rank: number;
  /** Seeded random state, carried so stepping stays pure. */
  rng: number;
  /** Seconds since the bite. */
  time: number;
  /** Positions in notches: `target` is where the fish is heading, `pos` where it is. */
  fish: { target: number; pos: number; beatIn: number };
  /** `goal` is where the cards have sent the zone, `pos` where it is, `size` its height in notches. */
  zone: { goal: number; pos: number; size: number };
  progress: number;
  line: number;
  hand: Card[];
  dealt: number;
  plays: number;
  /** Beats in a row the fish never left the zone. */
  streak: number;
  /** Whether the fish has left the zone since the last beat. */
  slipped: boolean;
  result: FightResult | null;
};

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
const glideTo = (from: number, to: number, speed: number, dt: number) => from + clamp(to - from, -speed * dt, speed * dt);

/** Draw from a carried seed: returns the value and the next seed. */
const roll = (rng: number): [number, number] => {
  const next = createSeededRandom(rng)();
  return [next, Math.floor(next * 2147483646) + 1];
};

/** Reel cards are drawn near the line card, mostly one rank either way (playable
 * now) and sometimes two (playable after a move), wrapping. */
const NEAR = [-1, 1, -1, 1, -2, 2];
const offsetRank = (line: number, offset: number) => ((line - 1 + offset + 13) % 13) + 1;
const drawNear = (line: number, value: number) => offsetRank(line, NEAR[Math.floor(value * NEAR.length)]);
/** A fresh reel card: usually fills a direction the hand is missing, so the fish has somewhere to go both ways. */
const drawReel = (line: number, hand: Card[], value: number) => {
  const missing = [rankUp(line), rankDown(line)].filter((rank) => !hand.some((card) => card.rank === rank));
  return missing.length && value < 0.6 ? missing[Math.floor((value / 0.6) * missing.length)] : drawNear(line, value);
};

/** Keep at least one playable card in hand, so the fish always has a move to make. */
const ensurePlayable = (hand: Card[], line: number, slot: number, value: number): Card[] => {
  if (hand.some((card) => reelDirection(line, card.rank))) return hand;
  const next = [...hand];
  next[slot] = { ...next[slot], rank: value < 0.5 ? rankUp(line) : rankDown(line) };
  return next;
};

/** How far one card from this hand can move the zone each way: 0, 1 or 2 notches (a two-card run). */
export const reach = (line: number, hand: Card[], direction: 1 | -1) => {
  const step = (rank: number) => (direction === 1 ? rankUp(rank) : rankDown(rank));
  const first = hand.find((card) => card.rank === step(line));
  if (!first) return 0;
  return hand.some((card) => card !== first && card.rank === step(first.rank)) ? 2 : 1;
};

export const createFight = (seed: number, rank: number): FightState => {
  let rng = seed;
  const hand: Card[] = [];
  for (let index = 0; index < FIGHT_HAND_SIZE; index++) {
    const [value, next] = roll(rng);
    rng = next;
    hand.push({ id: `reel-${index}`, rank: drawNear(rank, value) });
  }
  const [value, next] = roll(rng);
  const middle = FIGHT_NOTCHES / 2;
  // The fight opens with the fish in the zone; its first move comes a beat later.
  return {
    rank, rng: next, time: 0,
    fish: { target: middle, pos: middle, beatIn: temperFor(rank).beat },
    zone: { goal: middle, pos: middle, size: temperFor(rank).zone },
    progress: FIGHT_START_PROGRESS,
    line: rank,
    hand: ensurePlayable(hand, rank, 0, value),
    dealt: FIGHT_HAND_SIZE,
    plays: 0,
    streak: 0,
    slipped: false,
    result: null,
  };
};

export const fishInZone = (fight: FightState) => Math.abs(fight.fish.pos - fight.zone.pos) <= fight.zone.size / 2;

/** The fish turns: it heads somewhere one answering card (or a two-card run) away from the zone. */
const nextMove = (fight: FightState): FightState => {
  const temper = temperFor(fight.rank);
  const kept = !fight.slipped;
  const streak = kept ? fight.streak + 1 : 0;
  const size = clamp(fight.zone.size + (kept ? -ZONE_TIGHTEN : ZONE_LOOSEN), temper.zoneMin, temper.zoneMax);
  const [pickValue, r1] = roll(fight.rng);
  const [dashValue, rng] = roll(r1);
  const options = ([1, -1] as const).flatMap((direction) => {
    const notches = Math.min(reach(fight.line, fight.hand, direction), direction === 1 ? FIGHT_NOTCHES - fight.zone.goal : fight.zone.goal);
    return notches ? [{ direction, notches }] : [];
  });
  // Lean away from the meter's ends so both directions stay open.
  const weight = (direction: number) => 1 + (direction === 1 ? FIGHT_NOTCHES - fight.zone.goal : fight.zone.goal) / FIGHT_NOTCHES;
  const total = options.reduce((sum, option) => sum + weight(option.direction), 0);
  let pick = pickValue * total;
  const choice = options.find((option) => (pick -= weight(option.direction)) < 0) ?? options[0];
  // No card answers either way: the fish rests where the zone is.
  const move = choice ? choice.direction * (choice.notches === 2 && dashValue < temper.dash ? 2 : 1) : 0;
  return { ...fight, rng, streak, slipped: false, fish: { ...fight.fish, target: fight.zone.goal + move, beatIn: temper.beat }, zone: { ...fight.zone, size } };
};

export const stepFight = (fight: FightState, dt: number): FightState => {
  if (fight.result || dt <= 0) return fight;
  const temper = temperFor(fight.rank);
  let next: FightState = { ...fight, time: fight.time + dt, fish: { ...fight.fish, beatIn: fight.fish.beatIn - dt } };
  if (next.fish.beatIn <= 0) next = nextMove(next);
  // Fish and zone glide at the same speed, so an instant answer keeps them together.
  next = {
    ...next,
    fish: { ...next.fish, pos: glideTo(next.fish.pos, next.fish.target, temper.glide, dt) },
    zone: { ...next.zone, pos: glideTo(next.zone.pos, next.zone.goal, temper.glide, dt) },
  };
  const inZone = fishInZone(next);
  const progress = clamp(next.progress + (inZone ? FIGHT_FILL : -FIGHT_DRAIN) * dt, 0, 1);
  const result: FightResult | null = progress >= 1 ? 'landed' : progress <= 0 || next.time >= FIGHT_LIMIT ? 'escaped' : null;
  return { ...next, progress, result, slipped: next.slipped || !inZone };
};

/** Play a reel card onto the line. Cards that are neither +1 nor -1 are refused, as are moves off the meter. */
export const playReelCard = (fight: FightState, cardId: string): FightState => {
  const index = fight.hand.findIndex((card) => card.id === cardId);
  const card = fight.hand[index];
  const direction = card ? reelDirection(fight.line, card.rank) : 0;
  const goal = fight.zone.goal + direction;
  if (fight.result || !direction || goal < 0 || goal > FIGHT_NOTCHES) return fight;
  const [drawValue, r1] = roll(fight.rng);
  const [fixValue, rng] = roll(r1);
  const hand = [...fight.hand];
  hand[index] = { id: `reel-${fight.dealt}`, rank: drawReel(card.rank, hand.filter((_, slot) => slot !== index), drawValue) };
  return {
    ...fight,
    rng,
    line: card.rank,
    hand: ensurePlayable(hand, card.rank, index, fixValue),
    dealt: fight.dealt + 1,
    plays: fight.plays + 1,
    zone: { ...fight.zone, goal },
  };
};

/** The auto-solve: the card that moves the zone toward the fish, if the hand has one. */
export const solveFight = (fight: FightState): Card | null => {
  const want = Math.sign(fight.fish.target - fight.zone.goal);
  return want ? fight.hand.find((card) => reelDirection(fight.line, card.rank) === want) ?? null : null;
};

/** Where a notch position sits on the meter, 0 (bottom) to 1 (top), for drawing. */
export const meterFraction = (notch: number) => (notch + 0.5) / (FIGHT_NOTCHES + 1);
