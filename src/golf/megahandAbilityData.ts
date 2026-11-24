import type { OrimEffectDef, OrimRarity } from '../engine/types';
import { MEGAHAND_ABILITY_CATALOG } from './singlePlayerActors/megahandAbilityCatalog';
import { HERO_MEGAHAND_ABILITY_CATALOG, HERO_MEGAHAND_DECK } from './singlePlayerActors/heroMegahandDeck';

export type MegaHandSuit = 'spades' | 'hearts' | 'clubs' | 'diamonds';

export type MegaHandAbilityRangeDefinition = {
  key: string;
  startAp: number;
  endAp: number;
  apSegments?: number[];
  name: string;
  description: string;
  litColor?: string;
  unlitColor?: string;
  dividerColor?: string;
};

// Authored deck data. These are the printed stats/effects we define in actor decks.
export type MegaHandAbilityDefinition = {
  ownerName: string;
  side?: 'player' | 'enemy';
  name: string;
  description: string;
  flavorText?: string;
  abilityDescription?: string;
  energyCost: number;
  maxAp: number;
  golfValue: number;
  power: number;
  rarity?: OrimRarity;
  effects?: OrimEffectDef[];
  in_deck?: boolean;
  wildcard?: boolean;
  abilityRanges?: MegaHandAbilityRangeDefinition[];
  kinhandKind?: 'actor-basic' | 'orim-card' | 'orim-granted';
  kinhandTarget?: 'player-actor' | 'enemy-actor' | 'any-actor';
  kinhandOrimId?: string;
};

// Runtime state for a Megahand card while it moves through hand, prime, discard, and combat.
// `currentRarity` is mutable and may be promoted independently of the authored base rarity.
export type MegaHandRuntimeCard = {
  id: string;
  rank: number;
  suit: MegaHandSuit;
  tableauCharge: number;
  actorName: string;
  currentRarity: OrimRarity;
  megahandAbility?: MegaHandAbilityDefinition | null;
};

// Final UI model consumed by the Megahand ability card renderer.
export type ResolvedMegaHandAbilityCard = MegaHandAbilityDefinition & {
  currentAp: number;
  currentEnergyCost: number;
  printedGolfLabel: string;
  liveGolfLabel: string;
  ready: boolean;
  key: string;
  currentRarity: OrimRarity;
};

export type ResolveMegaHandAbilityCardInput = {
  actorName: string;
  currentAp: number;
  currentEnergyCost?: number | null;
  liveGolfValue: number;
  foundationCardId: string;
  abilityOverride?: MegaHandAbilityDefinition | null;
  currentRarity?: OrimRarity | null;
};

export type MegaHandActorSummary = {
  actorName: string;
  abilityLabel: string;
  apCap: number;
  abilities: MegaHandAbilityDefinition[];
  hasAssignedAbilities: boolean;
};

export const MEGAHAND_ENEMY_ABILITY: MegaHandAbilityDefinition = (
  MEGAHAND_ABILITY_CATALOG.find((ability) => ability.ownerName === 'Lesser Shade' && ability.name === 'Dark Claw')
  ?? {
    ownerName: 'Lesser Shade',
    name: 'Dark Claw',
    description: 'Deals 1 dmg',
    energyCost: 1,
    maxAp: 4,
    golfValue: 11,
    power: 1,
  }
);

export const MEGAHAND_ABILITY_LADDERS: Record<string, MegaHandAbilityDefinition[]> = (
  MEGAHAND_ABILITY_CATALOG.reduce<Record<string, MegaHandAbilityDefinition[]>>((acc, ability) => {
    const existing = acc[ability.ownerName] ?? [];
    return {
      ...acc,
      [ability.ownerName]: [...existing, ability],
    };
  }, {})
);

export const MEGAHAND_HERO_DECK: MegaHandAbilityDefinition[] = HERO_MEGAHAND_DECK;
export const MEGAHAND_STARTING_DECK: MegaHandAbilityDefinition[] = (
  MEGAHAND_ABILITY_CATALOG.filter((ability) => ability.in_deck !== false && (ability.side ?? 'player') === 'player')
);

