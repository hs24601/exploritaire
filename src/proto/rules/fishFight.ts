import type { Card } from '../protoState';
import { createSeededRandom } from './setup';

// The fight after a bite: a Stardew-style fishing meter played with cards. Pure:
// no React or DOM; the view steps it on animation frames.
//
// The hooked fish swims up and down a vertical meter. The catch zone is moved by
// playing reel cards onto the line card, golf style: a card one rank above the
// line card (+1) lifts the zone a notch, one rank below (-1) drops it a notch
// (A and K wrap). The played card becomes the new line card, so the next + and -
// cards change with every play: the skill is reading the hand quickly, not
// remembering cards. Every hand always holds at least one + and one - card, so a
// quick player is never stuck. Keeping the fish in the zone fills the catch bar;
// letting it out drains it. Full lands the fish, empty or the time limit loses it.

export const FIGHT_HAND_SIZE = 4;
/** Height of the catch zone, as a share of the meter. */
export const FIGHT_ZONE = 0.3;
/** How far one reel card moves the zone. */
export const FIGHT_STEP = 0.15;
/** How fast the zone glides to where the cards put it (meter heights per second). */
export const FIGHT_ZONE_SPEED = 1.4;
export const FIGHT_START_PROGRESS = 0.35;
/** Catch-bar fill per second with the fish in the zone: about four seconds of good play lands it. */
export const FIGHT_FILL = 0.17;
export const FIGHT_DRAIN = 0.12;
/** The line gives after this many seconds, so a whole fishing event stays under ten. */
export const FIGHT_LIMIT = 8;

/** How each size of fish fights: bigger fish dart further, faster and more often. */
export type FishTemper = { speed: number; dart: number; turnMin: number; turnMax: number };
export const FISH_TEMPERS: Record<'small' | 'medium' | 'large' | 'king', FishTemper> = {
  small: { speed: 0.3, dart: 0.32, turnMin: 0.8, turnMax: 1.4 },
  medium: { speed: 0.38, dart: 0.4, turnMin: 0.7, turnMax: 1.2 },
  large: { speed: 0.42, dart: 0.45, turnMin: 0.65, turnMax: 1.1 },
  king: { speed: 0.47, dart: 0.5, turnMin: 0.55, turnMax: 1 },
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
  fish: { pos: number; target: number; turnIn: number };
  /** Zone centre now and where the cards have sent it. */
  zone: { pos: number; goal: number };
  progress: number;
  line: number;
  hand: Card[];
  dealt: number;
  plays: number;
  result: FightResult | null;
};

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
const ZONE_MIN = FIGHT_ZONE / 2;
const ZONE_MAX = 1 - FIGHT_ZONE / 2;

/** Draw from a carried seed: returns the value and the next seed. */
const roll = (rng: number): [number, number] => {
  const next = createSeededRandom(rng)();
  return [next, Math.floor(next * 2147483646) + 1];
};

/** Reel cards are drawn near the line card (one or two ranks either way, wrapping),
 * so most of the hand stays in play as the line moves instead of going dead. */
const NEAR = [-2, -1, 1, 2];
const drawNear = (line: number, value: number) => ((line - 1 + NEAR[Math.floor(value * NEAR.length)] + 13) % 13) + 1;

/** Keep at least one + and one - card in hand, replacing cards that do neither. */
const ensureReelable = (hand: Card[], line: number, replaceFirst: number): Card[] => {
  const next = [...hand];
  for (const rank of [rankUp(line), rankDown(line)]) {
    if (next.some((card) => card.rank === rank)) continue;
    const order = [replaceFirst, ...next.map((_, index) => index).filter((index) => index !== replaceFirst)];
    const slot = order.find((index) => index >= 0 && reelDirection(line, next[index].rank) === 0);
    if (slot !== undefined) next[slot] = { ...next[slot], rank };
  }
  return next;
};

export const createFight = (seed: number, rank: number): FightState => {
  let rng = seed;
  const hand: Card[] = [];
  for (let index = 0; index < FIGHT_HAND_SIZE; index++) {
    const [value, next] = roll(rng);
    rng = next;
    hand.push({ id: `reel-${index}`, rank: drawNear(rank, value) });
  }
  // The fight opens with the fish in the middle of the zone: the catch bar fills from the first moment.
  return {
    rank, rng, time: 0,
    fish: { pos: 0.5, target: 0.5, turnIn: 0.35 },
    zone: { pos: 0.5, goal: 0.5 },
    progress: FIGHT_START_PROGRESS,
    line: rank,
    hand: ensureReelable(hand, rank, -1),
    dealt: FIGHT_HAND_SIZE,
    plays: 0,
    result: null,
  };
};

export const fishInZone = (fight: FightState) => Math.abs(fight.fish.pos - fight.zone.pos) <= FIGHT_ZONE / 2;

export const stepFight = (fight: FightState, dt: number): FightState => {
  if (fight.result || dt <= 0) return fight;
  const temper = temperFor(fight.rank);
  let { rng } = fight;
  let { pos, target, turnIn } = fight.fish;
  turnIn -= dt;
  if (turnIn <= 0) {
    // The fish darts somewhere new, up to `dart` away, and holds that course for a while.
    const [a, r1] = roll(rng);
    const [b, r2] = roll(r1);
    rng = r2;
    target = clamp(pos + (a * 2 - 1) * temper.dart, 0.04, 0.96);
    turnIn = temper.turnMin + b * (temper.turnMax - temper.turnMin);
  }
  pos += clamp(target - pos, -temper.speed * dt, temper.speed * dt);
  const zonePos = fight.zone.pos + clamp(fight.zone.goal - fight.zone.pos, -FIGHT_ZONE_SPEED * dt, FIGHT_ZONE_SPEED * dt);
  const next = { ...fight, rng, time: fight.time + dt, fish: { pos, target, turnIn }, zone: { ...fight.zone, pos: zonePos } };
  const progress = clamp(next.progress + (fishInZone(next) ? FIGHT_FILL : -FIGHT_DRAIN) * dt, 0, 1);
  const result: FightResult | null = progress >= 1 ? 'landed' : progress <= 0 || next.time >= FIGHT_LIMIT ? 'escaped' : null;
  return { ...next, progress, result };
};

/** Play a reel card onto the line. Cards that are neither +1 nor -1 are refused. */
export const playReelCard = (fight: FightState, cardId: string): FightState => {
  const index = fight.hand.findIndex((card) => card.id === cardId);
  const card = fight.hand[index];
  const direction = card ? reelDirection(fight.line, card.rank) : 0;
  if (fight.result || !direction) return fight;
  const [value, rng] = roll(fight.rng);
  const hand = [...fight.hand];
  hand[index] = { id: `reel-${fight.dealt}`, rank: drawNear(card.rank, value) };
  return {
    ...fight,
    rng,
    line: card.rank,
    hand: ensureReelable(hand, card.rank, index),
    dealt: fight.dealt + 1,
    plays: fight.plays + 1,
    zone: { ...fight.zone, goal: clamp(fight.zone.goal + direction * FIGHT_STEP, ZONE_MIN, ZONE_MAX) },
  };
};
