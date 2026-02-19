import type { Card as CardType, ActorKeruArchetype, Element } from '../engine/types';
import { ELEMENT_TO_SUIT } from '../engine/constants';
import keruAspectsJson from './keruAspects.json';

export type KeruAspect = Exclude<ActorKeruArchetype, 'blank'>;

type KeruAspectJson = {
  id: KeruAspect;
  label: string;
  ability: {
    label: string;
    description?: string;
    damage: string;
    cardId: string;
    cardRank: number;
    cardElement: Element;
    cardGlyph?: string;
  };
  tags?: string[];
  archetypeCard: {
    cardId: string;
    cardRank: number;
    cardElement: Element;
  };
};

const aspectEntries = (keruAspectsJson as { aspects: KeruAspectJson[] }).aspects ?? [];

export const ASPECT_DISPLAY_TEXT: Record<KeruAspect, string> = aspectEntries.reduce((acc, entry) => {
  acc[entry.id] = entry.label;
  return acc;
}, {} as Record<KeruAspect, string>);

export const ASPECT_ABILITY_DEFINITIONS: Record<KeruAspect, { label: string; damage: string; card: CardType }> = (
  aspectEntries.reduce((acc, entry) => {
    acc[entry.id] = {
      label: entry.ability.label,
      damage: entry.ability.damage,
      card: {
        id: entry.ability.cardId,
        rank: entry.ability.cardRank,
        element: entry.ability.cardElement,
        suit: ELEMENT_TO_SUIT[entry.ability.cardElement],
        actorGlyph: entry.ability.cardGlyph,
      },
    };
    return acc;
  }, {} as Record<KeruAspect, { label: string; damage: string; card: CardType }>)
);

export const KERU_ARCHETYPE_OPTIONS: Array<{ archetype: KeruAspect; label: string; ability: { label: string; damage: string; card: CardType } }> = (
  aspectEntries.map((entry) => ({
    archetype: entry.id,
    label: entry.label ?? `${entry.id.charAt(0).toUpperCase()}${entry.id.slice(1)}`,
    ability: ASPECT_ABILITY_DEFINITIONS[entry.id],
  }))
);

export const KERU_ARCHETYPE_CARDS: Record<KeruAspect, CardType> = aspectEntries.reduce((acc, entry) => {
  acc[entry.id] = {
    id: entry.archetypeCard.cardId,
    rank: entry.archetypeCard.cardRank,
    element: entry.archetypeCard.cardElement,
    suit: ELEMENT_TO_SUIT[entry.archetypeCard.cardElement],
  };
  return acc;
}, {} as Record<KeruAspect, CardType>);

export const KERU_ARCHETYPE_TAGS: Record<KeruAspect, string[]> = aspectEntries.reduce((acc, entry) => {
  acc[entry.id] = entry.tags ?? [];
  return acc;
}, {} as Record<KeruAspect, string[]>);