const formatGolfLabel = (value: number) => {
  if (value === 1) return 'A';
  if (value === 11) return 'J';
  if (value === 12) return 'Q';
  if (value === 13) return 'K';
  return String(value);
};

const resolveAbilityTextTemplate = (text: string, ability: MegaHandAbilityDefinition) => (
  text.replace(/\[power\]/gi, String(ability.power))
);

const resolveDescriptionTemplate = (ability: MegaHandAbilityDefinition) => (
  resolveAbilityTextTemplate(ability.abilityDescription ?? ability.description, ability)
);

export const getMegaHandAbilitiesForActor = (actorName: string) => (
  MEGAHAND_ABILITY_LADDERS[actorName] ?? []
);

export const getMegaHandActorSummary = (actorName: string): MegaHandActorSummary => {
  const abilities = getMegaHandAbilitiesForActor(actorName);
  return {
    actorName,
    abilityLabel: abilities.length > 0 ? abilities.map((entry) => entry.name).join(' / ') : 'Unassigned',
    apCap: abilities.length > 0 ? Math.max(...abilities.map((entry) => entry.maxAp)) : 1,
    abilities,
    hasAssignedAbilities: abilities.length > 0,
  };
};

export const resolveMegaHandAbilityCard = ({
  actorName,
  currentAp,
  currentEnergyCost,
  liveGolfValue,
  foundationCardId,
  abilityOverride,
  currentRarity,
}: ResolveMegaHandAbilityCardInput): ResolvedMegaHandAbilityCard => {
  if (abilityOverride) {
    return {
      ...abilityOverride,
      description: resolveDescriptionTemplate(abilityOverride),
      flavorText: abilityOverride.flavorText
        ? resolveAbilityTextTemplate(abilityOverride.flavorText, abilityOverride)
        : undefined,
      abilityDescription: resolveDescriptionTemplate(abilityOverride),
      currentEnergyCost: currentEnergyCost ?? abilityOverride.energyCost,
      currentAp,
      printedGolfLabel: formatGolfLabel(abilityOverride.golfValue),
      liveGolfLabel: formatGolfLabel(liveGolfValue),
      ready: currentAp >= abilityOverride.maxAp,
      key: `${foundationCardId}:${abilityOverride.ownerName}:${abilityOverride.name}:${abilityOverride.maxAp}`,
      currentRarity: currentRarity ?? abilityOverride.rarity ?? 'common',
    };
  }

  const ladder = getMegaHandAbilitiesForActor(actorName);
  const fallbackAbility: MegaHandAbilityDefinition = {
    ownerName: actorName,
    name: 'Unassigned',
    description: 'No effect assigned',
    energyCost: 0,
    maxAp: Math.max(1, currentAp + 1),
    golfValue: liveGolfValue,
    power: 0,
  };
  const resolvedAbility = ladder.find((entry) => currentAp <= entry.maxAp) ?? ladder[ladder.length - 1] ?? fallbackAbility;

  return {
    ...resolvedAbility,
    description: resolveDescriptionTemplate(resolvedAbility),
    flavorText: resolvedAbility.flavorText
      ? resolveAbilityTextTemplate(resolvedAbility.flavorText, resolvedAbility)
      : undefined,
    abilityDescription: resolveDescriptionTemplate(resolvedAbility),
    currentEnergyCost: currentEnergyCost ?? resolvedAbility.energyCost,
    currentAp,
    printedGolfLabel: formatGolfLabel(resolvedAbility.golfValue),
    liveGolfLabel: formatGolfLabel(liveGolfValue),
    ready: ladder.length > 0 && currentAp >= resolvedAbility.maxAp,
    key: `${foundationCardId}:${resolvedAbility.name}:${resolvedAbility.maxAp}`,
    currentRarity: currentRarity ?? resolvedAbility.rarity ?? 'common',
  };
};
