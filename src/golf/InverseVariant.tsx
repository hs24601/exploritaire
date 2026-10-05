import React, { useMemo, useState } from 'react';

type Suit = 'spades' | 'hearts' | 'clubs' | 'diamonds';
type SourceType = 'tableau' | 'hand' | 'seed';

type InverseCard = {
  id: string;
  rank: number;
  suit: Suit;
};

type FoundationEntry = {
  id: string;
  card: InverseCard;
  source: SourceType;
};

type InverseState = {
  tableau: InverseCard[][];
  hand: InverseCard[];
  foundation: FoundationEntry[];
  archive: FoundationEntry[];
  goalIndex: number;
};

const PRIME_GOALS = [2, 3, 5, 7, 11, 13, 17, 19, 23, 29];
const TABLEAU_ROWS = 4;
const TABLEAU_COLUMNS = 7;
const HAND_SIZE = 4;
const SUITS: Suit[] = ['spades', 'hearts', 'clubs', 'diamonds'];

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

const shuffle = <T,>(items: T[]) => {
  const next = [...items];
  for (let index = next.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [next[index], next[swapIndex]] = [next[swapIndex], next[index]];
  }
  return next;
};

const createDeck = () => {
  let sequence = 0;
  return shuffle(
    SUITS.flatMap((suit) =>
      Array.from({ length: 13 }, (_, idx) => {
        sequence += 1;
        return {
          id: `inverse-${suit}-${idx + 1}-${sequence}`,
          rank: idx + 1,
          suit,
        } satisfies InverseCard;
      }),
    ),
  );
};

const createRandomCard = (prefix: string): InverseCard => {
  const rank = Math.floor(Math.random() * 13) + 1;
  const suit = SUITS[Math.floor(Math.random() * SUITS.length)] ?? 'spades';
  return {
    id: `${prefix}-${suit}-${rank}-${Math.random().toString(36).slice(2, 8)}`,
    rank,
    suit,
  };
};

const createFoundationSeed = (): FoundationEntry => {
  const card = createRandomCard('inverse-seed');
  return {
    id: `seed-${card.id}`,
    card,
    source: 'seed',
  };
};

const drawCards = (stock: InverseCard[], count: number) => ({
  drawn: stock.slice(0, count),
  rest: stock.slice(count),
});

const createInitialState = (): InverseState => {
  const deck = createDeck();
  const tableau: InverseCard[][] = [];
  let remainder = deck;

  for (let columnIndex = 0; columnIndex < TABLEAU_COLUMNS; columnIndex += 1) {
    const draw = drawCards(remainder, TABLEAU_ROWS);
    tableau.push(draw.drawn);
    remainder = draw.rest;
  }

  const handDraw = drawCards(remainder, HAND_SIZE);
  return {
    tableau,
    hand: handDraw.drawn,
    foundation: [createFoundationSeed()],
    archive: [],
    goalIndex: 0,
  };
};

const isAdjacentRank = (left: number, right: number) => {
  if (left === right) return false;
  if ((left === 1 && right === 13) || (left === 13 && right === 1)) return true;
  return Math.abs(left - right) === 1;
};

const canPlayOnFoundation = (foundation: FoundationEntry[], card: InverseCard) => {
  const top = foundation[foundation.length - 1]?.card ?? null;
  if (!top) return true;
  return isAdjacentRank(top.rank, card.rank);
};

const countTableauContributions = (foundation: FoundationEntry[]) =>
  foundation.reduce((sum, entry) => sum + (entry.source === 'tableau' ? 1 : 0), 0);

