import type { Card, Actor } from '../engine/types';
import { CARD_SIZE } from '../engine/constants';

export type CardKind = 'playing' | 'actor';
export type CardDetailLevel = 'full' | 'compact' | 'minimal';

export interface CardLikeBase {
  id: string;
  kind: CardKind;
  size: { width: number; height: number };
}

export interface PlayingCardLike extends CardLikeBase {
  kind: 'playing';
  card: Card;
}

export interface ActorCardLike extends CardLikeBase {
  kind: 'actor';
  actor: Actor;
}

export type CardLike = PlayingCardLike | ActorCardLike;

export const DEFAULT_DETAIL_THRESHOLDS = {
  full: 1.4,
  compact: 0.88,
};

export function getCardDetailLevel(
  zoom: number,
  thresholds: { full: number; compact: number } = DEFAULT_DETAIL_THRESHOLDS
): CardDetailLevel {
  if (zoom >= thresholds.full) return 'full';
  if (zoom >= thresholds.compact) return 'compact';
  return 'minimal';
}

export function toPlayingCardLike(card: Card, size = CARD_SIZE): PlayingCardLike {
  return {
    id: card.id,
    kind: 'playing',
    size,
    card,
  };
}

export function toActorCardLike(actor: Actor, size: { width: number; height: number }): ActorCardLike {
  return {
    id: actor.id,
    kind: 'actor',
    size,
    actor,
  };
}
