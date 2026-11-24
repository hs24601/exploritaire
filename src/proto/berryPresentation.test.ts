import { describe, expect, it } from 'vitest';
import { berryScenerySprite, tileHasBerries } from './berryPresentation';
import type { Card } from './protoState';

const berry: Card = { id:'fruit', rank:3, resource:'mana', foodSource:'berries' };
const tile = { tileType:'berry-patch' as const, tableau:[[]] as Card[][], stock:[] as Card[] };
describe('dynamic bush fruit', () => {
  it('keeps sparse fruit until its finite harvest, including on revisits', () => {
    expect(tileHasBerries({...tile,berryPatchVariant:'sparse'})).toBe(true);
    expect(tileHasBerries({...tile,berryPatchVariant:'sparse',berryHarvested:true})).toBe(false);
  });
  it('includes buried rewards and stock, but removes fruit when the final reward is taken', () => {
    expect(tileHasBerries({...tile,tableau:[[berry,{id:'cover',rank:4}]]})).toBe(true);
    expect(tileHasBerries({...tile,stock:[berry]})).toBe(true);
    expect(tileHasBerries(tile)).toBe(false);
    expect(tileHasBerries({...tile,tableau:[[berry]]}, [[{id:'remaining',rank:4}]], [])).toBe(false);
  });
  it('selects empty foliage without changing other scenery', () => {
    expect(berryScenerySprite('/art/manaberry-sparse-standee-v1.png',false)).toBe('/art/manaberry-sparse-standee-empty-v1.png');
    expect(berryScenerySprite('/art/pine.png',false)).toBe('/art/pine.png');
  });
});