const CompactCard = ({
  card,
  onClick,
  disabled = false,
  highlighted = false,
  compact = false,
  bridged = false,
}: {
  card: InverseCard;
  onClick?: () => void;
  disabled?: boolean;
  highlighted?: boolean;
  compact?: boolean;
  bridged?: boolean;
}) => (
  <button
    type="button"
    onClick={onClick}
    disabled={disabled}
    className={`relative flex flex-col items-center justify-between rounded-[16px] border px-2 py-1.5 text-left transition ${
      compact
        ? 'h-[30px] w-[38px] sm:h-[56px] sm:w-[48px]'
        : 'h-[64px] w-[46px] sm:h-[96px] sm:w-[72px]'
    } ${
      disabled
        ? 'cursor-default border-white/10 bg-black/26 text-white/28'
        : highlighted
          ? 'border-[#9effd9]/80 bg-[linear-gradient(180deg,rgba(12,28,24,0.96),rgba(6,10,12,0.96))] text-white shadow-[0_0_20px_rgba(110,255,217,0.2)]'
          : bridged
            ? 'border-[#ffd166]/60 bg-[linear-gradient(180deg,rgba(44,34,12,0.92),rgba(12,10,6,0.94))] text-white/92'
            : 'border-white/12 bg-[linear-gradient(180deg,rgba(18,20,25,0.96),rgba(6,8,12,0.94))] text-white/92 hover:-translate-y-0.5 hover:border-[#ffd166]/55'
    }`}
  >
    <div className={`w-full font-semibold leading-none ${compact ? 'text-[11px] sm:text-[16px]' : 'text-[15px] sm:text-[24px]'}`}>
      {rankLabel(card.rank)}
    </div>
    <div className={`w-full text-right font-semibold ${compact ? 'text-[9px] sm:text-[13px]' : 'text-[11px] sm:text-[18px]'} ${isWarmSuit(card.suit) ? 'text-[#ff8f8f]' : 'text-[#c9d5ff]'}`}>
      {suitSymbol(card.suit)}
    </div>
  </button>
);

