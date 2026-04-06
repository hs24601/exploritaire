import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AbilityApBar } from '../components/combat/AbilityApBar';
import { Card } from '../components/Card';
import { Tooltip } from '../components/Tooltip';
import type { Card as GameCard, Element } from '../engine/types';
import { getActorApCap, getKinProfile, getStarterKinKit, getStarterPackAbilityName } from './data/starterKinData';

type Suit = 'spades' | 'hearts' | 'clubs' | 'diamonds';

type LocalCard = {
  id: string;
  rank: number;
  suit: Suit;
  tableauCharge: number;
  actorName: string;
};

type ChargeUpState = {
  tableau: LocalCard[][];
  deck: LocalCard[];
  discard: LocalCard[];
  hand: LocalCard[];
  playerFoundation: LocalCard[];
  enemyFoundation: LocalCard[];
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

const TABLEAU_COLUMNS = 7;
const TABLEAU_ROWS = 4;
const TABLEAU_STACK_OFFSET = 52;
const TABLEAU_CARD_ASPECT_RATIO = 144 / 102;
const TABLEAU_BACK_HEIGHT_RATIO = 64 / 144;
const CHARGE_UP_PLAYER_AUTO_STEP_MS = 260;
const CHARGE_UP_ENEMY_STEP_MS = 340;
const CHARGE_UP_ENEMY_DRAG_MIN_MS = 320;
const CHARGE_UP_ENEMY_DRAG_MAX_MS = 760;
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
const ENEMY_PERSONAS = [
  { actorName: 'Thorn Matron', rank: 12, suit: 'clubs' as Suit },
  { actorName: 'Mawling Raider', rank: 10, suit: 'spades' as Suit },
  { actorName: 'Shade Wisp', rank: 7, suit: 'hearts' as Suit },
  { actorName: 'Ember Mite', rank: 5, suit: 'diamonds' as Suit },
  { actorName: 'Dust Skipper', rank: 9, suit: 'spades' as Suit },
  { actorName: 'Mist Wisp', rank: 4, suit: 'clubs' as Suit },
  { actorName: 'Thorn Drone', rank: 11, suit: 'diamonds' as Suit },
] as const;
let refillSequence = 0;
let localSequence = 0;
let actorSequence = 0;

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
  };
};

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
  };
};

const createEnemyPersonaCard = (prefix = 'chargeup-enemy'): LocalCard => {
  localSequence += 1;
  const persona = ENEMY_PERSONAS[Math.floor(Math.random() * ENEMY_PERSONAS.length)] ?? ENEMY_PERSONAS[0];
  return {
    id: `${prefix}-${persona.actorName.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${localSequence}`,
    rank: persona.rank,
    suit: persona.suit,
    tableauCharge: 0,
    actorName: persona.actorName,
  };
};

const createStarterHand = (): LocalCard[] => [
  createActorCard('Hero', 6, 'diamonds', 'chargeup-hand'),
  createActorCard('Mochi', 8, 'hearts', 'chargeup-hand'),
  createActorCard('Banks', 13, 'clubs', 'chargeup-hand'),
  createActorCard('Jet', 2, 'spades', 'chargeup-hand'),
  createActorCard('Whis', 9, 'clubs', 'chargeup-hand'),
];

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

const createInitialState = (): ChargeUpState => {
  const deck = createDeck();
  const tableauCards = deck.slice(0, TABLEAU_COLUMNS * TABLEAU_ROWS);
  const tableau = Array.from({ length: TABLEAU_COLUMNS }, (_, columnIndex) =>
    tableauCards.slice(columnIndex * TABLEAU_ROWS, (columnIndex + 1) * TABLEAU_ROWS),
  );

  return {
    tableau,
    deck: deck.slice(TABLEAU_COLUMNS * TABLEAU_ROWS),
    discard: [],
    hand: createStarterHand(),
    playerFoundation: [],
    enemyFoundation: [createEnemyPersonaCard()],
  };
};

const getChargeUpFoundationTop = (foundation: LocalCard[]) => foundation[foundation.length - 1] ?? null;

