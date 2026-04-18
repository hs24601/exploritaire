import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Callout } from '../components/Callout';
import { AbilityApBar } from '../components/combat/AbilityApBar';
import { Card } from '../components/Card';
import { Tooltip } from '../components/Tooltip';
import type { Card as GameCard, Element, OrimRarity } from '../engine/types';
import { CombatVitalsBar } from './BanksThinSlice';
import { getActorApCap, getKinProfile, getStarterKinKit } from './data/starterKinData';
import { ActorAbilityCard } from './ActorAbilityCard';
import { MegaHandCardEditorModal, megaHandCardEditorHelpers, type EditableMegaHandAbilityCard } from './MegaHandCardEditorModal';
import type { MegaHandAbilityDefinition, MegaHandRuntimeCard, MegaHandSuit } from './megahandAbilityData';
import { getMegaHandActorSummary, MEGAHAND_ENEMY_ABILITY, MEGAHAND_STARTING_DECK, resolveMegaHandAbilityCard } from './megahandAbilityData';
import { resolveDamagePacket } from './combatResolver';
import type { ActorCombatState as ResolverActorCombatState, DamagePacket } from './combatResolver';
import { MEGAHAND_ABILITY_CATALOG } from './singlePlayerActors/megahandAbilityCatalog';

type Suit = MegaHandSuit;
type LocalCard = MegaHandRuntimeCard;

type ChargeUpState = {
  tableau: LocalCard[][];
  deck: LocalCard[];
  handDeck: LocalCard[];
  discard: LocalCard[];
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

type ChargeUpTargetKind = 'actor' | 'prime' | 'tableau';

type ActiveActorBoard = {
  key: string;
  actorName: string;
  side: ChargeUpActorSide;
  currentHp: number;
  maxHp: number;
  armor: number;
};

type MegaHandCombatantKey = 'hero' | 'mochi' | 'jet' | 'lesser-shade';

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
  localSequence += 1;
  return {
    id: `${prefix}-${MEGAHAND_ENEMY_ABILITY.ownerName.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${MEGAHAND_ENEMY_ABILITY.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${localSequence}`,
    rank: MEGAHAND_ENEMY_ABILITY.golfValue,
    suit: getMegaHandOwnerSuit(MEGAHAND_ENEMY_ABILITY.ownerName),
    tableauCharge: 0,
    actorName: MEGAHAND_ENEMY_ABILITY.ownerName,
    currentRarity: MEGAHAND_ENEMY_ABILITY.rarity ?? 'common',
    megahandAbility: MEGAHAND_ENEMY_ABILITY,
  };
};

const createHeroHandDeck = (): LocalCard[] => shuffle(
  MEGAHAND_STARTING_DECK.map((ability, index) => createMegaHandAbilityCard(ability, `megahand-starting-deck-${index}`))
);

const toEditableMegaHandCards = (cards: MegaHandAbilityDefinition[]): EditableMegaHandAbilityCard[] => (
  cards.map((card, index) => ({
    ...card,
    editorId: `${card.ownerName}:${card.name}:${index}`,
  }))
);

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
  side === 'enemy' ? ['lesser-shade'] : ['hero', 'mochi', 'jet']
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
  jet: createMegaHandCombatant('Jet'),
  'lesser-shade': createMegaHandCombatant('Lesser Shade'),
});

