import { describe, expect, it } from 'vitest';
import { createCombatCameraAction } from './combatCameraAction';
import type { BattleCue } from './rules/battleCues';

const chip: BattleCue = { id: 1, kind: 'attack', delay: 0, actorId: 'hero', targetId: 'slime', motion: 'bite', tier: 0, element: null, heavy: false, trap: false };
describe('combat camera action', () => {
  it('approaches with blur, holds a crisp contact, and returns exactly to framing', () => {
    const camera = createCombatCameraAction(); camera.cue(chip, 10, 1);
    expect(camera.sample(10, false).zoom).toBe(1);
    expect(camera.sample(10.12, false).blur).toBeGreaterThan(0);
    expect(camera.sample(10.24, false).zoom).toBeGreaterThan(1);
    expect(camera.sample(10.24, false).blur).toBeLessThan(.001);
    expect(camera.sample(11, false)).toEqual({ zoom: 1, drift: 0, blur: 0 });
  });
  it('bounds rapid chips and respects held time and reduced motion', () => {
    const camera = createCombatCameraAction();
    for (let i = 0; i < 100; i++) camera.cue(chip, 0, -1);
    const held = camera.sample(.12, false);
    expect(camera.sample(.12, false)).toEqual(held);
    expect(held.zoom).toBeLessThan(1.029);
    expect(held.drift).toBeLessThan(0);
    expect(camera.sample(.12, true)).toEqual({ zoom: 1, drift: 0, blur: 0 });
  });
});
