import type { Card, Element, GameState } from '../types';
import { ELEMENT_TO_SUIT, randomIdSuffix } from '../constants';
import { isRpgCore } from '../combatSession';

export function applyTokenReward(
  collectedTokens: Record<Element, number>,
  card: Card
): Record<Element, number> {
  if (!card.tokenReward) return collectedTokens;
  return {
    ...collectedTokens,
    [card.tokenReward]: (collectedTokens[card.tokenReward] || 0) + 1,
  };
}

function createRpgDarkClawCard(sourceActorId: string): Card {
  return {
    id: `rpg-dark-claw-${Date.now()}-${randomIdSuffix()}`,
    rank: 1,
    element: 'D',
    suit: ELEMENT_TO_SUIT.D,
    sourceActorId,
    actorGlyph: 'D',
    rarity: 'common',
  };
}

export function awardEnemyActorComboCards(
  state: GameState,
  enemyFoundationIndex: number,
  nextEnemyCombos: number[]
): Card[][] | undefined {
  if (!isRpgCore(state)) return state.rpgEnemyHandCards;
  const enemyActors = state.enemyActors ?? [];
  const actor = enemyActors[enemyFoundationIndex];
  if (!actor) return state.rpgEnemyHandCards;
  const combo = nextEnemyCombos[enemyFoundationIndex] ?? 0;
  if (combo <= 0) return state.rpgEnemyHandCards;

  const definitionId = actor.definitionId.toLowerCase();
  const isDarkClawActor = definitionId === 'shadowcub' || definitionId === 'shadowkit';
  if (!isDarkClawActor) return state.rpgEnemyHandCards;

  const current = state.rpgEnemyHandCards ?? enemyActors.map(() => []);
  const next = current.map((cards) => [...cards]);
  while (next.length < enemyActors.length) next.push([]);
  next[enemyFoundationIndex].push(createRpgDarkClawCard(actor.id));
  return next;
}

