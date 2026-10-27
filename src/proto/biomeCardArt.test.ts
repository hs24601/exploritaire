import { describe, expect, it } from 'vitest';
import { biomeCardKind, biomeCardSources, cardViewIndex, CARD_VIEW_COUNT } from './biomeCardArt';

describe('biome tableau artwork', () => {
  it('keeps identity views stable and fills the bounded pool for repeated ranks', () => {
    const queens = Array.from({ length: 100 }, (_, i) => ({ id: `card-${i}`, rank: 12 }));
    const views = queens.map(card => cardViewIndex(card.id));
    expect(new Set(views).size).toBe(CARD_VIEW_COUNT);
    expect(views).toEqual(queens.map(card => cardViewIndex(card.id)));
    expect(views.every(v => v >= 0 && v < CARD_VIEW_COUNT)).toBe(true);
  });
  it('follows live type and terrain for newly placed tiles, without a per-ID art entry', () => {
    expect(biomeCardKind({ id: 'new-berry-cell', tileType: 'berry-patch', terrain: 'woods' })).toBe('berry-patch');
    expect(biomeCardKind({ id: 'new-water-cell', terrain: 'water' })).toBe('water');
    expect(biomeCardKind({ id: 'new-path', road: { shape: 'straight' }, terrain: 'woods' })).toBe('path');
    expect(biomeCardKind({ id: 'hero-den' })).toBe('hero-den');
    expect(biomeCardKind({ id: 'combat', terrain: 'woods', danger: true })).toBe('dark-woods');
  });
  it('conceals unknown terrain even when it has a known biome or combat theme', () => {
    expect(biomeCardKind({ tileType: 'berry-patch', berryPatchVariant: 'sparse' })).toBe('berry-patch-sparse');
    expect(biomeCardSources('berry-patch-sparse', 'paint').scenery).toContain('manaberry-sparse-standee-v1.png');
    expect(biomeCardKind({ tileType: 'berry-patch', berryPatchVariant: 'sparse', flags: ['unexplored'] })).toBe('unexplored');
    expect(biomeCardKind({ tileType: 'berry-patch', flags: ['unexplored', 'danger'] })).toBe('unexplored');
    expect(biomeCardKind({ tileType: 'future-biome' })).toBe('unexplored');
    expect(biomeCardSources('unexplored', 'paint')).toEqual({ ground: undefined, overhead: undefined, scenery: undefined });
  });
  it('selects painted counterparts and retains original art when no counterpart exists', () => {
    const paint = biomeCardSources('berry-patch', 'paint'), pixel = biomeCardSources('berry-patch', 'pixel');
    expect(paint.scenery).toContain('watercolor/v1/berry-patch-sprite-v2.png');
    expect(pixel.scenery).toContain('deprecated/pixel/environment/berry-bush.svg');
    expect(biomeCardSources('water', 'paint')).toEqual(biomeCardSources('water', 'pixel'));
  });
});
