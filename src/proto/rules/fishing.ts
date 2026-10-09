import type { Card, ProtoState } from '../protoState';
import { createDeck, createSeededRandom, isAdjacentRank, shuffle } from './setup';

// Pond fishing: Go Fish for one. Pure: no React or DOM.
//
// The pond holds a hidden hand of fish (the water) and the angler holds bait.
// Casting a bait card into the pond asks it "got any kings?":
// - Bite: a fish of that rank takes the bait and is hooked. The fight that
//   follows (rules/fishFight.ts) lands it or loses it. A landed fish is caught
//   as its species (each rank is one, from the ace Minnow to the king Kingfish),
//   sometimes with a lucky extra (a glowfish), and a fresh fish rises from the school.
// - Miss ("Go fish!"): the bait is lost and casting costs stamina, but fish one
//   rank away (golf adjacency, A and K wrap) nibble and show their rank, so a
//   miss still teaches something.
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
/** Stamina a missed cast costs; casting needs at least this much. */
export const POND_MISS_STAMINA = 1;

export { GLOWFISH_CHANCE, POND_CATCHES, POND_SPECIES, catchForRank, isPondCatch, speciesForRank, type PondCatch, type PondSpecies } from './pondSpecies';
import { GLOWFISH_CHANCE, POND_SPECIES, catchForRank, type PondCatch, type PondSpecies } from './pondSpecies';
export type PondFish = { id: string; rank: number; revealed: boolean };
export type PondCast = { rank: number; outcome: 'bite' | 'miss' | 'landed' | 'escaped'; catch?: PondSpecies; bonus?: 'glowfish'; nibbles: number; drew: boolean };
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
  /** Lifetime catches. */
  caught: number;
  /** The fish on the line while a fight is on. */
  hooked: string | null;
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
  return { seed, day, water, school, bait: pile, hand, castsLeft: POND_CASTS_PER_DAY, caught, hooked: null, missedRanks: [], lastCast: null };
};

/** A new day restocks the pond; lifetime catches carry over. */
export const restockPond = (pond: PondState, day: number) => createPondDeal(pond.seed, day, pond.caught);

export const pondFinished = (pond: PondState) => !pond.hooked && (pond.castsLeft <= 0 || pond.hand.length === 0 || pond.water.length === 0);

/** Cast a bait card. A fish of that rank bites and is hooked; otherwise the bait is lost. */
export const castBait = (pond: PondState, baitId: string): { pond: PondState; hooked: PondFish | null } => {
  const card = pond.hand.find((entry) => entry.id === baitId);
  if (!card || pond.hooked || pondFinished(pond)) return { pond, hooked: null };
  const drawn = pond.bait[0];
  const hand = [...pond.hand.filter((entry) => entry.id !== baitId), ...(drawn ? [drawn] : [])];
  const bait = pond.bait.slice(1);
  const castsLeft = pond.castsLeft - 1;
  const hooked = pond.water.find((fish) => fish.rank === card.rank) ?? null;
  if (hooked) {
    return { hooked, pond: { ...pond, hand, bait, castsLeft, hooked: hooked.id, lastCast: { rank: card.rank, outcome: 'bite', nibbles: 0, drew: Boolean(drawn) } } };
  }
  const nibbles = pond.water.filter((fish) => isAdjacentRank(fish.rank, card.rank)).length;
  return {
    hooked: null,
    pond: {
      ...pond,
      hand,
      bait,
      castsLeft,
      water: pond.water.map((fish) => isAdjacentRank(fish.rank, card.rank) ? { ...fish, revealed: true } : fish),
      missedRanks: pond.missedRanks.includes(card.rank) ? pond.missedRanks : [...pond.missedRanks, card.rank],
      lastCast: { rank: card.rank, outcome: 'miss', nibbles, drew: Boolean(drawn) },
    },
  };
};

/** The fight was won: the hooked fish is caught, the luck roll may add a glowfish, and a fresh fish rises from the school. */
export const landHooked = (pond: PondState): { pond: PondState; caught: PondSpecies | null; bonus: 'glowfish' | null } => {
  const fish = pond.water.find((entry) => entry.id === pond.hooked);
  if (!fish) return { pond, caught: null, bonus: null };
  const remaining = pond.water.filter((entry) => entry.id !== fish.id);
  const rising = pond.school.slice(0, POND_WATER_SIZE - remaining.length);
  const caught = catchForRank(fish.rank);
  const bonus = createSeededRandom(pond.seed + (pond.caught + 1) * 7919)() < GLOWFISH_CHANCE ? 'glowfish' : null;
  return {
    caught,
    bonus,
    pond: {
      ...pond,
      water: [...remaining, ...rising],
      school: pond.school.slice(rising.length),
      caught: pond.caught + 1,
      hooked: null,
      missedRanks: [],
      lastCast: { rank: fish.rank, outcome: 'landed', catch: caught, ...(bonus ? { bonus } : {}), nibbles: 0, drew: pond.lastCast?.drew ?? false },
    },
  };
};

/** The fight was lost: the fish slips the hook and stays in the water, face up. */
export const loseHooked = (pond: PondState): PondState => {
  const fish = pond.water.find((entry) => entry.id === pond.hooked);
  if (!fish) return { ...pond, hooked: null };
  return {
    ...pond,
    hooked: null,
    water: pond.water.map((entry) => entry.id === fish.id ? { ...entry, revealed: true } : entry),
    lastCast: { rank: fish.rank, outcome: 'escaped', nibbles: 0, drew: pond.lastCast?.drew ?? false },
  };
};

// Eating the catch. Each species restores its stamina to the party and the
// eater; the Kingfish is a feast that restores both in full. The glowfish lends
// its glow to the eater until the day ends: more max stamina and a brighter,
// cooler carried light.
export const GLOWFISH_STAMINA = 1;
export const GLOWFISH_MAX_STAMINA_BONUS = 2;
export const GLOWFISH_LUMINOSITY = 0.6;
export const GLOWFISH_LIGHT_COLOR = '#9ff3ff';
/** A glowfish lying on the table lights its surroundings faintly ("dim"). */
export const GLOWFISH_TABLE_LIGHT = { radius: 1.6, height: 18, strength: 0.32, color: GLOWFISH_LIGHT_COLOR, flicker: 0.15, fromPiece: true };

type EaterState = Pick<ProtoState, 'stamina' | 'maxStamina' | 'actorStamina' | 'worldActors' | 'glowfishGlow'>;

export const eatPondCatch = <T extends EaterState>(state: T, kind: PondCatch, actorId: string, actorStaminaMax: number): T => {
  const glow = kind === 'glowfish';
  const food = glow ? GLOWFISH_STAMINA : POND_SPECIES.find((species) => species.id === kind)!.stamina;
  const maxStamina = state.maxStamina + (glow && !state.glowfishGlow ? GLOWFISH_MAX_STAMINA_BONUS : 0);
  const gain = food + (glow ? GLOWFISH_MAX_STAMINA_BONUS : 0);
  return {
    ...state,
    maxStamina,
    stamina: Math.min(maxStamina, state.stamina + gain),
    actorStamina: state.actorStamina.map((value, index) => index === 0 ? Math.min(actorStaminaMax, value + food) : value),
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
