import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Callout } from '../components/Callout';
import { AbilityApBar } from '../components/combat/AbilityApBar';
import { Card } from '../components/Card';
import { Tooltip } from '../components/Tooltip';
import type { Card as GameCard, Element, OrimEffectDef, OrimRarity } from '../engine/types';
import { getKinProfile, getStarterKinKit } from './data/starterKinData';
import { ActorAbilityCard } from './ActorAbilityCard';
import { KinHandActorCard } from './KinHandActorCard';
import type { MegaHandAbilityDefinition, MegaHandRuntimeCard, MegaHandSuit } from './megahandAbilityData';
import { resolveMegaHandAbilityCard } from './megahandAbilityData';
import { resolveDamagePacket } from './combatResolver';
import type { ActorCombatState as ResolverActorCombatState, DamagePacket } from './combatResolver';
import { kinhandAbilityRangeHelpers } from './kinhandAbilityRanges';
import {
  getKinHandActorDefinition,
  getKinHandOrimDefinition,
  getKinHandStartingActors,
  type KinHandActorDefinition,
  type KinHandAppliedOrimDefinition,
  type KinHandOrimDefinition,
  KINHAND_ACTOR_CATALOG,
  KINHAND_ORIM_CATALOG,
} from './kinhandCatalog';
import { KinHandOrchestratorModal, kinHandOrchestratorHelpers, type EditableKinHandCatalog } from './KinHandOrchestratorModal';

type Suit = MegaHandSuit;
type LocalCard = MegaHandRuntimeCard & {
  kinhandActorCard?: boolean;
  spawnedFromActor?: boolean;
  kinhandActorMaxAp?: number;
  kinhandAppliedOrims?: KinHandAppliedOrimDefinition[];
};

type ChargeUpState = {
  tableau: LocalCard[][];
  deck: LocalCard[];
  handDeck: LocalCard[];
  discard: LocalCard[];
  playerChargers: LocalCard[];
  hand: LocalCard[];
  playerFoundation: LocalCard[];
  enemyFoundation: LocalCard[];
  playerEnergy: number;
  enemyEnergy: number;
  playerPaidCardIds: string[];
  enemyPaidCardIds: string[];
  combatants: Record<string, MegaHandCombatantState>;
};

type ChargeUpTurn = 'player' | 'enemy';
type ChargeUpAutoPlayMode = 'off' | 'full';
type ChargeUpActorSide = 'player' | 'enemy';
type ChargeUpAutoAction =
  | {
      type: 'actor';
      actorCardId: string;
    }
  | {
      type: 'hand';
      cardId: string;
    }
  | {
      type: 'tableau';
      actor: ChargeUpActorSide;
      columnIndex: number;
      columnCardIndex: number;
    };

type ChargeUpDragAnim = {
  id: number;
  card: LocalCard;
  actor: ChargeUpActorSide;
  presentation: 'tableau' | 'actor';
  from: { x: number; y: number };
  to: { x: number; y: number };
  durationMs: number;
};

type AbilityCalloutEntry = {
  id: number;
  text: string;
  subtitle?: string;
  anchor?: { x: number; y: number };
};

type AbilityProgressSnapshot = {
  key: string;
  currentAp: number;
};

type ChargeUpTargetingState = {
  source: 'foundation' | 'hand';
  cardId: string;
};

type KinHandOrimPlacementState = {
  source: 'foundation' | 'hand';
  cardId: string;
  orimId: string;
  targetActorName: string;
  targetLabel: string;
  chosenAssignments: KinHandAppliedOrimDefinition[];
  remainingGrantedAbilityIds: string[];
  anchor?: { x: number; y: number };
};

type KinHandRewardPreviewState = {
  orimId: string;
  actorName: string;
  selectedSegment: number | null;
};

type ChargeUpTargetKind = 'actor' | 'prime' | 'tableau';

type MegaHandCombatantKey = 'hero' | 'mochi' | 'banks' | 'jet' | 'lesser-shade';

type MegaHandCombatantState = ResolverActorCombatState & {
  asleepTurns: number;
  catNapActive: boolean;
  prowlActive: boolean;
};

const TABLEAU_COLUMNS = 7;
const TABLEAU_ROWS = 4;
const TABLEAU_STACK_OFFSET = 52;
const TABLEAU_CARD_ASPECT_RATIO = 144 / 102;
const TABLEAU_BACK_HEIGHT_RATIO = 64 / 144;
const CHARGE_UP_ENEMY_STEP_MS = 340;
const CHARGE_UP_PLAYER_AUTO_STEP_MS = CHARGE_UP_ENEMY_STEP_MS;
const CHARGE_UP_ENEMY_DRAG_MIN_MS = 320;
const CHARGE_UP_ENEMY_DRAG_MAX_MS = 760;
const MEGAHAND_MAX_ENERGY = 5;
const MEGAHAND_ACTOR_BOARD_SCALE = 1.5625;
const SUITS: Suit[] = ['spades', 'hearts', 'clubs', 'diamonds'];
const LOCAL_SUIT_TO_ELEMENT: Record<Suit, Element> = {
  spades: 'D',
  hearts: 'F',
  clubs: 'A',
  diamonds: 'L',
};
const FAMILY_LABELS = {
  canid: 'Canid',
  felis: 'Felis',
  mustelid: 'Mustelid',
  corvid: 'Corvid',
  other: 'Other',
} as const;
const KIN_NAMES = ['Hero', 'Mochi', 'Banks', 'Jet', 'Whis'] as const;
let refillSequence = 0;
let localSequence = 0;
let actorSequence = 0;
const MEGAHAND_RARITY_ORDER: OrimRarity[] = ['common', 'uncommon', 'rare', 'epic', 'legendary', 'mythic'];

const suitSymbol = (suit: Suit) => {
  if (suit === 'spades') return '♠';
  if (suit === 'hearts') return '♥';
  if (suit === 'clubs') return '♣';
  return '♦';
};

const rankLabel = (rank: number) => {
  if (rank === 1) return 'A';
  if (rank === 11) return 'J';
  if (rank === 12) return 'Q';
  if (rank === 13) return 'K';
  return String(rank);
};

const isWarmSuit = (suit: Suit) => suit === 'hearts' || suit === 'diamonds';

const clampNumber = (value: number, min: number, max: number) => (
  Math.min(max, Math.max(min, value))
);

const getMegaHandOwnerSuit = (ownerName: string): Suit => {
  if (ownerName === 'Hero') return 'diamonds';
  if (ownerName === 'Mochi') return 'hearts';
  if (ownerName === 'Banks') return 'clubs';
  if (ownerName === 'Jet') return 'spades';
  if (ownerName === 'Lesser Shade') return 'spades';
  return 'clubs';
};

const shuffle = <T,>(items: T[]) => {
  const next = [...items];
  for (let index = next.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [next[index], next[swapIndex]] = [next[swapIndex], next[index]];
  }
  return next;
};

const createCard = (rank: number, suit: Suit, prefix = 'chargeup'): LocalCard => {
  localSequence += 1;
  actorSequence += 1;
  return {
    id: `${prefix}-${suit}-${rank}-${localSequence}`,
    rank,
    suit,
    tableauCharge: 0,
    actorName: KIN_NAMES[(actorSequence - 1) % KIN_NAMES.length],
    currentRarity: 'common',
  };
};

const createActorCard = (actorName: string, rank: number, suit: Suit, prefix = 'chargeup'): LocalCard => {
  localSequence += 1;
  return {
    id: `${prefix}-${actorName}-${suit}-${rank}-${localSequence}`,
    rank,
    suit,
    tableauCharge: 0,
    actorName,
    currentRarity: 'common',
  };
};

const cloneKinHandAppliedOrims = (appliedOrims: KinHandAppliedOrimDefinition[] | undefined) => (
  (appliedOrims ?? []).map((entry) => ({
    ...entry,
    apSegments: entry.apSegments ? [...entry.apSegments] : undefined,
  }))
);

const applyRangeToAbility = (
  ability: MegaHandAbilityDefinition,
  range: KinHandAppliedOrimDefinition,
): MegaHandAbilityDefinition => ({
  ...ability,
  abilityRanges: [{
    key: `${ability.ownerName.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${ability.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${(range.apSegments ?? []).join('-') || `${range.startAp}-${range.endAp}`}`,
    startAp: range.startAp,
    endAp: range.endAp,
    apSegments: range.apSegments ? [...range.apSegments] : undefined,
    name: ability.name,
    description: ability.description,
    litColor: 'rgba(255,194,92,0.98)',
    unlitColor: 'rgba(104,78,28,0.70)',
    dividerColor: 'rgba(255,219,148,0.64)',
  }],
});

const getApSegmentPowerValue = (segment: number) => {
  const normalizedSegment = clampNumber(Math.floor(segment), 1, 5);
  return Math.ceil(normalizedSegment * (1 + ((normalizedSegment - 1) * 0.35)));
};

const getResolvedEffectPower = (effect: OrimEffectDef, abilityPower: number) => (
  effect.powerMode === 'ap'
    ? abilityPower
    : Math.max(0, effect.value ?? 0)
);

const targetMatchesActorEffect = (
  effectTarget: OrimEffectDef['target'],
  sourceSide: ChargeUpActorSide,
  targetSide: ChargeUpActorSide,
) => {
  if (effectTarget === 'anyone') return true;
  if (effectTarget === 'self' || effectTarget === 'ally' || effectTarget === 'all_allies') {
    return sourceSide === targetSide;
  }
  if (effectTarget === 'enemy' || effectTarget === 'all_enemies') {
    return sourceSide !== targetSide;
  }
  return false;
};

const resolveBasicAbilityPower = (
  ability: MegaHandAbilityDefinition,
  currentAp?: number,
): MegaHandAbilityDefinition => {
  if (ability.kinhandKind !== 'actor-basic' || !currentAp || currentAp <= 0) return ability;
  return {
    ...ability,
    power: Math.max(1, Math.floor(currentAp)),
  };
};

const resolveAbilityPowerFromSegment = (
  ability: MegaHandAbilityDefinition,
  assignedRange: KinHandAppliedOrimDefinition,
  currentAp?: number,
): MegaHandAbilityDefinition => {
  const assignedSegments = assignedRange.apSegments?.length
    ? [...assignedRange.apSegments]
    : Array.from(
        { length: Math.max(1, assignedRange.endAp - assignedRange.startAp + 1) },
        (_, index) => Math.min(assignedRange.startAp, assignedRange.endAp) + index,
      );
  const triggerSegment = currentAp && assignedSegments.includes(currentAp)
    ? currentAp
    : Math.max(...assignedSegments, assignedRange.endAp, assignedRange.startAp, 1);
  const hasApScaledEffect = (ability.effects ?? []).some((effect) => effect.powerMode === 'ap');
  if (!hasApScaledEffect) return ability;
  const scaledPower = getApSegmentPowerValue(triggerSegment);
  return {
    ...ability,
    power: scaledPower,
    effects: (ability.effects ?? []).map((effect) => (
      effect.powerMode === 'ap'
        ? {
            ...effect,
            value: scaledPower,
            elementalValue: effect.elementalValue !== undefined || (effect.element && effect.element !== 'N')
              ? scaledPower
              : effect.elementalValue,
          }
        : effect
    )),
  };
};

const getActorRuntimeAbilities = (
  actorName: string,
  fallbackAbility?: MegaHandAbilityDefinition | null,
  appliedOrims?: KinHandAppliedOrimDefinition[],
  currentAp?: number,
) => {
  const actorDefinition = getKinHandActorDefinition(actorName);
  const baseAbility = actorDefinition?.basicAbility ?? fallbackAbility ?? null;
  const resolvedBasic = baseAbility ? [{
    ...resolveBasicAbilityPower(baseAbility, currentAp),
    ownerName: actorName,
    side: actorDefinition?.side ?? baseAbility.side ?? 'player',
  }] : [];

  const resolvedOrims = (appliedOrims ?? []).flatMap((assignment) => {
    const orim = getKinHandOrimDefinition(assignment.orimId);
    if (!orim) return [];
    const grantedAbility = orim.grantedAbilities.find((entry) => entry.id === assignment.grantedAbilityId);
    if (!grantedAbility || assignment.passive) return [];
    const ability = resolveAbilityPowerFromSegment({
      ...grantedAbility.ability,
      ownerName: actorName,
      side: actorDefinition?.side ?? grantedAbility.ability.side ?? 'player',
    }, assignment, currentAp);
    return [applyRangeToAbility(ability, assignment)];
  });

  return [...resolvedBasic, ...resolvedOrims];
};

const getKinHandSpawnableAbilitiesFromCard = (card: LocalCard) => (
  card.tableauCharge <= 0
    ? []
    : getActorRuntimeAbilities(card.actorName, card.megahandAbility, card.kinhandAppliedOrims, card.tableauCharge).filter((ability) => (
      (ability.abilityRanges ?? []).some((range) => kinhandAbilityRangeHelpers.rangeIncludesAp(range, card.tableauCharge))
    ))
);

const getAbilityDamageProfile = (
  ability: MegaHandAbilityDefinition,
  sourceSide: ChargeUpActorSide,
  targetSide: ChargeUpActorSide,
) => {
  const effects = ability.effects ?? [];
  const damageEffects = effects.filter((effect) => (
    effect.type === 'damage'
    && targetMatchesActorEffect(effect.target, sourceSide, targetSide)
  ));

  const profile = damageEffects.reduce<{
    physical: number;
    elemental: Partial<Record<Element, number>>;
  }>((sum, effect) => {
    const effectPower = getResolvedEffectPower(effect, ability.power);
    const elementalValue = effect.elementalValue ?? effectPower;
    if (effect.element && effect.element !== 'N') {
      return {
        physical: sum.physical,
        elemental: {
          ...sum.elemental,
          [effect.element]: (sum.elemental[effect.element] ?? 0) + Math.max(0, elementalValue),
        },
      };
    }
    return {
      physical: sum.physical + Math.max(0, effectPower),
      elemental: sum.elemental,
    };
  }, {
    physical: 0,
    elemental: {},
  });

  if (damageEffects.length === 0 && ability.power > 0) {
    return {
      physical: ability.power,
      elemental: {},
    };
  }

  return profile;
};

const describeAbilityDamage = (ability: MegaHandAbilityDefinition) => {
  const damageProfile = getAbilityDamageProfile(ability, ability.side ?? 'player', ability.side === 'enemy' ? 'player' : 'enemy');
  const parts: string[] = [];
  if (damageProfile.physical > 0) {
    parts.push(`${damageProfile.physical} damage`);
  }
  (Object.entries(damageProfile.elemental) as Array<[Element, number | undefined]>).forEach(([element, value]) => {
    if (!value || value <= 0) return;
    const label = element === 'F'
      ? 'fire'
      : element === 'A'
        ? 'air'
        : element === 'L'
          ? 'light'
          : element === 'D'
            ? 'dark'
            : element === 'W'
              ? 'water'
              : element === 'E'
                ? 'earth'
                : 'elemental';
    parts.push(`${value} ${label} damage`);
  });
  return parts.join(' + ');
};

const createKinHandActorCard = (actorDefinition: KinHandActorDefinition, prefix = 'kinhand-actor'): LocalCard => {
  const ability = actorDefinition.basicAbility;
  return {
    ...createActorCard(actorDefinition.actorName, actorDefinition.golfValue, actorDefinition.suit, prefix),
    kinhandActorCard: true,
    megahandAbility: ability,
    kinhandActorMaxAp: actorDefinition.maxAp,
    kinhandAppliedOrims: cloneKinHandAppliedOrims(actorDefinition.appliedOrims),
  };
};

const createMegaHandAbilityCard = (
  ability: MegaHandAbilityDefinition,
  prefix = 'megahand-hand',
): LocalCard => {
  localSequence += 1;
  return {
    id: `${prefix}-${ability.ownerName.toLowerCase()}-${ability.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${localSequence}`,
    rank: ability.golfValue,
    suit: getMegaHandOwnerSuit(ability.ownerName),
    tableauCharge: 0,
    actorName: ability.ownerName,
    currentRarity: ability.rarity ?? 'common',
    megahandAbility: ability,
    spawnedFromActor: prefix.startsWith('kinhand-spawn'),
  };
};

const getChargeUpRuleRank = (card: LocalCard | null | undefined) => {
  if (!card) return null;
  return card.rank;
};

const normalizeMegaHandCardState = (card: LocalCard): LocalCard => (
  card.megahandAbility
    ? {
        ...card,
        rank: card.rank ?? card.megahandAbility.golfValue,
        suit: card.suit ?? getMegaHandOwnerSuit(card.megahandAbility.ownerName),
        currentRarity: card.currentRarity ?? card.megahandAbility.rarity ?? 'common',
      }
    : card
);

const createDeck = () => {
  const cards = SUITS.flatMap((suit) =>
    Array.from({ length: 13 }, (_, idx) => createCard(idx + 1, suit)),
  );
  return shuffle(cards);
};

const createRandomCard = (): LocalCard => {
  refillSequence += 1;
  const suit = SUITS[Math.floor(Math.random() * SUITS.length)] ?? 'spades';
  actorSequence += 1;
  return {
    id: `chargeup-refill-${refillSequence}`,
    rank: Math.floor(Math.random() * 13) + 1,
    suit,
    tableauCharge: 0,
    actorName: KIN_NAMES[(actorSequence - 1) % KIN_NAMES.length],
    currentRarity: 'common',
  };
};

const createEnemyPersonaCard = (prefix = 'chargeup-enemy'): LocalCard => {
  const enemyActor = getKinHandActorDefinition('Lesser Shade');
  return enemyActor ? createKinHandActorCard(enemyActor, prefix) : createActorCard('Lesser Shade', 11, 'clubs', prefix);
};

const createKinHandStartingHand = (): LocalCard[] => ([
  ...getKinHandStartingActors('player').map((actor) => createKinHandActorCard(actor, 'kinhand-hand')),
]);

const toEditableKinHandCatalog = (): EditableKinHandCatalog => ({
  actors: KINHAND_ACTOR_CATALOG.map((actor, index) => ({
    ...actor,
    editorId: `actor:${actor.actorName}:${index}`,
    appliedOrims: cloneKinHandAppliedOrims(actor.appliedOrims),
  })),
  orims: KINHAND_ORIM_CATALOG.map((orim, index) => ({
    ...orim,
    editorId: `orim:${orim.id}:${index}`,
    grantedAbilities: orim.grantedAbilities.map((grantedAbility) => ({
      ...grantedAbility,
      defaultSegments: grantedAbility.defaultSegments ? [...grantedAbility.defaultSegments] : undefined,
      ability: {
        ...grantedAbility.ability,
        effects: grantedAbility.ability.effects?.map((effect) => ({ ...effect })) ?? [],
      },
    })),
  })),
});

const toGameCard = (card: LocalCard): GameCard => ({
  id: card.id,
  rank: card.rank,
  suit: '⭐',
  element: LOCAL_SUIT_TO_ELEMENT[card.suit],
  name: '',
});

const refillColumnToCapacity = (tableau: LocalCard[][], columnIndex: number) => {
  const column = tableau[columnIndex] ?? [];
  const missingCount = Math.max(0, TABLEAU_ROWS - column.length);
  if (missingCount === 0) return tableau;
  return tableau.map((innerColumn, index) => (
    index === columnIndex
      // Refill cards need to grow underneath the exposed face, not replace it.
      ? [...Array.from({ length: missingCount }, () => createRandomCard()), ...innerColumn]
      : innerColumn
  ));
};

const isAdjacentRank = (left: number, right: number) => {
  if (left === right) return false;
  if ((left === 1 && right === 13) || (left === 13 && right === 1)) return true;
  return Math.abs(left - right) === 1;
};

const drawCards = (deck: LocalCard[], discard: LocalCard[], count: number) => {
  let nextDeck = [...deck];
  let nextDiscard = [...discard];
  const drawn: LocalCard[] = [];

  while (drawn.length < count) {
    if (nextDeck.length === 0) {
      if (nextDiscard.length === 0) break;
      nextDeck = shuffle(nextDiscard);
      nextDiscard = [];
    }
    const nextCard = nextDeck.shift();
    if (!nextCard) break;
    drawn.push(nextCard);
  }

  return {
    deck: nextDeck,
    discard: nextDiscard,
    drawn,
  };
};

const getMegaHandCombatantKey = (actorName: string): MegaHandCombatantKey | null => {
  if (actorName === 'Hero') return 'hero';
  if (actorName === 'Mochi') return 'mochi';
  if (actorName === 'Banks') return 'banks';
  if (actorName === 'Jet') return 'jet';
  if (actorName === 'Lesser Shade') return 'lesser-shade';
  return null;
};

const getAbilitySourceCombatantKey = (ability: MegaHandAbilityDefinition | null | undefined): MegaHandCombatantKey | null => {
  if (!ability) return null;
  const directKey = getMegaHandCombatantKey(ability.ownerName);
  if (directKey) return directKey;
  return (ability.side ?? 'player') === 'enemy' ? 'lesser-shade' : 'hero';
};

const getCombatSupportAllyKeys = (side: ChargeUpActorSide): MegaHandCombatantKey[] => (
  side === 'enemy' ? ['lesser-shade'] : ['hero', 'mochi', 'banks', 'jet']
);

const createMegaHandCombatant = (actorName: string): MegaHandCombatantState => {
  const vitals = getMegaHandActorVitals(actorName);
  return {
    hp: vitals.maxHp,
    hpMax: vitals.maxHp,
    armor: vitals.armor,
    defense: 0,
    defenseBuffAmount: 0,
    evasion: 0,
    evasionBuffAmount: 0,
    superArmorBulwark: 0,
    superArmorWard: 0,
    superArmorReactive: 0,
    elementalShields: {},
    defenseBuffTurns: 0,
    evasionBuffTurns: 0,
    burn: 0,
    doomCounter: null,
    harmfulTickMeter: 0,
    beneficialTickMeter: 0,
    counterWindow: 0,
    counterDamage: 0,
    consecutiveHitsTaken: 0,
    dodgeCounter: 0,
    slow: 0,
    haste: 0,
    staggerPressure: 0,
    forecastIntent: false,
    asleepTurns: 0,
    catNapActive: false,
    prowlActive: false,
  };
};

const createMegaHandCombatants = (): Record<string, MegaHandCombatantState> => ({
  hero: createMegaHandCombatant('Hero'),
  mochi: createMegaHandCombatant('Mochi'),
  banks: createMegaHandCombatant('Banks'),
  jet: createMegaHandCombatant('Jet'),
  'lesser-shade': createMegaHandCombatant('Lesser Shade'),
});

const createFreshTableau = (): LocalCard[][] => {
  const deck = createDeck();
  const tableauCards = deck.slice(0, TABLEAU_COLUMNS * TABLEAU_ROWS);
  return Array.from({ length: TABLEAU_COLUMNS }, (_, columnIndex) =>
    tableauCards.slice(columnIndex * TABLEAU_ROWS, (columnIndex + 1) * TABLEAU_ROWS),
  );
};

const createInitialState = (): ChargeUpState => {
  const deck = createDeck();
  const tableau = createFreshTableau();
  const openingHand = createKinHandStartingHand();

  return {
    tableau,
    deck: deck.slice(TABLEAU_COLUMNS * TABLEAU_ROWS),
    handDeck: [],
    discard: [],
    playerChargers: openingHand,
    hand: [],
    playerFoundation: [],
    enemyFoundation: [],
    playerEnergy: MEGAHAND_MAX_ENERGY,
    enemyEnergy: MEGAHAND_MAX_ENERGY,
    playerPaidCardIds: [],
    enemyPaidCardIds: [],
    combatants: createMegaHandCombatants(),
  };
};

