import { expect, it } from 'vitest';
import { claimActorExpression, getActorExpression, setSceneActorExpression } from './actorExpression';
it('releases only the owning dialogue and restores the previous expression', () => {
  const first = claimActorExpression('hero', 'sad');
  const next = claimActorExpression('hero', 'happy');
  expect(getActorExpression('hero')).toBe('happy');
  first(); expect(getActorExpression('hero')).toBe('happy');
  next(); expect(getActorExpression('hero')).toBeUndefined();
  const old = claimActorExpression('hero', 'sad'), edited = claimActorExpression('hero', 'blush');
  edited(); expect(getActorExpression('hero')).toBe('sad');
  old(); expect(getActorExpression('hero')).toBeUndefined();
});
it('keeps the scene mood between dialogue and lets composition override dialogue', () => {
  setSceneActorExpression('hero', 'sad');
  expect(getActorExpression('hero')).toBe('sad');
  const release = claimActorExpression('hero', 'happy');
  expect(getActorExpression('hero')).toBe('happy');
  setSceneActorExpression('hero', 'sad', 'neutral');
  expect(getActorExpression('hero')).toBe('neutral');
  setSceneActorExpression('hero', 'sad');
  expect(getActorExpression('hero')).toBe('happy');
  release(); expect(getActorExpression('hero')).toBe('sad');
  setSceneActorExpression('hero');
  expect(getActorExpression('hero')).toBeUndefined();
});