const createInitialState = (): ChargeUpState => {
  const deck = createDeck();
  const tableauCards = deck.slice(0, TABLEAU_COLUMNS * TABLEAU_ROWS);
  const tableau = Array.from({ length: TABLEAU_COLUMNS }, (_, columnIndex) =>
    tableauCards.slice(columnIndex * TABLEAU_ROWS, (columnIndex + 1) * TABLEAU_ROWS),
  );
  const handDeck = createHeroHandDeck();
  const handDraw = drawCards(handDeck, [], 5);
  const normalizedOpeningHand = enforceSingleTackleInHand(handDraw.drawn, handDraw.deck);

  return {
    tableau,
    deck: deck.slice(TABLEAU_COLUMNS * TABLEAU_ROWS),
    handDeck: normalizedOpeningHand.handDeck,
    discard: handDraw.discard,
    hand: normalizedOpeningHand.hand,
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

const grantPrimeApToCard = (card: LocalCard): LocalCard => {
  const normalized = normalizeMegaHandCardState(card);
  const maxAp = normalized.megahandAbility?.maxAp ?? 0;
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

const applyPrimeEndTurnAp = (prev: ChargeUpState): ChargeUpState => applyMegaHandStatusTurnEffects({
  ...prev,
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

const ensureHandSize = (prev: ChargeUpState, targetSize = 5): ChargeUpState => {
  const missingCount = Math.max(0, targetSize - prev.hand.length);
  if (missingCount === 0) return prev;
  const drawResult = drawCards(prev.handDeck, [], missingCount);
  if (drawResult.drawn.length === 0) return prev;
  const normalized = enforceSingleTackleInHand([...prev.hand, ...drawResult.drawn], drawResult.deck);
  return {
    ...prev,
    handDeck: normalized.handDeck,
    hand: normalized.hand,
  };
};

const MEGAHAND_BENCH_ORDER = new Map<string, number>(
  MEGAHAND_STARTING_DECK.map((ability, index) => [`${ability.ownerName}:${ability.name}:${ability.golfValue}`, index] as const),
);

const getMegaHandBenchSignature = (card: LocalCard) => (
  card.megahandAbility
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
    const leftOrder = MEGAHAND_BENCH_ORDER.get(getMegaHandBenchSignature(left)) ?? Number.MAX_SAFE_INTEGER;
    const rightOrder = MEGAHAND_BENCH_ORDER.get(getMegaHandBenchSignature(right)) ?? Number.MAX_SAFE_INTEGER;
    if (leftOrder !== rightOrder) return leftOrder - rightOrder;
    return left.rank - right.rank;
  });
};

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
  hand: mergePlayerBenchWithFoundation(prev.hand, getChargeUpFoundationTop(prev.playerFoundation)),
  playerFoundation: [],
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

const chooseChargeUpPlayerAutoAction = (state: ChargeUpState): ChargeUpAutoAction | null => {
  const tableauMove = chooseBestChargeUpTableauMove(state, 'player');
  if (tableauMove) return tableauMove;
  const benchCard = chooseBestChargeUpBenchSwapTowardTableau(state);
  if (!benchCard) return null;
  return { type: 'hand', cardId: benchCard.id };
};

const chooseChargeUpEnemyAutoAction = (state: ChargeUpState): ChargeUpAutoAction | null => (
  chooseBestChargeUpTableauMove(state, 'enemy')
);

const applyChargeUpAutoAction = (state: ChargeUpState, action: ChargeUpAutoAction): ChargeUpState => (
  action.type === 'hand'
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
  const maxHp = actorName === 'Mochi'
    ? 10
    : actorName === 'Banks'
      ? 16
      : actorName === 'Jet'
        ? 18
        : actorName === 'Lesser Shade'
          ? 14
          : 20;
  const armor = actorName === 'Hero' ? 2 : actorName === 'Lesser Shade' ? 1 : 0;
  return {
    currentHp: maxHp,
    maxHp,
    armor,
  };
};

const StarterKinTooltipContent = ({ card }: { card: LocalCard }) => {
  const kinKit = getStarterKinKit(card.actorName);
  if (!kinKit) return null;

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
          <span className="text-white/42">AP Cap:</span> {getActorApCap(card.actorName)}
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
  const summary = getMegaHandActorSummary(card.actorName);
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

      {summary.hasAssignedAbilities ? (
        <div className="flex flex-col gap-2">
          {summary.abilities.map((ability) => (
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
  const megaHandActorSummary = getMegaHandActorSummary(card.actorName);
  const apCap = megaHandActorSummary.apCap;
  const hpMax = card.actorName === 'Mochi' ? 10 : card.actorName === 'Banks' ? 16 : card.actorName === 'Jet' ? 18 : 20;
  const armor = card.actorName === 'Hero' ? 2 : 0;
  const abilityName = megaHandActorSummary.abilityLabel;
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

const ActorBoard = ({
  actorName,
  side: _side,
  currentHp,
  maxHp,
  armor,
  onClick,
  buttonRef,
  highlighted = false,
  dimmed = false,
  mobile = false,
  scale = 1,
}: Omit<ActiveActorBoard, 'key'> & {
  onClick?: () => void;
  buttonRef?: React.Ref<HTMLButtonElement>;
  highlighted?: boolean;
  dimmed?: boolean;
  mobile?: boolean;
  scale?: number;
}) => {
  const backdrop = getActorFrameBackdropStyle(actorName);
  const width = (mobile ? 90 : 94) * scale;
  const height = (mobile ? 78 : 88) * scale;
  const outerRadius = 14;
  const innerRadius = 12;
  const accent = actorName === 'Banks'
    ? '#ffd57c'
    : actorName === 'Hero'
      ? '#ff9ccf'
      : actorName === 'Mochi'
        ? '#b89aff'
        : actorName === 'Lesser Shade'
          ? '#ff8a8a'
          : actorName === 'Darkheart'
            ? '#ff8ca1'
          : actorName === 'Lightbloom'
            ? '#9fffd8'
            : '#f0f0f0';

  return (
    <button
      ref={buttonRef}
      type="button"
      onClick={onClick}
      className={`relative shrink-0 overflow-hidden border p-[2px] text-left transition ${
        onClick ? 'cursor-pointer' : 'cursor-default'
      }`}
      style={{
        width,
        height,
        borderRadius: outerRadius,
        borderColor: highlighted ? 'rgba(142,242,212,0.82)' : backdrop.border,
        boxShadow: highlighted ? '0 0 28px rgba(110,255,217,0.28)' : backdrop.glow,
        background: highlighted
          ? 'linear-gradient(180deg, rgba(18,48,40,0.12), rgba(255,255,255,0.01))'
          : 'linear-gradient(180deg, rgba(255,255,255,0.03), rgba(255,255,255,0.01))',
        filter: dimmed && !highlighted ? 'saturate(0.58) brightness(0.72)' : undefined,
        opacity: dimmed && !highlighted ? 0.72 : 1,
      }}
    >
      <div
        className="relative h-full overflow-hidden border border-white/8 bg-[linear-gradient(180deg,rgba(11,16,22,0.96),rgba(7,9,12,0.98))] text-white"
        style={{ borderRadius: innerRadius }}
      >
        <div className="absolute inset-0" style={{ background: backdrop.background }} />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_78%,rgba(255,255,255,0.07),transparent_42%)]" />
        <div className="relative flex h-full flex-col justify-between p-2.5">
          <div className="text-center">
            <div className="text-[9px] font-black uppercase tracking-[0.16em] text-white">{actorName}</div>
          </div>

          <div>
            <div className="rounded-[10px] border border-white/10 bg-black/24 px-2 py-1.5 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.03)]">
              <CombatVitalsBar
                hp={currentHp}
                hpMax={maxHp}
                armor={armor}
                superArmor={0}
                accent={accent}
              />
            </div>
          </div>
        </div>
      </div>
    </button>
  );
};

const HeroBoard = ({
  mobile = false,
  hp = 20,
  maxHp = 20,
  armor = 2,
  onClick,
  buttonRef,
  highlighted = false,
  dimmed = false,
}: {
  mobile?: boolean;
  hp?: number;
  maxHp?: number;
  armor?: number;
  onClick?: () => void;
  buttonRef?: React.Ref<HTMLButtonElement>;
  highlighted?: boolean;
  dimmed?: boolean;
}) => (
  <ActorBoard
    key="hero-board"
    actorName="Hero"
    side="player"
    currentHp={hp}
    maxHp={maxHp}
    armor={armor}
    onClick={onClick}
    buttonRef={buttonRef}
    highlighted={highlighted}
    dimmed={dimmed}
    mobile={mobile}
    scale={MEGAHAND_ACTOR_BOARD_SCALE}
  />
);

const LesserShadeBoard = ({
  mobile = false,
  hp = 14,
  maxHp = 14,
  armor = 1,
  onClick,
  buttonRef,
  highlighted = false,
  dimmed = false,
}: {
  mobile?: boolean;
  hp?: number;
  maxHp?: number;
  armor?: number;
  onClick?: () => void;
  buttonRef?: React.Ref<HTMLButtonElement>;
  highlighted?: boolean;
  dimmed?: boolean;
}) => (
  <ActorBoard
    key="lesser-shade-board"
    actorName="Lesser Shade"
    side="enemy"
    currentHp={hp}
    maxHp={maxHp}
    armor={armor}
    onClick={onClick}
    buttonRef={buttonRef}
    highlighted={highlighted}
    dimmed={dimmed}
    mobile={mobile}
    scale={MEGAHAND_ACTOR_BOARD_SCALE}
  />
);

export function MegaHandVariant() {
  const [state, setState] = useState<ChargeUpState>(() => createInitialState());
  const [currentTurn, setCurrentTurn] = useState<ChargeUpTurn>('player');
  const [autoPlayMode, setAutoPlayMode] = useState<ChargeUpAutoPlayMode>('off');
  const [simulationPaused, setSimulationPaused] = useState(false);
  const [dragAnim, setDragAnim] = useState<ChargeUpDragAnim | null>(null);
  const [abilityCallouts, setAbilityCallouts] = useState<AbilityCalloutEntry[]>([]);
  const [targetingState, setTargetingState] = useState<ChargeUpTargetingState | null>(null);
  const [cardEditorOpen, setCardEditorOpen] = useState(false);
  const [cardEditorCards, setCardEditorCards] = useState<EditableMegaHandAbilityCard[]>(() => toEditableMegaHandCards(MEGAHAND_ABILITY_CATALOG));
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
  const playerActorBoardRef = useRef<HTMLButtonElement | null>(null);
  const enemyActorBoardRef = useRef<HTMLButtonElement | null>(null);
  const supportCardRefs = useRef<Record<string, HTMLButtonElement | null>>({});
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
  const jetCombatant = state.combatants.jet ?? createMegaHandCombatant('Jet');
  const lesserShadeCombatant = state.combatants['lesser-shade'] ?? createMegaHandCombatant('Lesser Shade');
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

    const cardRank = getChargeUpRuleRank(sourceCard);
    const foundationRank = getChargeUpRuleRank(playerFoundationTop);
    const canTargetPrime = targetingState.source === 'hand'
      && (
        !playerFoundationTop
        || (cardRank !== null && foundationRank !== null && isAdjacentRank(cardRank, foundationRank))
      );
    const isHeroTackle = resolvedAbility.ownerName === 'Hero' && resolvedAbility.name === 'Tackle';
    const isHeroFetch = resolvedAbility.ownerName === 'Hero' && resolvedAbility.name === 'Fetch';
    const isMochiHealingPurr = resolvedAbility.ownerName === 'Mochi' && resolvedAbility.name === 'Healing Purr';
    const isMochiCatNap = resolvedAbility.ownerName === 'Mochi' && resolvedAbility.name === 'Cat Nap';
    const isMochiProwl = resolvedAbility.ownerName === 'Mochi' && resolvedAbility.name === 'Prowl';

    if (isHeroTackle) {
      return {
        ...targetingState,
        card: sourceCard,
        abilityCard: resolvedAbility,
        canTargetPrime: false,
        canTargetTableau: targetingState.source === 'foundation' && playerFoundationTop !== null,
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
        canTargetTableau: targetingState.source === 'foundation' && playerFoundationTop !== null,
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
        canTargetTableau: targetingState.source === 'foundation' && playerFoundationTop !== null,
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
        canTargetTableau: targetingState.source === 'foundation' && playerFoundationTop !== null,
        canTargetPlayerBoard: true,
        canTargetEnemyBoard: false,
      };
    }

    return {
      ...targetingState,
      card: sourceCard,
      abilityCard: resolvedAbility,
      canTargetPrime,
      canTargetTableau: targetingState.source === 'foundation' && playerFoundationTop !== null,
      canTargetPlayerBoard: true,
      canTargetEnemyBoard: true,
    };
  }, [enemyFoundationTop, playerFoundationTop, state.discard.length, state.hand, targetingState]);
  const targetingActive = targetingContext !== null;
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
  const playerBoardHighlighted = targetingContext?.canTargetPlayerBoard ?? false;
  const enemyBoardHighlighted = targetingContext?.canTargetEnemyBoard ?? false;
  const primeTargetHighlighted = targetingContext?.canTargetPrime ?? false;
  const activeActorBoards = useMemo<ActiveActorBoard[]>(() => {
    const boards: ActiveActorBoard[] = [];
    const seenActors = new Set<string>();
    const registerBoard = (card: LocalCard | null, side: ChargeUpActorSide) => {
      if (!card) return;
      const actorName = card.megahandAbility?.ownerName ?? card.actorName;
      if (seenActors.has(actorName)) return;
      seenActors.add(actorName);
      const vitals = getMegaHandActorVitals(actorName);
      boards.push({
        key: `${side}:${actorName}`,
        actorName,
        side,
        ...vitals,
      });
    };

    state.hand.forEach((card) => {
      registerBoard(card, 'player');
    });
    registerBoard(playerFoundationTop, 'player');
    registerBoard(enemyFoundationTop, 'enemy');
    return boards;
  }, [enemyFoundationTop, playerFoundationTop, state.hand]);

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

    if (!card || !from || !to) return;

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

    applyStateUpdate((prev) => {
      let nextState = prev;
      const ability = targetingContext.card.megahandAbility;
      const sourceKey = getAbilitySourceCombatantKey(ability ?? targetingContext.abilityCard);
      const targetKey = getMegaHandCombatantKey(targetActorName);
      const sourceCombatant = sourceKey ? nextState.combatants[sourceKey] : null;
      const prowlBonus = sourceCombatant?.prowlActive && ability?.name !== 'Prowl' ? 1 : 0;
      const effectivePower = Math.max(0, (ability?.power ?? 0) + prowlBonus);
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
        && targetKind === 'actor'
        && targetKey
        && sourceKey
        && ability.name !== 'Fetch'
        && ability.name !== 'Healing Purr'
        && ability.name !== 'Cat Nap'
        && ability.name !== 'Prowl'
        && effectivePower > 0
      ) {
        const packet: DamagePacket = {
          physical: effectivePower,
          elemental: {},
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
        const playerPartyKeys: MegaHandCombatantKey[] = ['hero', 'mochi', 'jet'];
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

      if (targetKind === 'tableau') {
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
    }
  }, [applyStateUpdate, queueAbilityCallout, targetingContext]);

  const handleActorBoardTarget = useCallback((actorName: string, targetRef: HTMLElement | null) => {
    if (!targetingContext) return;
    const isPlayerTarget = actorName !== 'Lesser Shade';
    const isValid = isPlayerTarget ? canTargetPlayerActorBoard(actorName) : targetingContext.canTargetEnemyBoard;
    if (!isValid) {
      setTargetingState(null);
      return;
    }
    applyTargetedAbility(actorName, actorName, 'actor', getChargeUpCalloutAnchorPoint(targetRef));
  }, [applyTargetedAbility, canTargetPlayerActorBoard, targetingContext]);

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

  const saveCardEditorCards = useCallback(async () => {
    setCardEditorSaveState('saving');
    setCardEditorSaveMessage(null);
    try {
      const content = megaHandCardEditorHelpers.buildMegaHandCatalogFile(cardEditorCards);
      const response = await fetch('/__write-file', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          path: 'src/golf/singlePlayerActors/megahandAbilityCatalog.ts',
          content,
        }),
      });
      if (!response.ok) {
        throw new Error(await response.text());
      }
      setCardEditorSaveState('saved');
      setCardEditorSaveMessage('Saved directly to megahandAbilityCatalog.ts');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to save card data.';
      setCardEditorSaveState('error');
      setCardEditorSaveMessage(message);
    }
  }, [cardEditorCards]);

  useEffect(() => {
    const handleResize = () => setViewport({ width: window.innerWidth, height: window.innerHeight });
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented || megaHandCardEditorHelpers.isTextInputTarget(event.target)) return;
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
  }, [cardEditorCards]);

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
      ...ensureHandSize(applyPrimeEndTurnAp(prev)),
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
    applyStateUpdate((prev) => startChargeUpEnemyTurn(ensureHandSize(applyPrimeEndTurnAp(prev))));
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
  const interactionLocked = currentTurn !== 'player' || autoPlayMode !== 'off' || dragAnim !== null || targetingActive;
  const automationControlsVisible = currentTurn === 'enemy' || autoPlayMode !== 'off' || simulationPaused;
  const automationPaused = simulationPaused && automationControlsVisible;
  const actorBoardBaseWidth = (isCompactViewport ? 90 : 94) * MEGAHAND_ACTOR_BOARD_SCALE;
  const primePairWidth = (foundationCardWidth * 2) + foundationGap;
  const primeSideOffset = Math.round((primePairWidth / 2) + foundationGap);
  const teamEnergyBarWidth = Math.max(170, Math.round(actorBoardBaseWidth * 2.25));
  const playerBoardLaneWidth = Math.max(teamEnergyBarWidth, Math.round(actorBoardBaseWidth * 1.35));
  const enemyBoardLaneWidth = Math.max(teamEnergyBarWidth, Math.round(actorBoardBaseWidth * 1.15));
  const verticalEnergyRailWidth = 68;
  const verticalEnergyMeterHeight = Math.max(150, Math.round(actorBoardBaseWidth * 1.7));
  const primeLaneSideShellContentWidth = Math.max(
    playerBoardLaneWidth + verticalEnergyRailWidth + 16,
    enemyBoardLaneWidth + verticalEnergyRailWidth + 16,
  );
  const primeLaneHorizontalGap = 16;
  const primeLaneAvailableSideWidth = Math.max(
    260,
    Math.floor((viewport.width - primePairWidth - (primeLaneHorizontalGap * 2) - (isCompactViewport ? 24 : 48)) / 2),
  );
  const primeLaneSideShellScale = Math.min(1, primeLaneAvailableSideWidth / Math.max(primeLaneSideShellContentWidth, 1));
  const primeLaneSideShellWidth = Math.round(primeLaneSideShellContentWidth * primeLaneSideShellScale);
  const primeLaneFooterHeight = automationControlsVisible ? 0 : 42;
  const primeLaneSideShellContentHeight = verticalEnergyMeterHeight + primeLaneFooterHeight;
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

  const renderPrimeCards = () => (
    <div className="flex items-center justify-center" style={{ gap: foundationGap }}>
      <div className="relative" style={{ zIndex: primeTargetHighlighted ? 30 : 1 }}>
        {playerFoundationTop && playerFoundationAbilityCard ? (
          <ActorAbilityCard
            abilityCard={playerFoundationAbilityCard}
            highlighted={primeTargetHighlighted || (!targetingActive && !!playerFoundationTop)}
            dimmed={targetingActive && !primeTargetHighlighted}
            mobile={foundationCompact}
            showPower={false}
            buttonRef={(node) => { playerFoundationTargetRef.current = node; }}
            onClick={
              primeTargetHighlighted
                ? handlePrimeTarget
                : (!interactionLocked && playerFoundationAbilityCard.ready
                    ? () => selectChargedCard('foundation', playerFoundationTop.id)
                    : undefined)
            }
          />
        ) : (
          renderFoundationPlaceholder((node) => { playerFoundationTargetRef.current = node; })
        )}
      </div>
      {enemyFoundationTop && enemyFoundationAbilityCard ? (
        <ActorAbilityCard
          abilityCard={enemyFoundationAbilityCard}
          mobile={foundationCompact}
          enemy
          dimmed={targetingActive}
          showPower={false}
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
            <div className="flex items-center gap-4" style={{ minHeight: verticalEnergyMeterHeight }}>
              <div className="flex justify-end" style={{ width: verticalEnergyRailWidth, height: verticalEnergyMeterHeight }}>
                <div className="flex h-full w-full flex-col items-center rounded-[16px] border border-white/12 bg-black/35 px-2 py-3 shadow-[0_12px_28px_rgba(0,0,0,0.24)]">
                  <div className="mb-2 text-[14px] font-black leading-none text-white/52">⚡</div>
                  <AbilityApBar
                    ap={state.playerEnergy}
                    maxAp={MEGAHAND_MAX_ENERGY}
                    orientation="vertical"
                    barClassName="w-[20px] rounded-[7px]"
                    className="h-full flex-1"
                  />
                </div>
              </div>
              <div
                className="flex items-center justify-end"
                style={{ width: playerBoardLaneWidth, minHeight: verticalEnergyMeterHeight, zIndex: playerBoardHighlighted ? 30 : 1 }}
              >
                <ActorBoard
                  actorName="PLAYER"
                  side="player"
                  currentHp={heroCombatant.hp}
                  maxHp={heroCombatant.hpMax}
                  armor={heroCombatant.armor}
                  mobile={isCompactViewport}
                  scale={MEGAHAND_ACTOR_BOARD_SCALE}
                  onClick={playerBoardHighlighted ? () => handleActorBoardTarget('Hero', playerActorBoardRef.current) : undefined}
                  buttonRef={playerActorBoardRef}
                  highlighted={playerBoardHighlighted}
                  dimmed={targetingActive && !playerBoardHighlighted}
                />
              </div>
            </div>
            {!automationControlsVisible ? (
              <div className="flex" style={{ width: verticalEnergyRailWidth }}>
                <button
                  type="button"
                  onClick={endTurn}
                  disabled={currentTurn !== 'player' || autoPlayMode !== 'off' || dragAnim !== null || targetingActive}
                  className="w-full rounded-[14px] border border-white/12 bg-black/35 px-3 py-2 text-[9px] font-semibold uppercase tracking-[0.14em] text-white/72 transition hover:border-[#ffd166]/55 hover:text-white lg:text-[11px]"
                >
                  End Turn
                </button>
              </div>
            ) : null}
          </div>
        </div>
      </div>
      {/* Megahand layout rule: the prime pair is the fixed center anchor of the scene.
          Keep left and right side shells symmetrical so UX passes cannot nudge the primes. */}
      <div className="shrink-0" style={{ width: primePairWidth }}>
        {renderPrimeCards()}
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
            <div className="flex items-center gap-4" style={{ minHeight: verticalEnergyMeterHeight }}>
              <div
                className="flex items-center justify-start"
                style={{ width: enemyBoardLaneWidth, minHeight: verticalEnergyMeterHeight, zIndex: enemyBoardHighlighted ? 30 : 1 }}
              >
                <LesserShadeBoard
                  mobile={isCompactViewport}
                  hp={lesserShadeCombatant.hp}
                  maxHp={lesserShadeCombatant.hpMax}
                  armor={lesserShadeCombatant.armor}
                  onClick={enemyBoardHighlighted ? () => handleActorBoardTarget('Lesser Shade', enemyActorBoardRef.current) : undefined}
                  buttonRef={enemyActorBoardRef}
                  highlighted={enemyBoardHighlighted}
                  dimmed={targetingActive && !enemyBoardHighlighted}
                />
              </div>
              <div className="flex justify-start" style={{ width: verticalEnergyRailWidth, height: verticalEnergyMeterHeight }}>
                <div className="flex h-full w-full flex-col items-center rounded-[16px] border border-white/12 bg-black/35 px-2 py-3 shadow-[0_12px_28px_rgba(0,0,0,0.24)]">
                  <div className="mb-2 text-[14px] font-black leading-none text-white/52">⚡</div>
                  <AbilityApBar
                    ap={state.enemyEnergy}
                    maxAp={MEGAHAND_MAX_ENERGY}
                    orientation="vertical"
                    barClassName="w-[20px] rounded-[7px]"
                    className="h-full flex-1"
                  />
                </div>
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
        {state.hand.map((card, index) => {
          const resolvedAbilityCard = resolveMegaHandAbilityCard({
            actorName: card.actorName,
            currentAp: card.tableauCharge,
            currentEnergyCost: getCardActivationEnergyCost(card),
            liveGolfValue: getChargeUpRuleRank(card) ?? card.rank,
            foundationCardId: card.id,
            abilityOverride: card.megahandAbility,
            currentRarity: card.currentRarity,
          });
          const cardRank = getChargeUpRuleRank(card);
          const foundationRank = getChargeUpRuleRank(playerFoundationTop);
          const affordable = canAffordHandCardPlay(state, 'player', card);
          const playable = (
            affordable
            && (
              !playerFoundationTop
              || (cardRank !== null && foundationRank !== null && isAdjacentRank(cardRank, foundationRank))
            )
          );
          const selectedForTargeting = targetingContext?.source === 'hand' && targetingContext.cardId === card.id;
          const floatDuration = 3.8 + ((index % 3) * 0.45);
          const floatDelay = index * 0.22;
          return (
            <div
              key={card.id}
              className="shrink-0"
              style={{
                width: supportCardWidth,
                height: supportCardHeight + (handFloatAmplitude * 2),
                animationName: 'megahand-hand-float',
                animationDuration: `${floatDuration}s`,
                animationTimingFunction: 'ease-in-out',
                animationIterationCount: 'infinite',
                animationDirection: index % 2 === 0 ? 'alternate' : 'alternate-reverse',
                animationDelay: `${floatDelay}s`,
                willChange: 'transform',
              }}
            >
              <ActorAbilityCard
                abilityCard={resolvedAbilityCard}
                mobile={foundationCompact}
                width={supportCardWidth}
                height={supportCardHeight}
                buttonRef={(node) => {
                  supportCardRefs.current[card.id] = node;
                }}
                highlighted={selectedForTargeting || (!targetingActive && currentTurn === 'player' && playable)}
                dimmed={targetingActive ? !selectedForTargeting : currentTurn === 'player' && !playable}
                onClick={
                  !interactionLocked && resolvedAbilityCard.ready
                    ? () => selectChargedCard('hand', card.id)
                    : (!interactionLocked && playable ? () => playHandCardAsFoundation(card.id) : undefined)
                }
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
      {targetingActive ? (
        <button
          type="button"
          aria-label="Cancel ability targeting"
          className="absolute inset-0 z-20 bg-[rgba(3,5,8,0.58)]"
          onClick={cancelTargeting}
        />
      ) : null}
      <div className="mx-auto flex h-full w-full max-w-[min(1680px,100vw-12px)] flex-col items-center gap-3 px-1.5 py-2 lg:max-w-[min(1680px,100vw-16px)] lg:gap-2 lg:px-4 lg:py-5">
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
              <button
                type="button"
                aria-label="Start autoplay"
                title="Start autoplay"
                onClick={startAutoplay}
                disabled={dragAnim !== null || currentTurn !== 'player'}
                className={`absolute left-3 top-3 z-10 flex items-center justify-center rounded-[14px] border border-white/12 bg-black/35 text-white/72 transition ${
                  foundationCompact ? 'h-10 w-10 text-xl' : 'h-11 w-11 text-2xl'
                } ${
                  dragAnim !== null || currentTurn !== 'player'
                    ? 'cursor-default border-white/10 bg-white/[0.04] text-white/24'
                    : 'hover:border-[#8ef2d4]/55 hover:text-white'
                }`}
              >
                ▶
              </button>
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
                  <div className="flex justify-center">
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
                <div className="flex justify-center">
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
                      highlighted={dragAnim.actor === 'player'}
                      enemy={dragAnim.actor === 'enemy'}
                    />
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
      <MegaHandCardEditorModal
        open={cardEditorOpen}
        cards={cardEditorCards}
        onClose={() => setCardEditorOpen(false)}
        onChange={setCardEditorCards}
        onSave={saveCardEditorCards}
        saveState={cardEditorSaveState}
        saveMessage={cardEditorSaveMessage}
      />
    </div>
  );
}