const getChargeUpFoundationTop = (foundation: LocalCard[]) => foundation[foundation.length - 1] ?? null;

const clearChargeUpCard = (card: LocalCard): LocalCard => ({
  ...normalizeMegaHandCardState(card),
  tableauCharge: 0,
});

const getNextMegaHandRarity = (rarity: OrimRarity | undefined): OrimRarity => {
  const currentIndex = MEGAHAND_RARITY_ORDER.indexOf(rarity ?? 'common');
  if (currentIndex < 0) return 'common';
  return MEGAHAND_RARITY_ORDER[Math.min(MEGAHAND_RARITY_ORDER.length - 1, currentIndex + 1)] ?? 'mythic';
};

const getKinHandCardApCap = (card: LocalCard) => (
  card.kinhandActorCard
    ? Math.max(0, card.kinhandActorMaxAp ?? 0)
    : Math.max(0, card.megahandAbility?.maxAp ?? 0)
);

const grantPrimeApToCard = (card: LocalCard): LocalCard => {
  const normalized = normalizeMegaHandCardState(card);
  const maxAp = getKinHandCardApCap(normalized);
  if (maxAp > 0 && (normalized.tableauCharge ?? 0) >= maxAp) {
    return {
      ...normalized,
      currentRarity: getNextMegaHandRarity(normalized.currentRarity ?? normalized.megahandAbility?.rarity ?? 'common'),
    };
  }
  return {
    ...normalized,
    tableauCharge: (normalized.tableauCharge ?? 0) + 1,
  };
};

const consumeChargedFoundationCard = (prev: ChargeUpState, foundationCardId: string): ChargeUpState => {
  const foundationTop = getChargeUpFoundationTop(prev.playerFoundation);
  if (!foundationTop || foundationTop.id !== foundationCardId) return prev;
  return {
    ...prev,
    playerFoundation: prev.playerFoundation.slice(0, -1),
    discard: [...prev.discard, clearChargeUpCard(foundationTop)],
  };
};

const consumeChargedHandCard = (prev: ChargeUpState, cardId: string): ChargeUpState => {
  const handIndex = prev.hand.findIndex((card) => card.id === cardId);
  if (handIndex < 0) return prev;
  const handCard = prev.hand[handIndex];
  return {
    ...prev,
    hand: prev.hand.filter((card) => card.id !== cardId),
    discard: [...prev.discard, clearChargeUpCard(handCard)],
  };
};

const swapPlayerFoundationWithTableau = (
  prev: ChargeUpState,
  columnIndex: number,
  columnCardIndex: number,
): ChargeUpState => {
  const foundationTop = getChargeUpFoundationTop(prev.playerFoundation);
  if (!foundationTop) return prev;
  const column = prev.tableau[columnIndex] ?? [];
  const tableauCard = column[columnCardIndex] ?? null;
  if (!tableauCard || columnCardIndex !== column.length - 1) return prev;

  const nextFoundation = normalizeMegaHandCardState(tableauCard);
  const swappedPrime = normalizeMegaHandCardState(foundationTop);
  const nextColumn = column.map((card, index) => (index === columnCardIndex ? swappedPrime : card));

  return {
    ...prev,
    tableau: prev.tableau.map((innerColumn, index) => (
      index === columnIndex ? nextColumn : innerColumn
    )),
    playerFoundation: [nextFoundation],
  };
};

const retrieveLatestDiscardToHand = (prev: ChargeUpState): ChargeUpState => {
  const retrieved = prev.discard[prev.discard.length - 1] ?? null;
  if (!retrieved) return prev;
  const nextDiscard = prev.discard.slice(0, -1);
  const normalized = enforceSingleTackleInHand([...prev.hand, normalizeMegaHandCardState(retrieved)], prev.handDeck);
  return {
    ...prev,
    hand: normalized.hand,
    handDeck: normalized.handDeck,
    discard: nextDiscard,
  };
};

const retrieveEnemyPrimeToHand = (prev: ChargeUpState): ChargeUpState => {
  const enemyTop = getChargeUpFoundationTop(prev.enemyFoundation);
  if (!enemyTop) return prev;
  const normalized = enforceSingleTackleInHand([...prev.hand, normalizeMegaHandCardState(enemyTop)], prev.handDeck);
  return {
    ...prev,
    hand: normalized.hand,
    handDeck: normalized.handDeck,
    enemyFoundation: prev.enemyFoundation.slice(0, -1),
  };
};

const getDefaultAssignmentSegments = (grantedAbility: { defaultSegments?: number[] }) => {
  const normalized = [...new Set((grantedAbility.defaultSegments ?? [1]).map((value) => clampNumber(Math.floor(value), 1, 5)))].sort((left, right) => left - right);
  return normalized.length > 0 ? normalized : [1];
};

const buildAssignmentsForOrim = (
  orim: KinHandOrimDefinition,
  assignmentOverride?: Partial<KinHandAppliedOrimDefinition>,
): KinHandAppliedOrimDefinition[] => (
  orim.grantedAbilities.map((grantedAbility) => {
    if (grantedAbility.placement === 'passive') {
      return {
        orimId: orim.id,
        grantedAbilityId: grantedAbility.id,
        passive: true,
        startAp: 1,
        endAp: 1,
        apSegments: [],
      };
    }
    const overrideSegments = assignmentOverride?.apSegments?.length
      ? [...new Set(assignmentOverride.apSegments.map((value) => clampNumber(Math.floor(value), 1, 5)))]
          .sort((left, right) => left - right)
      : undefined;
    const segments = overrideSegments && overrideSegments.length > 0
      ? overrideSegments
      : getDefaultAssignmentSegments(grantedAbility);
    return {
      orimId: orim.id,
      grantedAbilityId: grantedAbility.id,
      passive: false,
      startAp: assignmentOverride?.startAp ?? segments[0] ?? 1,
      endAp: assignmentOverride?.endAp ?? segments[segments.length - 1] ?? 1,
      apSegments: segments,
    };
  })
);

const buildSegmentAssignmentForGrantedAbility = (
  orimId: string,
  grantedAbilityId: string,
  apValue: number,
): KinHandAppliedOrimDefinition => ({
  orimId,
  grantedAbilityId,
  passive: false,
  startAp: apValue,
  endAp: apValue,
  apSegments: [apValue],
});

const buildRewardPreviewAssignments = (
  orim: KinHandOrimDefinition,
  selectedSegment: number,
): KinHandAppliedOrimDefinition[] => (
  orim.grantedAbilities.map((grantedAbility) => (
    grantedAbility.placement === 'passive'
      ? {
          orimId: orim.id,
          grantedAbilityId: grantedAbility.id,
          passive: true,
          startAp: 1,
          endAp: 1,
          apSegments: [],
        }
      : buildSegmentAssignmentForGrantedAbility(orim.id, grantedAbility.id, selectedSegment)
  ))
);

const applyOrimToActorCard = (
  card: LocalCard,
  orim: KinHandOrimDefinition,
  assignmentOverride?: Partial<KinHandAppliedOrimDefinition>,
): LocalCard => {
  const nextAssignments = buildAssignmentsForOrim(orim, assignmentOverride);
  const nextAppliedOrims = [
    ...(card.kinhandAppliedOrims ?? []).filter((entry) => entry.orimId !== orim.id),
    ...nextAssignments,
  ];
  return {
    ...card,
    kinhandAppliedOrims: nextAppliedOrims,
  };
};

const updateActorCardByName = (
  cards: LocalCard[],
  actorName: string,
  updater: (card: LocalCard) => LocalCard,
) => {
  let didUpdate = false;
  const nextCards = cards.map((card) => {
    if (card.actorName !== actorName) return card;
    didUpdate = true;
    return updater(card);
  });
  return { cards: nextCards, didUpdate };
};

const applyOrimToActorInState = (
  prev: ChargeUpState,
  actorName: string,
  orim: KinHandOrimDefinition,
  assignmentOverride?: Partial<KinHandAppliedOrimDefinition>,
): ChargeUpState => {
  const applyToCard = (card: LocalCard) => applyOrimToActorCard(card, orim, assignmentOverride);
  const chargers = updateActorCardByName(prev.playerChargers, actorName, applyToCard);
  if (chargers.didUpdate) {
    return {
      ...prev,
      playerChargers: chargers.cards,
    };
  }

  const playerFoundation = updateActorCardByName(prev.playerFoundation, actorName, applyToCard);
  if (playerFoundation.didUpdate) {
    return {
      ...prev,
      playerFoundation: playerFoundation.cards,
    };
  }

  const enemyFoundation = updateActorCardByName(prev.enemyFoundation, actorName, applyToCard);
  if (enemyFoundation.didUpdate) {
    return {
      ...prev,
      enemyFoundation: enemyFoundation.cards,
    };
  }

  return prev;
};

const applyOrimAssignmentsToActorCard = (
  card: LocalCard,
  orimId: string,
  assignments: KinHandAppliedOrimDefinition[],
): LocalCard => ({
  ...card,
  kinhandAppliedOrims: [
    ...(card.kinhandAppliedOrims ?? []).filter((entry) => entry.orimId !== orimId),
    ...assignments.map((entry) => ({
      ...entry,
      apSegments: entry.apSegments ? [...entry.apSegments] : undefined,
    })),
  ],
});

const applyOrimAssignmentsToActorInState = (
  prev: ChargeUpState,
  actorName: string,
  orimId: string,
  assignments: KinHandAppliedOrimDefinition[],
): ChargeUpState => {
  const applyToCard = (card: LocalCard) => applyOrimAssignmentsToActorCard(card, orimId, assignments);
  const chargers = updateActorCardByName(prev.playerChargers, actorName, applyToCard);
  if (chargers.didUpdate) {
    return { ...prev, playerChargers: chargers.cards };
  }
  const playerFoundation = updateActorCardByName(prev.playerFoundation, actorName, applyToCard);
  if (playerFoundation.didUpdate) {
    return { ...prev, playerFoundation: playerFoundation.cards };
  }
  const enemyFoundation = updateActorCardByName(prev.enemyFoundation, actorName, applyToCard);
  if (enemyFoundation.didUpdate) {
    return { ...prev, enemyFoundation: enemyFoundation.cards };
  }
  return prev;
};

const isActorAsleep = (state: ChargeUpState, actorName: string) => {
  const key = getMegaHandCombatantKey(actorName);
  if (!key) return false;
  return (state.combatants[key]?.asleepTurns ?? 0) > 0;
};

const grantOwnerApToCards = (cards: LocalCard[], ownerName: string) => (
  cards.map((card) => {
    const owner = card.megahandAbility?.ownerName ?? card.actorName;
    return owner === ownerName ? grantPrimeApToCard(card) : card;
  })
);

const applyMegaHandStatusTurnEffects = (prev: ChargeUpState): ChargeUpState => {
  const mochi = prev.combatants.mochi;
  if (!mochi || mochi.asleepTurns <= 0 || !mochi.catNapActive) return prev;
  const nextAsleepTurns = Math.max(0, mochi.asleepTurns - 1);
  return {
    ...prev,
    hand: grantOwnerApToCards(prev.hand, 'Mochi'),
    playerChargers: grantOwnerApToCards(prev.playerChargers, 'Mochi'),
    playerFoundation: grantOwnerApToCards(prev.playerFoundation, 'Mochi'),
    combatants: {
      ...prev.combatants,
      mochi: {
        ...mochi,
        asleepTurns: nextAsleepTurns,
        catNapActive: nextAsleepTurns > 0,
      },
    },
  };
};

const gainPrimeAp = (foundation: LocalCard[]) => {
  const top = getChargeUpFoundationTop(foundation);
  if (!top) return foundation;
  return [...foundation.slice(0, -1), grantPrimeApToCard(top)];
};

const gainStartTurnPrimeActorAp = (foundation: LocalCard[], amount = 2) => {
  const top = getChargeUpFoundationTop(foundation);
  if (!top?.kinhandActorCard || amount <= 0) return foundation;

  let nextTop = top;
  for (let index = 0; index < amount; index += 1) {
    nextTop = grantPrimeApToCard(nextTop);
  }

  return [...foundation.slice(0, -1), nextTop];
};

const applyPrimeEndTurnAp = (prev: ChargeUpState): ChargeUpState => applyMegaHandStatusTurnEffects({
  ...prev,
  playerChargers: prev.playerChargers.map((card) => grantPrimeApToCard(card)),
  playerFoundation: gainPrimeAp(prev.playerFoundation),
  enemyFoundation: gainPrimeAp(prev.enemyFoundation),
});

const isHeroTackleCard = (card: LocalCard) => (
  card.megahandAbility?.ownerName === 'Hero' && card.megahandAbility?.name === 'Tackle'
);

const enforceSingleTackleInHand = (hand: LocalCard[], handDeck: LocalCard[]) => {
  let tackleSeen = false;
  const normalizedHand: LocalCard[] = [];
  const returnedToDeck: LocalCard[] = [];

  hand.forEach((card) => {
    if (isHeroTackleCard(card)) {
      if (tackleSeen) {
        returnedToDeck.push(card);
        return;
      }
      tackleSeen = true;
    }
    normalizedHand.push(card);
  });

  return {
    hand: normalizedHand,
    handDeck: returnedToDeck.length > 0 ? shuffle([...handDeck, ...returnedToDeck]) : handDeck,
  };
};

const ensureHandSize = (prev: ChargeUpState): ChargeUpState => prev;

const KINHAND_BENCH_ORDER = new Map<string, number>(
  ['Jet', 'Hero', 'Mochi', 'Banks'].map((actorName, index) => [actorName, index] as const),
);

const getMegaHandBenchSignature = (card: LocalCard) => (
  card.kinhandActorCard
    ? card.actorName
    : card.megahandAbility
      ? `${card.megahandAbility.ownerName}:${card.megahandAbility.name}:${card.megahandAbility.golfValue}`
      : card.id
);

const mergePlayerBenchWithFoundation = (
  hand: LocalCard[],
  foundationTop: LocalCard | null,
) => {
  const deduped = new Map<string, LocalCard>();
  [...hand, ...(foundationTop ? [normalizeMegaHandCardState(foundationTop)] : [])].forEach((card) => {
    const normalized = normalizeMegaHandCardState(card);
    const signature = getMegaHandBenchSignature(normalized);
    const existing = deduped.get(signature);
    if (!existing || normalized.tableauCharge >= existing.tableauCharge) {
      deduped.set(signature, normalized);
    }
  });

  return [...deduped.values()].sort((left, right) => {
    const leftOrder = KINHAND_BENCH_ORDER.get(getMegaHandBenchSignature(left)) ?? Number.MAX_SAFE_INTEGER;
    const rightOrder = KINHAND_BENCH_ORDER.get(getMegaHandBenchSignature(right)) ?? Number.MAX_SAFE_INTEGER;
    if (leftOrder !== rightOrder) return leftOrder - rightOrder;
    return left.rank - right.rank;
  });
};

const getKinHandSpawnableAbilities = (actorCard: LocalCard) => getKinHandSpawnableAbilitiesFromCard(actorCard);

const getHandCardEnergyCost = (card: LocalCard) => card.megahandAbility?.energyCost ?? 0;

const getCardEnergyCostDiscount = (card: LocalCard) => {
  const maxAp = card.megahandAbility?.maxAp ?? 0;
  if (maxAp <= 0) return 0;
  return card.tableauCharge >= maxAp ? 1 : 0;
};

const getCardActivationEnergyCost = (card: LocalCard) => (
  Math.max(0, getHandCardEnergyCost(card) - getCardEnergyCostDiscount(card))
);

const getActorEnergy = (state: ChargeUpState, actor: ChargeUpActorSide) => (
  actor === 'player' ? state.playerEnergy : state.enemyEnergy
);

const getActorPaidCardIds = (state: ChargeUpState, actor: ChargeUpActorSide) => (
  actor === 'player' ? state.playerPaidCardIds : state.enemyPaidCardIds
);

const isHandCardPaidForTurn = (state: ChargeUpState, actor: ChargeUpActorSide, cardId: string) => (
  getActorPaidCardIds(state, actor).includes(cardId)
);

const canAffordHandCardPlay = (state: ChargeUpState, actor: ChargeUpActorSide, card: LocalCard) => (
  !isActorAsleep(state, card.megahandAbility?.ownerName ?? card.actorName)
);

const getChargeUpLegalTableauMoves = (tableau: LocalCard[][], foundationTop: LocalCard | null) => {
  const foundationRank = getChargeUpRuleRank(foundationTop);
  if (foundationRank === null) return [] as Array<{ columnIndex: number; columnCardIndex: number; card: LocalCard }>;
  if (!foundationTop) return [] as Array<{ columnIndex: number; columnCardIndex: number; card: LocalCard }>;
  return tableau.flatMap((column, columnIndex) => {
    const topCardIndex = column.length - 1;
    const card = column[topCardIndex] ?? null;
    if (!card || !isAdjacentRank(card.rank, foundationRank)) return [];
    return [{ columnIndex, columnCardIndex: topCardIndex, card }];
  });
};

const getChargeUpLegalHandCards = (state: ChargeUpState, actor: ChargeUpActorSide, foundationTop: LocalCard | null) => (
  foundationTop
    ? state.hand.filter((card) => {
        const cardRank = getChargeUpRuleRank(card);
        const foundationRank = getChargeUpRuleRank(foundationTop);
        return (
          cardRank !== null
          && foundationRank !== null
          && isAdjacentRank(cardRank, foundationRank)
          && canAffordHandCardPlay(state, actor, card)
        );
      })
    : state.hand.filter((card) => canAffordHandCardPlay(state, actor, card))
);

const canMovePlayerChargerToPrime = (state: ChargeUpState, actorCard: LocalCard) => {
  if (!actorCard.kinhandActorCard) return false;
  if (isActorAsleep(state, actorCard.actorName)) return false;
  const foundationTop = getChargeUpFoundationTop(state.playerFoundation);
  if (!foundationTop) return true;
  if (!foundationTop.kinhandActorCard) return false;
  const actorRank = getChargeUpRuleRank(actorCard);
  const foundationRank = getChargeUpRuleRank(foundationTop);
  return actorRank !== null && foundationRank !== null && isAdjacentRank(actorRank, foundationRank);
};

const movePlayerChargerToPrime = (prev: ChargeUpState, actorCardId: string): ChargeUpState => {
  const actorIndex = prev.playerChargers.findIndex((card) => card.id === actorCardId);
  if (actorIndex < 0) return prev;
  const actorCard = prev.playerChargers[actorIndex];
  if (!actorCard || !canMovePlayerChargerToPrime(prev, actorCard)) return prev;

  const nextPrime = normalizeMegaHandCardState(actorCard);
  const previousPrime = getChargeUpFoundationTop(prev.playerFoundation);
  const nextChargers = prev.playerChargers.filter((card) => card.id !== actorCardId);

  if (!previousPrime) {
    return {
      ...prev,
      playerChargers: nextChargers,
      playerFoundation: [nextPrime],
    };
  }

  return {
    ...prev,
    playerChargers: mergePlayerBenchWithFoundation([...nextChargers, normalizeMegaHandCardState(previousPrime)], null),
    playerFoundation: [nextPrime],
  };
};

const applyPlayHandCardAsFoundation = (prev: ChargeUpState, cardId: string): ChargeUpState => {
  const handIndex = prev.hand.findIndex((card) => card.id === cardId);
  if (handIndex < 0) return prev;
  const nextCard = prev.hand[handIndex];
  if (!nextCard) return prev;
  if (isActorAsleep(prev, nextCard.megahandAbility?.ownerName ?? nextCard.actorName)) return prev;
  const normalizedNextCard = normalizeMegaHandCardState(nextCard);
  const top = getChargeUpFoundationTop(prev.playerFoundation);
  const nextCardRank = getChargeUpRuleRank(normalizedNextCard);
  const topRank = getChargeUpRuleRank(top);
  if (top && (nextCardRank === null || topRank === null || !isAdjacentRank(nextCardRank, topRank))) return prev;
  const nextHand = prev.hand.filter((card) => card.id !== cardId);
  if (top) {
    nextHand.push(normalizeMegaHandCardState(top));
  }
  return {
    ...prev,
    hand: nextHand,
    playerFoundation: [normalizedNextCard],
    enemyFoundation: prev.enemyFoundation,
  };
};

const applyPlayTableauCardToFoundation = (
  prev: ChargeUpState,
  actor: ChargeUpActorSide,
  columnIndex: number,
  columnCardIndex: number,
): ChargeUpState => {
  const column = prev.tableau[columnIndex] ?? [];
  const nextCard = column[columnCardIndex];
  if (!nextCard) return prev;
  if (isActorAsleep(prev, nextCard.megahandAbility?.ownerName ?? nextCard.actorName)) return prev;
  const foundation = actor === 'player' ? prev.playerFoundation : prev.enemyFoundation;
  const foundationTop = getChargeUpFoundationTop(foundation);
  const foundationRank = getChargeUpRuleRank(foundationTop);
  if (!foundationTop || foundationRank === null || !isAdjacentRank(nextCard.rank, foundationRank)) return prev;

  const nextColumn = column.filter((_, idx) => idx !== columnCardIndex);
  let nextTableau = prev.tableau.map((innerColumn, index) => (
    index === columnIndex ? nextColumn : innerColumn
  ));
  nextTableau = refillColumnToCapacity(nextTableau, columnIndex);

  const nextFoundationTop: LocalCard = foundationTop.megahandAbility
    ? grantPrimeApToCard({
        ...foundationTop,
        rank: nextCard.rank,
        suit: nextCard.suit,
      })
    : {
        ...foundationTop,
        rank: nextCard.rank,
        suit: nextCard.suit,
        tableauCharge: (foundationTop.tableauCharge ?? 0) + 1,
      };

  return actor === 'player'
    ? {
        ...prev,
        tableau: nextTableau,
        playerFoundation: [nextFoundationTop],
      }
    : {
        ...prev,
        tableau: nextTableau,
        enemyFoundation: [nextFoundationTop],
      };
};

const startChargeUpEnemyTurn = (prev: ChargeUpState): ChargeUpState => ({
  ...prev,
  enemyFoundation: prev.enemyFoundation.length > 0 ? prev.enemyFoundation : [createEnemyPersonaCard()],
  playerEnergy: MEGAHAND_MAX_ENERGY,
  enemyEnergy: MEGAHAND_MAX_ENERGY,
  playerPaidCardIds: [],
  enemyPaidCardIds: [],
});

const getChargeUpPlayerBenchStateKey = (state: ChargeUpState) => {
  const foundationTop = getChargeUpFoundationTop(state.playerFoundation);
  const foundationKey = foundationTop ? foundationTop.id : 'none';
  const handKey = state.hand
    .map((card) => card.id)
    .sort()
    .join('|');
  return `${foundationKey}::${handKey}`;
};

