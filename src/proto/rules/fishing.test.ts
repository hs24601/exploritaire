import { describe, expect, it } from 'vitest';
import { GLOWFISH_CATCH, POND_BAIT_PER_DAY, POND_CASTS_PER_DAY, POND_FISH_PER_DAY, POND_HAND_SIZE, POND_WATER_SIZE, GLOWFISH_LIGHT_COLOR, GLOWFISH_LUMINOSITY, GLOWFISH_MAX_STAMINA_BONUS, castBait, createPondDeal, eatPondCatch, endGlowfishGlow, pondFinished, restockPond, rippleSize, type PondState } from './fishing';
import { isAdjacentRank } from './setup';

const biteFor = (pond: PondState) => pond.hand.find((card) => pond.water.some((fish) => fish.rank === card.rank));
const missFor = (pond: PondState) => pond.hand.find((card) => !pond.water.some((fish) => fish.rank === card.rank));

describe('pond fishing', () => {
  it('deals a seeded pond with two opening bites in hand', () => {
    const pond = createPondDeal(42, 1);
    expect(createPondDeal(42, 1)).toEqual(pond);
    expect(pond.water).toHaveLength(POND_WATER_SIZE);
    expect(pond.water.length + pond.school.length).toBe(POND_FISH_PER_DAY);
    expect(pond.hand).toHaveLength(POND_HAND_SIZE);
    expect(pond.hand.length + pond.bait.length).toBe(POND_BAIT_PER_DAY);
    expect(pond.hand.filter((card) => pond.water.some((fish) => fish.rank === card.rank)).length).toBeGreaterThanOrEqual(2);
    expect(pond.water.every((fish) => !fish.revealed)).toBe(true);
  });

  it('a bite catches every fish of that rank, spends the bait and refills the water', () => {
    const pond = createPondDeal(7, 1);
    const bait = biteFor(pond)!;
    const hooked = pond.water.filter((fish) => fish.rank === bait.rank).length;
    const { pond: next, catches } = castBait(pond, bait.id);
    expect(catches).toHaveLength(hooked);
    expect(next.caught).toBe(hooked);
    expect(next.hand.some((card) => card.id === bait.id)).toBe(false);
    expect(next.hand).toHaveLength(POND_HAND_SIZE);
    expect(next.water).toHaveLength(POND_WATER_SIZE);
    expect(next.school).toHaveLength(pond.school.length - hooked);
    expect(next.lastCast?.outcome).toBe('bite');
  });

  it('a miss says go fish, draws fresh bait and shows fish one rank away', () => {
    const pond = createPondDeal(7, 1);
    const bait = missFor(pond)!;
    const { pond: next, catches } = castBait(pond, bait.id);
    expect(catches).toEqual([]);
    expect(next.caught).toBe(0);
    expect(next.hand).toHaveLength(POND_HAND_SIZE);
    expect(next.hand[next.hand.length - 1]).toEqual(pond.bait[0]);
    expect(next.missedRanks).toEqual([bait.rank]);
    expect(next.lastCast).toMatchObject({ outcome: 'miss', rank: bait.rank });
    next.water.forEach((fish) => expect(fish.revealed).toBe(isAdjacentRank(fish.rank, bait.rank)));
  });

  it('the fourth fish ever caught is the glowfish, and only that one', () => {
    let pond = { ...createPondDeal(3, 1), caught: GLOWFISH_CATCH - 1 };
    const result = castBait(pond, biteFor(pond)!.id);
    expect(result.catches[0]).toBe('glowfish');
    expect(result.catches.slice(1).every((kind) => kind === 'fish')).toBe(true);
    pond = { ...createPondDeal(3, 1), caught: GLOWFISH_CATCH };
    expect(castBait(pond, biteFor(pond)!.id).catches.every((kind) => kind === 'fish')).toBe(true);
  });

  it('several seeds reach the glowfish on the first day by casting bites first', () => {
    for (const seed of [1, 2, 3, 99, 12345]) {
      let pond = createPondDeal(seed, 1);
      const caught: string[] = [];
      while (!pondFinished(pond)) {
        const card = biteFor(pond) ?? pond.hand[0];
        const result = castBait(pond, card.id);
        caught.push(...result.catches);
        pond = result.pond;
      }
      expect(caught[GLOWFISH_CATCH - 1]).toBe('glowfish');
    }
  });

  it('the line holds fewer casts than the tin holds bait', () => {
    let pond = createPondDeal(11, 1);
    let casts = 0;
    while (!pondFinished(pond)) { pond = castBait(pond, pond.hand[0].id).pond; casts += 1; }
    expect(casts).toBe(POND_CASTS_PER_DAY);
    expect(pond.castsLeft).toBe(0);
    expect(pond.hand.length + pond.bait.length).toBeGreaterThan(0);
    expect(castBait(pond, pond.hand[0].id).pond).toBe(pond);
  });

  it('restocking keeps the lifetime catch count', () => {
    const pond = castBait(createPondDeal(5, 1), biteFor(createPondDeal(5, 1))!.id).pond;
    const tomorrow = restockPond(pond, 2);
    expect(tomorrow.day).toBe(2);
    expect(tomorrow.caught).toBe(pond.caught);
    expect(tomorrow.water).toHaveLength(POND_WATER_SIZE);
  });

  it('ripples group ranks into three sizes', () => {
    expect([1, 4, 5, 9, 10, 13].map(rippleSize)).toEqual(['small', 'small', 'medium', 'medium', 'large', 'large']);
  });

  describe('eating the catch', () => {
    const eater = () => ({ stamina: 3, maxStamina: 8, actorStamina: [2, 4, 4], worldActors: [{ id: 'hero' as const, label: 'Hero', location: 'table' as const, position: { x: 0, y: 0 }, luminosity: 0.3 }], glowfishGlow: false });

    it('a fish restores one stamina to the party and the actor', () => {
      const fed = eatPondCatch(eater(), 'fish', 'hero', 4);
      expect(fed).toMatchObject({ stamina: 4, maxStamina: 8, actorStamina: [3, 4, 4], glowfishGlow: false });
      expect(fed.worldActors[0].luminosity).toBe(0.3);
    });

    it('a glowfish raises max stamina and the eater\'s light until the glow ends', () => {
      const fed = eatPondCatch(eater(), 'glowfish', 'hero', 4);
      expect(fed.maxStamina).toBe(8 + GLOWFISH_MAX_STAMINA_BONUS);
      expect(fed.stamina).toBe(3 + 1 + GLOWFISH_MAX_STAMINA_BONUS);
      expect(fed.worldActors[0]).toMatchObject({ luminosity: GLOWFISH_LUMINOSITY, lightColor: GLOWFISH_LIGHT_COLOR });
      expect(eatPondCatch(fed, 'glowfish', 'hero', 4).maxStamina).toBe(fed.maxStamina);
      const night = endGlowfishGlow({ ...fed, stamina: fed.maxStamina }, 0.3);
      expect(night).toMatchObject({ maxStamina: 8, stamina: 8, glowfishGlow: false });
      expect(night.worldActors[0]).toMatchObject({ luminosity: 0.3, lightColor: undefined });
      expect(endGlowfishGlow(night, 0.3)).toBe(night);
    });
  });
});
