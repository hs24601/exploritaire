import type { Actor, Card, Element, Suit } from '../types';
import { SUIT_TO_ELEMENT, randomIdSuffix } from '../constants';
import { getActorDefinition } from '../actors';

export function createActorFoundationCard(actor: Actor): Card {
  const definition = getActorDefinition(actor.definitionId);
  if (!definition) {
    throw new Error(`Actor definition not found for ${actor.definitionId}`);
  }

  const suit: Suit = definition.suit || '⭐';
  const element: Element = definition.element || SUIT_TO_ELEMENT[suit];
  const rank = actor.currentValue;

  return {
    rank,
    suit,
    element,
    id: `actor-${actor.id}-${Date.now()}-${randomIdSuffix()}`,
    name: definition.name,
    description: definition.description,
    tags: definition.titles ?? [],
    sourceActorId: actor.id,
    rpgActorId: actor.id,
    rpgCardKind: 'focus',
  };
}

