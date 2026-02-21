import type { Card as CardType, ActorKeruArchetype, Element } from '../engine/types';
import { ELEMENT_TO_SUIT } from '../engine/constants';
import { ORIM_DEFINITIONS } from '../engine/orims';
import aspectsJson from './aspects.json';

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

const aspectEntries = (aspectsJson as { aspects: AspectJson[] }).aspects ?? [];

// Index aspect orims by ID for checking if an aspect exists
const aspectOrimsByEntryId = ORIM_DEFINITIONS.filter((o) => o.isAspect).reduce(
  (acc, orim) => {
    acc[orim.id] = orim;
    return acc;
  },
  {} as Record<string, typeof ORIM_DEFINITIONS[0]>
);

// Build aspect ability definitions from aspect orims
export const ASPECT_ABILITY_DEFINITIONS: Record<KeruAspect, { label: string; damage: string; card: CardType }> = (
  aspectEntries.reduce((acc, entry) => {
    const orim = aspectOrimsByEntryId[entry.id];
    if (!orim) return acc;
    acc[entry.id] = {
      label: orim.name,
      damage: orim.description,
      card: {
        id: entry.archetypeCard.cardId,
        rank: entry.archetypeCard.cardRank,
        element: entry.archetypeCard.cardElement,
        suit: ELEMENT_TO_SUIT[entry.archetypeCard.cardElement],
      },
    };
    return acc;
  }, {} as Record<KeruAspect, { label: string; damage: string; card: CardType }>)
);

export const ASPECT_DISPLAY_TEXT: Record<KeruAspect, string> = aspectEntries.reduce((acc, entry) => {
  acc[entry.id] = entry.label;
  return acc;
}, {} as Record<KeruAspect, string>);

export const KERU_ARCHETYPE_OPTIONS: Array<{ archetype: KeruAspect; label: string; ability: { label: string; damage: string; card: CardType } }> = (
  aspectEntries
    .filter((entry) => !!aspectOrimsByEntryId[entry.id])
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
