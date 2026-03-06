import type { Actor, Card, Element } from '../types';
import { randomIdSuffix } from '../constants';
import { createActor } from '../actors';

export type EnemyFoundationSeed = { id: string; rank: number; suit: Card['suit']; element: Element };

export const DEFAULT_ENEMY_FOUNDATION_SEEDS: EnemyFoundationSeed[] = [
  { id: 'enemy-shadow', rank: 12, suit: '🌙', element: 'D' },
  { id: 'enemy-sun', rank: 8, suit: '☀️', element: 'L' },
];

export const DEFAULT_ENEMY_ACTOR_IDS = ['shadowcub', 'shadowkit', 'shade'] as const;
export const DEFAULT_COMBAT_LAB_ENEMY_ACTOR_ID = 'shade_of_resentment';

export function createEnemyFoundationCard(seed: EnemyFoundationSeed): Card {
  return {
    rank: seed.rank,
    suit: seed.suit,
    element: seed.element,
    id: `${seed.id}-${Date.now()}-${randomIdSuffix()}`,
  };
}

export function createDefaultEnemyActors(): Actor[] {
  const actors = DEFAULT_ENEMY_ACTOR_IDS
    .map((definitionId) => createActor(definitionId))
    .filter((actor): actor is Actor => Boolean(actor))
    .slice(0, DEFAULT_ENEMY_FOUNDATION_SEEDS.length)
    .map((actor) => ({
      ...actor,
      hpMax: 10,
      hp: 10,
      armor: 0,
      evasion: 5,
      accuracy: 90,
      staminaMax: 3,
      stamina: 3,
      energyMax: 3,
      energy: 3,
    }));
  return actors;
}

export function createRandomEnemyActor(): Actor | null {
  const definitionId = DEFAULT_ENEMY_ACTOR_IDS[Math.floor(Math.random() * DEFAULT_ENEMY_ACTOR_IDS.length)];
  const actor = createActor(definitionId);
  if (!actor) return null;
  const isShade = definitionId === 'shade';
  return {
    ...actor,
    hpMax: isShade ? 25 : 10,
    hp: isShade ? 25 : 10,
    armor: 0,
    evasion: 5,
    accuracy: 90,
    staminaMax: 3,
    stamina: 3,
    energyMax: 3,
    energy: 3,
  };
}

export function resolveCombatLabTargetActor(existingActors: Actor[]): Actor | null {
  return existingActors.find((actor) => actor.definitionId === DEFAULT_COMBAT_LAB_ENEMY_ACTOR_ID)
    ?? existingActors.find((actor) => actor.definitionId === 'target_dummy')
    ?? createActor(DEFAULT_COMBAT_LAB_ENEMY_ACTOR_ID)
    ?? createActor('target_dummy');
}