const getChargeUpLegalTableauMoves = (tableau: LocalCard[][], foundationTop: LocalCard | null) => {
  if (!foundationTop) return [] as Array<{ columnIndex: number; columnCardIndex: number; card: LocalCard }>;
  return tableau.flatMap((column, columnIndex) => {
    const topCardIndex = column.length - 1;
    const card = column[topCardIndex] ?? null;
    if (!card || !isAdjacentRank(card.rank, foundationTop.rank)) return [];
    return [{ columnIndex, columnCardIndex: topCardIndex, card }];
  });
};

const getChargeUpLegalHandCards = (hand: LocalCard[], foundationTop: LocalCard | null) => (
  foundationTop
    ? hand.filter((card) => isAdjacentRank(card.rank, foundationTop.rank))
    : [...hand]
);

const applyPlayHandCardAsFoundation = (prev: ChargeUpState, cardId: string): ChargeUpState => {
  const handIndex = prev.hand.findIndex((card) => card.id === cardId);
  if (handIndex < 0) return prev;
  const nextCard = prev.hand[handIndex];
  if (!nextCard) return prev;
  const top = getChargeUpFoundationTop(prev.playerFoundation);
  if (top && !isAdjacentRank(nextCard.rank, top.rank)) return prev;
  const nextHand = prev.hand.filter((card) => card.id !== cardId);
  if (top) {
    nextHand.push(top);
  }
  return {
    ...prev,
    hand: nextHand,
    playerFoundation: [nextCard],
    enemyFoundation: prev.enemyFoundation.length === 0 ? [createEnemyPersonaCard()] : prev.enemyFoundation,
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
  const foundation = actor === 'player' ? prev.playerFoundation : prev.enemyFoundation;
  const foundationTop = getChargeUpFoundationTop(foundation);
  if (!foundationTop || !isAdjacentRank(nextCard.rank, foundationTop.rank)) return prev;

  const nextColumn = column.filter((_, idx) => idx !== columnCardIndex);
  let nextTableau = prev.tableau.map((innerColumn, index) => (
    index === columnIndex ? nextColumn : innerColumn
  ));
  nextTableau = refillColumnToCapacity(nextTableau, columnIndex);

  const nextFoundationTop: LocalCard = {
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
  hand: createStarterHand(),
  playerFoundation: [],
  enemyFoundation: [createEnemyPersonaCard()],
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
      ? getChargeUpLegalHandCards(nextState.hand, nextTop).length
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
  const legalHandCards = getChargeUpLegalHandCards(state.hand, foundationTop);
  if (legalHandCards.length === 0) return null;

  let bestCard = legalHandCards[0] ?? null;
  let bestScore = -Infinity;

  legalHandCards.forEach((card, index) => {
    const nextState = applyPlayHandCardAsFoundation(state, card.id);
    const nextTop = getChargeUpFoundationTop(nextState.playerFoundation);
    const continuationCount = getChargeUpLegalTableauMoves(nextState.tableau, nextTop).length;
    const extraHandOptions = getChargeUpLegalHandCards(nextState.hand, nextTop).length;
    const score = (continuationCount * 100) + (extraHandOptions * 10) + card.rank - index;
    if (score > bestScore) {
      bestScore = score;
      bestCard = card;
    }
  });

  return bestCard;
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
    const legalHandCards = [...getChargeUpLegalHandCards(nextEntry.state.hand, foundationTop)]
      .sort((left, right) => {
        const leftNext = applyPlayHandCardAsFoundation(nextEntry.state, left.id);
        const rightNext = applyPlayHandCardAsFoundation(nextEntry.state, right.id);
        const leftTop = getChargeUpFoundationTop(leftNext.playerFoundation);
        const rightTop = getChargeUpFoundationTop(rightNext.playerFoundation);
        const leftTableauOptions = getChargeUpLegalTableauMoves(leftNext.tableau, leftTop).length;
        const rightTableauOptions = getChargeUpLegalTableauMoves(rightNext.tableau, rightTop).length;
        if (rightTableauOptions !== leftTableauOptions) return rightTableauOptions - leftTableauOptions;
        const leftHandOptions = getChargeUpLegalHandCards(leftNext.hand, leftTop).length;
        const rightHandOptions = getChargeUpLegalHandCards(rightNext.hand, rightTop).length;
        if (rightHandOptions !== leftHandOptions) return rightHandOptions - leftHandOptions;
        return right.rank - left.rank;
      });

    legalHandCards.forEach((card) => {
      const nextState = applyPlayHandCardAsFoundation(nextEntry.state, card.id);
      if (nextState === nextEntry.state) return;
      const key = getChargeUpPlayerBenchStateKey(nextState);
      if (visited.has(key)) return;
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
  const benchPath = findChargeUpBenchPathToTableau(state);
  if (!benchPath || benchPath.length === 0) return null;
  return { type: 'hand', cardId: benchPath[0] };
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

const getChargeUpEnemyDragDurationMs = (from: { x: number; y: number }, to: { x: number; y: number }) => {
  const distance = Math.hypot(to.x - from.x, to.y - from.y);
  return clampNumber(
    Math.round(240 + (distance * 0.9)),
    CHARGE_UP_ENEMY_DRAG_MIN_MS,
    CHARGE_UP_ENEMY_DRAG_MAX_MS,
  );
};

const getActorFrameBackdropStyle = (actorName: string) => {
  if (actorName === 'Hero') {
    return {
      border: 'rgba(186,255,228,0.7)',
      glow: '0 0 28px rgba(146,255,218,0.32), 0 0 10px rgba(146,255,218,0.24)',
      background: 'radial-gradient(circle at 50% 18%, rgba(180,255,220,0.18), rgba(14,28,24,0.08) 36%, rgba(4,6,10,0) 78%)',
    };
  }
  if (actorName === 'Mochi') {
    return {
      border: 'rgba(255,171,201,0.58)',
      glow: '0 0 26px rgba(255,122,180,0.26), 0 0 10px rgba(255,122,180,0.18)',
      background: 'radial-gradient(circle at 50% 18%, rgba(255,166,214,0.16), rgba(34,14,26,0.08) 36%, rgba(4,6,10,0) 78%)',
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
  return {
    border: 'rgba(205,182,255,0.52)',
    glow: '0 0 24px rgba(182,140,255,0.18), 0 0 10px rgba(182,140,255,0.14)',
    background: 'radial-gradient(circle at 50% 18%, rgba(218,198,255,0.14), rgba(24,16,34,0.08) 36%, rgba(4,6,10,0) 78%)',
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
  const apCap = getActorApCap(card.actorName);
  const hpMax = card.actorName === 'Mochi' ? 10 : card.actorName === 'Banks' ? 16 : card.actorName === 'Jet' ? 18 : 20;
  const armor = card.actorName === 'Hero' ? 2 : 0;
  const abilityName = getStarterPackAbilityName(card.actorName, 1) ?? 'Prime';
  const tooltipContent = getStarterKinKit(card.actorName) ? <StarterKinTooltipContent card={card} /> : null;
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

export function ChargeUpVariant() {
  const [state, setState] = useState<ChargeUpState>(() => createInitialState());
  const [currentTurn, setCurrentTurn] = useState<ChargeUpTurn>('player');
  const [autoPlayMode, setAutoPlayMode] = useState<ChargeUpAutoPlayMode>('off');
  const [simulationPaused, setSimulationPaused] = useState(false);
  const [dragAnim, setDragAnim] = useState<ChargeUpDragAnim | null>(null);
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
  const supportCardRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const tableauTopRefs = useRef<Record<number, HTMLDivElement | null>>({});
  const playerAutoTimeoutRef = useRef<number | null>(null);
  const enemyAiTimeoutRef = useRef<number | null>(null);
  const playerAutoRunIdRef = useRef(0);
  const playerActionRunIdRef = useRef(0);
  const enemyTurnRunIdRef = useRef(0);
  const enemyDragNodeRef = useRef<HTMLDivElement | null>(null);
  const enemyDragRafRef = useRef(0);
  const enemyDragTimeoutRef = useRef(0);
  const enemyDragCompletionRef = useRef<(() => void) | null>(null);
  const dragActiveRef = useRef(false);
  const enemyDragSequenceIdRef = useRef(0);
  const isPortraitMobile = viewport.width < 768 && viewport.width <= viewport.height;
  const isLandscapeMobile = viewport.width <= 1024 && viewport.width > viewport.height;
  const isCompactViewport = isPortraitMobile || isLandscapeMobile;
  const isShortDesktop = !isCompactViewport && viewport.height < 880;
  const isMobileCardScale = isCompactViewport;
  const foundationCompact = isCompactViewport;
  const foundationCardWidth = foundationCompact ? 88 : 118;
  const foundationCardHeight = foundationCompact ? 136 : 182;
  const foundationGap = foundationCompact ? 16 : 28;
  const supportGap = Math.max(8, Math.round(foundationGap / 2));
  const lowerLaneWidth = Math.min(1500, viewport.width - (isCompactViewport ? 24 : 48));
  const supportBaseCardWidth = foundationCompact ? 88 : 118;
  const supportBaseCardHeight = foundationCompact ? 136 : 182;
  const supportCount = Math.max(1, state.hand.length);
  const portraitSupportWidth = Math.max(0, lowerLaneWidth - 16);
  const nonPortraitSupportWidth = Math.max(0, Math.floor((lowerLaneWidth / 2) - foundationCardWidth - (foundationGap * 1.5)));
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
  const supportContentMode = supportCardWidth <= (foundationCompact ? 58 : 72)
    ? 'minimal'
    : supportCardWidth <= (foundationCompact ? 74 : 92)
      ? 'compact'
      : 'full';
  const tableauColumnsPerRow = isCompactViewport ? 4 : TABLEAU_COLUMNS;
  const tableauRowCount = Math.ceil(TABLEAU_COLUMNS / tableauColumnsPerRow);
  const tableauVisibleRowCount = isCompactViewport ? 2 : isShortDesktop ? 3 : TABLEAU_ROWS;
  const tableauPanelPaddingTop = isCompactViewport ? 14 : isShortDesktop ? 22 : 30;
  const tableauPanelPaddingX = isCompactViewport ? 8 : 20;
  const tableauPanelInnerWidth = Math.max(
    0,
    (tableauPanelWidth || (viewport.width - (isCompactViewport ? 24 : 48))) - (tableauPanelPaddingX * 2),
  );
  const tableauTargetColumnWidth = tableauPanelInnerWidth > 0
    ? (tableauPanelInnerWidth * 0.75) / tableauColumnsPerRow
    : (isMobileCardScale ? 48 : 102);
  const tableauMinGap = isCompactViewport ? 5 : 10;
  const tableauMaxGap = isCompactViewport ? 14 : 24;
  const tableauMaxWidthToFit = (tableauPanelInnerWidth - (tableauMinGap * Math.max(0, tableauColumnsPerRow - 1))) / tableauColumnsPerRow;
  const tableauMinWidth = isCompactViewport ? 34 : 80;
  const tableauMaxWidthByHeight = Math.floor(supportCardHeight / TABLEAU_CARD_ASPECT_RATIO);
  const tableauMaxWidth = Math.max(
    tableauMinWidth,
    Math.min(
      isCompactViewport ? 110 : isShortDesktop ? 152 : 176,
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
  const tableauOffset = Math.round(tableauFrontHeight * (isCompactViewport ? 0.29 : isShortDesktop ? 0.31 : TABLEAU_STACK_OFFSET / 144));
  const tableauColumnHeight = tableauFrontHeight + (Math.max(0, tableauVisibleRowCount - 1) * tableauOffset);
  const tableauRowGap = isCompactViewport ? clampNumber(Math.round(tableauFrontHeight * 0.16), 10, 18) : 0;
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

  useEffect(() => {
    const handleResize = () => setViewport({ width: window.innerWidth, height: window.innerHeight });
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    latestStateRef.current = state;
  }, [state]);

  useEffect(() => {
    currentTurnRef.current = currentTurn;
  }, [currentTurn]);

  useEffect(() => {
    simulationPausedRef.current = simulationPaused;
  }, [simulationPaused]);

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
    }
  ), [clearDragAnimation, clearEnemyAiTimeout, clearPlayerAutoTimeout]);

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
    currentTurnRef.current = 'player';
    setCurrentTurn('player');
    setSimulationPaused(false);
  }, [clearDragAnimation, clearEnemyAiTimeout]);

  const runEnemyTurnStep = useCallback(async () => {
    const runId = enemyTurnRunIdRef.current;
    if (currentTurnRef.current !== 'enemy' || simulationPausedRef.current) return;
    const current = latestStateRef.current;
    const action = chooseChargeUpEnemyAutoAction(current);
    if (!action) {
      finishEnemyTurn();
      return;
    }

    await animateChargeUpAction(current, action);
    if (enemyTurnRunIdRef.current !== runId || currentTurnRef.current !== 'enemy' || simulationPausedRef.current) return;

    const next = applyStateUpdate((prev) => applyChargeUpAutoAction(prev, action));
    if (next === current) {
      finishEnemyTurn();
      return;
    }
    enemyAiTimeoutRef.current = window.setTimeout(() => {
      void runEnemyTurnStep();
    }, CHARGE_UP_ENEMY_STEP_MS);
  }, [animateChargeUpAction, applyStateUpdate, finishEnemyTurn]);

  const startEnemyTurnSequence = useCallback(() => {
    clearPlayerAutoTimeout();
    playerAutoRunIdRef.current += 1;
    playerActionRunIdRef.current += 1;
    clearEnemyAiTimeout();
    clearDragAnimation();
    enemyTurnRunIdRef.current += 1;
    setSimulationPaused(false);
    applyStateUpdate(startChargeUpEnemyTurn);
    currentTurnRef.current = 'enemy';
    setCurrentTurn('enemy');
  }, [applyStateUpdate, clearDragAnimation, clearEnemyAiTimeout, clearPlayerAutoTimeout]);

  const playHandCardAsFoundation = useCallback(async (cardId: string) => {
    if (currentTurnRef.current !== 'player' || autoPlayMode !== 'off' || dragActiveRef.current) return;
    const current = latestStateRef.current;
    const handCard = current.hand.find((card) => card.id === cardId) ?? null;
    if (!handCard) return;
    const foundationTop = getChargeUpFoundationTop(current.playerFoundation);
    if (foundationTop && !isAdjacentRank(handCard.rank, foundationTop.rank)) return;
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
    if (!tableauCard || !foundationTop || !isAdjacentRank(tableauCard.rank, foundationTop.rank)) return;
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
  }, [clearDragAnimation, clearEnemyAiTimeout, clearPlayerAutoTimeout]);

  const startAutoplay = useCallback(() => {
    if (dragAnim !== null || currentTurnRef.current !== 'player') return;
    setSimulationPaused(false);
    setAutoPlayMode('full');
  }, [dragAnim]);

  const toggleAutomationPause = useCallback(() => {
    if (dragAnim !== null) return;
    setSimulationPaused((prev) => !prev);
  }, [dragAnim]);

  const stopAutomation = useCallback(() => {
    if (dragAnim !== null) return;
    clearPlayerAutoTimeout();
    clearEnemyAiTimeout();
    playerAutoRunIdRef.current += 1;
    playerActionRunIdRef.current += 1;
    enemyTurnRunIdRef.current += 1;
    clearDragAnimation();
    setAutoPlayMode('off');
    setSimulationPaused(false);
    currentTurnRef.current = 'player';
    setCurrentTurn('player');
  }, [clearDragAnimation, clearEnemyAiTimeout, clearPlayerAutoTimeout, dragAnim]);

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
        startEnemyTurnSequence();
        return;
      }
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
  }, [animateChargeUpAction, applyStateUpdate, autoPlayMode, clearPlayerAutoTimeout, currentTurn, simulationPaused, startEnemyTurnSequence]);

  const playableVisibleCardExists = visibleCardsByColumn.some((column) =>
    column.some(({ card }) => !!playerFoundationTop && isAdjacentRank(card.rank, playerFoundationTop.rank)),
  );
  const interactionLocked = currentTurn !== 'player' || autoPlayMode !== 'off' || dragAnim !== null;
  const automationControlsVisible = currentTurn === 'enemy' || autoPlayMode !== 'off' || simulationPaused;
  const automationPaused = simulationPaused && automationControlsVisible;

  const renderFoundationPlaceholder = (
    label: 'Player' | 'Enemy',
    targetRef?: (node: HTMLDivElement | null) => void,
  ) => (
    <div
      ref={targetRef}
      className={`flex items-center justify-center rounded-[18px] border border-dashed border-white/14 uppercase tracking-[0.16em] text-white/42 ${
        foundationCompact ? 'text-[10px]' : 'text-[11px]'
      }`}
      style={{ width: foundationCardWidth, height: foundationCardHeight }}
    >
      {label}
    </div>
  );

  const renderFoundationLane = () => (
    <div className="flex items-center justify-center" style={{ gap: foundationGap }}>
      {playerFoundationTop ? (
        <ActorFrameCard
          card={playerFoundationTop}
          highlighted
          mobile={foundationCompact}
          buttonRef={(node) => { playerFoundationTargetRef.current = node; }}
        />
      ) : (
        renderFoundationPlaceholder('Player', (node) => { playerFoundationTargetRef.current = node; })
      )}
      {state.enemyFoundation[0] ? (
        <ActorFrameCard
          card={state.enemyFoundation[0]}
          mobile={foundationCompact}
          enemy
          buttonRef={(node) => { enemyFoundationTargetRef.current = node; }}
        />
      ) : (
        renderFoundationPlaceholder('Enemy', (node) => { enemyFoundationTargetRef.current = node; })
      )}
    </div>
  );

  const renderSupportRow = (style?: React.CSSProperties, alignRight = false) => (
    <div
      className={`flex items-start ${alignRight ? 'justify-end' : 'justify-center'}`}
      style={{ gap: supportGap, ...style }}
      aria-label="Support actors"
    >
      {state.hand.map((card) => {
        const playable = !playerFoundationTop || isAdjacentRank(card.rank, playerFoundationTop.rank);
        return (
          <ActorFrameCard
            key={card.id}
            card={card}
            mobile={foundationCompact}
            width={supportCardWidth}
            height={supportCardHeight}
            contentMode={supportContentMode}
            buttonRef={(node) => {
              supportCardRefs.current[card.id] = node;
            }}
            highlighted={currentTurn === 'player' && playable}
            dimmed={currentTurn === 'player' && !playable && !!playerFoundationTop}
            onClick={!interactionLocked && playable ? () => playHandCardAsFoundation(card.id) : undefined}
          />
        );
      })}
    </div>
  );

  const renderControls = ({ inline = false }: { inline?: boolean } = {}) => (
    <div className={`flex ${inline ? 'items-center gap-3' : 'flex-col items-center gap-3'}`}>
      <button
        type="button"
        onClick={redeal}
        className={`rounded-[14px] border border-white/12 bg-black/35 px-4 py-2 font-semibold uppercase tracking-[0.14em] text-white/72 transition hover:border-[#8ef2d4]/55 hover:text-white ${
          foundationCompact ? 'text-[10px]' : 'text-[11px]'
        }`}
      >
        Redeal
      </button>
      <div className={`rounded-[20px] border border-white/10 bg-[linear-gradient(180deg,rgba(18,20,25,0.96),rgba(6,8,12,0.94))] shadow-[0_18px_50px_rgba(0,0,0,0.24)] ${inline ? 'px-3 py-2' : 'p-3'}`}>
        <div
          className="flex items-center justify-center rounded-[18px] border border-dashed border-white/10 bg-black/22"
          style={{
            width: inline ? 72 : foundationCompact ? 72 : 92,
            height: inline ? 92 : foundationCompact ? 92 : 128,
          }}
        >
          <div className={`rounded-full border border-white/12 bg-white/5 px-3 py-1 font-semibold text-white/86 ${foundationCompact ? 'text-base' : 'text-lg'}`}>
            {state.deck.length}
          </div>
        </div>
        <div className="mt-2 flex justify-center">
          <div className={`rounded-full border border-white/10 bg-white/5 px-2 py-0.5 font-semibold uppercase tracking-[0.12em] text-white/68 ${foundationCompact ? 'text-[9px]' : 'text-[10px]'}`}>
            {state.discard.length} discard
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen overflow-x-hidden overflow-y-auto bg-[radial-gradient(circle_at_top,rgba(20,38,31,0.24),transparent_38%),linear-gradient(180deg,#05060a,#090d12_44%,#06070b)] text-white">
      <div className="mx-auto flex min-h-screen w-full max-w-[min(1680px,100vw-12px)] flex-col items-center gap-3 px-1.5 py-2 lg:max-w-[min(1680px,100vw-16px)] lg:gap-2 lg:px-4 lg:py-5">
          <div
            ref={tableauPanelRef}
            className="w-full rounded-[18px] border border-[#8ef2d4]/18 bg-[linear-gradient(180deg,rgba(14,22,20,0.44),rgba(9,12,14,0.28))]"
            style={{
              paddingTop: tableauPanelPaddingTop,
              paddingBottom: isCompactViewport ? 12 : 18,
              paddingLeft: tableauPanelPaddingX,
              paddingRight: tableauPanelPaddingX,
            }}
          >
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
                      const playable = isFront && !!playerFoundationTop && isAdjacentRank(entry.card.rank, playerFoundationTop.rank);
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
                            active={currentTurn === 'player' && playable}
                            muted={!isFront}
                            disabled={!isFront || interactionLocked || !playable}
                            width={tableauColumnWidth}
                            height={isFront ? tableauFrontHeight : tableauBackHeight}
                            onClick={!interactionLocked && playable ? () => playTableauCard(columnIndex, entry.columnCardIndex) : undefined}
                          />
                        </div>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          </div>

        <div className="flex flex-wrap items-center justify-center gap-3">
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
          ) : (
            <>
              <button
                type="button"
                onClick={endTurn}
                disabled={currentTurn !== 'player' || autoPlayMode !== 'off' || dragAnim !== null}
                className="rounded-[14px] border border-white/12 bg-black/35 px-4 py-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-white/72 transition hover:border-[#ffd166]/55 hover:text-white lg:text-sm"
              >
                End Turn
              </button>
              <button
                type="button"
                aria-label="Start autoplay"
                title="Start autoplay"
                onClick={startAutoplay}
                disabled={dragAnim !== null || currentTurn !== 'player'}
                className={`flex h-[42px] w-[42px] items-center justify-center rounded-[14px] border text-lg transition lg:h-[46px] lg:w-[46px] ${
                  dragAnim !== null || currentTurn !== 'player'
                    ? 'cursor-default border-white/10 bg-white/[0.04] text-white/24'
                    : 'border-white/12 bg-black/35 text-white/78 hover:border-[#8ef2d4]/55 hover:text-white'
                }`}
              >
                ▶
              </button>
            </>
          )}
        </div>

        <div className="relative flex w-full flex-col items-center gap-3 lg:gap-6">
          {isPortraitMobile ? (
            <>
              {renderFoundationLane()}
              <div className="w-full pb-2">
                <div className="mx-auto" style={{ maxWidth: supportAvailableWidth }}>
                  {renderSupportRow({ width: '100%' })}
                </div>
              </div>
              {renderControls({ inline: true })}
            </>
          ) : (
            <div
              className={`relative flex w-full max-w-[1500px] items-start justify-between ${isLandscapeMobile ? 'gap-3' : 'gap-5'}`}
              style={{ minHeight: foundationCardHeight }}
            >
              <div className="pointer-events-none absolute inset-x-0 top-0 flex justify-center">
                <div className="pointer-events-auto">
                  {renderFoundationLane()}
                </div>
              </div>

              <div className="flex min-w-0 justify-start overflow-hidden" style={{ width: nonPortraitSupportWidth }}>
                {renderSupportRow({ width: '100%' }, true)}
              </div>

              <div className="flex shrink-0 justify-end">
                {renderControls()}
              </div>
            </div>
          )}
        </div>

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
                    <ActorFrameCard
                      card={dragAnim.card}
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
    </div>
  );
}
