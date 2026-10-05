import React, { useMemo, useState } from 'react';
import { Hand } from '../components/Hand';
import { ELEMENT_TO_SUIT } from '../engine/constants';
import type { Card as EngineCard, Element } from '../engine/types';

type Suit = 'spades' | 'hearts' | 'clubs' | 'diamonds';

type Card = {
  id: string;
  rank: number;
  suit: Suit;
};

type FoundationPile = {
  id: string;
  name: string;
  card: Card;
  addedCount: number;
  streak: number;
};

type BenchClassicState = {
  tableau: Card[][];
  stock: Card[];
  stockCount: number;
  prime: FoundationPile;
  bench: FoundationPile[];
};

const TABLEAU_COLUMNS = 7;
const TABLEAU_ROWS = 5;
const DEFAULT_VISIBLE_TABLEAU_ROWS = 2;
const SUITS: Suit[] = ['spades', 'hearts', 'clubs', 'diamonds'];
let refillSequence = 0;
const LOCAL_SUIT_TO_ELEMENT: Record<Suit, Element> = {
  spades: 'D',
  hearts: 'F',
  clubs: 'A',
  diamonds: 'L',
};

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
          id: `benchclassic-${suit}-${idx + 1}-${sequence}`,
          rank: idx + 1,
          suit,
        } satisfies Card;
      }),
    ),
  );
};

const isAdjacentRank = (left: number, right: number) => {
  if (left === right) return false;
  if ((left === 1 && right === 13) || (left === 13 && right === 1)) return true;
  return Math.abs(left - right) === 1;
};

const createStarterBenchCard = (rank: number, suit: Suit, id: string): Card => ({
  id,
  rank,
  suit,
});

const createRandomBenchClassicCard = (): Card => {
  refillSequence += 1;
  const suit = SUITS[Math.floor(Math.random() * SUITS.length)] ?? 'spades';
  return {
    id: `benchclassic-refill-${refillSequence}`,
    rank: Math.floor(Math.random() * 13) + 1,
    suit,
  };
};

const refillClearedTableauColumn = (tableau: Card[][], columnIndex: number) => {
  if (tableau[columnIndex]?.length) return tableau;
  return tableau.map((column, index) => (
    index === columnIndex ? Array.from({ length: TABLEAU_ROWS }, () => createRandomBenchClassicCard()) : column
  ));
};

const createInitialState = (): BenchClassicState => {
  const deck = createDeck();
  const tableauDeck = deck.slice(0, TABLEAU_COLUMNS * TABLEAU_ROWS);
  const stock = deck.slice(TABLEAU_COLUMNS * TABLEAU_ROWS);
  const tableau = Array.from({ length: TABLEAU_COLUMNS }, (_, columnIndex) =>
    tableauDeck.slice(columnIndex * TABLEAU_ROWS, (columnIndex + 1) * TABLEAU_ROWS),
  );

  return {
    tableau,
    stock,
    stockCount: stock.length,
    prime: {
      id: 'hero',
      name: 'Hero',
      card: createStarterBenchCard(13, 'clubs', 'benchclassic-starter-hero'),
      addedCount: 0,
      streak: 0,
    },
    bench: [
      {
        id: 'mochi',
        name: 'Mochi',
        card: createStarterBenchCard(6, 'diamonds', 'benchclassic-starter-mochi'),
        addedCount: 0,
        streak: 0,
      },
      {
        id: 'banks',
        name: 'Banks',
        card: createStarterBenchCard(8, 'hearts', 'benchclassic-starter-banks'),
        addedCount: 0,
        streak: 0,
      },
      {
        id: 'jet',
        name: 'Jet',
        card: createStarterBenchCard(2, 'spades', 'benchclassic-starter-jet'),
        addedCount: 0,
        streak: 0,
      },
      {
        id: 'wis',
        name: 'Wis',
        card: createStarterBenchCard(9, 'clubs', 'benchclassic-starter-wis'),
        addedCount: 0,
        streak: 0,
      },
    ],
  };
};

