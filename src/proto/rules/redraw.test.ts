import { describe, expect, it } from 'vitest';
import { REDRAW_INSPIRATION_COST, canRedraw, drawRedrawRank, redrawFoundation, redrawOptions } from './redraw';

describe('foundation redraw', () => {
  it('draws a new value and costs the actor 1 inspiration', () => {
    expect(REDRAW_INSPIRATION_COST).toBe(1);
    const next = redrawFoundation({ rank: 7, inspiration: 3 }, { kind: 'draw' }, 0.5);
    expect(next).not.toBeNull();
    expect(next!.inspiration).toBe(2);
    expect(next!.rank).not.toBe(7);
  });

  it('is refused at 0 inspiration', () => {
    expect(canRedraw(0)).toBe(false);
    expect(redrawFoundation({ rank: 7, inspiration: 0 })).toBeNull();
  });

  it('never redraws the abandoned value and covers every other rank', () => {
    for (let current = 1; current <= 13; current += 1) {
      const ranks = new Set(Array.from({ length: 12 }, (_, step) => drawRedrawRank(current, (step + 0.5) / 12)));
      expect(ranks.has(current)).toBe(false);
      expect(ranks.size).toBe(12);
      expect([...ranks].every((rank) => rank >= 1 && rank <= 13)).toBe(true);
    }
    expect(drawRedrawRank(13, 0.999999)).toBe(12);
    expect(drawRedrawRank(1, 1)).toBe(13);
  });

  it("takes a spirit companion's fixed value instead of a random one, at the same cost", () => {
    const spirits = [{ id: 'ember', redrawRank: 9 }, { id: 'cal' }];
    const options = redrawOptions(spirits);
    expect(options).toEqual([{ kind: 'draw' }, { kind: 'spirit', spiritId: 'ember', rank: 9 }]);
    expect(redrawFoundation({ rank: 4, inspiration: 1 }, options[1])).toEqual({ rank: 9, inspiration: 0 });
    expect(redrawOptions()).toEqual([{ kind: 'draw' }]);
  });
});
