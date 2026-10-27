import { describe, expect, it } from 'vitest';
import { actorSprite } from './actorArt';

describe('static actor art selection', () => {
  it('selects painted den poses with deployment prefixes intact', () => {
    for (const view of ['', '-topdown']) {
      const src = `/game/assets/deprecated/pixel/characters/hero-sleeping${view}.png`;
      expect(actorSprite(src, 'paint')).toBe(`/game/assets/runtime/characters/hero/sleeping/watercolor/v1/hero-sleeping${view}-body-v3.png`);
      expect(actorSprite(src, 'pixel')).toBe(src);
    }
  });
  it('preserves unconverted companions and missing art', () => {
    for (const src of [undefined, '/assets/deprecated/pixel/characters/mochi-sleeping.png', '/assets/deprecated/pixel/characters/hero-mochi-sleeping.png']) {
      expect(actorSprite(src, 'paint')).toBe(src);
    }
  });
});