const BenchCardFace = ({
  card,
  disabled = false,
  active = false,
  muted = false,
  compact = false,
}: {
  card: Card;
  disabled?: boolean;
  active?: boolean;
  muted?: boolean;
  compact?: boolean;
}) => (
  <div
    className={`relative flex flex-col justify-between rounded-[16px] border transition ${
      compact ? 'h-[48px] w-[36px] px-1.5 py-1 sm:h-[74px] sm:w-[56px] sm:px-2.5 sm:py-2' : 'h-[66px] w-[48px] px-2 py-1.5 sm:h-[112px] sm:w-[84px] sm:px-3 sm:py-2.5'
    } ${
      disabled
        ? 'cursor-default border-white/10 bg-black/18 text-white/28'
        : active
          ? 'border-[#8ef2d4]/80 bg-[linear-gradient(180deg,rgba(12,28,24,0.98),rgba(6,10,12,0.98))] text-white shadow-[0_0_28px_rgba(110,255,217,0.22)]'
          : muted
            ? 'border-white/8 bg-[linear-gradient(180deg,rgba(14,16,20,0.82),rgba(8,10,14,0.8))] text-white/60'
            : 'border-white/12 bg-[linear-gradient(180deg,rgba(20,22,27,0.96),rgba(8,10,14,0.95))] text-white/92 hover:-translate-y-0.5 hover:border-[#ffd166]/40'
    }`}
  >
    <div className={`font-semibold leading-none ${compact ? 'text-[13px] sm:text-[20px]' : 'text-[18px] sm:text-[30px]'}`}>
      {rankLabel(card.rank)}
    </div>
    <div className={`text-right font-semibold ${compact ? 'text-[10px] sm:text-[15px]' : 'text-[12px] sm:text-[20px]'} ${isWarmSuit(card.suit) ? 'text-[#ff9797]' : 'text-[#cfd8ff]'}`}>
      {suitSymbol(card.suit)}
    </div>
  </div>
);

const BenchCard = ({
  card,
  onClick,
  disabled = false,
  active = false,
  muted = false,
  compact = false,
}: {
  card: Card;
  onClick?: () => void;
  disabled?: boolean;
  active?: boolean;
  muted?: boolean;
  compact?: boolean;
}) => (
  <button
    type="button"
    onClick={onClick}
    disabled={disabled}
    className="rounded-[16px]"
  >
    <BenchCardFace
      card={card}
      disabled={disabled}
      active={active}
      muted={muted}
      compact={compact}
    />
  </button>
);

