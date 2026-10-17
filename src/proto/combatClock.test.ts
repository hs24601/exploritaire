import { describe, expect, it } from 'vitest';
import { createCombatClock } from './combatClock';

describe('combat presentation clock', () => {
  it('freezes actions while held, then resumes without replaying the held interval', () => {
    const clock = createCombatClock(100);
    expect(clock.sample(101, false)).toBe(101);
    expect(clock.sample(102, true)).toBe(102);
    expect(clock.sample(140, true)).toBe(102);
    expect(clock.sample(150, false)).toBe(102);
    expect(clock.sample(151, false)).toBe(103);
  });
  it('handles a paused renderer with no frames and repeated pause transitions', () => {
    const clock = createCombatClock(0);
    clock.sample(1, true);
    expect(clock.sample(1000, false)).toBe(1);
    expect(clock.sample(1001, true)).toBe(2);
    expect(clock.sample(2000, false)).toBe(2);
  });
});
