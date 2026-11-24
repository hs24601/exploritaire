import type { ProtoHeroClass } from '../../proto/protoTypes';

export type CardPatternDirection = 'up' | 'down';

export type CardPatternTrigger = {
  id: string;
  actorClass: ProtoHeroClass;
  pattern: readonly CardPatternDirection[];
  effectLabel: string;
};

export const RETIRED_PROTO_CARD_PATTERNS: readonly CardPatternTrigger[] = [
  {
    id: 'knight-taunt-down-down-up',
    actorClass: 'Knight',
    pattern: ['down', 'down', 'up'],
    effectLabel: 'Taunt',
  },
];

export const matchesCardPattern = (
  history: readonly CardPatternDirection[],
  pattern: readonly CardPatternDirection[],
) =>
  history.length >= pattern.length &&
  history.slice(-pattern.length).every((direction, index) => direction === pattern[index]);
