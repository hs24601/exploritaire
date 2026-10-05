import { describe, expect, it } from 'vitest';
import { resolveDroppedCard, type TableBody } from './cardPhysics';

const body = (id: string, x: number, y: number): TableBody => ({ id, x, y, halfWidth: 5, halfHeight: 7 });

describe('table card physics', () => {
  it('moves only the dropped card out of an existing card', () => {
    const fixed = body('fixed', 50, 50);
    const resolved = resolveDroppedCard(body('moving', 50, 50), [fixed]);
    expect(resolved).not.toEqual({ x: 50, y: 50 });
    expect(fixed).toMatchObject({ x: 50, y: 50 });
  });

  it('keeps a dropped card inside table boundaries', () => {
    const resolved = resolveDroppedCard(body('moving', -30, 140), []);
    expect(resolved.x).toBeGreaterThanOrEqual(5);
    expect(resolved.y).toBeLessThanOrEqual(93);
  });

  it('finds a nearby open position around dense blockers', () => {
    const resolved = resolveDroppedCard(body('moving', 50, 50), [body('a', 50, 50), body('b', 60, 50), body('c', 40, 50)]);
    expect(resolved).not.toEqual({ x: 50, y: 50 });
  });
});
