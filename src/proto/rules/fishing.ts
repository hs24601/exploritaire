import type { Card, ProtoState } from '../protoState';
import { createDeck, createSeededRandom, isAdjacentRank, shuffle } from './setup';

// Pond fishing: Go Fish for one. Pure: no React or DOM.
//
// The pond holds a hidden hand of fish (the water) and the angler holds bait.
// Casting a bait card asks the pond "got any sevens?":
// - Bite: every fish of that rank in the water is caught, as in Go Fish where the
//   other player hands over all their sevens. Fresh fish rise from the school to
//   refill the water.
// - Miss ("Go fish!"): fish one rank away (golf adjacency, A and K wrap) nibble
//   and show their rank, so a miss still teaches something.
// Every cast spends its bait and the angler draws a fresh one from the tin.
// The line holds fewer casts than the tin holds bait, so each cast is a choice:
// ripples hint each hidden fish's size band, nibbles show exact ranks.

export const POND_WATER_SIZE = 6;
export const POND_FISH_PER_DAY = 10;
export const POND_HAND_SIZE = 4;
export const POND_BAIT_PER_DAY = 16;
/** Bait cards per day that match a fish; the rest are decoys that can only nibble. */
export const POND_MATCHED_BAIT = 8;
/** Casts the line holds each day; the tin has more bait than that, so choosing matters. */
export const POND_CASTS_PER_DAY = 10;
/** The fourth fish ever caught is always the glowfish. */
export const GLOWFISH_CATCH = 4;

export type PondCatch = 'fish' | 'glowfish';
export type PondFish = { id: string; rank: number; revealed: boolean };
export type PondCast = { rank: number; outcome: 'bite' | 'miss'; catches: PondCatch[]; nibbles: number; drew: boolean };
export type PondState = {
  seed: number;
  day: number;
  /** Fish in reach of a cast, face down unless a nibble showed them. */
  water: PondFish[];
  /** Fish that rise to refill the water after a bite. */
  school: PondFish[];
  /** Bait draw pile. */
  bait: Card[];
  hand: Card[];
  castsLeft: number;
  /** Lifetime catches; decides the glowfish. */
  caught: number;
  /** Ranks that missed since the water last changed. A hint, not a block. */
  missedRanks: number[];
  lastCast: PondCast | null;
};

export type RippleSize = 'small' | 'medium' | 'large';
export const rippleSize = (rank: number): RippleSize => rank <= 4 ? 'small' : rank <= 9 ? 'medium' : 'large';
export const RIPPLE_RANGES: Record<RippleSize, string> = { small: 'A–4', medium: '5–9', large: '10–K' };

export const createPondDeal = (seed: number, day: number, caught = 0): PondState => {
  const random = createSeededRandom(seed + day * 7907);
  const fishRanks = shuffle(createDeck(), random).slice(0, POND_FISH_PER_DAY).map((card) => card.rank);
  const fish = fishRanks.map((rank, index) => ({ id: `pond-${day}-fish-${index}`, rank, revealed: false }));
  const water = fish.slice(0, POND_WATER_SIZE);
  const school = fish.slice(POND_WATER_SIZE);
  // Decoys come from ranks no fish has, so they never bite by accident.
  const decoyRanks = Array.from({ length: 13 }, (_, index) => index + 1).filter((rank) => !fishRanks.includes(rank));
  const decoyPool = decoyRanks.length ? decoyRanks : [fishRanks[0]];
  const bait = (rank: number, index: number): Card => ({ id: `pond-${day}-bait-${index}`, rank });
  const matched = fishRanks.slice(0, POND_MATCHED_BAIT).map(bait);
  const decoys = Array.from({ length: POND_BAIT_PER_DAY - POND_MATCHED_BAIT }, (_, index) =>
    bait(decoyPool[Math.floor(random() * decoyPool.length)], POND_MATCHED_BAIT + index));
  // The opening hand always holds two bites for the water and two decoys.
  const hand = shuffle([matched[0], matched[1], decoys[0], decoys[1]], random);
  const pile = shuffle([...matched.slice(2), ...decoys.slice(2)], random);
  return { seed, day, water, school, bait: pile, hand, castsLeft: POND_CASTS_PER_DAY, caught, missedRanks: [], lastCast: null };
};

/** A new day restocks the pond; lifetime catches carry over. */
export const restockPond = (pond: PondState, day: number) => createPondDeal(pond.seed, day, pond.caught);

export const nextCatchKind = (caught: number): PondCatch => caught + 1 === GLOWFISH_CATCH ? 'glowfish' : 'fish';

