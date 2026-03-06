import type { Actor, Card, GameState } from '../types';
import { randomIdSuffix } from '../constants';
import { createEmptyTokenCounts } from './shared';
import {
  createDefaultEnemyActors,
  createEnemyFoundationCard,
  DEFAULT_ENEMY_FOUNDATION_SEEDS,
  resolveCombatLabTargetActor,
} from './enemyFactory';

function ensureEnemyActorsForFoundations(
  existingActors: Actor[] | undefined,
  foundationCount: number
): Actor[] {
  const defaults = createDefaultEnemyActors();
  const result: Actor[] = [];
  for (let i = 0; i < foundationCount; i += 1) {
    const existing = existingActors?.[i];
    if (existing) {
      result.push(existing);
      continue;
    }
    const fallback = defaults[i] ?? defaults[defaults.length - 1];
    result.push({
      ...fallback,
      id: `${fallback.id}-${randomIdSuffix()}`,
    });
  }
  return result;
}

export function createEmptyEnemyFoundations(): Card[][] {
  return DEFAULT_ENEMY_FOUNDATION_SEEDS.map(() => []);
}

export function ensureEnemyFoundationsForPlay(
  state: GameState,
  createActorFoundationCard: (actor: Actor) => Card
): {
  state: GameState;
  enemyFoundations: Card[][];
  enemyActors: Actor[];
} {
  const existingFoundations = state.enemyFoundations;
  const existingActors = state.enemyActors ?? [];
  if (existingFoundations && existingFoundations.length > 0) {
    const ensuredActors = existingActors.length >= existingFoundations.length
      ? existingActors
      : ensureEnemyActorsForFoundations(existingActors, existingFoundations.length);
    const actorsChanged = (
      ensuredActors.length !== existingActors.length
      || ensuredActors.some((actor, index) => actor !== existingActors[index])
    );
    const ensuredState = !actorsChanged
      ? state
      : { ...state, enemyActors: ensuredActors };
    return {
      state: ensuredState,
      enemyFoundations: existingFoundations,
      enemyActors: ensuredActors,
    };
  }

  const targetDummyActor = resolveCombatLabTargetActor(existingActors);
  if (!targetDummyActor) {
    return {
      state,
      enemyFoundations: [],
      enemyActors: existingActors,
    };
  }
  const ensuredEnemyActors = existingActors.some((actor) => actor.id === targetDummyActor.id)
    ? existingActors
    : [...existingActors, targetDummyActor];
  const ensuredEnemyFoundations: Card[][] = [[createActorFoundationCard(targetDummyActor)]];
  const existingEnemyHandLane = state.rpgEnemyHandCards?.[0] ?? [];
  const ensuredEnemyState: GameState = {
    ...state,
    enemyActors: ensuredEnemyActors,
    enemyFoundations: ensuredEnemyFoundations,
    enemyFoundationCombos: [0],
    enemyFoundationTokens: [createEmptyTokenCounts()],
    rpgEnemyHandCards: [existingEnemyHandLane.slice()],
  };
  return {
    state: ensuredEnemyState,
    enemyFoundations: ensuredEnemyFoundations,
    enemyActors: ensuredEnemyActors,
  };
}

export function createDefaultEnemyFoundations(): Card[][] {
  return DEFAULT_ENEMY_FOUNDATION_SEEDS.map((seed) => [createEnemyFoundationCard(seed)]);
}
