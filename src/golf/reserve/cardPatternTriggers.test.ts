import { describe, expect, it } from 'vitest';
import {
  matchesCardPattern,
  RETIRED_CLASSIC_PLUS_CARD_PATTERNS,
} from './cardPatternTriggers';

describe('retired card pattern triggers', () => {
  it('matches the trailing portion of a direction history', () => {
    expect(matchesCardPattern(['up', 'down', 'down', 'up'], ['down', 'down', 'up'])).toBe(true);
    expect(matchesCardPattern(['down', 'up', 'up'], ['down', 'down', 'up'])).toBe(false);
  });

  it('keeps the former Hero Taunt pattern as reusable data', () => {
    expect(RETIRED_CLASSIC_PLUS_CARD_PATTERNS).toContainEqual({
      id: 'knight-taunt-down-down-up',
      actorClass: 'Knight',
      pattern: ['down', 'down', 'up'],
      effectLabel: 'Taunt',
    });
  });
});