const chooseBestChargeUpTableauMove = (
  state: ChargeUpState,
  actor: ChargeUpActorSide,
): ChargeUpAutoAction | null => {
  const foundationTop = getChargeUpFoundationTop(
    actor === 'player' ? state.playerFoundation : state.enemyFoundation,
  );
  const legalMoves = getChargeUpLegalTableauMoves(state.tableau, foundationTop);
  if (legalMoves.length === 0) return null;

  let bestMove = legalMoves[0] ?? null;
  let bestScore = -Infinity;

  legalMoves.forEach((move, index) => {
    const nextState = applyPlayTableauCardToFoundation(
      state,
      actor,
      move.columnIndex,
      move.columnCardIndex,
    );
    const nextTop = getChargeUpFoundationTop(
      actor === 'player' ? nextState.playerFoundation : nextState.enemyFoundation,
    );
    const continuationCount = getChargeUpLegalTableauMoves(nextState.tableau, nextTop).length;
    const playerHandOptions = actor === 'player'
      ? getChargeUpLegalHandCards(nextState, 'player', nextTop).length
      : 0;
    const remainingColumnDepth = nextState.tableau[move.columnIndex]?.length ?? 0;
    const score = (continuationCount * 100) + (playerHandOptions * 10) + remainingColumnDepth - index;
    if (score > bestScore) {
      bestScore = score;
      bestMove = move;
    }
  });

  return bestMove
    ? {
        type: 'tableau',
        actor,
        columnIndex: bestMove.columnIndex,
        columnCardIndex: bestMove.columnCardIndex,
      }
    : null;
};

const chooseBestChargeUpHandCard = (state: ChargeUpState): LocalCard | null => {
  const foundationTop = getChargeUpFoundationTop(state.playerFoundation);
  const legalHandCards = getChargeUpLegalHandCards(state, 'player', foundationTop);
  if (legalHandCards.length === 0) return null;

  let bestCard = legalHandCards[0] ?? null;
  let bestScore = -Infinity;

  legalHandCards.forEach((card, index) => {
    const nextState = applyPlayHandCardAsFoundation(state, card.id);
    const nextTop = getChargeUpFoundationTop(nextState.playerFoundation);
    const continuationCount = getChargeUpLegalTableauMoves(nextState.tableau, nextTop).length;
    const extraHandOptions = getChargeUpLegalHandCards(nextState, 'player', nextTop).length;
    const score = (continuationCount * 100) + (extraHandOptions * 10) + card.rank - index;
    if (score > bestScore) {
      bestScore = score;
      bestCard = card;
    }
  });

  return bestCard;
};

const chooseBestChargeUpBenchSwapTowardTableau = (state: ChargeUpState): LocalCard | null => {
  const foundationTop = getChargeUpFoundationTop(state.playerFoundation);
  const legalHandCards = getChargeUpLegalHandCards(state, 'player', foundationTop);
  if (legalHandCards.length === 0) return null;

  let bestCard = legalHandCards[0] ?? null;
  let bestScore = -Infinity;

  legalHandCards.forEach((card, index) => {
    const nextState = applyPlayHandCardAsFoundation(state, card.id);
    if (nextState === state) return;
    const nextTop = getChargeUpFoundationTop(nextState.playerFoundation);
    const immediateTableauOptions = getChargeUpLegalTableauMoves(nextState.tableau, nextTop).length;
    if (immediateTableauOptions === 0) return;
    const extraHandOptions = getChargeUpLegalHandCards(nextState, 'player', nextTop).length;
    const score = (immediateTableauOptions * 100) + (extraHandOptions * 10) + card.rank - index;
    if (score > bestScore) {
      bestScore = score;
      bestCard = card;
    }
  });

  return bestScore === -Infinity ? null : bestCard;
};

const hasForwardChargeUpBenchOption = (
  state: ChargeUpState,
  previousBenchKey: string,
  visited: Set<string>,
) => {
  const foundationTop = getChargeUpFoundationTop(state.playerFoundation);
  const legalHandCards = getChargeUpLegalHandCards(state, 'player', foundationTop);
  return legalHandCards.some((card) => {
    const nextState = applyPlayHandCardAsFoundation(state, card.id);
    if (nextState === state) return false;
    const nextKey = getChargeUpPlayerBenchStateKey(nextState);
    return nextKey !== previousBenchKey && !visited.has(nextKey);
  });
};

const findChargeUpBenchPathToTableau = (state: ChargeUpState): string[] | null => {
  const queue: Array<{ state: ChargeUpState; path: string[] }> = [{ state, path: [] }];
  const visited = new Set<string>([getChargeUpPlayerBenchStateKey(state)]);

  while (queue.length > 0) {
    const nextEntry = queue.shift();
    if (!nextEntry) break;

    const tableauMove = chooseBestChargeUpTableauMove(nextEntry.state, 'player');
    if (tableauMove) {
      return nextEntry.path;
    }

    const foundationTop = getChargeUpFoundationTop(nextEntry.state.playerFoundation);
    const legalHandCards = [...getChargeUpLegalHandCards(nextEntry.state, 'player', foundationTop)]
      .sort((left, right) => {
        const leftNext = applyPlayHandCardAsFoundation(nextEntry.state, left.id);
        const rightNext = applyPlayHandCardAsFoundation(nextEntry.state, right.id);
        const leftTop = getChargeUpFoundationTop(leftNext.playerFoundation);
        const rightTop = getChargeUpFoundationTop(rightNext.playerFoundation);
        const leftTableauOptions = getChargeUpLegalTableauMoves(leftNext.tableau, leftTop).length;
        const rightTableauOptions = getChargeUpLegalTableauMoves(rightNext.tableau, rightTop).length;
        if (rightTableauOptions !== leftTableauOptions) return rightTableauOptions - leftTableauOptions;
        const leftHandOptions = getChargeUpLegalHandCards(leftNext, 'player', leftTop).length;
        const rightHandOptions = getChargeUpLegalHandCards(rightNext, 'player', rightTop).length;
        if (rightHandOptions !== leftHandOptions) return rightHandOptions - leftHandOptions;
        return right.rank - left.rank;
      });

    legalHandCards.forEach((card) => {
      const nextState = applyPlayHandCardAsFoundation(nextEntry.state, card.id);
      if (nextState === nextEntry.state) return;
      const nextTableauMove = chooseBestChargeUpTableauMove(nextState, 'player');
      const key = getChargeUpPlayerBenchStateKey(nextState);
      if (visited.has(key)) return;
      if (
        !nextTableauMove
        && !hasForwardChargeUpBenchOption(nextState, getChargeUpPlayerBenchStateKey(nextEntry.state), visited)
      ) return;
      visited.add(key);
      queue.push({
        state: nextState,
        path: [...nextEntry.path, card.id],
      });
    });
  }

  return null;
};

const chooseBestPlayerPrimeActor = (state: ChargeUpState): LocalCard | null => {
  const legalActors = state.playerChargers.filter((card) => canMovePlayerChargerToPrime(state, card));
  if (legalActors.length === 0) return null;

  let bestActor = legalActors[0] ?? null;
  let bestScore = -Infinity;

  legalActors.forEach((card, index) => {
    const nextState = movePlayerChargerToPrime(state, card.id);
    if (nextState === state) return;
    const nextTop = getChargeUpFoundationTop(nextState.playerFoundation);
    const tableauOptions = getChargeUpLegalTableauMoves(nextState.tableau, nextTop).length;
    const handOptions = getChargeUpLegalHandCards(nextState, 'player', nextTop).length;
    const score = (tableauOptions * 100) + (handOptions * 10) + card.rank - index;
    if (score > bestScore) {
      bestScore = score;
      bestActor = card;
    }
  });

  return bestActor;
};

const chooseChargeUpPlayerAutoAction = (state: ChargeUpState): ChargeUpAutoAction | null => {
  const primeActor = chooseBestPlayerPrimeActor(state);
  if (primeActor && !getChargeUpFoundationTop(state.playerFoundation)) {
    return { type: 'actor', actorCardId: primeActor.id };
  }
  const tableauMove = chooseBestChargeUpTableauMove(state, 'player');
  if (tableauMove) return tableauMove;
  if (primeActor) {
    return { type: 'actor', actorCardId: primeActor.id };
  }
  const benchCard = chooseBestChargeUpBenchSwapTowardTableau(state);
  if (!benchCard) return null;
  return { type: 'hand', cardId: benchCard.id };
};

const chooseChargeUpEnemyAutoAction = (state: ChargeUpState): ChargeUpAutoAction | null => (
  chooseBestChargeUpTableauMove(state, 'enemy')
);

const applyChargeUpAutoAction = (state: ChargeUpState, action: ChargeUpAutoAction): ChargeUpState => (
  action.type === 'actor'
    ? movePlayerChargerToPrime(state, action.actorCardId)
    : action.type === 'hand'
    ? applyPlayHandCardAsFoundation(state, action.cardId)
    : applyPlayTableauCardToFoundation(state, action.actor, action.columnIndex, action.columnCardIndex)
);

const getChargeUpPointerAnchorPoint = (element: HTMLElement | null) => {
  if (!element) return null;
  const rect = element.getBoundingClientRect();
  return {
    x: rect.right - 10,
    y: rect.bottom - 10,
  };
};

const getChargeUpCalloutAnchorPoint = (element: HTMLElement | null) => {
  if (!element) return undefined;
  const rect = element.getBoundingClientRect();
  return {
    x: rect.left + rect.width / 2,
    y: rect.top - 8,
  };
};

const getChargeUpEnemyDragDurationMs = (from: { x: number; y: number }, to: { x: number; y: number }) => {
  const distance = Math.hypot(to.x - from.x, to.y - from.y);
  return clampNumber(
    Math.round(240 + (distance * 0.9)),
    CHARGE_UP_ENEMY_DRAG_MIN_MS,
    CHARGE_UP_ENEMY_DRAG_MAX_MS,
  );
};

const getActorFrameBackdropStyle = (actorName: string) => {
  if (actorName === 'Lightbloom') {
    return {
      border: 'rgba(154,255,214,0.74)',
      glow: '0 0 30px rgba(112,255,204,0.28), 0 0 12px rgba(112,255,204,0.2)',
      background: 'radial-gradient(circle at 50% 18%, rgba(178,255,230,0.2), rgba(14,34,30,0.1) 36%, rgba(4,6,10,0) 78%)',
    };
  }
  if (actorName === 'Darkheart') {
    return {
      border: 'rgba(255,122,122,0.74)',
      glow: '0 0 30px rgba(255,108,132,0.3), 0 0 12px rgba(255,108,132,0.2)',
      background: 'radial-gradient(circle at 50% 18%, rgba(255,136,162,0.2), rgba(40,12,20,0.12) 36%, rgba(4,6,10,0) 78%)',
    };
  }
  if (actorName === 'Hero') {
    return {
      border: 'rgba(255,154,205,0.72)',
      glow: '0 0 28px rgba(255,120,190,0.28), 0 0 10px rgba(255,120,190,0.2)',
      background: 'radial-gradient(circle at 50% 18%, rgba(255,170,215,0.2), rgba(38,14,28,0.08) 36%, rgba(4,6,10,0) 78%)',
    };
  }
  if (actorName === 'Mochi') {
    return {
      border: 'rgba(184,154,255,0.64)',
      glow: '0 0 26px rgba(160,124,255,0.24), 0 0 10px rgba(160,124,255,0.16)',
      background: 'radial-gradient(circle at 50% 18%, rgba(192,162,255,0.18), rgba(24,16,38,0.08) 36%, rgba(4,6,10,0) 78%)',
    };
  }
  if (actorName === 'Banks') {
    return {
      border: 'rgba(255,214,143,0.56)',
      glow: '0 0 26px rgba(255,196,96,0.22), 0 0 10px rgba(255,196,96,0.16)',
      background: 'radial-gradient(circle at 50% 18%, rgba(255,214,132,0.14), rgba(36,24,12,0.08) 36%, rgba(4,6,10,0) 78%)',
    };
  }
  if (actorName === 'Jet') {
    return {
      border: 'rgba(144,206,255,0.58)',
      glow: '0 0 26px rgba(110,190,255,0.24), 0 0 10px rgba(110,190,255,0.18)',
      background: 'radial-gradient(circle at 50% 18%, rgba(140,210,255,0.15), rgba(10,22,36,0.08) 36%, rgba(4,6,10,0) 78%)',
    };
  }
  if (actorName === 'Lesser Shade') {
    return {
      border: 'rgba(255,128,128,0.68)',
      glow: '0 0 28px rgba(255,108,108,0.26), 0 0 10px rgba(255,108,108,0.18)',
      background: 'radial-gradient(circle at 50% 18%, rgba(255,132,132,0.18), rgba(38,12,18,0.08) 36%, rgba(4,6,10,0) 78%)',
    };
  }
  return {
    border: 'rgba(205,182,255,0.52)',
    glow: '0 0 24px rgba(182,140,255,0.18), 0 0 10px rgba(182,140,255,0.14)',
    background: 'radial-gradient(circle at 50% 18%, rgba(218,198,255,0.14), rgba(24,16,34,0.08) 36%, rgba(4,6,10,0) 78%)',
  };
};

const getMegaHandActorVitals = (actorName: string) => {
  const maxHp = 10;
  const armor = actorName === 'Hero' ? 1 : 0;
  return {
    currentHp: maxHp,
    maxHp,
    armor,
  };
};

