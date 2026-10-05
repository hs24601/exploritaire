import { describe, expect, it } from 'vitest';
import { canActorInteractWithNode, consumeFuel, EMBER_COMPLETION_REQUIREMENT, EMBER_TARGET_ID, FIRE_FUEL_CAPACITY, createInitialGame, donateToEmber, getFoundationProgress, getFuelProgress, getValidMoves, isTableauSorted } from './rules';

describe('spirit fire resource rules', () => {
  it('starts with sixteen scattered wood cards and an unfed Ember', () => {
    const game = createInitialGame();
    expect(game.scatteredCards).toHaveLength(16);
    expect(game.scatteredCards.every((card) => card.resourceType === 'wood')).toBe(true);
    expect(getFoundationProgress(game)).toBe(0);
  });

  it('allows any wood card value to target the Ember', () => {
    const game = createInitialGame();
    expect(getValidMoves(game, 'north-1')).toEqual([EMBER_TARGET_ID]);
    expect(getValidMoves(game, 'east-1')).toEqual([EMBER_TARGET_ID]);
    expect(getValidMoves(game, 'south-1')).toEqual([EMBER_TARGET_ID]);
    expect(getValidMoves(game, 'west-1')).toEqual([EMBER_TARGET_ID]);
  });

  it('tracks a donated wood card as Ember fuel instead of as a cardinal stack', () => {
    let game = createInitialGame();
    game = donateToEmber(game, 'north-1');
    game = donateToEmber(game, 'east-1');
    expect(game.fireState.fuelQueue.map((card) => card.rank)).toEqual([9, 5]);
    expect(game.scatteredCards).toHaveLength(14);
    expect(getFoundationProgress(game)).toBe(2);
  });

  it('continues accepting wood after first ignition, until its fuel rails are full', () => {
    let game = createInitialGame();
    ['north-1', 'east-1', 'south-1', 'west-1'].forEach((id) => { game = donateToEmber(game, id); });
    game = consumeFuel(game);
    const next = donateToEmber(game, 'north-2');
    expect(next.scatteredCards).toHaveLength(11);
    expect(next.fireState.fuelQueue).toHaveLength(5);
  });

  it('completes after exactly four wood donations', () => {
    let game = createInitialGame();
    ['north-1', 'east-1', 'south-1', 'west-1'].forEach((id) => { game = donateToEmber(game, id); });
    expect(isTableauSorted(game)).toBe(true);
    expect(getFoundationProgress(game)).toBe(EMBER_COMPLETION_REQUIREMENT);
  });

  it('stores ten action ticks per wood rail and burns one tick per node action', () => {
    let game = createInitialGame();
    game = donateToEmber(game, 'north-1');
    expect(getFuelProgress(game)).toBe(10);
    game = consumeFuel(game);
    expect(getFuelProgress(game)).toBe(9);
    expect(game.fireState.actionCount).toBe(1);
    for (let index = 0; index < 40; index += 1) game = consumeFuel(game);
    expect(getFuelProgress(game)).toBe(0);
    expect(FIRE_FUEL_CAPACITY).toBe(40);
  });

  it('allows every actor to work a typed node; traits are efficiency affinities', () => {
    const grove = { id: 'small-grove', resourceType: 'wood' as const, requiredTrait: 'lumberLore' as const };
    expect(canActorInteractWithNode({ id: 'beaver', traits: ['lumberLore'] }, grove)).toBe(true);
    expect(canActorInteractWithNode({ id: 'wanderer', traits: [] }, grove)).toBe(true);
  });
});
