import { describe, expect, it } from 'vitest';
import { advanceDiscoveryAnimations, DISCOVERY_DURATION_MS } from './tileDiscoveryAnimation';

describe('cosmetic tile discovery clock', () => {
  it('starts only hidden-to-visible transitions and keeps their original clock', () => {
    const previous = new Map([['new', false], ['home', true]]);
    const tiles = [{ id: 'new' }, { id: 'home' }, { id: 'added' }];
    const active = advanceDiscoveryAnimations(previous, new Map(), tiles, 100, false);
    expect([...active]).toEqual([['new', 100]]);
    expect([...advanceDiscoveryAnimations(new Map(tiles.map(tile => [tile.id, true])), active, tiles, 2000, false)]).toEqual([['new', 100]]);
  });
  it('ends completed effects without replaying, and removes concealed or deleted tiles', () => {
    const previous = new Map([['new', true], ['hidden', true], ['deleted', true]]);
    const active = new Map([['new', 100], ['hidden', 100], ['deleted', 100]]);
    expect(advanceDiscoveryAnimations(previous, active, [{ id: 'new' }, { id: 'hidden', flags: ['unexplored'] }], 100 + DISCOVERY_DURATION_MS, false).size).toBe(0);
  });
  it('skips and clears effects under reduced motion, retaining discovery', () => {
    expect(advanceDiscoveryAnimations(new Map([['tile', false]]), new Map([['tile', 100]]), [{ id: 'tile' }], 200, true).size).toBe(0);
    expect(advanceDiscoveryAnimations(new Map([['tile', true]]), new Map(), [{ id: 'tile' }], 300, false).size).toBe(0);
  });
  it('keeps locked terrain concealed until it becomes visible', () => {
    expect(advanceDiscoveryAnimations(new Map([['tile', false]]), new Map(), [{ id: 'tile', unlocked: false }], 100, false).size).toBe(0);
    expect([...advanceDiscoveryAnimations(new Map([['tile', false]]), new Map(), [{ id: 'tile', unlocked: true }], 200, false)]).toEqual([['tile', 200]]);
  });
});
