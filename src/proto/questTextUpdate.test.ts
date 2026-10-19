import { expect, it } from 'vitest';
import { questTextUpdate } from './questTextUpdate';
it('acknowledges the old step before revealing the next and removes its temporary effects', () => {
  expect(questTextUpdate(0, 100)).toMatchObject({ phase: 'emphasize', newText: false, strike: 0 });
  expect(questTextUpdate(600, 100)).toMatchObject({ phase: 'strike', newText: false, weight: 700 });
  expect(questTextUpdate(1000, 100)).toMatchObject({ phase: 'fade', strike: 1 });
  const typing = questTextUpdate(2000, 100);
  expect(typing.phase).toBe('type'); expect(typing.characters).toBeGreaterThan(0); expect(typing.characters).toBeLessThan(100);
  expect(questTextUpdate(10000, 100)).toMatchObject({ phase: 'idle', characters: 100, glow: 0 });
});
it('reduced motion replaces the step immediately with a brief static cue', () => {
  expect(questTextUpdate(0, 100, true)).toMatchObject({ phase: 'updated', newText: true, characters: 100, progress: .5 });
  expect(questTextUpdate(500, 100, true)).toMatchObject({ phase: 'idle', glow: 0 });
});
