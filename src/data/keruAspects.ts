import type { Card as CardType, ActorKeruArchetype, Element } from '../engine/types';
import { ELEMENT_TO_SUIT } from '../engine/constants';
import aspectsJson from './aspects.json';
import abilitiesJson from './abilities.json';

export type KeruAspect = Exclude<ActorKeruArchetype, 'blank'>;

type AspectJson = {
  id: KeruAspect;
  label: string;
  tags?: string[];
  archetypeCard: {
    cardId: string;
    cardRank: number;
    cardElement: Element;
  };
};

type AbilityJson = {
  id: string;
  aspectId: string;
  label: string;
  description?: string;
  damage: string;
  cardId: string;
  cardRank: number;
  cardElement: Element;
  cardGlyph?: string;
  abilityType?: string;
};

const aspectEntries = (aspectsJson as { aspects: AspectJson[] }).aspects ?? [];
const abilityEntries = (abilitiesJson as { abilities: AbilityJson[] }).abilities ?? [];

// Index abilities by aspectId for fast lookup
const abilitiesByAspect = abilityEntries.reduce((acc, entry) => {
  acc[entry.aspectId] = entry;
  return acc;
}, {} as Record<string, AbilityJson>);

export const ASPECT_DISPLAY_TEXT: Record<KeruAspect, string> = aspectEntries.reduce((acc, entry) => {
  acc[entry.id] = entry.label;
  return acc;
}, {} as Record<KeruAspect, string>);

export const ASPECT_ABILITY_DEFINITIONS: Record<KeruAspect, { label: string; damage: string; card: CardType }> = (
  aspectEntries.reduce((acc, entry) => {
    const ability = abilitiesByAspect[entry.id];
    if (!ability) return acc;
    acc[entry.id] = {
      label: ability.label,
      damage: ability.damage,
      card: {
        id: ability.cardId,
        rank: ability.cardRank,
        element: ability.cardElement,
        suit: ELEMENT_TO_SUIT[ability.cardElement],
        actorGlyph: ability.cardGlyph,
      },
    };
    return acc;
  }, {} as Record<KeruAspect, { label: string; damage: string; card: CardType }>)
);

export const KERU_ARCHETYPE_OPTIONS: Array<{ archetype: KeruAspect; label: string; ability: { label: string; damage: string; card: CardType } }> = (
  aspectEntries
    .filter((entry) => !!abilitiesByAspect[entry.id])
    .map((entry) => ({
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
