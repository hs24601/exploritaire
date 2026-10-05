import { describe, expect, it } from 'vitest';
import { advanceBuild, matchRecipe, playBuildCard, reserveIngredients, splitStack, startStackBuild, type CraftStack } from './classicPlusCrafting';

const pile = (resource: CraftStack['resource'], count: number): CraftStack => ({
  id: 'pile', resource, count, biomeId: 'woods-alpha', position: { x: 0, y: 0 },
});

describe('stack crafting', () => {
  it('accepts any mixture of low quality food, excluding crafted food', () => {
    expect(matchRecipe({ berries: 2, herbs: 1 })?.id).toBe('ration');
    expect(matchRecipe({ berries: 3 })?.id).toBe('ration');
    expect(matchRecipe({ herbs: 3 })?.id).toBe('ration');
    expect(matchRecipe({ berries: 2, hearty_ration: 1 })).toBeUndefined();
    expect(matchRecipe({ wood: 3 })?.id).toBe('lumber');
  });

  it('reserves exactly one recipe and preserves excess and unrelated ingredients', () => {
    const recipe = matchRecipe({ berries: 2, herbs: 4 })!;
    expect(reserveIngredients({ berries: 2, herbs: 4, wood: 1 }, recipe)).toEqual({
      reserved: { berries: 2, herbs: 1 }, leftovers: { herbs: 3, wood: 1 },
    });
    const [job, leftover] = startStackBuild(pile('wood', 5));
    expect(job.count).toBe(3);
    expect(leftover.ingredients).toEqual({ wood: 2 });
    expect(leftover.build).toBeUndefined();
  });

  it('produces lumber only when the timer completes', () => {
    const [job] = startStackBuild(pile('wood', 3));
    const waiting = advanceBuild(job, 5999, false);
    expect(waiting.build).toBeDefined();
    const complete = advanceBuild(waiting, 1, false);
    expect(complete.resource).toBe('lumber');
    expect(complete.count).toBe(1);
    expect(complete.build).toBeUndefined();
    expect(complete.ingredients).toBeUndefined();
    expect(advanceBuild(complete, 6000, false)).toBe(complete);
  });

  it('makes the hut from chained materials', () => {
    const materials = { ...pile('lumber', 3), ingredients: { lumber: 3, wood: 2 } };
    let [job] = startStackBuild(materials);
    expect(job.build?.recipeId).toBe('hut');
    expect(job.build?.stationId).toBe(job.id);
    expect(advanceBuild(job, 18000, false)).toBe(job);
    for (const rank of [4, 5, 6, 7]) job = playBuildCard(job, rank);
    expect(advanceBuild(job, 18000, true).resource).toBe('provisions_hut');
  });

  it('splits mixed stacks without losing resources and locks reserved ingredients', () => {
    const mixed = { ...pile('berries', 3), ingredients: { berries: 1, wood: 2 } };
    const [remaining, piece] = splitStack(mixed, 'split');
    expect(remaining.ingredients).toEqual({ wood: 2 });
    expect(remaining.resource).toBe('wood');
    expect(piece.resource).toBe('berries');
    expect(piece.count + remaining.count).toBe(3);
    const [job] = startStackBuild(pile('wood', 3));
    expect(splitStack(job, 'split')).toEqual([job]);
  });

  it('requires hut staffing, build time, and legal solitaire work for enhanced food', () => {
    const hut = { ...pile('provisions_hut', 1), id: 'hut' };
    let [job] = startStackBuild({ ...pile('berries', 3), ingredients: { berries: 1, herbs: 2 } }, hut);
    expect(job.build?.stationId).toBe('hut');
    expect(advanceBuild(job, 12000, false)).toBe(job);
    job = advanceBuild(job, 12000, true);
    expect(job.build).toBeDefined();
    expect(playBuildCard(job, 7)).toBe(job);
    for (const rank of [4, 5, 6, 7]) job = playBuildCard(job, rank);
    expect(job.build?.work).toBe(4);
    expect(playBuildCard(job, 9)).toBe(job);
    expect(advanceBuild(job, 0, true).resource).toBe('hearty_ration');
    const [earlyWork] = startStackBuild(pile('berries', 3), hut);
    let worked = earlyWork;
    for (const rank of [4, 5, 6, 7]) worked = playBuildCard(worked, rank);
    expect(advanceBuild(worked, 11999, true).build).toBeDefined();
  });
});
