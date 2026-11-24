import { describe, expect, it } from 'vitest';
import { BLOCKED_REGIONS, CLEAR_AREA, blockedPathObstacles, isBlockedPoint } from './worldBounds';
import { findWorldPath } from './worldPathfinding';
import { sampleTableLight, tableLightReaches } from './protoLighting';

describe('world bounds', () => {
  it('leaves a 15x15 open square around True Center', () => {
    expect((CLEAR_AREA.right - CLEAR_AREA.left) / 48).toBe(15);
    expect(isBlockedPoint({ x: 7 * 48, y: -7 * 48 })).toBe(false);
    expect(isBlockedPoint({ x: 8 * 48, y: 0 })).toBe(true);
  });
  it('routes actors to the outermost open cell but never onto terrain', () => {
    expect(findWorldPath({ x: 0, y: 0 }, { x: 7 * 48, y: 7 * 48 }, blockedPathObstacles())).not.toBeNull();
    expect(findWorldPath({ x: 0, y: 0 }, { x: 8 * 48, y: 0 }, blockedPathObstacles())).toBeNull();
  });
  it('keeps table light off terrain while the sky still reaches it', () => {
    const lamp = { id: 'lamp', position: { x: 7 * 48, y: 0 }, radius: 4 };
    expect(tableLightReaches(lamp, { x: 6 * 48, y: 0 }, BLOCKED_REGIONS)).toBe(true);
    expect(tableLightReaches(lamp, { x: 8 * 48, y: 0 }, BLOCKED_REGIONS)).toBe(false);
    const onTerrain = sampleTableLight(0, { x: 8 * 48, y: 0 }, [lamp], BLOCKED_REGIONS);
    expect(onTerrain.local).toBe(0);
    expect(sampleTableLight(12, { x: 8 * 48, y: 0 }, [lamp], BLOCKED_REGIONS).ambient).toBeGreaterThan(onTerrain.ambient);
  });
});