export const pondFinished = (pond: PondState) => pond.castsLeft <= 0 || pond.hand.length === 0 || pond.water.length === 0;

export const castBait = (pond: PondState, baitId: string): { pond: PondState; catches: PondCatch[] } => {
  const card = pond.hand.find((entry) => entry.id === baitId);
  if (!card || pondFinished(pond)) return { pond, catches: [] };
  const drawn = pond.bait[0];
  const hand = [...pond.hand.filter((entry) => entry.id !== baitId), ...(drawn ? [drawn] : [])];
  const bait = pond.bait.slice(1);
  const castsLeft = pond.castsLeft - 1;
  const hooked = pond.water.filter((fish) => fish.rank === card.rank);
  if (hooked.length) {
    const catches = hooked.map((_, index) => nextCatchKind(pond.caught + index));
    const remaining = pond.water.filter((fish) => fish.rank !== card.rank);
    const rising = pond.school.slice(0, POND_WATER_SIZE - remaining.length);
    return {
      catches,
      pond: {
        ...pond,
        hand,
        bait,
        castsLeft,
        water: [...remaining, ...rising],
        school: pond.school.slice(rising.length),
        caught: pond.caught + catches.length,
        missedRanks: [],
        lastCast: { rank: card.rank, outcome: 'bite', catches, nibbles: 0, drew: Boolean(drawn) },
      },
    };
  }
  const nibbles = pond.water.filter((fish) => isAdjacentRank(fish.rank, card.rank)).length;
  return {
    catches: [],
    pond: {
      ...pond,
      hand,
      bait,
      castsLeft,
      water: pond.water.map((fish) => isAdjacentRank(fish.rank, card.rank) ? { ...fish, revealed: true } : fish),
      missedRanks: pond.missedRanks.includes(card.rank) ? pond.missedRanks : [...pond.missedRanks, card.rank],
      lastCast: { rank: card.rank, outcome: 'miss', catches: [], nibbles, drew: Boolean(drawn) },
    },
  };
};

// Eating the catch. Fish is plain food; the glowfish lends its glow to the eater
// until the day ends: more max stamina and a brighter, cooler carried light.
export const FISH_STAMINA = 1;
export const GLOWFISH_MAX_STAMINA_BONUS = 2;
export const GLOWFISH_LUMINOSITY = 0.6;
export const GLOWFISH_LIGHT_COLOR = '#9ff3ff';
/** A glowfish lying on the table lights its surroundings faintly ("dim"). */
export const GLOWFISH_TABLE_LIGHT = { radius: 1.6, height: 18, strength: 0.32, color: GLOWFISH_LIGHT_COLOR, flicker: 0.15, fromPiece: true };

type EaterState = Pick<ProtoState, 'stamina' | 'maxStamina' | 'actorStamina' | 'worldActors' | 'glowfishGlow'>;

export const eatPondCatch = <T extends EaterState>(state: T, kind: PondCatch, actorId: string, actorStaminaMax: number): T => {
  const glow = kind === 'glowfish';
  const maxStamina = state.maxStamina + (glow && !state.glowfishGlow ? GLOWFISH_MAX_STAMINA_BONUS : 0);
  const gain = FISH_STAMINA + (glow ? GLOWFISH_MAX_STAMINA_BONUS : 0);
  return {
    ...state,
    maxStamina,
    stamina: Math.min(maxStamina, state.stamina + gain),
    actorStamina: state.actorStamina.map((value, index) => index === 0 ? Math.min(actorStaminaMax, value + FISH_STAMINA) : value),
    worldActors: glow ? state.worldActors.map((actor) => actor.id === actorId ? { ...actor, luminosity: GLOWFISH_LUMINOSITY, lightColor: GLOWFISH_LIGHT_COLOR } : actor) : state.worldActors,
    glowfishGlow: state.glowfishGlow || glow,
  };
};

/** Night falls on the glow: max stamina and every actor's light return to normal. */
export const endGlowfishGlow = <T extends EaterState>(state: T, defaultLuminosity: number): T => {
  if (!state.glowfishGlow) return state;
  const maxStamina = state.maxStamina - GLOWFISH_MAX_STAMINA_BONUS;
  return {
    ...state,
    maxStamina,
    stamina: Math.min(maxStamina, state.stamina),
    worldActors: state.worldActors.map((actor) => actor.lightColor === GLOWFISH_LIGHT_COLOR ? { ...actor, luminosity: defaultLuminosity, lightColor: undefined } : actor),
    glowfishGlow: false,
  };
};
