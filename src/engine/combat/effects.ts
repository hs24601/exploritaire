import type { Effect } from '../types';

export function processEffects(effects: Effect[]): Effect[] {
  return effects
    .map((effect) => ({
      ...effect,
      duration: effect.duration > 0 ? effect.duration - 1 : effect.duration,
    }))
    .filter((effect) => effect.duration !== 0);
}