const StarterKinTooltipContent = ({ card }: { card: LocalCard }) => {
  const kinKit = getStarterKinKit(card.actorName);
  if (!kinKit) return null;
  const actorDefinition = getKinHandActorDefinition(card.actorName);

  const profile = getKinProfile(card.actorName);
  const signatureName = kinKit.signature.fullName ?? kinKit.signature.name;
  const pronounLine = `${profile.pronouns.subject}/${profile.pronouns.object}/${profile.pronouns.possessive}`;

  return (
    <div className="flex max-w-[320px] flex-col gap-3 text-white">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="text-sm font-black uppercase tracking-[0.08em] text-[#8ef2d4]">{card.actorName}</div>
          <div className="mt-0.5 text-[10px] uppercase tracking-[0.16em] text-white/45">
            {FAMILY_LABELS[profile.family]} · {pronounLine}
          </div>
        </div>
        <div className="rounded-full border border-white/12 bg-white/6 px-2 py-1 text-[10px] font-semibold text-white/76">
          {rankLabel(card.rank)} {suitSymbol(card.suit)}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-[11px] text-white/72">
        <div>
          <span className="text-white/42">AP Cap:</span> {actorDefinition?.maxAp ?? 5}
        </div>
        <div>
          <span className="text-white/42">Charge:</span> +{card.tableauCharge}
        </div>
      </div>

      <div>
        <div className="mb-1 text-[10px] font-black uppercase tracking-[0.16em] text-[#8ef2d4]/78">Signature</div>
        <div className="text-[12px] font-semibold text-white">{signatureName}</div>
        <div className="mt-1 text-[11px] leading-snug text-white/72">{kinKit.signature.exploreDescription}</div>
        <div className="mt-1 text-[10px] uppercase tracking-[0.12em] text-white/45">
          {kinKit.signature.focus ?? 'hybrid'}
          {kinKit.signature.cost ? ` · Cost ${kinKit.signature.cost}` : ''}
        </div>
      </div>

      {kinKit.passiveTrait ? (
        <div>
          <div className="mb-1 text-[10px] font-black uppercase tracking-[0.16em] text-[#8ef2d4]/78">Passive</div>
          <div className="text-[12px] font-semibold text-white">{kinKit.passiveTrait.name}</div>
          <div className="mt-1 text-[11px] leading-snug text-white/72">{kinKit.passiveTrait.effectText}</div>
        </div>
      ) : null}

      {kinKit.collapse ? (
        <div>
          <div className="mb-1 text-[10px] font-black uppercase tracking-[0.16em] text-[#8ef2d4]/78">Collapse</div>
          <div className="text-[12px] font-semibold text-white">
            {kinKit.collapse.name}
            <span className="ml-1 text-white/42">· {kinKit.collapse.role}</span>
          </div>
          <div className="mt-1 text-[11px] leading-snug text-white/72">{kinKit.collapse.combatDescription}</div>
        </div>
      ) : null}

      {kinKit.signatureMutations.length > 0 ? (
        <div>
          <div className="mb-1 text-[10px] font-black uppercase tracking-[0.16em] text-[#8ef2d4]/78">Mutations</div>
          <div className="flex flex-col gap-2">
            {kinKit.signatureMutations.map((mutation) => (
              <div key={mutation.id} className="rounded-[10px] border border-white/10 bg-white/[0.03] px-2.5 py-2">
                <div className="text-[11px] font-semibold text-white">
                  {mutation.name}
                  <span className="ml-1 text-white/42">· {mutation.tier}</span>
                </div>
                <div className="mt-1 text-[11px] leading-snug text-white/68">{mutation.summary}</div>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
};

const MegaHandKinTooltipContent = ({ card }: { card: LocalCard }) => {
  const profile = getKinProfile(card.actorName);
  const abilities = getActorRuntimeAbilities(card.actorName, card.megahandAbility, card.kinhandAppliedOrims, card.tableauCharge);
  const pronounLine = `${profile.pronouns.subject}/${profile.pronouns.object}/${profile.pronouns.possessive}`;

  return (
    <div className="flex max-w-[320px] flex-col gap-3 text-white">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="text-sm font-black uppercase tracking-[0.08em] text-[#8ef2d4]">{card.actorName}</div>
          <div className="mt-0.5 text-[10px] uppercase tracking-[0.16em] text-white/45">
            {FAMILY_LABELS[profile.family]} · {pronounLine}
          </div>
        </div>
        <div className="rounded-full border border-white/12 bg-white/6 px-2 py-1 text-[10px] font-semibold text-white/76">
          Rank {rankLabel(card.rank)}
        </div>
      </div>

      {abilities.length > 0 ? (
        <div className="flex flex-col gap-2">
          {abilities.map((ability) => (
            <div key={`${card.actorName}-${ability.name}`} className="rounded-[10px] border border-white/10 bg-white/[0.03] px-2.5 py-2">
              <div className="flex items-center justify-between gap-3">
                <div className="text-[12px] font-semibold text-white">{ability.name}</div>
                <div className="rounded-full border border-white/12 bg-black/25 px-2 py-0.5 text-[10px] font-black uppercase tracking-[0.12em] text-white/76">
                  {ability.energyCost}en
                </div>
              </div>
              <div className="mt-1 text-[10px] uppercase tracking-[0.14em] text-white/45">
                AP {ability.maxAp} · Golf {rankLabel(ability.golfValue)} · Pow {ability.power}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="rounded-[10px] border border-white/10 bg-white/[0.03] px-2.5 py-2 text-[11px] leading-snug text-white/68">
          No megahand abilities assigned yet.
        </div>
      )}
    </div>
  );
};

const SimpleCard = ({
  card,
  onClick,
  onPointerDown,
  active = false,
  muted = false,
  compact = false,
  disabled = false,
  mobile = false,
  width,
  height,
}: {
  card: LocalCard;
  onClick?: () => void;
  onPointerDown?: (event: React.PointerEvent<HTMLButtonElement>) => void;
  active?: boolean;
  muted?: boolean;
  compact?: boolean;
  disabled?: boolean;
  mobile?: boolean;
  width?: number;
  height?: number;
}) => {
  const baseWidth = compact ? (mobile ? 38 : 68) : (mobile ? 48 : 102);
  const baseHeight = compact ? (mobile ? 52 : 94) : (mobile ? 78 : 144);
  const resolvedWidth = width ?? baseWidth;
  const resolvedHeight = height ?? baseHeight;
  const inactive = disabled && !active && !muted;
  const outerRadius = Math.round(clampNumber(resolvedWidth * 0.16, 12, 16));
  const innerRadius = Math.max(10, outerRadius - 2);
  const cardSize = {
    width: Math.max(24, resolvedWidth - 4),
    height: Math.max(36, resolvedHeight - 4),
  };

  return (
    <button
      type="button"
      onClick={onClick}
      onPointerDown={onPointerDown}
      disabled={disabled}
      className="rounded-[16px]"
      style={{ borderRadius: outerRadius }}
    >
      <div
        className={`relative overflow-hidden border p-[2px] transition ${
          active
            ? 'border-[#8ef2d4]/80 bg-[linear-gradient(180deg,rgba(12,28,24,0.98),rgba(6,10,12,0.98))] text-white shadow-[0_0_28px_rgba(110,255,217,0.22)]'
            : muted
              ? 'border-white/14 bg-[linear-gradient(180deg,rgba(18,20,26,0.94),rgba(7,8,11,0.92))] text-white/90 shadow-[0_0_16px_rgba(255,255,255,0.08)]'
              : inactive
                ? 'cursor-default border-white/16 bg-[linear-gradient(180deg,rgba(20,22,28,0.97),rgba(8,10,14,0.95))] text-white/88 shadow-[0_0_18px_rgba(255,255,255,0.08)]'
                : 'border-white/15 bg-[linear-gradient(180deg,rgba(18,20,26,0.96),rgba(7,8,11,0.92))] text-white/92 shadow-[0_0_18px_rgba(255,255,255,0.08)] hover:-translate-y-0.5 hover:border-[#ffd166]/40'
        }`}
        style={{ width: resolvedWidth, height: resolvedHeight, borderRadius: outerRadius }}
      >
        <div
          className="relative h-full w-full overflow-hidden"
          style={{
            borderRadius: innerRadius,
            filter: muted
              ? 'grayscale(0.1) saturate(0.82) brightness(0.86)'
              : inactive
                ? 'saturate(0.96) brightness(0.97)'
                : undefined,
            opacity: muted ? 0.94 : 1,
          }}
        >
          <Card
            card={toGameCard(card)}
            showGraphics={false}
            size={cardSize}
            canPlay={active && !disabled}
            borderColorOverride="transparent"
            boxShadowOverride="none"
            hideElements
            disableAnimation
            disableTilt
            disableHoverLift
          />
        </div>
      </div>
    </button>
  );
};

const ActorFrameCard = ({
  card,
  onClick,
  onPointerDown,
  buttonRef,
  highlighted = false,
  dimmed = false,
  enemy = false,
  roleLabel,
  mobile = false,
  width,
  height,
  contentMode,
}: {
  card: LocalCard;
  onClick?: () => void;
  onPointerDown?: (event: React.PointerEvent<HTMLButtonElement>) => void;
  buttonRef?: React.Ref<HTMLButtonElement>;
  highlighted?: boolean;
  dimmed?: boolean;
  enemy?: boolean;
  roleLabel?: string;
  mobile?: boolean;
  width?: number;
  height?: number;
  contentMode?: 'full' | 'compact' | 'minimal';
}) => {
  const runtimeAbilities = getActorRuntimeAbilities(card.actorName, card.megahandAbility, card.kinhandAppliedOrims, card.tableauCharge);
  const apCap = card.kinhandActorMaxAp ?? 5;
  const hpMax = 10;
  const armor = 0;
  const abilityName = runtimeAbilities.map((ability) => ability.name).join(' / ') || 'Unassigned';
  const tooltipContent = <MegaHandKinTooltipContent card={card} />;
  const actorNameLabel = tooltipContent ? (
    <Tooltip content={tooltipContent} disabled={mobile} delayMs={350} hoverEnabled={!mobile} clickToPin={false} inlineTrigger>
      <span className="cursor-help">{card.actorName}</span>
    </Tooltip>
  ) : (
    <span>{card.actorName}</span>
  );
  const baseWidth = mobile ? 88 : 118;
  const baseHeight = mobile ? 136 : 182;
  const resolvedWidth = width ?? baseWidth;
  const resolvedHeight = height ?? Math.round((baseHeight / baseWidth) * resolvedWidth);
  const resolvedContentMode = contentMode ?? (
    resolvedWidth <= (mobile ? 56 : 70)
      ? 'minimal'
      : resolvedWidth <= (mobile ? 72 : 92)
        ? 'compact'
        : 'full'
  );
  const outerRadius = Math.round(clampNumber(resolvedWidth * 0.14, 12, 16));
  const innerRadius = Math.max(outerRadius - 2, 10);
  const paddingX = clampNumber(
    resolvedContentMode === 'minimal' ? resolvedWidth * 0.08 : resolvedWidth * 0.1,
    6,
    12,
  );
  const paddingTop = clampNumber(
    resolvedContentMode === 'minimal' ? resolvedHeight * 0.05 : resolvedHeight * 0.07,
    6,
    12,
  );
  const paddingBottom = clampNumber(resolvedHeight * 0.05, 6, 12);
  const nameFontSize = clampNumber(
    resolvedContentMode === 'minimal' ? resolvedWidth * 0.12 : resolvedWidth * 0.076,
    6,
    9,
  );
  const statFontSize = clampNumber(resolvedWidth * 0.068, 5.5, 8);
  const microFontSize = clampNumber(resolvedWidth * 0.06, 5, 7);
  const valueFontSize = clampNumber(
    resolvedContentMode === 'minimal' ? resolvedWidth * 0.55 : resolvedWidth * 0.44,
    26,
    52,
  );
  const chipFontSize = clampNumber(resolvedWidth * 0.07, 5.5, 8);
  const chipPaddingX = clampNumber(resolvedWidth * 0.1, 5, 8);
  const chipPaddingY = resolvedContentMode === 'minimal' ? 1 : 2;
  const hpBarHeight = clampNumber(resolvedWidth * 0.08, 6, 10);
  const apBarHeight = clampNumber(resolvedWidth * 0.075, 6, 9);
  const showStats = resolvedContentMode !== 'minimal';
  const showAbilityName = resolvedContentMode === 'full';
  const showApBar = resolvedContentMode !== 'minimal';

  return (
    <button
      ref={buttonRef}
      type="button"
      onClick={onClick}
      onPointerDown={onPointerDown}
      className={`relative flex flex-col items-center gap-2 rounded-[16px] p-0 ${onClick ? 'cursor-pointer' : 'cursor-default'}`}
      aria-disabled={dimmed && !highlighted}
    >
      <div
        className={`relative flex flex-col overflow-hidden border text-white transition ${
          highlighted
            ? 'border-[#8ef2d4]/80 bg-[linear-gradient(180deg,rgba(18,48,40,0.96),rgba(7,12,16,0.98))]'
            : dimmed
              ? 'border-white/10 bg-[linear-gradient(180deg,rgba(11,15,20,0.9),rgba(5,7,10,0.94))]'
            : enemy
              ? 'border-[#ff7a7a]/70 bg-[linear-gradient(180deg,rgba(42,20,24,0.98),rgba(13,8,10,0.98))]'
              : 'border-white/16 bg-[linear-gradient(180deg,rgba(18,23,29,0.98),rgba(7,10,14,0.98))]'
        }`}
        style={{
          width: resolvedWidth,
          height: resolvedHeight,
          borderRadius: outerRadius,
          paddingLeft: paddingX,
          paddingRight: paddingX,
          paddingTop,
          paddingBottom,
          ...(dimmed && !highlighted ? { filter: 'saturate(0.55) brightness(0.72)', opacity: 0.72 } : {}),
        }}
      >
        <div
          className="absolute inset-0"
          style={{
            borderRadius: outerRadius,
            background: enemy
              ? 'radial-gradient(circle at 50% 34%, rgba(255,120,120,0.18), rgba(32,10,12,0.08) 46%, transparent 76%)'
              : 'radial-gradient(circle_at_50%_34%,rgba(164,255,223,0.14),rgba(12,18,22,0.04)_46%,transparent_76%)',
          }}
        />
        <div
          className="relative flex items-center justify-between font-black uppercase tracking-[0.1em] text-white/92"
          style={{ fontSize: nameFontSize, lineHeight: 1.05 }}
        >
          {actorNameLabel}
        </div>
        {showStats ? (
          <div className="relative" style={{ marginTop: clampNumber(resolvedHeight * 0.06, 6, 14) }}>
            <div
              className="mb-1.5 flex items-center justify-between font-semibold text-[#d7f8e9]"
              style={{ fontSize: statFontSize, marginBottom: clampNumber(resolvedHeight * 0.01, 3, 6) }}
            >
              <span>{hpMax}/{hpMax} ({armor})</span>
              {showAbilityName ? (
                <span style={{ fontSize: microFontSize }} className="text-[#ffe08a]">
                  {abilityName}
                </span>
              ) : null}
            </div>
            <div
              className="overflow-hidden rounded-full border border-[#ffe08a]/55 bg-[#24352e]/90 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.04)]"
              style={{ height: hpBarHeight }}
            >
              <div
                className="h-full rounded-full bg-[linear-gradient(90deg,rgba(250,232,122,0.95),rgba(196,255,176,0.9))]"
                style={{ width: '100%' }}
              />
            </div>
          </div>
        ) : null}
        <div className="relative flex flex-1 flex-col items-center justify-center">
          <div
            className="font-black leading-none text-white drop-shadow-[0_0_16px_rgba(255,255,255,0.12)]"
            style={{ fontSize: valueFontSize }}
          >
            {rankLabel(card.rank)}
          </div>
          <div
            className="mt-2 rounded-full border border-white/14 bg-black/28 font-semibold tracking-[0.08em] text-white/82"
            style={{
              fontSize: chipFontSize,
              padding: `${chipPaddingY}px ${chipPaddingX}px`,
            }}
          >
            +{card.tableauCharge}
          </div>
        </div>
        {showApBar ? (
          <div className="relative mt-auto">
            <AbilityApBar
              ap={card.tableauCharge}
              maxAp={apCap}
              barClassName={`${resolvedContentMode === 'compact' ? 'h-[7px]' : 'h-[9px]'} rounded-[3px]`}
            />
          </div>
        ) : null}
      </div>
      {roleLabel ? (
        <div className="rounded-full border border-white/10 bg-black/42 px-2 py-1 text-[7px] font-black uppercase tracking-[0.12em] text-white/82">
          {roleLabel}
        </div>
      ) : null}
    </button>
  );
};

const PartyBoard = ({
  actorName,
  side,
  onClick,
  buttonRef,
  highlighted = false,
  dimmed = false,
  mobile = false,
  scale = 1,
  widthOverride,
  heightOverride,
  labelOverride,
  trayChildren,
  trayFooter,
}: {
  actorName: string;
  side: ChargeUpActorSide;
  onClick?: () => void;
  buttonRef?: React.Ref<HTMLDivElement>;
  highlighted?: boolean;
  dimmed?: boolean;
  mobile?: boolean;
  scale?: number;
  widthOverride?: number;
  heightOverride?: number;
  labelOverride?: string;
  trayChildren?: React.ReactNode;
  trayFooter?: React.ReactNode;
}) => {
  const width = widthOverride ?? ((mobile ? 90 : 94) * scale);
  const height = heightOverride ?? (trayChildren ? (mobile ? 170 : 194) : ((mobile ? 78 : 88) * scale));
  const mirrored = side === 'enemy';
  const outerEdgePadding = mobile ? 18 : 22;
  const centerEdgePadding = mobile ? 18 : 22;

  return (
    <div
      ref={buttonRef}
      onClick={onClick}
      aria-label={labelOverride ?? actorName}
      className={`relative shrink-0 text-left transition ${
        onClick ? 'cursor-pointer' : 'cursor-default'
      }`}
      style={{
        width,
        height,
        filter: dimmed && !highlighted ? 'saturate(0.58) brightness(0.72)' : undefined,
        opacity: dimmed && !highlighted ? 0.72 : 1,
      }}
    >
      {trayChildren ? (
        <div
          className={`relative flex h-full items-center py-2 ${mirrored ? '' : ''}`}
          style={{
            paddingLeft: mirrored ? centerEdgePadding : outerEdgePadding,
            paddingRight: mirrored ? outerEdgePadding : centerEdgePadding,
          }}
          onClick={(event) => event.stopPropagation()}
        >
          <div className={`relative flex w-full items-end gap-3 ${mirrored ? 'justify-start' : 'justify-end'}`}>
            <div className={`flex items-end gap-3 ${mirrored ? 'mr-auto' : 'ml-auto'}`}>
              {trayChildren}
            </div>
          </div>
        </div>
      ) : null}
      {trayFooter ? (
        <div className="shrink-0 pb-1 pt-2 min-w-0" onClick={(event) => event.stopPropagation()}>
          {trayFooter}
        </div>
      ) : null}
    </div>
  );
};

const KinHandRewardModalShell = ({
  title,
  subtitle,
  onClose,
  children,
}: {
  title: string;
  subtitle?: string;
  onClose: () => void;
  children: React.ReactNode;
}) => (
  <div className="pointer-events-none absolute inset-0 z-[80] flex items-center justify-center bg-[rgba(0,0,0,0.46)] px-4">
    <button type="button" aria-label="Close reward modal" className="absolute inset-0 pointer-events-auto" onClick={onClose} />
    <div className="pointer-events-auto relative max-h-[min(92vh,980px)] w-full max-w-[920px] overflow-y-auto rounded-[28px] border border-[#ffd166]/22 bg-[linear-gradient(180deg,rgba(9,10,14,0.97),rgba(4,5,8,0.94))] px-5 py-5 shadow-[0_30px_80px_rgba(0,0,0,0.55)]">
      <div className="text-[18px] font-black uppercase tracking-[0.18em] text-[#ffd166] [text-shadow:0_0_18px_rgba(255,209,102,0.28)] md:text-[24px]">
        {title}
      </div>
      {subtitle ? <div className="mt-2 text-[13px] leading-5 text-white/70">{subtitle}</div> : null}
      <div className="mt-4">{children}</div>
    </div>
  </div>
);

export function KinHandVariant() {
  const [state, setState] = useState<ChargeUpState>(() => createInitialState());
  const [currentTurn, setCurrentTurn] = useState<ChargeUpTurn>('player');
  const [autoPlayMode, setAutoPlayMode] = useState<ChargeUpAutoPlayMode>('off');
  const [simulationPaused, setSimulationPaused] = useState(false);
  const [dragAnim, setDragAnim] = useState<ChargeUpDragAnim | null>(null);
  const [abilityCallouts, setAbilityCallouts] = useState<AbilityCalloutEntry[]>([]);
  const [targetingState, setTargetingState] = useState<ChargeUpTargetingState | null>(null);
  const [orimPlacementState, setOrimPlacementState] = useState<KinHandOrimPlacementState | null>(null);
  const [rewardCalModalOpen, setRewardCalModalOpen] = useState(false);
  const [rewardTargetingOrimId, setRewardTargetingOrimId] = useState<string | null>(null);
  const [rewardPreviewState, setRewardPreviewState] = useState<KinHandRewardPreviewState | null>(null);
  const [cardEditorOpen, setCardEditorOpen] = useState(false);
  const [orchestratorCatalog, setOrchestratorCatalog] = useState<EditableKinHandCatalog>(() => toEditableKinHandCatalog());
  const [cardEditorSaveState, setCardEditorSaveState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [cardEditorSaveMessage, setCardEditorSaveMessage] = useState<string | null>(null);
  const [viewport, setViewport] = useState(() =>
    typeof window !== 'undefined'
      ? { width: window.innerWidth, height: window.innerHeight }
      : { width: 1280, height: 800 },
  );
  const [tableauPanelWidth, setTableauPanelWidth] = useState(0);
  const latestStateRef = useRef(state);
  const currentTurnRef = useRef<ChargeUpTurn>('player');
  const simulationPausedRef = useRef(false);
  const tableauPanelRef = useRef<HTMLDivElement | null>(null);
  const playerFoundationTargetRef = useRef<HTMLElement | null>(null);
  const enemyFoundationTargetRef = useRef<HTMLElement | null>(null);
  const playerActorBoardRef = useRef<HTMLDivElement | null>(null);
  const enemyActorBoardRef = useRef<HTMLDivElement | null>(null);
  const enemyFoundationActorRef = useRef<HTMLElement | null>(null);
  const playerChargerRefs = useRef<Record<string, HTMLElement | null>>({});
  const supportCardRefs = useRef<Record<string, HTMLElement | null>>({});
  const tableauTopRefs = useRef<Record<number, HTMLDivElement | null>>({});
  const playerAutoTimeoutRef = useRef<number | null>(null);
  const enemyAiTimeoutRef = useRef<number | null>(null);
  const playerAutoRunIdRef = useRef(0);
  const playerActionRunIdRef = useRef(0);
  const enemyTurnRunIdRef = useRef(0);
  const autoplayPassCountRef = useRef(0);
  const enemyDragNodeRef = useRef<HTMLDivElement | null>(null);
  const enemyDragRafRef = useRef(0);
  const enemyDragTimeoutRef = useRef(0);
  const enemyDragCompletionRef = useRef<(() => void) | null>(null);
  const abilityCalloutTimeoutsRef = useRef<number[]>([]);
  const abilityProgressRef = useRef<{ player: AbilityProgressSnapshot | null; enemy: AbilityProgressSnapshot | null }>({
    player: null,
    enemy: null,
  });
  const dragActiveRef = useRef(false);
  const enemyDragSequenceIdRef = useRef(0);
  const isPortraitMobile = viewport.width < 768 && viewport.width <= viewport.height;
  const isLandscapeMobile = viewport.width <= 1024 && viewport.width > viewport.height;
  const isCompactViewport = isPortraitMobile || isLandscapeMobile;
  const isShortDesktop = !isCompactViewport && viewport.height < 880;
  const isMobileCardScale = isCompactViewport;
  const foundationCompact = isCompactViewport;
  const foundationBaseCardWidth = foundationCompact ? 88 : 118;
  const foundationBaseCardHeight = foundationCompact ? 136 : 182;
  const foundationGap = foundationCompact ? 16 : 28;
  const supportGap = Math.max(8, Math.round(foundationGap / 2));
  const playerChargerCards = useMemo(
    () => [...state.playerChargers].sort((left, right) => {
      const actorOrder = ['Jet', 'Banks', 'Mochi', 'Hero'];
      return actorOrder.indexOf(left.actorName) - actorOrder.indexOf(right.actorName);
    }),
    [state.playerChargers],
  );
  const lowerLaneWidth = Math.min(1500, viewport.width - (isCompactViewport ? 24 : 48));
  const supportBaseCardWidth = foundationCompact ? 88 : 118;
  const supportBaseCardHeight = foundationCompact ? 136 : 182;
  const supportCount = Math.max(1, state.hand.length);
  const portraitSupportWidth = Math.max(0, lowerLaneWidth - 16);
  const nonPortraitSupportWidth = Math.max(0, Math.floor((lowerLaneWidth / 2) - foundationBaseCardWidth - (foundationGap * 1.5)));
  const supportAvailableWidth = isPortraitMobile ? portraitSupportWidth : nonPortraitSupportWidth;
  const supportRawWidth = Math.floor(
    (supportAvailableWidth - (supportGap * Math.max(0, supportCount - 1))) / supportCount,
  );
  const supportCardWidth = clampNumber(
    supportRawWidth,
    foundationCompact ? 48 : 52,
    supportBaseCardWidth,
  );
  const supportCardHeight = Math.round((supportBaseCardHeight / supportBaseCardWidth) * supportCardWidth);
  const foundationCardWidth = Math.round(supportCardWidth * 1.2);
  const foundationCardHeight = Math.round(supportCardHeight * 1.2);
  const handFloatAmplitude = foundationCompact ? 8 : 10;
  const handRowGap = clampNumber(Math.round(supportCardWidth * 0.16), 8, foundationCompact ? 12 : 16);
  const handRailPaddingX = Math.max(18, Math.round(supportCardWidth * 0.3));
  const handRailWidth = Math.max(
    supportCardWidth,
    (state.hand.length * supportCardWidth) + (Math.max(0, state.hand.length - 1) * handRowGap),
  );
  const handRailCanvasWidth = handRailWidth + (handRailPaddingX * 2);
  const handRailHeight = supportCardHeight + (handFloatAmplitude * 2);
  const handMaxOverlayWidth = Math.max(260, viewport.width - (isCompactViewport ? 20 : 56));
  const handOverlayScale = Math.min(1, handMaxOverlayWidth / Math.max(handRailCanvasWidth, 1));
  const handBottomSafeInset = isCompactViewport ? 18 : 24;
  const handBottomOverlayHeight = Math.ceil((handRailHeight * handOverlayScale) + handBottomSafeInset);
  const supportContentMode = supportCardWidth <= (foundationCompact ? 58 : 72)
    ? 'minimal'
    : supportCardWidth <= (foundationCompact ? 74 : 92)
      ? 'compact'
      : 'full';
  const tableauColumnsPerRow = TABLEAU_COLUMNS;
  const tableauRowCount = Math.ceil(TABLEAU_COLUMNS / tableauColumnsPerRow);
  const tableauVisibleRowCount = isCompactViewport ? 2 : isShortDesktop ? 3 : TABLEAU_ROWS;
  const tableauPanelPaddingTop = isCompactViewport ? 42 : isShortDesktop ? 22 : 30;
  const tableauPanelPaddingX = isCompactViewport ? 6 : 20;
  const tableauPanelInnerWidth = Math.max(
    0,
    (tableauPanelWidth || (viewport.width - (isCompactViewport ? 24 : 48))) - (tableauPanelPaddingX * 2),
  );
  const tableauTargetColumnWidth = tableauPanelInnerWidth > 0
    ? ((tableauPanelInnerWidth * (isCompactViewport ? 0.98 : 0.75)) / tableauColumnsPerRow)
    : (isMobileCardScale ? 48 : 102);
  const tableauMinGap = isCompactViewport ? 2 : 10;
  const tableauMaxGap = isCompactViewport ? 8 : 24;
  const tableauMaxWidthToFit = (tableauPanelInnerWidth - (tableauMinGap * Math.max(0, tableauColumnsPerRow - 1))) / tableauColumnsPerRow;
  const tableauMinWidth = isCompactViewport ? 28 : 80;
  const tableauMaxWidthByHeight = Math.floor(supportCardHeight / TABLEAU_CARD_ASPECT_RATIO);
  const tableauMaxWidth = Math.max(
    tableauMinWidth,
    Math.min(
      isCompactViewport ? 52 : isShortDesktop ? 152 : 176,
      tableauMaxWidthByHeight,
    ),
  );
  const tableauColumnWidth = Math.max(
    tableauMinWidth,
    Math.floor(
      clampNumber(
        Math.min(tableauTargetColumnWidth, tableauMaxWidthToFit, tableauMaxWidth),
        tableauMinWidth,
        tableauMaxWidth,
      ),
    ),
  );
  const tableauFrontHeight = Math.min(
    supportCardHeight,
    Math.round(tableauColumnWidth * TABLEAU_CARD_ASPECT_RATIO),
  );
  const tableauBackHeight = Math.round(tableauFrontHeight * TABLEAU_BACK_HEIGHT_RATIO);
  const tableauDragCardWidth = Math.max(38, tableauColumnWidth);
  const tableauDragCardHeight = Math.max(56, tableauFrontHeight);
  const tableauDragCardSize = {
    width: Math.max(24, tableauDragCardWidth - 4),
    height: Math.max(36, tableauDragCardHeight - 4),
  };
  const tableauOffset = Math.round(tableauFrontHeight * (isCompactViewport ? 0.23 : isShortDesktop ? 0.31 : TABLEAU_STACK_OFFSET / 144));
  const tableauColumnHeight = tableauFrontHeight + (Math.max(0, tableauVisibleRowCount - 1) * tableauOffset);
  const tableauRowGap = isCompactViewport ? 0 : 0;
  const tableauGridHeight = (tableauColumnHeight * tableauRowCount) + (Math.max(0, tableauRowCount - 1) * tableauRowGap);
  const tableauGap = clampNumber(
    Math.floor((tableauPanelInnerWidth - (tableauColumnWidth * tableauColumnsPerRow)) / (tableauColumnsPerRow + 1)),
    tableauMinGap,
    tableauMaxGap,
  );
  const visibleCardsByColumn = useMemo(
    () => state.tableau.map((column) => {
      const startIndex = Math.max(0, column.length - tableauVisibleRowCount);
      return column.slice(startIndex).map((card, offset) => ({
        card,
        columnCardIndex: startIndex + offset,
      }));
    }),
    [state.tableau, tableauVisibleRowCount],
  );

  const playerFoundationTop = useMemo(
    () => state.playerFoundation[state.playerFoundation.length - 1] ?? null,
    [state.playerFoundation],
  );
  const enemyFoundationTop = useMemo(
    () => state.enemyFoundation[state.enemyFoundation.length - 1] ?? null,
    [state.enemyFoundation],
  );
  const playerFoundationAbilityCard = useMemo(
    () => (
      playerFoundationTop
        ? resolveMegaHandAbilityCard({
            actorName: playerFoundationTop.actorName,
            currentAp: playerFoundationTop.tableauCharge,
            currentEnergyCost: getCardActivationEnergyCost(playerFoundationTop),
            liveGolfValue: getChargeUpRuleRank(playerFoundationTop) ?? playerFoundationTop.rank,
            foundationCardId: playerFoundationTop.id,
            abilityOverride: playerFoundationTop.megahandAbility,
            currentRarity: playerFoundationTop.currentRarity,
          })
        : null
    ),
    [playerFoundationTop],
  );
  const enemyFoundationAbilityCard = useMemo(
    () => (
      enemyFoundationTop
        ? resolveMegaHandAbilityCard({
            actorName: enemyFoundationTop.actorName,
            currentAp: enemyFoundationTop.tableauCharge,
            currentEnergyCost: getCardActivationEnergyCost(enemyFoundationTop),
            liveGolfValue: getChargeUpRuleRank(enemyFoundationTop) ?? enemyFoundationTop.rank,
            foundationCardId: enemyFoundationTop.id,
            abilityOverride: enemyFoundationTop.megahandAbility,
            currentRarity: enemyFoundationTop.currentRarity,
          })
        : null
    ),
    [enemyFoundationTop],
  );
  const heroCombatant = state.combatants.hero ?? createMegaHandCombatant('Hero');
  const mochiCombatant = state.combatants.mochi ?? createMegaHandCombatant('Mochi');
  const banksCombatant = state.combatants.banks ?? createMegaHandCombatant('Banks');
  const jetCombatant = state.combatants.jet ?? createMegaHandCombatant('Jet');
  const lesserShadeCombatant = state.combatants['lesser-shade'] ?? createMegaHandCombatant('Lesser Shade');
  const rewardTargetingOrim = useMemo(
    () => (rewardTargetingOrimId ? getKinHandOrimDefinition(rewardTargetingOrimId) : null),
    [rewardTargetingOrimId],
  );
  const rewardPreviewOrim = useMemo(
    () => (rewardPreviewState ? getKinHandOrimDefinition(rewardPreviewState.orimId) : null),
    [rewardPreviewState],
  );
  const rewardPreviewActorCard = useMemo(() => {
    if (!rewardPreviewState) return null;
    return (
      state.playerChargers.find((card) => card.actorName === rewardPreviewState.actorName)
      ?? state.playerFoundation.find((card) => card.actorName === rewardPreviewState.actorName)
      ?? null
    );
  }, [rewardPreviewState, state.playerChargers, state.playerFoundation]);
  const rewardPreviewAssignments = useMemo(() => (
    rewardPreviewOrim && rewardPreviewState?.selectedSegment
      ? buildRewardPreviewAssignments(rewardPreviewOrim, rewardPreviewState.selectedSegment)
      : []
  ), [rewardPreviewOrim, rewardPreviewState]);
  const rewardPreviewAbilities = useMemo(() => {
    if (!rewardPreviewActorCard) return [];
    const nextAppliedOrims = [
      ...(rewardPreviewActorCard.kinhandAppliedOrims ?? []).filter((entry) => entry.orimId !== rewardPreviewOrim?.id),
      ...rewardPreviewAssignments,
    ];
    const previewAp = rewardPreviewState?.selectedSegment ?? rewardPreviewActorCard.tableauCharge;
    return getActorRuntimeAbilities(
      rewardPreviewActorCard.actorName,
      rewardPreviewActorCard.megahandAbility,
      nextAppliedOrims,
      previewAp,
    );
  }, [rewardPreviewActorCard, rewardPreviewAssignments, rewardPreviewOrim?.id, rewardPreviewState]);
  const rewardPreviewResolvedCards = useMemo(() => {
    const selectedSegment = rewardPreviewState?.selectedSegment;
    if (!rewardPreviewActorCard || selectedSegment === null || selectedSegment === undefined) return [];
    const activeAbilities = rewardPreviewAbilities.filter((ability) => (
      (ability.abilityRanges ?? []).some((range) => kinhandAbilityRangeHelpers.rangeIncludesAp(range, selectedSegment))
    ));
    const baseAbility = activeAbilities.find((ability) => ability.kinhandKind === 'actor-basic') ?? activeAbilities[0] ?? null;
    const grantedDamageSummary = activeAbilities
      .filter((ability) => ability !== baseAbility)
      .map((ability) => describeAbilityDamage(ability))
      .filter(Boolean)
      .join(' + ');

    const mergedBaseCards = baseAbility ? [resolveMegaHandAbilityCard({
      actorName: rewardPreviewActorCard.actorName,
      currentAp: selectedSegment,
      currentEnergyCost: baseAbility.energyCost,
      liveGolfValue: rewardPreviewActorCard.rank,
      foundationCardId: `reward-preview:${rewardPreviewActorCard.actorName}:${baseAbility.name}:merged`,
      abilityOverride: {
        ...baseAbility,
        abilityDescription: grantedDamageSummary
          ? `${baseAbility.abilityDescription ?? baseAbility.description} + ${grantedDamageSummary}`
          : (baseAbility.abilityDescription ?? baseAbility.description),
        description: grantedDamageSummary
          ? `${baseAbility.abilityDescription ?? baseAbility.description} + ${grantedDamageSummary}`
          : (baseAbility.abilityDescription ?? baseAbility.description),
      },
      currentRarity: baseAbility.rarity ?? 'common',
    })] : [];

    const grantedCards = activeAbilities
      .filter((ability) => ability !== baseAbility)
      .map((ability) => {
      const damageSummary = describeAbilityDamage(ability);
      return resolveMegaHandAbilityCard({
        actorName: rewardPreviewActorCard.actorName,
        currentAp: selectedSegment,
        currentEnergyCost: ability.energyCost,
        liveGolfValue: rewardPreviewActorCard.rank,
        foundationCardId: `reward-preview:${rewardPreviewActorCard.actorName}:${ability.name}`,
        abilityOverride: {
          ...ability,
          abilityDescription: damageSummary && ability.ownerName === rewardPreviewActorCard.actorName
            ? `${ability.abilityDescription ?? ability.description} + ${damageSummary}`
            : (ability.abilityDescription ?? ability.description),
          description: damageSummary && ability.ownerName === rewardPreviewActorCard.actorName
            ? `${ability.abilityDescription ?? ability.description} + ${damageSummary}`
            : (ability.abilityDescription ?? ability.description),
        },
        currentRarity: ability.rarity ?? 'common',
      });
    });
    return [...mergedBaseCards, ...grantedCards];
  }, [rewardPreviewAbilities, rewardPreviewActorCard, rewardPreviewState]);
  const calRewardAbilityCard = useMemo(() => {
    const cal = getKinHandOrimDefinition('cal');
    if (!cal) return null;
    return resolveMegaHandAbilityCard({
      actorName: cal.orimAbility.ownerName,
      currentAp: cal.orimAbility.maxAp,
      currentEnergyCost: cal.orimAbility.energyCost,
      liveGolfValue: cal.orimAbility.golfValue,
      foundationCardId: 'reward:cal',
      abilityOverride: {
        ...cal.orimAbility,
        abilityDescription: `${cal.grantedAbilities.map((entry) => entry.ability.name).join(' + ')}`,
        description: `${cal.grantedAbilities.map((entry) => entry.ability.name).join(' + ')}`,
      },
      currentRarity: cal.orimAbility.rarity ?? 'common',
    });
  }, []);
  const rewardPreviewOrimCard = useMemo(() => {
    if (!rewardPreviewOrim) return null;
    const selectedSegment = rewardPreviewState?.selectedSegment;
    const summary = rewardPreviewOrim.grantedAbilities.map((entry) => (
      entry.placement === 'passive'
        ? `${entry.ability.name} passive`
        : `${entry.ability.name}${selectedSegment ? ` @ ${selectedSegment}` : ''}`
    )).join(' + ');
    return resolveMegaHandAbilityCard({
      actorName: rewardPreviewOrim.orimAbility.ownerName,
      currentAp: rewardPreviewOrim.orimAbility.maxAp,
      currentEnergyCost: rewardPreviewOrim.orimAbility.energyCost,
      liveGolfValue: rewardPreviewOrim.orimAbility.golfValue,
      foundationCardId: `reward-preview:${rewardPreviewOrim.id}`,
      abilityOverride: {
        ...rewardPreviewOrim.orimAbility,
        abilityDescription: summary,
        description: summary,
      },
      currentRarity: rewardPreviewOrim.orimAbility.rarity ?? 'common',
    });
  }, [rewardPreviewOrim, rewardPreviewState?.selectedSegment]);
  const targetingContext = useMemo(() => {
    if (!targetingState) return null;

    const sourceCard = targetingState.source === 'foundation'
      ? (playerFoundationTop?.id === targetingState.cardId ? playerFoundationTop : null)
      : (state.hand.find((card) => card.id === targetingState.cardId) ?? null);
    if (!sourceCard) return null;

    const resolvedAbility = resolveMegaHandAbilityCard({
      actorName: sourceCard.actorName,
      currentAp: sourceCard.tableauCharge,
      currentEnergyCost: getCardActivationEnergyCost(sourceCard),
      liveGolfValue: getChargeUpRuleRank(sourceCard) ?? sourceCard.rank,
      foundationCardId: sourceCard.id,
      abilityOverride: sourceCard.megahandAbility,
      currentRarity: sourceCard.currentRarity,
    });
    if (!resolvedAbility.ready) return null;

    const canTargetPrime = false;
    const isHeroTackle = resolvedAbility.ownerName === 'Hero' && resolvedAbility.name === 'Tackle';
    const isHeroFetch = resolvedAbility.ownerName === 'Hero' && resolvedAbility.name === 'Fetch';
    const isMochiHealingPurr = resolvedAbility.ownerName === 'Mochi' && resolvedAbility.name === 'Healing Purr';
    const isMochiCatNap = resolvedAbility.ownerName === 'Mochi' && resolvedAbility.name === 'Cat Nap';
    const isMochiProwl = resolvedAbility.ownerName === 'Mochi' && resolvedAbility.name === 'Prowl';
    const isOrimCard = resolvedAbility.kinhandKind === 'orim-card';

    if (isHeroTackle) {
      return {
        ...targetingState,
        card: sourceCard,
        abilityCard: resolvedAbility,
        canTargetPrime: false,
        canTargetTableau: false,
        canTargetPlayerBoard: false,
        canTargetEnemyBoard: true,
      };
    }

    if (isHeroFetch) {
      return {
        ...targetingState,
        card: sourceCard,
        abilityCard: resolvedAbility,
        canTargetPrime: false,
        canTargetTableau: false,
        canTargetPlayerBoard: state.discard.length > 0,
        canTargetEnemyBoard: enemyFoundationTop !== null,
      };
    }

    if (isMochiHealingPurr) {
      return {
        ...targetingState,
        card: sourceCard,
        abilityCard: resolvedAbility,
        canTargetPrime: false,
        canTargetTableau: false,
        canTargetPlayerBoard: true,
        canTargetEnemyBoard: false,
      };
    }

    if (isMochiCatNap || isMochiProwl) {
      return {
        ...targetingState,
        card: sourceCard,
        abilityCard: resolvedAbility,
        canTargetPrime: false,
        canTargetTableau: false,
        canTargetPlayerBoard: true,
        canTargetEnemyBoard: false,
      };
    }

    if (isOrimCard) {
      return {
        ...targetingState,
        card: sourceCard,
        abilityCard: resolvedAbility,
        canTargetPrime: false,
        canTargetTableau: false,
        canTargetPlayerBoard: resolvedAbility.kinhandTarget === 'player-actor' || resolvedAbility.kinhandTarget === 'any-actor',
        canTargetEnemyBoard: resolvedAbility.kinhandTarget === 'enemy-actor' || resolvedAbility.kinhandTarget === 'any-actor',
      };
    }

    return {
      ...targetingState,
      card: sourceCard,
      abilityCard: resolvedAbility,
      canTargetPrime,
      canTargetTableau: false,
      canTargetPlayerBoard: true,
      canTargetEnemyBoard: true,
    };
  }, [enemyFoundationTop, playerFoundationTop, state.discard.length, state.hand, targetingState]);
  const targetingActive = targetingContext !== null;
  const placementOrim = useMemo(
    () => (orimPlacementState ? getKinHandOrimDefinition(orimPlacementState.orimId) : null),
    [orimPlacementState],
  );
  const placementGrantedAbility = useMemo(() => {
    if (!placementOrim || !orimPlacementState) return null;
    const nextId = orimPlacementState.remainingGrantedAbilityIds[0];
    return placementOrim.grantedAbilities.find((entry) => entry.id === nextId) ?? null;
  }, [orimPlacementState, placementOrim]);
  const placementActive = orimPlacementState !== null && placementGrantedAbility !== null;
  const getCombatantForActor = useCallback((actorName: string) => {
    const key = getMegaHandCombatantKey(actorName);
    return key ? state.combatants[key] ?? null : null;
  }, [state.combatants]);
  const isEnemySingleTargetingPlayer = (
    !!targetingContext
    && targetingContext.abilityCard.side === 'enemy'
    && targetingContext.canTargetPlayerBoard
  );
  const canTargetPlayerActorBoard = useCallback((actorName: string) => {
    if (!targetingContext?.canTargetPlayerBoard) return false;
    if (targetingContext.abilityCard.ownerName === 'Mochi' && (targetingContext.abilityCard.name === 'Cat Nap' || targetingContext.abilityCard.name === 'Prowl')) {
      return actorName === 'Mochi';
    }
    if (isEnemySingleTargetingPlayer && getCombatantForActor(actorName)?.prowlActive) {
      return false;
    }
    return true;
  }, [getCombatantForActor, isEnemySingleTargetingPlayer, targetingContext]);
  const rewardTargetingActive = rewardTargetingOrim !== null;
  const playerBoardHighlighted = (targetingContext?.canTargetPlayerBoard ?? false) || rewardTargetingActive;
  const enemyBoardHighlighted = targetingContext?.canTargetEnemyBoard ?? false;
  const primeTargetHighlighted = targetingContext?.canTargetPrime ?? false;

  const clearPlayerAutoTimeout = useCallback(() => {
    if (playerAutoTimeoutRef.current !== null) {
      window.clearTimeout(playerAutoTimeoutRef.current);
      playerAutoTimeoutRef.current = null;
    }
  }, []);

  const clearEnemyAiTimeout = useCallback(() => {
    if (enemyAiTimeoutRef.current !== null) {
      window.clearTimeout(enemyAiTimeoutRef.current);
      enemyAiTimeoutRef.current = null;
    }
  }, []);

  const clearDragAnimation = useCallback(() => {
    dragActiveRef.current = false;
    if (enemyDragRafRef.current) {
      window.cancelAnimationFrame(enemyDragRafRef.current);
      enemyDragRafRef.current = 0;
    }
    if (enemyDragTimeoutRef.current) {
      window.clearTimeout(enemyDragTimeoutRef.current);
      enemyDragTimeoutRef.current = 0;
    }
    const complete = enemyDragCompletionRef.current;
    enemyDragCompletionRef.current = null;
    setDragAnim(null);
    complete?.();
  }, []);

  const playDragAnimation = useCallback((anim: ChargeUpDragAnim) => {
    return new Promise<void>((resolve) => {
      dragActiveRef.current = true;
      enemyDragCompletionRef.current = resolve;
      setDragAnim(anim);
    });
  }, []);

  const animateChargeUpAction = useCallback(async (
    state: ChargeUpState,
    action: ChargeUpAutoAction,
  ) => {
    let card: LocalCard | null = null;
    let from: { x: number; y: number } | null = null;
    let to: { x: number; y: number } | null = null;
    let actor: ChargeUpActorSide = 'player';
    let presentation: ChargeUpDragAnim['presentation'] = 'tableau';

    if (action.type === 'hand') {
      card = state.hand.find((entry) => entry.id === action.cardId) ?? null;
      from = getChargeUpPointerAnchorPoint(supportCardRefs.current[action.cardId]);
      to = getChargeUpPointerAnchorPoint(playerFoundationTargetRef.current);
      actor = 'player';
      presentation = 'actor';
    } else if (action.type === 'actor') {
      card = state.playerChargers.find((entry) => entry.id === action.actorCardId) ?? null;
      from = getChargeUpPointerAnchorPoint(playerChargerRefs.current[action.actorCardId]);
      to = getChargeUpPointerAnchorPoint(playerFoundationTargetRef.current);
      actor = 'player';
      presentation = 'actor';
    } else {
      card = state.tableau[action.columnIndex]?.[action.columnCardIndex] ?? null;
      from = getChargeUpPointerAnchorPoint(tableauTopRefs.current[action.columnIndex]);
      to = getChargeUpPointerAnchorPoint(
        action.actor === 'player'
          ? playerFoundationTargetRef.current
          : enemyFoundationTargetRef.current,
      );
      actor = action.actor;
      presentation = 'tableau';
    }

    if (!card) return;
    if (!from || !to) {
      await new Promise<void>((resolve) => {
        window.setTimeout(resolve, CHARGE_UP_ENEMY_STEP_MS);
      });
      return;
    }

    enemyDragSequenceIdRef.current += 1;
    await playDragAnimation({
      id: enemyDragSequenceIdRef.current,
      card,
      actor,
      presentation,
      from,
      to,
      durationMs: getChargeUpEnemyDragDurationMs(from, to),
    });
  }, [playDragAnimation]);

  const applyStateUpdate = useCallback((updater: (prev: ChargeUpState) => ChargeUpState) => {
    const next = updater(latestStateRef.current);
    latestStateRef.current = next;
    setState(next);
    return next;
  }, []);

  const clearAbilityCallouts = useCallback(() => {
    abilityCalloutTimeoutsRef.current.forEach((timeoutId) => window.clearTimeout(timeoutId));
    abilityCalloutTimeoutsRef.current = [];
    setAbilityCallouts([]);
  }, []);

  const queueAbilityCallout = useCallback((text: string, subtitle?: string, anchor?: { x: number; y: number }) => {
    const id = Date.now() + Math.floor(Math.random() * 1000);
    setAbilityCallouts((prev) => [...prev, { id, text, subtitle, anchor }]);
    const timeoutId = window.setTimeout(() => {
      setAbilityCallouts((prev) => prev.filter((entry) => entry.id !== id));
      abilityCalloutTimeoutsRef.current = abilityCalloutTimeoutsRef.current.filter((entry) => entry !== timeoutId);
    }, 2200);
    abilityCalloutTimeoutsRef.current.push(timeoutId);
  }, []);

  const spawnAbilitiesFromActorCard = useCallback((actorCardId: string) => {
    if (currentTurnRef.current !== 'player' || autoPlayMode !== 'off' || dragActiveRef.current || targetingActive) return;
    let spawnedNames: string[] = [];
    let calloutAnchor: { x: number; y: number } | undefined;

    applyStateUpdate((prev) => {
      const actorIndex = prev.playerChargers.findIndex((card) => card.id === actorCardId);
      if (actorIndex < 0) return prev;
      const actorCard = prev.playerChargers[actorIndex];
      if (!actorCard || isActorAsleep(prev, actorCard.actorName)) return prev;

      const activeAbilities = getKinHandSpawnableAbilities(actorCard);
      if (activeAbilities.length === 0) return prev;

      const spawnedCards = activeAbilities.map((ability) => ({
        ...createMegaHandAbilityCard(ability, 'kinhand-spawn'),
        tableauCharge: ability.maxAp,
        currentRarity: actorCard.currentRarity ?? ability.rarity ?? 'common',
        spawnedFromActor: true,
      }));
      const normalized = enforceSingleTackleInHand([...prev.hand, ...spawnedCards], prev.handDeck);
      spawnedNames = activeAbilities.map((ability) => ability.name);
      calloutAnchor = getChargeUpCalloutAnchorPoint(playerChargerRefs.current[actorCard.id]);

      return {
        ...prev,
        hand: normalized.hand,
        handDeck: normalized.handDeck,
        playerChargers: prev.playerChargers.map((card, index) => (
          index === actorIndex
            ? { ...card, tableauCharge: 0 }
            : card
        )),
      };
    });

    if (spawnedNames.length > 0) {
      queueAbilityCallout(
        spawnedNames.length > 1 ? `${spawnedNames.length} abilities prepared` : `${spawnedNames[0]} prepared`,
        spawnedNames.join(' + '),
        calloutAnchor,
      );
    }
  }, [applyStateUpdate, autoPlayMode, queueAbilityCallout, targetingActive]);

  const spawnAbilitiesFromPlayerPrimeActorCard = useCallback((actorCardId: string) => {
    if (currentTurnRef.current !== 'player' || autoPlayMode !== 'off' || dragActiveRef.current || targetingActive) return;
    let spawnedNames: string[] = [];
    let calloutAnchor: { x: number; y: number } | undefined;

    applyStateUpdate((prev) => {
      const foundationTop = getChargeUpFoundationTop(prev.playerFoundation);
      if (!foundationTop || foundationTop.id !== actorCardId || !foundationTop.kinhandActorCard) return prev;
      if (isActorAsleep(prev, foundationTop.actorName)) return prev;

      const activeAbilities = getKinHandSpawnableAbilities(foundationTop);
      if (activeAbilities.length === 0) return prev;

      const spawnedCards = activeAbilities.map((ability) => ({
        ...createMegaHandAbilityCard(ability, 'kinhand-spawn'),
        tableauCharge: ability.maxAp,
        currentRarity: foundationTop.currentRarity ?? ability.rarity ?? 'common',
        spawnedFromActor: true,
      }));
      const normalized = enforceSingleTackleInHand([...prev.hand, ...spawnedCards], prev.handDeck);
      spawnedNames = activeAbilities.map((ability) => ability.name);
      calloutAnchor = getChargeUpCalloutAnchorPoint(playerFoundationTargetRef.current);

      return {
        ...prev,
        hand: normalized.hand,
        handDeck: normalized.handDeck,
        playerFoundation: prev.playerFoundation.map((card) => (
          card.id === foundationTop.id
            ? { ...card, tableauCharge: 0 }
            : card
        )),
      };
    });

    if (spawnedNames.length > 0) {
      queueAbilityCallout(
        spawnedNames.length > 1 ? `${spawnedNames.length} abilities prepared` : `${spawnedNames[0]} prepared`,
        spawnedNames.join(' + '),
        calloutAnchor,
      );
    }
  }, [applyStateUpdate, autoPlayMode, queueAbilityCallout, targetingActive]);

  const movePlayerChargerCardToPrime = useCallback(async (actorCardId: string) => {
    if (currentTurnRef.current !== 'player' || autoPlayMode !== 'off' || dragActiveRef.current || targetingActive) return;
    const current = latestStateRef.current;
    const actorCard = current.playerChargers.find((card) => card.id === actorCardId) ?? null;
    if (!actorCard || !canMovePlayerChargerToPrime(current, actorCard)) return;

    playerActionRunIdRef.current += 1;
    const runId = playerActionRunIdRef.current;
    const sourcePoint = getChargeUpPointerAnchorPoint(playerChargerRefs.current[actorCardId]);
    const targetPoint = getChargeUpPointerAnchorPoint(playerFoundationTargetRef.current);
    if (sourcePoint && targetPoint) {
      enemyDragSequenceIdRef.current += 1;
      await playDragAnimation({
        id: enemyDragSequenceIdRef.current,
        card: actorCard,
        actor: 'player',
        presentation: 'actor',
        from: sourcePoint,
        to: targetPoint,
        durationMs: getChargeUpEnemyDragDurationMs(sourcePoint, targetPoint),
      });
      if (playerActionRunIdRef.current !== runId || currentTurnRef.current !== 'player') return;
    }

    const foundationTop = getChargeUpFoundationTop(current.playerFoundation);
    applyStateUpdate((prev) => movePlayerChargerToPrime(prev, actorCardId));
    queueAbilityCallout(
      foundationTop ? `${actorCard.actorName} benchswapped` : `${actorCard.actorName} moved to prime`,
      foundationTop ? `${actorCard.actorName} traded places with the current prime` : `${actorCard.actorName} is now in prime`,
      getChargeUpCalloutAnchorPoint(playerFoundationTargetRef.current),
    );
  }, [applyStateUpdate, autoPlayMode, playDragAnimation, queueAbilityCallout, targetingActive]);

  const cancelTargeting = useCallback(() => {
    setTargetingState(null);
  }, []);

  const selectChargedCard = useCallback((source: 'foundation' | 'hand', cardId: string) => {
    const current = latestStateRef.current;
    const sourceCard = source === 'foundation'
      ? (getChargeUpFoundationTop(current.playerFoundation)?.id === cardId ? getChargeUpFoundationTop(current.playerFoundation) : null)
      : (current.hand.find((card) => card.id === cardId) ?? null);
    if (sourceCard && isActorAsleep(current, sourceCard.megahandAbility?.ownerName ?? sourceCard.actorName)) {
      return;
    }
    setTargetingState((prev) => (
      prev && prev.source === source && prev.cardId === cardId
        ? null
        : { source, cardId }
    ));
  }, []);

  const applyTargetedAbility = useCallback((
    targetActorName: string,
    targetLabel: string,
    targetKind: ChargeUpTargetKind,
    anchor: { x: number; y: number } | undefined,
  ) => {
    if (!targetingContext) return;

    let effectCallout = {
      text: `${targetingContext.abilityCard.name} applied`,
      subtitle: `${targetLabel} · effect pending`,
    };
    let insufficientEnergy = false;
    let nextPlacementState: KinHandOrimPlacementState | null = null;
    let shouldConsumeCard = true;

    applyStateUpdate((prev) => {
      let nextState = prev;
      const ability = targetingContext.card.megahandAbility;
      const sourceKey = getAbilitySourceCombatantKey(ability ?? targetingContext.abilityCard);
      const targetKey = getMegaHandCombatantKey(targetActorName);
      const sourceCombatant = sourceKey ? nextState.combatants[sourceKey] : null;
      const prowlBonus = sourceCombatant?.prowlActive && ability?.name !== 'Prowl' ? 1 : 0;
      const effectivePower = Math.max(0, targetingContext.abilityCard.power + prowlBonus);
      const sourceSide = ability?.side ?? 'player';
      const activationEnergyCost = getCardActivationEnergyCost(targetingContext.card);
      const chargeEnergyOnUse = targetKind === 'actor';

      if (chargeEnergyOnUse && getActorEnergy(nextState, sourceSide) < activationEnergyCost) {
        insufficientEnergy = true;
        effectCallout = {
          text: `${ability?.name ?? 'Ability'} fizzled`,
          subtitle: `Need ${activationEnergyCost} Energy`,
        };
        return prev;
      }

      if (chargeEnergyOnUse && activationEnergyCost > 0) {
        nextState = sourceSide === 'player'
          ? {
              ...nextState,
              playerEnergy: Math.max(0, nextState.playerEnergy - activationEnergyCost),
            }
          : {
              ...nextState,
              enemyEnergy: Math.max(0, nextState.enemyEnergy - activationEnergyCost),
            };
      }

      if (
        ability
        && ability.kinhandKind === 'orim-card'
        && ability.kinhandOrimId
        && targetKind === 'actor'
      ) {
        const orim = getKinHandOrimDefinition(ability.kinhandOrimId);
        if (orim) {
          const passiveAssignments = buildAssignmentsForOrim(orim).filter((assignment) => assignment.passive);
          const segmentGrantedAbilityIds = orim.grantedAbilities
            .filter((grantedAbility) => grantedAbility.placement === 'segment')
            .map((grantedAbility) => grantedAbility.id);

          if (segmentGrantedAbilityIds.length > 0) {
            nextPlacementState = {
              source: targetingContext.source,
              cardId: targetingContext.cardId,
              orimId: orim.id,
              targetActorName,
              targetLabel,
              chosenAssignments: passiveAssignments,
              remainingGrantedAbilityIds: segmentGrantedAbilityIds,
              anchor,
            };
            shouldConsumeCard = false;
            effectCallout = {
              text: `${orim.orimAbility.name} ready to slot`,
              subtitle: `Choose an AP segment for ${orim.grantedAbilities.find((entry) => entry.id === segmentGrantedAbilityIds[0])?.ability.name ?? 'the granted ability'}`,
            };
          } else {
            nextState = applyOrimAssignmentsToActorInState(nextState, targetActorName, orim.id, passiveAssignments);
            effectCallout = {
              text: `${orim.orimAbility.name} equipped`,
              subtitle: `${targetLabel} · passive effect applied`,
            };
          }
        }
      }

      const targetSide: ChargeUpActorSide = targetActorName === 'Lesser Shade' ? 'enemy' : 'player';
      const damageProfile = ability ? getAbilityDamageProfile({
        ...ability,
        power: effectivePower,
      }, sourceSide, targetSide) : null;

      if (
        ability
        && targetKind === 'actor'
        && targetKey
        && sourceKey
        && ability.kinhandKind !== 'orim-card'
        && ability.name !== 'Fetch'
        && ability.name !== 'Healing Purr'
        && ability.name !== 'Cat Nap'
        && ability.name !== 'Prowl'
        && damageProfile
        && (damageProfile.physical > 0 || Object.values(damageProfile.elemental).some((value) => (value ?? 0) > 0))
      ) {
        const packet: DamagePacket = {
          physical: damageProfile.physical,
          elemental: damageProfile.elemental,
          deliberate: true,
          threshold: 1,
          source: sourceSide,
          sourceActor: sourceKey,
          targetActor: targetKey,
        };
        const resolved = resolveDamagePacket(nextState.combatants, packet, { supportAllyKeys: getCombatSupportAllyKeys(sourceSide) });
        const targetAfter = resolved.combatants[targetKey];
        nextState = {
          ...nextState,
          combatants: resolved.combatants,
        };
        effectCallout = resolved.dodged
          ? {
              text: `${ability.name} missed`,
              subtitle: `${targetLabel} dodged`,
            }
          : {
              text: `${ability.name} dealt ${resolved.damageDealt} dmg`,
              subtitle: `${targetLabel} · ${targetAfter.hp}/${targetAfter.hpMax} HP`,
            };
      }

      if (
        ability
        && ability.ownerName === 'Hero'
        && ability.name === 'Fetch'
      ) {
        if (targetActorName === 'Lesser Shade' && getChargeUpFoundationTop(prev.enemyFoundation)) {
          nextState = retrieveEnemyPrimeToHand(nextState);
          effectCallout = {
            text: 'Fetch stole the enemy card',
            subtitle: 'Enemy prime returned to your hand',
          };
        } else if (targetActorName !== 'Lesser Shade' && prev.discard.length > 0) {
          const retrieved = prev.discard[prev.discard.length - 1];
          nextState = retrieveLatestDiscardToHand(nextState);
          effectCallout = {
            text: 'Fetch recovered a discarded card',
            subtitle: `${retrieved?.megahandAbility?.name ?? retrieved?.actorName ?? 'Card'} returned to hand`,
          };
        }
      }

      if (
        ability
        && ability.ownerName === 'Mochi'
        && ability.name === 'Healing Purr'
        && targetActorName !== 'Lesser Shade'
      ) {
        const healAmount = effectivePower;
        const playerPartyKeys: MegaHandCombatantKey[] = ['hero', 'mochi', 'banks', 'jet'];
        const nextCombatants = { ...nextState.combatants };
        let totalHealed = 0;
        playerPartyKeys.forEach((key) => {
          const combatant = nextCombatants[key];
          if (!combatant) return;
          const healedHp = Math.min(combatant.hpMax, combatant.hp + healAmount);
          totalHealed += Math.max(0, healedHp - combatant.hp);
          nextCombatants[key] = {
            ...combatant,
            hp: healedHp,
          };
        });
        nextState = {
          ...nextState,
          combatants: nextCombatants,
        };
        effectCallout = {
          text: 'Healing Purr restored the party',
          subtitle: `All active ally boards healed +${healAmount}`,
        };
        if (totalHealed === 0) {
          effectCallout = {
            text: 'Healing Purr soothed the party',
            subtitle: 'All active ally boards were already at full HP',
          };
        }
      }

      if (
        ability
        && ability.ownerName === 'Mochi'
        && ability.name === 'Cat Nap'
        && sourceKey === 'mochi'
      ) {
        nextState = {
          ...nextState,
          combatants: {
            ...nextState.combatants,
            mochi: {
              ...nextState.combatants.mochi,
              asleepTurns: Math.max(1, ability.power),
              catNapActive: true,
            },
          },
        };
        effectCallout = {
          text: 'Cat Nap applied',
          subtitle: `Mochi is asleep for ${Math.max(1, ability.power)} turn${Math.max(1, ability.power) === 1 ? '' : 's'}`,
        };
      }

      if (
        ability
        && ability.ownerName === 'Mochi'
        && ability.name === 'Prowl'
        && sourceKey === 'mochi'
      ) {
        nextState = {
          ...nextState,
          combatants: {
            ...nextState.combatants,
            mochi: {
              ...nextState.combatants.mochi,
              prowlActive: true,
            },
          },
        };
        effectCallout = {
          text: 'Prowl applied',
          subtitle: 'Mochi is hidden and the next Mochi card gains +1 POW',
        };
      }

      if (prowlBonus > 0 && sourceKey) {
        nextState = {
          ...nextState,
          combatants: {
            ...nextState.combatants,
            [sourceKey]: {
              ...nextState.combatants[sourceKey],
              prowlActive: false,
            },
          },
        };
      }

      if (targetKind === 'tableau' || !shouldConsumeCard) {
        return nextState;
      }

      return targetingContext.source === 'foundation'
        ? consumeChargedFoundationCard(nextState, targetingContext.cardId)
        : consumeChargedHandCard(nextState, targetingContext.cardId);
    });

    queueAbilityCallout(
      effectCallout.text,
      effectCallout.subtitle,
      anchor,
    );
    if (!insufficientEnergy) {
      setTargetingState(null);
      setOrimPlacementState(nextPlacementState);
    }
  }, [applyStateUpdate, queueAbilityCallout, targetingContext]);

  const handleOrimPlacementSegment = useCallback((apValue: number) => {
    if (!orimPlacementState || !placementOrim || !placementGrantedAbility) return;
    const nextAssignment = buildSegmentAssignmentForGrantedAbility(
      placementOrim.id,
      placementGrantedAbility.id,
      apValue,
    );
    const nextAssignments = [...orimPlacementState.chosenAssignments, nextAssignment];
    const remainingGrantedAbilityIds = orimPlacementState.remainingGrantedAbilityIds.slice(1);

    if (remainingGrantedAbilityIds.length > 0) {
      setOrimPlacementState({
        ...orimPlacementState,
        chosenAssignments: nextAssignments,
        remainingGrantedAbilityIds,
      });
      queueAbilityCallout(
        `${placementGrantedAbility.ability.name} slotted`,
        `Choose an AP segment for ${placementOrim.grantedAbilities.find((entry) => entry.id === remainingGrantedAbilityIds[0])?.ability.name ?? 'the next granted ability'}`,
        orimPlacementState.anchor,
      );
      return;
    }

    applyStateUpdate((prev) => {
      const applied = applyOrimAssignmentsToActorInState(
        prev,
        orimPlacementState.targetActorName,
        placementOrim.id,
        nextAssignments,
      );
      return orimPlacementState.source === 'foundation'
        ? consumeChargedFoundationCard(applied, orimPlacementState.cardId)
        : consumeChargedHandCard(applied, orimPlacementState.cardId);
    });

    queueAbilityCallout(
      `${placementOrim.orimAbility.name} equipped`,
      `${orimPlacementState.targetLabel} · ${nextAssignments.map((assignment) => (
        assignment.passive
          ? `${placementOrim.grantedAbilities.find((entry) => entry.id === assignment.grantedAbilityId)?.ability.name ?? 'Passive'} passive`
          : `${placementOrim.grantedAbilities.find((entry) => entry.id === assignment.grantedAbilityId)?.ability.name ?? 'Ability'} @ ${assignment.apSegments?.join(', ') ?? assignment.startAp}`
      )).join(' + ')}`,
      orimPlacementState.anchor,
    );
    setOrimPlacementState(null);
  }, [applyStateUpdate, orimPlacementState, placementGrantedAbility, placementOrim, queueAbilityCallout]);

  const handleActorBoardTarget = useCallback((actorName: string, targetRef: HTMLElement | null) => {
    if (rewardTargetingOrim) {
      setRewardPreviewState({
        orimId: rewardTargetingOrim.id,
        actorName,
        selectedSegment: null,
      });
      setRewardTargetingOrimId(null);
      return;
    }
    if (!targetingContext) return;
    const isPlayerTarget = actorName !== 'Lesser Shade';
    const isValid = isPlayerTarget ? canTargetPlayerActorBoard(actorName) : targetingContext.canTargetEnemyBoard;
    if (!isValid) {
      setTargetingState(null);
      return;
    }
    applyTargetedAbility(actorName, actorName, 'actor', getChargeUpCalloutAnchorPoint(targetRef));
  }, [applyTargetedAbility, canTargetPlayerActorBoard, rewardTargetingOrim, targetingContext]);

  const handlePrimeTarget = useCallback(() => {
    if (!targetingContext || !targetingContext.canTargetPrime) {
      setTargetingState(null);
      return;
    }
    applyTargetedAbility('Hero', 'Prime', 'prime', getChargeUpCalloutAnchorPoint(playerFoundationTargetRef.current));
  }, [applyTargetedAbility, targetingContext]);

  const handleTableauTarget = useCallback((columnIndex: number, columnCardIndex: number) => {
    if (!targetingContext?.canTargetTableau || targetingContext.source !== 'foundation') {
      setTargetingState(null);
      return;
    }
    const current = latestStateRef.current;
    const column = current.tableau[columnIndex] ?? [];
    if (columnCardIndex !== column.length - 1) {
      setTargetingState(null);
      return;
    }
    const tableauCard = column[columnCardIndex] ?? null;
    if (!tableauCard || !getChargeUpFoundationTop(current.playerFoundation)) {
      setTargetingState(null);
      return;
    }

    applyStateUpdate((prev) => swapPlayerFoundationWithTableau(prev, columnIndex, columnCardIndex));
    queueAbilityCallout(
      `${targetingContext.abilityCard.name} swapped with tableau`,
      `${targetingContext.abilityCard.name} returned to the tableau`,
      getChargeUpCalloutAnchorPoint(tableauTopRefs.current[columnIndex]),
    );
    setTargetingState(null);
  }, [applyStateUpdate, queueAbilityCallout, targetingContext]);

  const applyRewardOrimToActor = useCallback(() => {
    if (!rewardPreviewState?.selectedSegment || !rewardPreviewOrim) return;
    const assignments = buildRewardPreviewAssignments(rewardPreviewOrim, rewardPreviewState.selectedSegment);
    applyStateUpdate((prev) => applyOrimAssignmentsToActorInState(
      prev,
      rewardPreviewState.actorName,
      rewardPreviewOrim.id,
      assignments,
    ));
    queueAbilityCallout(
      `${rewardPreviewOrim.orimAbility.name} equipped`,
      `${rewardPreviewState.actorName} · slotted on AP ${rewardPreviewState.selectedSegment}`,
      undefined,
    );
    setRewardPreviewState(null);
  }, [applyStateUpdate, queueAbilityCallout, rewardPreviewOrim, rewardPreviewState]);

  const saveOrchestratorCatalog = useCallback(async () => {
    setCardEditorSaveState('saving');
    setCardEditorSaveMessage(null);
    try {
      const content = kinHandOrchestratorHelpers.buildKinHandCatalogFile(orchestratorCatalog);
      const response = await fetch('/__write-file', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          path: 'src/golf/kinhandCatalog.ts',
          content,
        }),
      });
      if (!response.ok) {
        throw new Error(await response.text());
      }
      setCardEditorSaveState('saved');
      setCardEditorSaveMessage('Saved directly to kinhandCatalog.ts');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to save card data.';
      setCardEditorSaveState('error');
      setCardEditorSaveMessage(message);
    }
  }, [orchestratorCatalog]);

  useEffect(() => {
    const handleResize = () => setViewport({ width: window.innerWidth, height: window.innerHeight });
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented || kinHandOrchestratorHelpers.isTextInputTarget(event.target)) return;
      if (event.key.toLowerCase() !== 'c') return;
      event.preventDefault();
      setCardEditorOpen((current) => !current);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  useEffect(() => {
    latestStateRef.current = state;
  }, [state]);

  useEffect(() => {
    if (cardEditorSaveState === 'idle') return;
    setCardEditorSaveState('idle');
    setCardEditorSaveMessage(null);
  }, [orchestratorCatalog]);

  useEffect(() => {
    currentTurnRef.current = currentTurn;
  }, [currentTurn]);

  useEffect(() => {
    simulationPausedRef.current = simulationPaused;
  }, [simulationPaused]);

  useEffect(() => {
    if (currentTurn !== 'player' || autoPlayMode !== 'off' || dragAnim !== null || targetingContext === null && targetingState !== null) {
      setTargetingState(null);
    }
  }, [autoPlayMode, currentTurn, dragAnim, targetingContext, targetingState]);

  useEffect(() => {
    const element = tableauPanelRef.current;
    if (!element || typeof ResizeObserver === 'undefined') return;

    const updateWidth = () => setTableauPanelWidth(element.clientWidth);
    updateWidth();

    const observer = new ResizeObserver(() => updateWidth());
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  useEffect(() => (
    () => {
      clearPlayerAutoTimeout();
      clearEnemyAiTimeout();
      clearDragAnimation();
      clearAbilityCallouts();
    }
  ), [clearAbilityCallouts, clearDragAnimation, clearEnemyAiTimeout, clearPlayerAutoTimeout]);

  useEffect(() => {
    if (!dragAnim) {
      dragActiveRef.current = false;
      if (enemyDragRafRef.current) {
        window.cancelAnimationFrame(enemyDragRafRef.current);
        enemyDragRafRef.current = 0;
      }
      if (enemyDragTimeoutRef.current) {
        window.clearTimeout(enemyDragTimeoutRef.current);
        enemyDragTimeoutRef.current = 0;
      }
      return;
    }

    const node = enemyDragNodeRef.current;
    if (!node) return;

    if (enemyDragRafRef.current) {
      window.cancelAnimationFrame(enemyDragRafRef.current);
      enemyDragRafRef.current = 0;
    }
    if (enemyDragTimeoutRef.current) {
      window.clearTimeout(enemyDragTimeoutRef.current);
      enemyDragTimeoutRef.current = 0;
    }

    const dx = dragAnim.to.x - dragAnim.from.x;
    const dy = dragAnim.to.y - dragAnim.from.y;
    const headingDegrees = Math.atan2(dy, dx) * (180 / Math.PI);
    const targetRotation = headingDegrees * 0.08;
    const initialTransform = `translate3d(${dragAnim.from.x.toFixed(2)}px, ${dragAnim.from.y.toFixed(2)}px, 0) rotate(0deg)`;
    const targetTransform = `translate3d(${dragAnim.to.x.toFixed(2)}px, ${dragAnim.to.y.toFixed(2)}px, 0) rotate(${targetRotation.toFixed(2)}deg)`;

    node.style.transition = 'none';
    node.style.transform = initialTransform;

    enemyDragRafRef.current = window.requestAnimationFrame(() => {
      const activeNode = enemyDragNodeRef.current;
      if (!activeNode) return;
      activeNode.style.transition = `transform ${dragAnim.durationMs}ms cubic-bezier(0.33, 1, 0.68, 1)`;
      activeNode.style.transform = targetTransform;
      enemyDragTimeoutRef.current = window.setTimeout(() => {
        enemyDragTimeoutRef.current = 0;
        enemyDragRafRef.current = 0;
        dragActiveRef.current = false;
        const complete = enemyDragCompletionRef.current;
        enemyDragCompletionRef.current = null;
        setDragAnim(null);
        complete?.();
      }, dragAnim.durationMs);
    });
  }, [dragAnim]);

  const finishEnemyTurn = useCallback(() => {
    clearEnemyAiTimeout();
    clearDragAnimation();
    applyStateUpdate((prev) => ({
      ...(() => {
        const next = ensureHandSize(applyPrimeEndTurnAp(prev));
        return {
          ...next,
          playerFoundation: gainStartTurnPrimeActorAp(next.playerFoundation, 2),
        };
      })(),
      playerEnergy: MEGAHAND_MAX_ENERGY,
      enemyEnergy: MEGAHAND_MAX_ENERGY,
      playerPaidCardIds: [],
      enemyPaidCardIds: [],
    }));
    currentTurnRef.current = 'player';
    setCurrentTurn('player');
    setSimulationPaused(false);
  }, [applyStateUpdate, clearDragAnimation, clearEnemyAiTimeout]);

  const stopAutomation = useCallback(() => {
    if (dragActiveRef.current) return;
    clearPlayerAutoTimeout();
    clearEnemyAiTimeout();
    autoplayPassCountRef.current = 0;
    playerAutoRunIdRef.current += 1;
    playerActionRunIdRef.current += 1;
    enemyTurnRunIdRef.current += 1;
    clearDragAnimation();
    setAutoPlayMode('off');
    setSimulationPaused(false);
    currentTurnRef.current = 'player';
    setCurrentTurn('player');
  }, [clearDragAnimation, clearEnemyAiTimeout, clearPlayerAutoTimeout]);

  const runEnemyTurnStep = useCallback(async () => {
    const runId = enemyTurnRunIdRef.current;
    if (currentTurnRef.current !== 'enemy' || simulationPausedRef.current) return;
    const current = latestStateRef.current;
    const action = chooseChargeUpEnemyAutoAction(current);
    if (!action) {
      autoplayPassCountRef.current += 1;
      if (autoPlayMode === 'full' && autoplayPassCountRef.current >= 2) {
        stopAutomation();
        return;
      }
      finishEnemyTurn();
      return;
    }

    await animateChargeUpAction(current, action);
    if (enemyTurnRunIdRef.current !== runId || currentTurnRef.current !== 'enemy' || simulationPausedRef.current) return;

    const next = applyStateUpdate((prev) => applyChargeUpAutoAction(prev, action));
    if (next === current) {
      autoplayPassCountRef.current += 1;
      if (autoPlayMode === 'full' && autoplayPassCountRef.current >= 2) {
        stopAutomation();
        return;
      }
      finishEnemyTurn();
      return;
    }
    autoplayPassCountRef.current = 0;
    enemyAiTimeoutRef.current = window.setTimeout(() => {
      void runEnemyTurnStep();
    }, CHARGE_UP_ENEMY_STEP_MS);
  }, [animateChargeUpAction, applyStateUpdate, autoPlayMode, finishEnemyTurn, stopAutomation]);

  const startEnemyTurnSequence = useCallback(() => {
    clearPlayerAutoTimeout();
    playerAutoRunIdRef.current += 1;
    playerActionRunIdRef.current += 1;
    clearEnemyAiTimeout();
    clearDragAnimation();
    enemyTurnRunIdRef.current += 1;
    setSimulationPaused(false);
    applyStateUpdate((prev) => {
      const next = startChargeUpEnemyTurn(ensureHandSize(applyPrimeEndTurnAp(prev)));
      return {
        ...next,
        enemyFoundation: gainStartTurnPrimeActorAp(next.enemyFoundation, 2),
      };
    });
    currentTurnRef.current = 'enemy';
    setCurrentTurn('enemy');
  }, [applyStateUpdate, clearDragAnimation, clearEnemyAiTimeout, clearPlayerAutoTimeout]);

  const playHandCardAsFoundation = useCallback(async (cardId: string) => {
    if (currentTurnRef.current !== 'player' || autoPlayMode !== 'off' || dragActiveRef.current) return;
    const current = latestStateRef.current;
    const handCard = current.hand.find((card) => card.id === cardId) ?? null;
    if (!handCard) return;
    const foundationTop = getChargeUpFoundationTop(current.playerFoundation);
    const handCardRank = getChargeUpRuleRank(handCard);
    const foundationRank = getChargeUpRuleRank(foundationTop);
    if (
      foundationTop
      && (handCardRank === null || foundationRank === null || !isAdjacentRank(handCardRank, foundationRank))
    ) return;
    playerActionRunIdRef.current += 1;
    const runId = playerActionRunIdRef.current;
    const sourcePoint = getChargeUpPointerAnchorPoint(supportCardRefs.current[cardId]);
    const targetPoint = getChargeUpPointerAnchorPoint(playerFoundationTargetRef.current);
    if (sourcePoint && targetPoint) {
      enemyDragSequenceIdRef.current += 1;
      await playDragAnimation({
        id: enemyDragSequenceIdRef.current,
        card: handCard,
        actor: 'player',
        presentation: 'actor',
        from: sourcePoint,
        to: targetPoint,
        durationMs: getChargeUpEnemyDragDurationMs(sourcePoint, targetPoint),
      });
      if (playerActionRunIdRef.current !== runId || currentTurnRef.current !== 'player') return;
    }
    applyStateUpdate((prev) => applyPlayHandCardAsFoundation(prev, cardId));
  }, [applyStateUpdate, autoPlayMode, playDragAnimation]);

  const playTableauCard = useCallback(async (columnIndex: number, columnCardIndex: number) => {
    if (currentTurnRef.current !== 'player' || autoPlayMode !== 'off' || dragActiveRef.current) return;
    const current = latestStateRef.current;
    const tableauCard = current.tableau[columnIndex]?.[columnCardIndex] ?? null;
    const foundationTop = getChargeUpFoundationTop(current.playerFoundation);
    const foundationRank = getChargeUpRuleRank(foundationTop);
    if (!tableauCard || !foundationTop || foundationRank === null || !isAdjacentRank(tableauCard.rank, foundationRank)) return;
    playerActionRunIdRef.current += 1;
    const runId = playerActionRunIdRef.current;
    const sourcePoint = getChargeUpPointerAnchorPoint(tableauTopRefs.current[columnIndex]);
    const targetPoint = getChargeUpPointerAnchorPoint(playerFoundationTargetRef.current);
    if (sourcePoint && targetPoint) {
      enemyDragSequenceIdRef.current += 1;
      await playDragAnimation({
        id: enemyDragSequenceIdRef.current,
        card: tableauCard,
        actor: 'player',
        presentation: 'tableau',
        from: sourcePoint,
        to: targetPoint,
        durationMs: getChargeUpEnemyDragDurationMs(sourcePoint, targetPoint),
      });
      if (playerActionRunIdRef.current !== runId || currentTurnRef.current !== 'player') return;
    }
    applyStateUpdate((prev) => applyPlayTableauCardToFoundation(prev, 'player', columnIndex, columnCardIndex));
  }, [applyStateUpdate, autoPlayMode, playDragAnimation]);

  const endTurn = useCallback(() => {
    if (currentTurnRef.current !== 'player') return;
    startEnemyTurnSequence();
  }, [startEnemyTurnSequence]);

  const redeal = useCallback(() => {
    clearPlayerAutoTimeout();
    clearEnemyAiTimeout();
    clearAbilityCallouts();
    autoplayPassCountRef.current = 0;
    playerActionRunIdRef.current += 1;
    clearDragAnimation();
    playerAutoRunIdRef.current += 1;
    enemyTurnRunIdRef.current += 1;
    const next = createInitialState();
    latestStateRef.current = next;
    setState(next);
    currentTurnRef.current = 'player';
    setCurrentTurn('player');
    setSimulationPaused(false);
    setAutoPlayMode('off');
  }, [clearAbilityCallouts, clearDragAnimation, clearEnemyAiTimeout, clearPlayerAutoTimeout]);

  const revealTableau = useCallback(() => {
    clearAbilityCallouts();
    setTargetingState(null);
    setRewardTargetingOrimId(null);
    setRewardCalModalOpen(false);
    setRewardPreviewState(null);
    setOrimPlacementState(null);
    applyStateUpdate((prev) => ({
      ...prev,
      tableau: createFreshTableau(),
    }));
  }, [applyStateUpdate, clearAbilityCallouts]);

  const startAutoplay = useCallback(() => {
    if (dragAnim !== null || currentTurnRef.current !== 'player') return;
    autoplayPassCountRef.current = 0;
    setSimulationPaused(false);
    setAutoPlayMode('full');
  }, [dragAnim]);

  const toggleAutomationPause = useCallback(() => {
    if (dragAnim !== null) return;
    setSimulationPaused((prev) => !prev);
  }, [dragAnim]);

  useEffect(() => {
    if (currentTurn !== 'enemy' || simulationPaused) {
      clearEnemyAiTimeout();
      return;
    }

    enemyAiTimeoutRef.current = window.setTimeout(() => {
      void runEnemyTurnStep();
    }, CHARGE_UP_ENEMY_STEP_MS);

    return clearEnemyAiTimeout;
  }, [clearEnemyAiTimeout, currentTurn, runEnemyTurnStep, simulationPaused]);

  useEffect(() => {
    if (autoPlayMode !== 'full' || currentTurn !== 'player' || simulationPaused) {
      playerAutoRunIdRef.current += 1;
      clearPlayerAutoTimeout();
      return;
    }

    playerAutoRunIdRef.current += 1;
    const runId = playerAutoRunIdRef.current;

    const step = async () => {
      if (
        playerAutoRunIdRef.current !== runId
        || currentTurnRef.current !== 'player'
        || autoPlayMode !== 'full'
        || simulationPausedRef.current
      ) return;
      const current = latestStateRef.current;
      const action = chooseChargeUpPlayerAutoAction(current);
      if (!action) {
        clearPlayerAutoTimeout();
        autoplayPassCountRef.current += 1;
        startEnemyTurnSequence();
        return;
      }
      const previewNext = applyChargeUpAutoAction(current, action);
      if (previewNext === current) {
        clearPlayerAutoTimeout();
        autoplayPassCountRef.current += 1;
        startEnemyTurnSequence();
        return;
      }
      await animateChargeUpAction(current, action);
      if (
        playerAutoRunIdRef.current !== runId
        || currentTurnRef.current !== 'player'
        || autoPlayMode !== 'full'
        || simulationPausedRef.current
      ) return;
      const next = applyStateUpdate((prev) => applyChargeUpAutoAction(prev, action));
      if (next === current) {
        clearPlayerAutoTimeout();
        autoplayPassCountRef.current += 1;
        startEnemyTurnSequence();
        return;
      }
      autoplayPassCountRef.current = 0;
      playerAutoTimeoutRef.current = window.setTimeout(() => {
        void step();
      }, CHARGE_UP_PLAYER_AUTO_STEP_MS);
    };

    playerAutoTimeoutRef.current = window.setTimeout(() => {
      void step();
    }, CHARGE_UP_PLAYER_AUTO_STEP_MS);
    return () => {
      playerAutoRunIdRef.current += 1;
      clearPlayerAutoTimeout();
    };
  }, [animateChargeUpAction, applyStateUpdate, autoPlayMode, clearPlayerAutoTimeout, currentTurn, simulationPaused, startEnemyTurnSequence, stopAutomation]);

  useEffect(() => {
    const nextSnapshots = {
      player: playerFoundationAbilityCard
        ? { key: playerFoundationAbilityCard.key, currentAp: playerFoundationAbilityCard.currentAp }
        : null,
      enemy: enemyFoundationAbilityCard
        ? { key: enemyFoundationAbilityCard.key, currentAp: enemyFoundationAbilityCard.currentAp }
        : null,
    };

    const previousPlayer = abilityProgressRef.current.player;
    if (
      playerFoundationAbilityCard
      && playerFoundationTop
      && playerFoundationAbilityCard.ready
      && (!previousPlayer || previousPlayer.key !== nextSnapshots.player?.key || previousPlayer.currentAp < playerFoundationAbilityCard.maxAp)
    ) {
      queueAbilityCallout(
        `${playerFoundationAbilityCard.name} complete`,
        playerFoundationAbilityCard.ownerName,
        getChargeUpCalloutAnchorPoint(playerFoundationTargetRef.current),
      );
    }

    const previousEnemy = abilityProgressRef.current.enemy;
    if (
      enemyFoundationAbilityCard
      && enemyFoundationTop
      && enemyFoundationAbilityCard.ready
      && (!previousEnemy || previousEnemy.key !== nextSnapshots.enemy?.key || previousEnemy.currentAp < enemyFoundationAbilityCard.maxAp)
    ) {
      queueAbilityCallout(
        `${enemyFoundationAbilityCard.name} complete`,
        enemyFoundationAbilityCard.ownerName,
        getChargeUpCalloutAnchorPoint(enemyFoundationTargetRef.current),
      );
    }

    abilityProgressRef.current = {
      player: nextSnapshots.player,
      enemy: nextSnapshots.enemy,
    };
  }, [enemyFoundationAbilityCard, enemyFoundationTop, playerFoundationAbilityCard, playerFoundationTop, queueAbilityCallout]);

  const playableVisibleCardExists = visibleCardsByColumn.some((column) =>
    column.some(({ card }) => {
      const foundationRank = getChargeUpRuleRank(playerFoundationTop);
      return foundationRank !== null && isAdjacentRank(card.rank, foundationRank);
    }),
  );
  const interactionLocked = currentTurn !== 'player' || autoPlayMode !== 'off' || dragAnim !== null || targetingActive || placementActive || rewardTargetingActive || rewardPreviewState !== null || rewardCalModalOpen;
  const automationControlsVisible = currentTurn === 'enemy' || autoPlayMode !== 'off' || simulationPaused;
  const automationPaused = simulationPaused && automationControlsVisible;
  const actorBoardBaseWidth = (isCompactViewport ? 90 : 94) * MEGAHAND_ACTOR_BOARD_SCALE;
  const dualPrimeWidth = (foundationCardWidth * 2) + foundationGap;
  const tableauHalfReachWidth = Math.floor(tableauPanelInnerWidth / 2);
  const teamEnergyBarWidth = Math.max(170, Math.round(actorBoardBaseWidth * 2.25));
  const chargerCardGap = foundationCompact ? 10 : 14;
  const playerChargersWidth = playerChargerCards.length > 0
    ? (playerChargerCards.length * supportCardWidth) + (Math.max(0, playerChargerCards.length - 1) * chargerCardGap)
    : 0;
  const playerTrayBoardHeight = supportCardHeight + (foundationCompact ? 118 : 136);
  const playerPartyBoardMinWidth = Math.max(
    Math.round(actorBoardBaseWidth * 1.35),
    playerChargersWidth + 36,
  );
  const enemyPartyBoardMinWidth = Math.max(teamEnergyBarWidth, Math.round(actorBoardBaseWidth * 1.35));
  const enemyPartyBoardHeight = playerTrayBoardHeight;
  const primeClusterGap = foundationCompact ? 10 : 14;
  const sideBoardTargetWidth = Math.max(
    teamEnergyBarWidth,
    tableauHalfReachWidth - foundationCardWidth - primeClusterGap,
  );
  const playerPartyBoardWidth = Math.max(playerPartyBoardMinWidth, sideBoardTargetWidth);
  const enemyPartyBoardWidth = Math.max(enemyPartyBoardMinWidth, sideBoardTargetWidth);
  const playerBoardLaneWidth = playerPartyBoardWidth;
  const enemyBoardLaneWidth = enemyPartyBoardWidth;
  const horizontalEnergyMeterWidth = Math.max(150, Math.round(playerPartyBoardWidth - 54));
  const enemyHorizontalEnergyMeterWidth = Math.max(150, Math.round(enemyPartyBoardWidth - 54));
  const enemyFoundationActor = enemyFoundationTop?.kinhandActorCard
    ? enemyFoundationTop
    : createEnemyPersonaCard();
  const enemyFoundationActorCard = (
    <KinHandActorCard
      actorName={enemyFoundationActor.actorName}
      currentAp={enemyFoundationActor.tableauCharge}
      golfValue={rankLabel(enemyFoundationActor.rank)}
      actorAbilities={getActorRuntimeAbilities(
        enemyFoundationActor.actorName,
        enemyFoundationActor.megahandAbility,
        enemyFoundationActor.kinhandAppliedOrims,
        enemyFoundationActor.tableauCharge,
      )}
      apCap={enemyFoundationActor.kinhandActorMaxAp ?? getKinHandActorDefinition(enemyFoundationActor.actorName)?.maxAp ?? 5}
      currentHp={lesserShadeCombatant.hp}
      maxHp={lesserShadeCombatant.hpMax}
      armor={lesserShadeCombatant.armor}
      mobile={foundationCompact}
      width={supportCardWidth}
      height={supportCardHeight}
      spawnCount={getKinHandSpawnableAbilities(enemyFoundationActor).length}
      placementMode={placementActive && orimPlacementState?.targetActorName === enemyFoundationActor.actorName}
      placementPrompt={placementActive && orimPlacementState?.targetActorName === enemyFoundationActor.actorName ? `Slot ${placementGrantedAbility?.ability.name ?? 'Orim'}` : undefined}
      onApSegmentClick={placementActive && orimPlacementState?.targetActorName === enemyFoundationActor.actorName ? handleOrimPlacementSegment : undefined}
      buttonRef={(node) => { enemyFoundationActorRef.current = node; }}
      onCardClick={!rewardTargetingActive && enemyBoardHighlighted ? () => handleActorBoardTarget(enemyFoundationActor.actorName, enemyFoundationActorRef.current) : undefined}
      highlighted={enemyBoardHighlighted || (placementActive && orimPlacementState?.targetActorName === enemyFoundationActor.actorName)}
      dimmed={rewardTargetingActive ? true : (placementActive ? orimPlacementState?.targetActorName !== enemyFoundationActor.actorName : (targetingActive && !enemyBoardHighlighted))}
    />
  );
  const playerPrimeClusterWidth = playerPartyBoardWidth + foundationCardWidth + primeClusterGap;
  const enemyPrimeClusterWidth = enemyPartyBoardWidth + foundationCardWidth + primeClusterGap;
  const primeLaneSideShellContentWidth = Math.max(
    playerPrimeClusterWidth,
    enemyPrimeClusterWidth,
  );
  const primeLaneHorizontalGap = 16;
  const primeLaneAvailableSideWidth = Math.max(
    260,
    Math.floor((viewport.width - (primeLaneHorizontalGap * 2) - (isCompactViewport ? 24 : 48)) / 2),
  );
  const primeLaneSideShellScale = Math.min(1, primeLaneAvailableSideWidth / Math.max(primeLaneSideShellContentWidth, 1));
  const primeLaneSideShellWidth = Math.round(primeLaneSideShellContentWidth * primeLaneSideShellScale);
  const primeLaneFooterHeight = automationControlsVisible ? 0 : 42;
  const primeLaneBodyHeight = Math.max(playerTrayBoardHeight, enemyPartyBoardHeight, foundationCardHeight);
  const primeLaneSideShellContentHeight = primeLaneBodyHeight + primeLaneFooterHeight;
  const primeLaneSideShellHeight = Math.round(primeLaneSideShellContentHeight * primeLaneSideShellScale);

  const renderFoundationPlaceholder = (
    targetRef?: (node: HTMLDivElement | null) => void,
  ) => (
    <div
      ref={targetRef}
      className="rounded-[18px] border border-dashed border-white/14"
      style={{ width: foundationCardWidth, height: foundationCardHeight }}
    />
  );

  const renderPlayerPrimeCard = () => (
    <div className="relative shrink-0" style={{ zIndex: primeTargetHighlighted ? 30 : 1 }}>
      {playerFoundationTop && playerFoundationAbilityCard ? (
        playerFoundationTop.kinhandActorCard ? (
          <KinHandActorCard
            actorName={playerFoundationTop.actorName}
            currentAp={playerFoundationTop.tableauCharge}
            golfValue={rankLabel(getChargeUpRuleRank(playerFoundationTop) ?? playerFoundationTop.rank)}
            actorAbilities={getActorRuntimeAbilities(playerFoundationTop.actorName, playerFoundationTop.megahandAbility, playerFoundationTop.kinhandAppliedOrims, playerFoundationTop.tableauCharge)}
            apCap={playerFoundationTop.kinhandActorMaxAp ?? 5}
            currentHp={(getCombatantForActor(playerFoundationTop.actorName) ?? createMegaHandCombatant(playerFoundationTop.actorName)).hp}
            maxHp={(getCombatantForActor(playerFoundationTop.actorName) ?? createMegaHandCombatant(playerFoundationTop.actorName)).hpMax}
            armor={(getCombatantForActor(playerFoundationTop.actorName) ?? createMegaHandCombatant(playerFoundationTop.actorName)).armor}
            spawnCount={getKinHandSpawnableAbilities(playerFoundationTop).length}
            highlighted={primeTargetHighlighted || rewardTargetingActive || (!targetingActive && !rewardTargetingActive && !!playerFoundationTop)}
            dimmed={(targetingActive && !primeTargetHighlighted) || (rewardTargetingActive && false)}
            mobile={foundationCompact}
            buttonRef={(node) => { playerFoundationTargetRef.current = node; }}
            onGolfClick={
              rewardTargetingActive
                ? () => handleActorBoardTarget(playerFoundationTop.actorName, playerFoundationTargetRef.current)
                : primeTargetHighlighted
                ? handlePrimeTarget
                : (!interactionLocked && playerFoundationAbilityCard.ready
                    ? () => selectChargedCard('foundation', playerFoundationTop.id)
                    : undefined)
            }
            onSpawnClick={
              !interactionLocked && !primeTargetHighlighted
                ? () => spawnAbilitiesFromPlayerPrimeActorCard(playerFoundationTop.id)
                : undefined
            }
          />
        ) : (
          <ActorAbilityCard
            abilityCard={playerFoundationAbilityCard}
            highlighted={primeTargetHighlighted || (!targetingActive && !!playerFoundationTop)}
            dimmed={targetingActive && !primeTargetHighlighted}
            mobile={foundationCompact}
            showPower={false}
            showGolfValue={false}
            buttonRef={(node) => { playerFoundationTargetRef.current = node; }}
            onClick={
              primeTargetHighlighted
                ? handlePrimeTarget
                : (!interactionLocked && playerFoundationAbilityCard.ready
                    ? () => selectChargedCard('foundation', playerFoundationTop.id)
                    : undefined)
            }
          />
        )
      ) : (
        renderFoundationPlaceholder((node) => { playerFoundationTargetRef.current = node; })
      )}
    </div>
  );

  const renderEnemyPrimeCard = () => (
    <div className="relative shrink-0">
      {enemyFoundationTop && enemyFoundationAbilityCard ? (
        <ActorAbilityCard
          abilityCard={enemyFoundationAbilityCard}
          mobile={foundationCompact}
          enemy
          dimmed={targetingActive}
          showPower={false}
          showGolfValue={false}
          buttonRef={(node) => { enemyFoundationTargetRef.current = node; }}
        />
      ) : (
        renderFoundationPlaceholder((node) => { enemyFoundationTargetRef.current = node; })
      )}
    </div>
  );

  const renderPrimeLane = () => (
    <div className="flex w-full items-center justify-center" style={{ gap: primeLaneHorizontalGap }}>
      <div className="flex justify-end" style={{ width: primeLaneSideShellWidth }}>
        <div
          style={{
            width: primeLaneSideShellContentWidth,
            height: primeLaneSideShellHeight,
            transform: `scale(${primeLaneSideShellScale})`,
            transformOrigin: 'right center',
          }}
        >
          <div className="flex h-full flex-col justify-between">
            <div className="flex items-center justify-end" style={{ minHeight: primeLaneBodyHeight, gap: primeClusterGap }}>
                <div
                  className={`flex items-center justify-end transition ${rewardTargetingActive ? 'drop-shadow-[0_0_24px_rgba(142,242,212,0.24)]' : ''}`}
                  style={{ width: playerBoardLaneWidth, minHeight: primeLaneBodyHeight, zIndex: playerBoardHighlighted ? 30 : 1 }}
                >
                <PartyBoard
                  actorName="PLAYER"
                  side="player"
                  mobile={isCompactViewport}
                  scale={MEGAHAND_ACTOR_BOARD_SCALE}
                  widthOverride={playerPartyBoardWidth}
                  heightOverride={playerTrayBoardHeight}
                  labelOverride="PLAYER"
                  buttonRef={playerActorBoardRef}
                  highlighted={playerBoardHighlighted}
                  dimmed={rewardTargetingActive ? false : (targetingActive && !playerBoardHighlighted)}
                  trayChildren={playerChargerCards.map((card) => {
                    const canMoveToPrime = canMovePlayerChargerToPrime(state, card);
                    const spawnableAbilities = getKinHandSpawnableAbilities(card);
                    const combatant = getCombatantForActor(card.actorName) ?? createMegaHandCombatant(card.actorName);
                    const actorTargetable = targetingActive && canTargetPlayerActorBoard(card.actorName);
                    const canSpawn = currentTurn === 'player'
                      && !targetingActive
                      && !isActorAsleep(state, card.actorName)
                      && spawnableAbilities.length > 0;
                    const actionable = canMoveToPrime || canSpawn;
                    return (
                      <KinHandActorCard
                        key={card.id}
                        actorName={card.actorName}
                        currentAp={card.tableauCharge}
                        golfValue={rankLabel(getChargeUpRuleRank(card) ?? card.rank)}
                        actorAbilities={getActorRuntimeAbilities(card.actorName, card.megahandAbility, card.kinhandAppliedOrims, card.tableauCharge)}
                        apCap={card.kinhandActorMaxAp ?? 5}
                        currentHp={combatant.hp}
                        maxHp={combatant.hpMax}
                        armor={combatant.armor}
                        mobile={foundationCompact}
                        width={supportCardWidth}
                        height={supportCardHeight}
                        spawnCount={spawnableAbilities.length}
                        placementMode={placementActive && orimPlacementState?.targetActorName === card.actorName}
                        placementPrompt={placementActive && orimPlacementState?.targetActorName === card.actorName ? `Slot ${placementGrantedAbility?.ability.name ?? 'Orim'}` : undefined}
                        onApSegmentClick={placementActive && orimPlacementState?.targetActorName === card.actorName ? handleOrimPlacementSegment : undefined}
                        buttonRef={(node) => {
                          playerChargerRefs.current[card.id] = node;
                        }}
                        highlighted={rewardTargetingActive || actorTargetable || actionable || (placementActive && orimPlacementState?.targetActorName === card.actorName)}
                        dimmed={rewardTargetingActive ? false : (placementActive ? orimPlacementState?.targetActorName !== card.actorName : (targetingActive ? !actorTargetable : (!actionable && currentTurn === 'player')))}
                        onCardClick={rewardTargetingActive ? () => handleActorBoardTarget(card.actorName, playerChargerRefs.current[card.id]) : (actorTargetable ? () => handleActorBoardTarget(card.actorName, playerChargerRefs.current[card.id]) : undefined)}
                        onGolfClick={
                          rewardTargetingActive
                            ? () => handleActorBoardTarget(card.actorName, playerChargerRefs.current[card.id])
                            : (!targetingActive && canMoveToPrime
                            ? () => { void movePlayerChargerCardToPrime(card.id); }
                            : undefined)
                        }
                        onSpawnClick={canSpawn ? () => spawnAbilitiesFromActorCard(card.id) : undefined}
                      />
                    );
                  })}
                />
              </div>
              {renderPlayerPrimeCard()}
            </div>
          </div>
        </div>
      </div>
      <div className="flex justify-start" style={{ width: primeLaneSideShellWidth }}>
        <div
          style={{
            width: primeLaneSideShellContentWidth,
            height: primeLaneSideShellHeight,
            transform: `scale(${primeLaneSideShellScale})`,
            transformOrigin: 'left center',
          }}
        >
          <div className="flex h-full flex-col justify-between">
            <div className="flex items-center justify-start" style={{ minHeight: primeLaneBodyHeight, gap: primeClusterGap }}>
              {renderEnemyPrimeCard()}
              <div
                className="flex items-center justify-start"
                style={{ width: enemyBoardLaneWidth, minHeight: primeLaneBodyHeight, zIndex: enemyBoardHighlighted ? 30 : 1 }}
              >
                <PartyBoard
                  actorName="Lesser Shade"
                  side="enemy"
                  mobile={isCompactViewport}
                  scale={MEGAHAND_ACTOR_BOARD_SCALE}
                  widthOverride={enemyBoardLaneWidth}
                  heightOverride={enemyPartyBoardHeight}
                  labelOverride="ENEMY"
                  buttonRef={enemyActorBoardRef}
                  highlighted={enemyBoardHighlighted}
                  dimmed={targetingActive && !enemyBoardHighlighted}
                  trayChildren={enemyFoundationActorCard}
                />
              </div>
            </div>
            {!automationControlsVisible ? (
              <div style={{ height: primeLaneFooterHeight }} />
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );

  const renderEndTurnButton = () => (
    !automationControlsVisible ? (
      <div className="flex justify-center">
        <button
          type="button"
          onClick={endTurn}
          disabled={currentTurn !== 'player' || autoPlayMode !== 'off' || dragAnim !== null || targetingActive}
          className="rounded-[14px] border border-white/12 bg-black/35 px-5 py-2 text-[9px] font-semibold uppercase tracking-[0.14em] text-white/72 transition hover:border-[#ffd166]/55 hover:text-white lg:text-[11px]"
        >
          End Turn
        </button>
      </div>
    ) : null
  );

  const renderSupportHand = () => (
    <div className="flex justify-center" aria-label="Support abilities">
      <div
        className="flex items-end justify-center"
        style={{
          width: handRailCanvasWidth,
          height: handRailHeight,
          gap: handRowGap,
          paddingLeft: handRailPaddingX,
          paddingRight: handRailPaddingX,
        }}
      >
        {state.hand.map((card) => {
          const resolvedAbilityCard = resolveMegaHandAbilityCard({
            actorName: card.actorName,
            currentAp: card.tableauCharge,
            currentEnergyCost: getCardActivationEnergyCost(card),
            liveGolfValue: getChargeUpRuleRank(card) ?? card.rank,
            foundationCardId: card.id,
            abilityOverride: card.megahandAbility,
            currentRarity: card.currentRarity,
          });
          const playable = currentTurn === 'player' && !interactionLocked && resolvedAbilityCard.ready;
          const selectedForTargeting = targetingContext?.source === 'hand' && targetingContext.cardId === card.id;
          return (
            <div
              key={card.id}
              className="shrink-0"
              style={{
                width: supportCardWidth,
                height: supportCardHeight + (handFloatAmplitude * 2),
              }}
            >
              <ActorAbilityCard
                abilityCard={resolvedAbilityCard}
                mobile={foundationCompact}
                width={supportCardWidth}
                height={supportCardHeight}
                showGolfValue={false}
                buttonRef={(node) => {
                  supportCardRefs.current[card.id] = node;
                }}
                highlighted={selectedForTargeting || (!targetingActive && playable)}
                dimmed={targetingActive ? !selectedForTargeting : currentTurn === 'player' && !playable}
                onClick={playable ? () => selectChargedCard('hand', card.id) : undefined}
              />
            </div>
          );
        })}
      </div>
    </div>
  );

  const renderActionControls = () => (
    <div className="flex items-center justify-center gap-3">
      {automationControlsVisible ? (
        <div className="flex items-center gap-2 rounded-[16px] border border-white/12 bg-black/35 px-2 py-2 shadow-[0_12px_28px_rgba(0,0,0,0.24)]">
          <button
            type="button"
            aria-label={automationPaused ? 'Resume automation' : 'Pause automation'}
            title={automationPaused ? 'Resume automation' : 'Pause automation'}
            onClick={toggleAutomationPause}
            disabled={dragAnim !== null}
            className={`flex h-10 w-10 items-center justify-center rounded-[12px] border text-lg transition ${
              dragAnim !== null
                ? 'cursor-default border-white/10 bg-white/[0.04] text-white/24'
                : 'border-white/12 bg-white/[0.04] text-white/78 hover:border-[#8ef2d4]/55 hover:text-white'
            }`}
          >
            {automationPaused ? '▶' : '⏸'}
          </button>
          <button
            type="button"
            aria-label="Stop automation"
            title="Stop automation"
            onClick={stopAutomation}
            disabled={dragAnim !== null}
            className={`flex h-10 w-10 items-center justify-center rounded-[12px] border text-lg transition ${
              dragAnim !== null
                ? 'cursor-default border-white/10 bg-white/[0.04] text-white/24'
                : 'border-white/12 bg-white/[0.04] text-white/78 hover:border-[#ff7a7a]/55 hover:text-white'
            }`}
          >
            ⏹
          </button>
        </div>
      ) : null}
    </div>
  );

  return (
    <div className="relative h-screen overflow-hidden bg-[radial-gradient(circle_at_top,rgba(20,38,31,0.24),transparent_38%),linear-gradient(180deg,#05060a,#090d12_44%,#06070b)] text-white">
      <style>{`
        @keyframes megahand-hand-float {
          0% { transform: translateY(0px); }
          100% { transform: translateY(-${handFloatAmplitude}px); }
        }

        @media (prefers-reduced-motion: reduce) {
          [aria-label="Support abilities"] > div > div {
            animation: none !important;
            transform: none !important;
          }
        }
      `}</style>
      {targetingActive || rewardTargetingActive ? (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 z-0 bg-[rgba(3,5,8,0.58)]"
        />
      ) : null}
      <div
        className="relative z-10 mx-auto flex h-full w-full max-w-[min(1680px,100vw-12px)] flex-col items-center gap-3 px-1.5 py-2 lg:max-w-[min(1680px,100vw-16px)] lg:gap-2 lg:px-4 lg:py-5"
        onClick={targetingActive ? cancelTargeting : (rewardTargetingActive ? () => setRewardTargetingOrimId(null) : undefined)}
      >
          <div
            ref={tableauPanelRef}
            className="relative w-full rounded-[18px] border border-[#8ef2d4]/18 bg-[linear-gradient(180deg,rgba(14,22,20,0.44),rgba(9,12,14,0.28))]"
            style={{
              paddingTop: tableauPanelPaddingTop,
              paddingBottom: isCompactViewport ? 12 : 18,
              paddingLeft: tableauPanelPaddingX,
              paddingRight: tableauPanelPaddingX,
            }}
          >
            {!automationControlsVisible ? (
              <div className="absolute left-3 top-3 z-10 flex flex-col gap-2">
                <button
                  type="button"
                  aria-label="Start autoplay"
                  title="Start autoplay"
                  onClick={startAutoplay}
                  disabled={dragAnim !== null || currentTurn !== 'player'}
                  className={`flex items-center justify-center rounded-[14px] border border-white/12 bg-black/35 text-white/72 transition ${
                    foundationCompact ? 'h-10 w-10 text-xl' : 'h-11 w-11 text-2xl'
                  } ${
                    dragAnim !== null || currentTurn !== 'player'
                      ? 'cursor-default border-white/10 bg-white/[0.04] text-white/24'
                      : 'hover:border-[#8ef2d4]/55 hover:text-white'
                  }`}
                >
                  ▶
                </button>
                <button
                  type="button"
                  aria-label="Generate treasure reward"
                  title="Generate treasure reward"
                  onClick={() => {
                    setRewardPreviewState(null);
                    setRewardTargetingOrimId(null);
                    setRewardCalModalOpen(true);
                  }}
                  className={`flex items-center justify-center rounded-[14px] border border-white/12 bg-black/35 text-white/72 transition ${
                    foundationCompact ? 'h-10 w-10 text-lg' : 'h-11 w-11 text-xl'
                  } hover:border-[#ffd166]/55 hover:text-white`}
                >
                  💎
                </button>
                <button
                  type="button"
                  aria-label="Reveal fresh tableau"
                  title="Reveal fresh tableau"
                  onClick={revealTableau}
                  className={`flex items-center justify-center rounded-[14px] border border-white/12 bg-black/35 text-white/72 transition ${
                    foundationCompact ? 'h-10 w-10 text-lg' : 'h-11 w-11 text-xl'
                  } hover:border-[#8ef2d4]/55 hover:text-white`}
                >
                  👁
                </button>
              </div>
            ) : null}
            <button
              type="button"
              aria-label="Redeal"
              title="Redeal"
              onClick={redeal}
              className={`absolute right-3 top-3 z-10 flex items-center justify-center rounded-[14px] border border-white/12 bg-black/35 text-white/72 transition hover:border-[#8ef2d4]/55 hover:text-white ${
                foundationCompact ? 'h-10 w-10 text-xl' : 'h-11 w-11 text-2xl'
              }`}
            >
              ↻
            </button>
            <div
              className="grid justify-center"
              style={{
                minHeight: tableauGridHeight,
                gridTemplateColumns: `repeat(${tableauColumnsPerRow}, ${tableauColumnWidth}px)`,
                columnGap: tableauGap,
                rowGap: tableauRowGap,
                alignItems: 'end',
              }}
            >
              {visibleCardsByColumn.map((visibleColumn, columnIndex) => {
                const visibleEntry = visibleColumn[visibleColumn.length - 1] ?? null;
                return (
                  <div
                    key={`chargeup-column-${columnIndex}`}
                    className="relative self-end"
                    style={{ height: tableauColumnHeight, width: tableauColumnWidth }}
                  >
                    {Array.from({ length: tableauVisibleRowCount }, (_, rowIndex) => {
                      const topPadding = tableauVisibleRowCount - visibleColumn.length;
                      const visibleIndex = rowIndex - topPadding;
                      const entry = visibleIndex >= 0 ? visibleColumn[visibleIndex] ?? null : null;
                      if (!entry) {
                        return (
                          <div
                            key={`chargeup-empty-${columnIndex}-${rowIndex}`}
                            className="absolute left-0 rounded-[16px] border border-dashed border-white/7 bg-black/10"
                            style={{
                              top: `${rowIndex * tableauOffset}px`,
                              width: tableauColumnWidth,
                              height: tableauFrontHeight,
                            }}
                          />
                        );
                      }
                      const isFront = visibleIndex === visibleColumn.length - 1;
                      const foundationRank = getChargeUpRuleRank(playerFoundationTop);
                      const playable = isFront && foundationRank !== null && isAdjacentRank(entry.card.rank, foundationRank);
                      const tableauTargetable = isFront && !!targetingContext?.canTargetTableau && targetingContext.source === 'foundation';
                      const tableauDimmed = targetingActive && !tableauTargetable;
                      return (
                        <div
                          key={entry.card.id}
                          className="absolute left-0 overflow-hidden"
                          ref={isFront ? (el) => { tableauTopRefs.current[columnIndex] = el; } : undefined}
                          style={{
                            top: `${rowIndex * tableauOffset}px`,
                            zIndex: rowIndex + 1,
                            width: tableauColumnWidth,
                            height: isFront ? tableauFrontHeight : tableauBackHeight,
                          }}
                        >
                          <SimpleCard
                            card={entry.card}
                            mobile={isMobileCardScale}
                            active={tableauTargetable || (!targetingActive && currentTurn === 'player' && playable)}
                            muted={!isFront || tableauDimmed}
                            disabled={!isFront || (targetingActive ? !tableauTargetable : interactionLocked || !playable)}
                            width={tableauColumnWidth}
                            height={isFront ? tableauFrontHeight : tableauBackHeight}
                            onClick={
                              targetingActive
                                ? (isFront ? () => handleTableauTarget(columnIndex, entry.columnCardIndex) : undefined)
                                : (!interactionLocked && playable ? () => playTableauCard(columnIndex, entry.columnCardIndex) : undefined)
                            }
                          />
                        </div>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          </div>

        <div className="relative mt-auto flex w-full flex-col items-center gap-3 lg:gap-4" style={{ paddingBottom: handBottomOverlayHeight }}>
          {isPortraitMobile ? (
            <>
              <div className="w-full">
                <div
                  className="mx-auto flex w-full max-w-[1200px] items-start justify-center"
                  style={{ minHeight: Math.max(foundationCardHeight, 88) }}
                >
                  <div className="flex w-full flex-col items-center gap-3">
                    {renderEndTurnButton()}
                    {renderPrimeLane()}
                  </div>
                </div>
              </div>
              <div className="flex w-full items-start justify-center">
                <div className="flex shrink-0 flex-col items-center gap-3">
                  {renderActionControls()}
                </div>
              </div>
            </>
          ) : (
            <div className="w-full max-w-[1500px]">
              <div
                className="flex w-full items-start justify-center"
                style={{ minHeight: Math.max(foundationCardHeight, 88) }}
              >
                <div className="flex w-full flex-col items-center gap-3">
                  {renderEndTurnButton()}
                  {renderPrimeLane()}
                </div>
              </div>

              <div className="mt-3 flex items-start justify-center">
                <div className="flex shrink-0 flex-col items-center gap-3 pt-1">
                  {renderActionControls()}
                </div>
              </div>

            </div>
          )}
        </div>

        <div
          className="pointer-events-none absolute inset-x-0 z-[30] flex justify-center"
          style={{ bottom: handBottomSafeInset, height: handBottomOverlayHeight - handBottomSafeInset }}
        >
          <div
            className="pointer-events-auto"
            style={{
              width: handRailCanvasWidth,
              maxWidth: '100%',
              transform: `scale(${handOverlayScale})`,
              transformOrigin: 'center bottom',
            }}
          >
            {renderSupportHand()}
          </div>
        </div>

        {rewardCalModalOpen && calRewardAbilityCard ? (
          <KinHandRewardModalShell
            title="Treasure Reward"
            subtitle="Cal joins your run. Click the Orim card to begin equipping it to a party actor."
            onClose={() => setRewardCalModalOpen(false)}
          >
            <div className="flex flex-col items-center gap-4">
              <ActorAbilityCard
                abilityCard={calRewardAbilityCard}
                width={Math.round(supportCardWidth * 1.08)}
                height={Math.round(supportCardHeight * 1.08)}
                showPower={false}
                showOwnerName={false}
                showGolfValue={false}
                onClick={() => {
                  setRewardCalModalOpen(false);
                  setRewardTargetingOrimId('cal');
                }}
              />
              <div className="max-w-[620px] text-center text-[12px] leading-6 text-white/68">
                Grants <span className="font-semibold text-white">Cal&apos;s Hearthfire</span> as a passive affinity
                and <span className="font-semibold text-white">Touch of Flame</span> as a segment-slot ability.
              </div>
            </div>
          </KinHandRewardModalShell>
        ) : null}

        {rewardPreviewState && rewardPreviewActorCard && rewardPreviewOrimCard ? (
          <KinHandRewardModalShell
            title="Apply Orim"
            subtitle={`Choose where ${rewardPreviewOrimCard.name} will live on ${rewardPreviewState.actorName}'s AP meter.`}
            onClose={() => setRewardPreviewState(null)}
          >
            <div className="flex flex-col gap-5">
              <div className="flex flex-wrap items-start justify-center gap-6">
                <KinHandActorCard
                  actorName={rewardPreviewActorCard.actorName}
                  currentAp={rewardPreviewState.selectedSegment ?? rewardPreviewActorCard.tableauCharge}
                  apCap={rewardPreviewActorCard.kinhandActorMaxAp ?? 5}
                  golfValue={rankLabel(rewardPreviewActorCard.rank)}
                  actorAbilities={rewardPreviewAbilities}
                  currentHp={(getCombatantForActor(rewardPreviewActorCard.actorName) ?? createMegaHandCombatant(rewardPreviewActorCard.actorName)).hp}
                  maxHp={(getCombatantForActor(rewardPreviewActorCard.actorName) ?? createMegaHandCombatant(rewardPreviewActorCard.actorName)).hpMax}
                  armor={(getCombatantForActor(rewardPreviewActorCard.actorName) ?? createMegaHandCombatant(rewardPreviewActorCard.actorName)).armor}
                  spawnCount={rewardPreviewResolvedCards.length}
                  width={Math.round(supportCardWidth * 1.05)}
                  height={Math.round(supportCardHeight * 1.05)}
                  highlighted
                />
                <ActorAbilityCard
                  abilityCard={rewardPreviewOrimCard}
                  width={Math.round(supportCardWidth * 1.05)}
                  height={Math.round(supportCardHeight * 1.05)}
                  showPower={false}
                  showOwnerName={false}
                  showGolfValue={false}
                  highlighted
                />
              </div>

              <div className="flex flex-col items-center gap-3">
                <div className="text-[11px] font-black uppercase tracking-[0.18em] text-white/56">Click A Segment To Apply The Orim To</div>
                <div className="grid w-full max-w-[560px] gap-2" style={{ gridTemplateColumns: 'repeat(5, minmax(0, 1fr))' }}>
                  {Array.from({ length: 5 }, (_, index) => {
                    const apValue = index + 1;
                    const active = rewardPreviewState.selectedSegment === apValue;
                    return (
                      <button
                        key={`reward-preview-segment-${apValue}`}
                        type="button"
                        onClick={() => setRewardPreviewState((prev) => prev ? { ...prev, selectedSegment: apValue } : prev)}
                        className={`h-12 rounded-[14px] border text-sm font-black transition ${active ? 'border-[#8ef2d4]/70 bg-[rgba(20,58,52,0.62)] text-white' : 'border-white/10 bg-black/20 text-white/72 hover:border-white/22 hover:text-white'}`}
                      >
                        {apValue}
                      </button>
                    );
                  })}
                </div>
              </div>

              {rewardPreviewState.selectedSegment ? (
                <div className="rounded-[18px] border border-white/10 bg-[rgba(255,255,255,0.03)] px-4 py-4">
                  <div className="text-[11px] font-black uppercase tracking-[0.18em] text-white/56">Resulting Ability Cards</div>
                  <div
                    className="mt-4 grid max-h-[320px] justify-center gap-4 overflow-y-auto pr-1"
                    style={{ gridTemplateColumns: `repeat(${Math.min(2, Math.max(1, rewardPreviewResolvedCards.length))}, minmax(0, 92px))` }}
                  >
                    {rewardPreviewResolvedCards.map((abilityCard) => (
                      <ActorAbilityCard
                        key={abilityCard.key}
                        abilityCard={abilityCard}
                        width={92}
                        height={Math.round(92 * (supportCardHeight / supportCardWidth))}
                        showPower
                        showGolfValue={false}
                        highlighted
                      />
                    ))}
                  </div>
                </div>
              ) : null}

              <div className="flex justify-center gap-3">
                <button
                  type="button"
                  onClick={() => setRewardPreviewState(null)}
                  className="rounded-[12px] border border-white/12 bg-white/[0.05] px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-white/74 transition hover:border-white/24 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={!rewardPreviewState.selectedSegment}
                  onClick={applyRewardOrimToActor}
                  className={`rounded-[12px] border px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.14em] transition ${
                    rewardPreviewState.selectedSegment
                      ? 'border-[#8ef2d4]/55 bg-[rgba(20,58,52,0.44)] text-[#d7fff3] hover:border-[#8ef2d4]/75'
                      : 'cursor-default border-white/10 bg-white/[0.04] text-white/26'
                  }`}
                >
                  Apply Orim
                </button>
              </div>
            </div>
          </KinHandRewardModalShell>
        ) : null}

        {abilityCallouts.map((entry, index) => (
          <Callout
            key={entry.id}
            visible
            text={entry.text}
            subtitle={entry.subtitle}
            instanceKey={entry.id}
            tone="dialogue"
            autoFadeMs={1600}
            anchor={entry.anchor}
            style={
              entry.anchor
                ? undefined
                : { position: 'fixed', left: '50%', top: `${22 + (index * 72)}px`, transform: 'translateX(-50%)' }
            }
          />
        ))}

        {dragAnim ? (
          <div className="pointer-events-none fixed inset-0 z-[120]">
            <div
              ref={enemyDragNodeRef}
              className="pointer-events-none absolute left-0 top-0"
              style={{
                willChange: 'transform',
                transform: `translate3d(${dragAnim.from.x.toFixed(2)}px, ${dragAnim.from.y.toFixed(2)}px, 0) rotate(0deg)`,
                transition: 'none',
              }}
            >
              <div className="relative h-0 w-0">
                {dragAnim.presentation === 'actor' ? (
                  <div
                    className="absolute"
                    style={{
                      width: foundationCardWidth,
                      height: foundationCardHeight,
                      transform: 'translate(calc(-100% + 10px), calc(-100% + 10px))',
                      transformOrigin: '100% 100%',
                    }}
                  >
                    {dragAnim.card.kinhandActorCard ? (
                      <KinHandActorCard
                        actorName={dragAnim.card.actorName}
                        currentAp={dragAnim.card.tableauCharge}
                        golfValue={rankLabel(getChargeUpRuleRank(dragAnim.card) ?? dragAnim.card.rank)}
                        actorAbilities={getActorRuntimeAbilities(dragAnim.card.actorName, dragAnim.card.megahandAbility, dragAnim.card.kinhandAppliedOrims, dragAnim.card.tableauCharge)}
                        apCap={dragAnim.card.kinhandActorMaxAp ?? 5}
                        mobile={foundationCompact}
                        width={foundationCardWidth}
                        height={foundationCardHeight}
                        spawnCount={0}
                        highlighted={dragAnim.actor === 'player'}
                        enemy={dragAnim.actor === 'enemy'}
                      />
                    ) : (
                      <ActorAbilityCard
                        abilityCard={resolveMegaHandAbilityCard({
                          actorName: dragAnim.card.actorName,
                          currentAp: dragAnim.card.tableauCharge,
                          currentEnergyCost: getCardActivationEnergyCost(dragAnim.card),
                          liveGolfValue: getChargeUpRuleRank(dragAnim.card) ?? dragAnim.card.rank,
                          foundationCardId: dragAnim.card.id,
                          abilityOverride: dragAnim.card.megahandAbility,
                          currentRarity: dragAnim.card.currentRarity,
                        })}
                        mobile={foundationCompact}
                        width={foundationCardWidth}
                        height={foundationCardHeight}
                        showGolfValue={false}
                        highlighted={dragAnim.actor === 'player'}
                        enemy={dragAnim.actor === 'enemy'}
                      />
                    )}
                  </div>
                ) : (
                  <div
                    className="absolute"
                    style={{
                      width: tableauDragCardWidth,
                      height: tableauDragCardHeight,
                      transform: 'translate(calc(-100% + 10px), calc(-100% + 10px))',
                      transformOrigin: '100% 100%',
                    }}
                  >
                    <div
                      className={`relative overflow-hidden rounded-[16px] border p-[2px] shadow-[0_0_26px_rgba(0,0,0,0.24)] ${
                        dragAnim.actor === 'enemy'
                          ? 'border-[#ff8d80]/55 bg-[linear-gradient(180deg,rgba(22,14,16,0.96),rgba(10,8,10,0.94))] shadow-[0_0_26px_rgba(255,110,102,0.28)]'
                          : 'border-[#8ef2d4]/70 bg-[linear-gradient(180deg,rgba(12,28,24,0.98),rgba(6,10,12,0.98))] shadow-[0_0_26px_rgba(110,255,217,0.24)]'
                      }`}
                      style={{ width: tableauDragCardWidth, height: tableauDragCardHeight }}
                    >
                      <div className="relative h-full w-full overflow-hidden rounded-[14px]">
                        <Card
                          card={toGameCard(dragAnim.card)}
                          showGraphics={false}
                          size={tableauDragCardSize}
                          borderColorOverride="transparent"
                          boxShadowOverride="none"
                          hideElements
                          disableAnimation
                          disableTilt
                          disableHoverLift
                        />
                      </div>
                    </div>
                  </div>
                )}
                <div
                  className="absolute select-none text-[20px] leading-none text-[#ffd166] drop-shadow-[0_0_8px_rgba(255,209,102,0.95)]"
                  style={{ left: '2px', top: '2px' }}
                >
                  ☝
                </div>
              </div>
            </div>
          </div>
        ) : null}
      </div>
      <KinHandOrchestratorModal
        open={cardEditorOpen}
        catalog={orchestratorCatalog}
        onClose={() => setCardEditorOpen(false)}
        onChange={setOrchestratorCatalog}
        onSave={saveOrchestratorCatalog}
        saveState={cardEditorSaveState}
        saveMessage={cardEditorSaveMessage}
      />
    </div>
  );
}