export const BenchClassicVariant = ({ playerArea = 'bench' }: { playerArea?: 'bench' | 'hand' }) => {
  const [state, setState] = useState<BenchClassicState>(() => createInitialState());

  const visibleHiddenRowCount = Math.max(0, Math.min(TABLEAU_ROWS - 1, DEFAULT_VISIBLE_TABLEAU_ROWS - 1));
  const visibleCardsByColumn = useMemo(
    () => state.tableau.map((column) => {
      const startIndex = Math.max(0, column.length - DEFAULT_VISIBLE_TABLEAU_ROWS);
      return column.slice(startIndex).map((card, offset) => ({
        card,
        columnCardIndex: startIndex + offset,
      }));
    }),
    [state.tableau],
  );
  const hasPlayableVisibleCard = useMemo(
    () => visibleCardsByColumn.some((column) => column.some(({ card }) => isAdjacentRank(card.rank, state.prime.card.rank))),
    [state.prime.card.rank, visibleCardsByColumn],
  );
  const swappableBench = useMemo(
    () => state.bench.reduce<number[]>((list, pile, index) => (
      isAdjacentRank(pile.card.rank, state.prime.card.rank) ? [...list, index] : list
    ), []),
    [state.bench, state.prime.card.rank],
  );
  const clearedCount = state.tableau.reduce((sum, column) => sum + (TABLEAU_ROWS - column.length), 0);
  const won = state.tableau.every((column) => column.length === 0);
  const stuck = !won && (state.stock.length === 0 || state.stockCount <= 0) && !hasPlayableVisibleCard && swappableBench.length === 0;

  const playTableauCard = (columnIndex: number, columnCardIndex: number) => {
    setState((prev) => {
      const column = prev.tableau[columnIndex] ?? [];
      const card = column[columnCardIndex] ?? null;
      if (!card || !isAdjacentRank(card.rank, prev.prime.card.rank)) return prev;
      const nextTableau = refillClearedTableauColumn(
        prev.tableau.map((innerColumn, index) => (
          index === columnIndex
            ? innerColumn.filter((_, innerIndex) => innerIndex !== columnCardIndex)
            : innerColumn
        )),
        columnIndex,
      );
      return {
        ...prev,
        tableau: nextTableau,
        prime: {
          card,
          addedCount: prev.prime.addedCount + 1,
          streak: prev.prime.streak + 1,
        },
      };
    });
  };

  const drawStock = () => {
    setState((prev) => {
      const next = prev.stock[0] ?? null;
      const stockCost = next && isAdjacentRank(next.rank, prev.prime.card.rank) ? 0.5 : 1;
      if (!next || prev.stockCount < stockCost) return prev;
      return {
        ...prev,
        stock: prev.stock.slice(1),
        stockCount: Math.max(0, prev.stockCount - stockCost),
        prime: {
          card: next,
          addedCount: prev.prime.addedCount + 1,
          streak: 0,
        },
      };
    });
  };

  const swapBench = (benchIndex: number) => {
    setState((prev) => {
      const benchPile = prev.bench[benchIndex] ?? null;
      if (!benchPile || !isAdjacentRank(benchPile.card.rank, prev.prime.card.rank)) return prev;
      const nextBench = [...prev.bench];
      nextBench[benchIndex] = {
        ...prev.prime,
        streak: 0,
      };
      return {
        ...prev,
        prime: {
          ...benchPile,
          streak: 0,
        },
        bench: nextBench,
      };
    });
  };

  const handCards = useMemo<EngineCard[]>(
    () => [state.prime, ...state.bench].map((pile) => {
      const element = LOCAL_SUIT_TO_ELEMENT[pile.card.suit];
      return {
        id: pile.id,
        rank: pile.card.rank,
        element,
        suit: ELEMENT_TO_SUIT[element],
        name: pile.name,
      };
    }),
    [state.bench, state.prime],
  );

  const handleHandCardClick = (card: EngineCard) => {
    if (card.id === state.prime.id) return;
    const benchIndex = state.bench.findIndex((pile) => pile.id === card.id);
    if (benchIndex >= 0) {
      swapBench(benchIndex);
    }
  };

  return (
    <div className="h-full overflow-x-hidden overflow-y-auto bg-[radial-gradient(circle_at_top,rgba(20,38,31,0.24),transparent_38%),linear-gradient(180deg,#05060a,#090d12_38%,#06070a)] px-2 py-2 text-white sm:px-4 sm:py-4">
      <div className="mx-auto flex w-full max-w-[min(1680px,100vw-16px)] flex-col items-center gap-3 sm:max-w-[1680px] sm:gap-5">
        <div className="flex flex-col gap-4 sm:gap-6">
          <div className="rounded-[24px] border border-white/8 bg-black/20 p-2.5 shadow-[0_24px_90px_rgba(0,0,0,0.24)] sm:rounded-[30px] sm:p-5">
            <div className="flex justify-center gap-[15px]">
              {Array.from({ length: TABLEAU_COLUMNS }, (_, columnIndex) => (
                <div key={`rest-column-${columnIndex}`} className="flex flex-col gap-2 sm:gap-3">
                  {Array.from({ length: visibleHiddenRowCount }, (_, slotIndex) => {
                    const visibleColumn = visibleCardsByColumn[columnIndex] ?? [];
                    const visibleHiddenCards = visibleColumn.slice(0, -1);
                    const topPadding = visibleHiddenRowCount - visibleHiddenCards.length;
                    const visibleEntry = slotIndex < topPadding ? null : visibleHiddenCards[slotIndex - topPadding] ?? null;
                    if (!visibleEntry) {
                      return (
                        <div
                          key={`rest-empty-${columnIndex}-${slotIndex}`}
                          className="h-[48px] w-[36px] rounded-[16px] border border-dashed border-white/6 bg-black/10 sm:h-[74px] sm:w-[56px]"
                        />
                      );
                    }
                    const playable = isAdjacentRank(visibleEntry.card.rank, state.prime.card.rank);
                    return (
                      <BenchCard
                        key={visibleEntry.card.id}
                        card={visibleEntry.card}
                        compact
                        active={playable}
                        muted={!playable}
                        disabled={!playable}
                        onClick={playable ? () => playTableauCard(columnIndex, visibleEntry.columnCardIndex) : undefined}
                      />
                    );
                  })}
                </div>
              ))}
            </div>

            <div className="mt-3 rounded-[18px] border border-[#8ef2d4]/18 bg-[linear-gradient(180deg,rgba(14,22,20,0.44),rgba(9,12,14,0.28))] px-2 py-2.5 sm:mt-4 sm:px-4 sm:py-3">
              <div className="flex justify-center gap-[15px]">
                {visibleCardsByColumn.map((visibleColumn, columnIndex) => {
                  const visibleEntry = visibleColumn[visibleColumn.length - 1] ?? null;
                  if (!visibleEntry) {
                    return (
                      <div
                        key={`top-empty-${columnIndex}`}
                        className="h-[66px] w-[48px] rounded-[16px] border border-dashed border-white/8 bg-black/12 sm:h-[112px] sm:w-[84px]"
                      />
                    );
                  }
                  const playable = isAdjacentRank(visibleEntry.card.rank, state.prime.card.rank);
                  return (
                    <BenchCard
                      key={visibleEntry.card.id}
                      card={visibleEntry.card}
                      active={playable}
                      disabled={!playable}
                      onClick={playable ? () => playTableauCard(columnIndex, visibleEntry.columnCardIndex) : undefined}
                    />
                  );
                })}
              </div>
            </div>
          </div>

          {playerArea === 'hand' ? (
            <div className="relative flex min-h-[170px] items-end justify-center sm:min-h-[240px]">
              <button
                type="button"
                onClick={() => setState(createInitialState())}
                className="absolute left-0 bottom-0 rounded-[14px] border border-white/12 bg-black/35 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-white/72 transition hover:border-[#ffd166]/55 hover:text-white sm:text-sm"
              >
                Redeal
              </button>

              <div className="w-full max-w-[960px] px-12 sm:px-20">
                <div className="mb-2 flex justify-center">
                  <div className="rounded-full border border-[#8ef2d4]/20 bg-[#8ef2d4]/8 px-2.5 py-0.5 text-[9px] font-semibold uppercase tracking-[0.14em] text-[#d8fff3] sm:text-[10px]">
                    {state.prime.streak} streak
                  </div>
                </div>
                <Hand
                  cards={handCards}
                  cardScale={1}
                  onDragStart={() => {}}
                  onCardClick={handleHandCardClick}
                  stockCount={Number(state.stockCount.toFixed(1))}
                  onStockClick={drawStock}
                  showGraphics
                  interactionMode="click"
                  tooltipEnabled={false}
                  upgradedCardIds={[state.prime.id]}
                  disableSpringMotion
                  disableTilt
                />
                <div className="mt-2 flex justify-center gap-2">
                  {(won || stuck) && (
                    <div className={`rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] sm:text-xs ${
                      won
                        ? 'border-[#8ef2d4]/28 bg-[#8ef2d4]/10 text-[#d8fff3]'
                        : 'border-[#ffd166]/28 bg-[#ffd166]/10 text-[#ffe8ae]'
                    }`}>
                      {won ? 'Clear' : 'Dead'}
                    </div>
                  )}
                  <div className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[0.12em] text-white/68 sm:text-[10px]">
                    {clearedCount} cleared
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="relative flex min-h-[120px] items-end justify-center sm:min-h-[164px]">
              <button
                type="button"
                onClick={() => setState(createInitialState())}
                className="absolute left-0 bottom-0 rounded-[14px] border border-white/12 bg-black/35 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-white/72 transition hover:border-[#ffd166]/55 hover:text-white sm:text-sm"
              >
                Redeal
              </button>

              <div className="flex max-w-full flex-wrap items-end justify-center gap-2 pr-[64px] sm:flex-nowrap sm:gap-4 sm:pr-[120px]">
                <div className="grid grid-cols-2 gap-2 sm:gap-3">
                  {state.bench.slice(0, 2).map((card, benchIndex) => {
                    const legalSwap = isAdjacentRank(card.card.rank, state.prime.card.rank);
                    return (
                      <div key={card.card.id} className="flex flex-col items-center gap-1.5">
                        <BenchCard
                          card={card.card}
                          compact
                          active={legalSwap}
                          disabled={!legalSwap}
                          onClick={legalSwap ? () => swapBench(benchIndex) : undefined}
                        />
                        <div className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[0.12em] text-white/68 sm:text-[10px]">
                          {card.addedCount}
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div className="shrink-0">
                  <div className="mb-1.5 flex justify-center">
                    <div className="rounded-full border border-[#8ef2d4]/20 bg-[#8ef2d4]/8 px-2.5 py-0.5 text-[9px] font-semibold uppercase tracking-[0.14em] text-[#d8fff3] sm:text-[10px]">
                      {state.prime.streak} streak
                    </div>
                  </div>
                  <BenchCard card={state.prime.card} active />
                  <div className="mt-3 flex justify-center">
                    {won ? (
                      <div className="rounded-full border border-[#8ef2d4]/28 bg-[#8ef2d4]/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-[#d8fff3] sm:text-xs">
                        Clear
                      </div>
                    ) : stuck ? (
                      <div className="rounded-full border border-[#ffd166]/28 bg-[#ffd166]/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-[#ffe8ae] sm:text-xs">
                        Dead
                      </div>
                    ) : null}
                  </div>
                  <div className="mt-1.5 flex justify-center">
                    <div className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[0.12em] text-white/68 sm:text-[10px]">
                      {state.prime.addedCount}
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 sm:gap-3">
                  {state.bench.slice(2).map((card, offset) => {
                    const benchIndex = offset + 2;
                    const legalSwap = isAdjacentRank(card.card.rank, state.prime.card.rank);
                    return (
                      <div key={card.card.id} className="flex flex-col items-center gap-1.5">
                        <BenchCard
                          card={card.card}
                          compact
                          active={legalSwap}
                          disabled={!legalSwap}
                          onClick={legalSwap ? () => swapBench(benchIndex) : undefined}
                        />
                        <div className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[0.12em] text-white/68 sm:text-[10px]">
                          {card.addedCount}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <button
                type="button"
                onClick={drawStock}
                disabled={state.stock.length === 0 || state.stockCount <= 0}
                className={`absolute right-0 bottom-0 shrink-0 rounded-[20px] border p-2 shadow-[0_18px_50px_rgba(0,0,0,0.24)] transition sm:p-3 ${
                  state.stock.length === 0 || state.stockCount <= 0
                    ? 'cursor-default border-white/8 bg-black/18 text-white/25'
                    : 'border-white/12 bg-[linear-gradient(180deg,rgba(18,20,25,0.96),rgba(6,8,12,0.94))] text-white/86 hover:border-[#ffd166]/45'
                }`}
              >
                <div className="flex items-center justify-center rounded-[16px] border border-dashed border-white/10 bg-black/22 p-2 sm:rounded-[18px] sm:p-3">
                  {state.stock.length > 0 ? (
                    <BenchCardFace card={state.stock[0]} disabled compact />
                  ) : (
                    <div className="text-sm font-semibold text-white/26 sm:text-xl">0</div>
                  )}
                </div>
                <div className="mt-2 flex justify-center">
                  <div className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-white/68 sm:text-xs">
                    {state.stockCount.toFixed(1)}
                  </div>
                </div>
                <div className="mt-1.5 flex justify-center">
                  <div className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[0.12em] text-white/68 sm:text-[10px]">
                    {clearedCount} cleared
                  </div>
                </div>
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