export const InverseVariant = () => {
  const [state, setState] = useState<InverseState>(() => createInitialState());

  const currentGoal = PRIME_GOALS[Math.min(state.goalIndex, PRIME_GOALS.length - 1)];
  const tableauProgress = countTableauContributions(state.foundation);
  const topRowCards = useMemo(() => state.tableau.map((column) => column[0] ?? null), [state.tableau]);
  const foundationTop = state.foundation[state.foundation.length - 1]?.card ?? null;
  const foundationPathPreview = state.foundation.slice(-6);

  const commitCard = (card: InverseCard, source: { type: 'tableau'; columnIndex: number } | { type: 'hand'; handIndex: number }) => {
    setState((prev) => {
      if (!canPlayOnFoundation(prev.foundation, card)) return prev;

      const nextEntry: FoundationEntry = {
        id: `${source.type}-${card.id}-${prev.foundation.length}`,
        card,
        source: source.type,
      };

      const nextTableau = source.type === 'tableau'
        ? prev.tableau.map((column, columnIndex) => (columnIndex === source.columnIndex ? column.slice(1) : column))
        : prev.tableau;

      const nextFoundation = [...prev.foundation, nextEntry];
      const nextTableauProgress = countTableauContributions(nextFoundation);

      if (nextTableauProgress >= PRIME_GOALS[Math.min(prev.goalIndex, PRIME_GOALS.length - 1)]) {
        return {
          ...prev,
          tableau: nextTableau,
          archive: [...prev.archive, ...nextFoundation],
          foundation: [createFoundationSeed()],
          goalIndex: Math.min(PRIME_GOALS.length - 1, prev.goalIndex + 1),
        };
      }

      return {
        ...prev,
        tableau: nextTableau,
        foundation: nextFoundation,
      };
    });
  };

  const topRowPanel = (
    <div className="rounded-[18px] border border-white/8 bg-black/22 p-2 shadow-[0_18px_80px_rgba(0,0,0,0.26)] sm:rounded-[26px] sm:p-4">
      <div className="-mx-1 overflow-x-auto px-1">
        <div className="grid min-w-[360px] grid-cols-7 gap-1.5 sm:min-w-[560px] sm:gap-3">
          {Array.from({ length: TABLEAU_COLUMNS }, (_, columnIndex) => {
            const card = topRowCards[columnIndex];
            const buriedCount = Math.max(0, (state.tableau[columnIndex]?.length ?? 0) - 1);
            return (
              <div key={`top-${columnIndex}`} className="flex flex-col items-center gap-1 sm:gap-2">
                {card ? (
                  <CompactCard
                    card={card}
                    highlighted={canPlayOnFoundation(state.foundation, card)}
                    disabled={!canPlayOnFoundation(state.foundation, card)}
                    onClick={canPlayOnFoundation(state.foundation, card) ? () => commitCard(card, { type: 'tableau', columnIndex }) : undefined}
                  />
                ) : (
                  <div className="h-[64px] w-[46px] rounded-[14px] border border-dashed border-white/8 bg-black/16 sm:h-[96px] sm:w-[72px]" />
                )}
                <div className="flex gap-1">
                  {Array.from({ length: Math.min(3, buriedCount) }, (_, index) => (
                    <div
                      key={`peek-${columnIndex}-${index}`}
                      className="h-[6px] w-[10px] rounded-full border border-white/10 bg-white/8 sm:h-[7px] sm:w-[14px]"
                    />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );

  const foundationPanel = (
    <div className="rounded-[18px] border border-[#f4c86c]/24 bg-[linear-gradient(180deg,rgba(15,18,22,0.98),rgba(7,8,10,0.98))] p-2 shadow-[0_22px_80px_rgba(0,0,0,0.38)] sm:rounded-[26px] sm:p-4">
      <div className="rounded-[14px] border border-white/12 bg-black/28 p-2.5 sm:rounded-[20px] sm:p-3">
        <div className="mb-2 flex items-center justify-between">
          <div className="rounded-full border border-[#9effd9]/25 bg-[#9effd9]/8 px-2 py-0.5 text-[10px] font-semibold text-[#d8fff3]">
            {tableauProgress}/{currentGoal}
          </div>
          <div className="text-[10px] text-white/56">
            {foundationTop ? `${rankLabel(foundationTop.rank)}${suitSymbol(foundationTop.suit)}` : '•'}
          </div>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-white/8 sm:h-3">
          <div
            className="h-full rounded-full bg-[linear-gradient(90deg,#7ef0d0,#ffd166)] transition-all"
            style={{ width: `${Math.min(100, (tableauProgress / Math.max(1, currentGoal)) * 100)}%` }}
          />
        </div>
        <div className="mt-2 flex items-center justify-between text-[10px] text-white/52 sm:text-xs">
          <span>{state.archive.length}</span>
          <span>{state.foundation.length}</span>
        </div>
        <div className="mt-2 flex min-h-[40px] flex-wrap gap-1.5 rounded-[12px] border border-dashed border-white/10 bg-black/18 p-1.5 sm:mt-3 sm:min-h-[92px] sm:rounded-[18px] sm:gap-2 sm:p-3">
          {foundationPathPreview.length === 0 ? (
            <div className="h-[30px] w-full rounded-[10px] border border-dashed border-white/8 bg-black/10 sm:h-[44px]" />
          ) : (
            foundationPathPreview.map((entry) => (
              <CompactCard
                key={entry.id}
                card={entry.card}
                compact
                bridged={entry.source === 'hand'}
              />
            ))
          )}
        </div>
      </div>
    </div>
  );

  const handPanel = (
    <div className="rounded-[18px] border border-white/8 bg-[linear-gradient(180deg,rgba(10,11,14,0.94),rgba(7,7,9,0.98))] p-2 shadow-[0_18px_80px_rgba(0,0,0,0.22)] backdrop-blur sm:rounded-[24px] sm:p-4">
      <div className="flex flex-wrap gap-2 sm:gap-3">
        {state.hand.map((card, handIndex) => {
          const playable = canPlayOnFoundation(state.foundation, card);
          return (
            <CompactCard
              key={card.id}
              card={card}
              highlighted={playable}
              disabled={!playable}
              onClick={playable ? () => commitCard(card, { type: 'hand', handIndex }) : undefined}
            />
          );
        })}
      </div>
    </div>
  );

  return (
    <div className="h-full overflow-hidden bg-[radial-gradient(circle_at_top,rgba(22,42,32,0.28),transparent_40%),linear-gradient(180deg,#06070b,#090d12_35%,#07070a)] px-2 py-2 text-white sm:px-4 sm:py-4">
      <div className="mx-auto flex h-full w-full max-w-[1680px] flex-col gap-2 sm:gap-4">
        <div className="flex items-center justify-end">
          <button
            type="button"
            onClick={() => setState(createInitialState())}
            className="rounded-[14px] border border-white/12 bg-black/35 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-white/70 hover:border-[#ffd166]/55 hover:text-white sm:px-3 sm:py-2 sm:text-sm"
          >
            Redeal
          </button>
        </div>

        <div className="grid grid-rows-[auto_auto_auto] gap-2 overflow-hidden sm:gap-4 lg:grid-cols-[minmax(0,1fr)_360px] lg:grid-rows-[auto_1fr_auto]">
          <div className="lg:col-start-2 lg:row-span-2">
            {foundationPanel}
          </div>
          <div className="lg:col-start-1 lg:row-start-1">
            {topRowPanel}
          </div>
          <div className="lg:col-span-2 lg:row-start-3">
            {handPanel}
          </div>
        </div>
      </div>
    </div>
  );
};
