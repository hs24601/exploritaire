import React, { useMemo, useState } from 'react';

type Suit = 'spades' | 'hearts' | 'clubs' | 'diamonds';

type Card = {
  id: string;
  rank: number;
  suit: Suit;
};

type ClassicState = {
  tableau: Card[][];
  stock: Card[];
  foundation: Card[];
};

const TABLEAU_COLUMNS = 7;
const TABLEAU_ROWS = 5;
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
          id: `classic-${suit}-${idx + 1}-${sequence}`,
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

const createInitialState = (): ClassicState => {
  const deck = createDeck();
  const foundation = [deck[0]];
  const tableauDeck = deck.slice(1, 1 + (TABLEAU_COLUMNS * TABLEAU_ROWS));
  const stock = deck.slice(1 + (TABLEAU_COLUMNS * TABLEAU_ROWS));
  const tableau = Array.from({ length: TABLEAU_COLUMNS }, (_, columnIndex) =>
    tableauDeck.slice(columnIndex * TABLEAU_ROWS, (columnIndex + 1) * TABLEAU_ROWS),
  );
  return { tableau, stock, foundation };
};

const GolfCard = ({
  card,
  onClick,
  disabled = false,
  active = false,
  muted = false,
}: {
  card: Card;
  onClick?: () => void;
  disabled?: boolean;
  active?: boolean;
  muted?: boolean;
}) => (
  <button
    type="button"
    onClick={onClick}
    disabled={disabled}
    className={`relative flex h-[74px] w-[56px] flex-col justify-between rounded-[16px] border px-2.5 py-2 transition sm:h-[110px] sm:w-[80px] sm:px-3 sm:py-2.5 ${
      disabled
        ? 'cursor-default border-white/10 bg-black/16 text-white/30'
        : active
          ? 'border-[#8ef2d4]/80 bg-[linear-gradient(180deg,rgba(12,28,24,0.98),rgba(6,10,12,0.98))] text-white shadow-[0_0_30px_rgba(110,255,217,0.24)]'
          : muted
            ? 'border-white/8 bg-[linear-gradient(180deg,rgba(14,16,20,0.82),rgba(8,10,14,0.8))] text-white/62'
            : 'border-white/12 bg-[linear-gradient(180deg,rgba(20,22,27,0.96),rgba(8,10,14,0.95))] text-white/92 hover:-translate-y-0.5 hover:border-[#ffd166]/38'
    }`}
  >
    <div className={`font-semibold leading-none ${muted ? 'text-[14px] sm:text-[18px]' : 'text-[20px] sm:text-[30px]'}`}>
      {rankLabel(card.rank)}
    </div>
    <div className={`text-right font-semibold ${muted ? 'text-[11px] sm:text-[14px]' : 'text-[14px] sm:text-[20px]'} ${isWarmSuit(card.suit) ? 'text-[#ff9797]' : 'text-[#cfd8ff]'}`}>
      {suitSymbol(card.suit)}
    </div>
  </button>
);

export const ClassicGolfVariant = () => {
  const [state, setState] = useState<ClassicState>(() => createInitialState());

  const foundationTop = state.foundation[state.foundation.length - 1] ?? null;
  const topCards = useMemo(() => state.tableau.map((column) => column[column.length - 1] ?? null), [state.tableau]);
  const playableColumns = useMemo(
    () => topCards.reduce<number[]>((list, card, index) => (
      card && foundationTop && isAdjacentRank(card.rank, foundationTop.rank) ? [...list, index] : list
    ), []),
    [foundationTop, topCards],
  );
  const clearedCount = state.tableau.reduce((sum, column) => sum + (TABLEAU_ROWS - column.length), 0);
  const won = state.tableau.every((column) => column.length === 0);
  const stuck = !won && state.stock.length === 0 && playableColumns.length === 0;

  const playColumn = (columnIndex: number) => {
    setState((prev) => {
      const column = prev.tableau[columnIndex] ?? [];
      const card = column[column.length - 1] ?? null;
      const top = prev.foundation[prev.foundation.length - 1] ?? null;
      if (!card || !top || !isAdjacentRank(card.rank, top.rank)) return prev;
      return {
        ...prev,
        tableau: prev.tableau.map((innerColumn, index) => (index === columnIndex ? innerColumn.slice(0, -1) : innerColumn)),
        foundation: [...prev.foundation, card],
      };
    });
  };

  const drawStock = () => {
    setState((prev) => {
      const next = prev.stock[0] ?? null;
      if (!next) return prev;
      return {
        ...prev,
        stock: prev.stock.slice(1),
        foundation: [...prev.foundation, next],
      };
    });
  };

  return (
    <div className="h-full overflow-y-auto bg-[radial-gradient(circle_at_top,rgba(20,38,31,0.24),transparent_38%),linear-gradient(180deg,#05060a,#090d12_38%,#06070a)] px-2 py-2 text-white sm:px-4 sm:py-4">
      <div className="mx-auto flex w-full max-w-[1680px] flex-col gap-3 sm:gap-5">
        <div className="flex items-center justify-end gap-2">
          <div className="text-[11px] text-white/52 sm:text-sm">Play the highlighted row. Draw when stuck.</div>
          <button
            type="button"
            onClick={() => setState(createInitialState())}
            className="rounded-[14px] border border-white/12 bg-black/35 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-white/72 transition hover:border-[#ffd166]/55 hover:text-white sm:text-sm"
          >
            Redeal
          </button>
        </div>

        <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_160px] xl:grid-cols-[minmax(0,1fr)_180px] sm:gap-5">
          <div className="rounded-[24px] border border-white/8 bg-black/20 p-3 shadow-[0_24px_90px_rgba(0,0,0,0.24)] sm:rounded-[30px] sm:p-5">
            <div className="grid grid-cols-7 gap-2 sm:gap-4">
              {Array.from({ length: TABLEAU_COLUMNS }, (_, columnIndex) => (
                <div key={`rest-column-${columnIndex}`} className="flex flex-col gap-2 sm:gap-3">
                  {Array.from({ length: TABLEAU_ROWS - 1 }, (_, slotIndex) => {
                    const hiddenCards = state.tableau[columnIndex]?.slice(0, -1) ?? [];
                    const topPadding = (TABLEAU_ROWS - 1) - hiddenCards.length;
                    const card = slotIndex < topPadding ? null : hiddenCards[slotIndex - topPadding] ?? null;
                    if (!card) {
                      return <div key={`rest-empty-${columnIndex}-${offset}`} className="h-[74px] w-[56px] rounded-[16px] border border-dashed border-white/6 bg-black/10 sm:h-[110px] sm:w-[80px]" />;
                    }
                    return <GolfCard key={card.id} card={card} muted disabled />;
                  })}
                </div>
              ))}
            </div>

            <div className="mt-4 rounded-[18px] border border-[#8ef2d4]/18 bg-[linear-gradient(180deg,rgba(14,22,20,0.44),rgba(9,12,14,0.28))] px-3 py-3 sm:px-4">
              <div className="grid grid-cols-7 gap-2 sm:gap-4">
                {topCards.map((card, columnIndex) => {
                  if (!card) {
                    return <div key={`top-empty-${columnIndex}`} className="h-[74px] w-[56px] rounded-[16px] border border-dashed border-white/8 bg-black/12 sm:h-[110px] sm:w-[80px]" />;
                  }
                  const playable = foundationTop ? isAdjacentRank(card.rank, foundationTop.rank) : false;
                  return (
                    <GolfCard
                      key={card.id}
                      card={card}
                      active={playable}
                      disabled={!playable}
                      onClick={playable ? () => playColumn(columnIndex) : undefined}
                    />
                  );
                })}
              </div>
            </div>
          </div>

          <div className="flex flex-row gap-3 lg:flex-col sm:gap-5">
            <button
              type="button"
              onClick={drawStock}
              disabled={state.stock.length === 0}
              className={`flex-1 rounded-[24px] border p-3 shadow-[0_24px_80px_rgba(0,0,0,0.24)] transition sm:rounded-[30px] sm:p-4 ${
                state.stock.length === 0
                  ? 'cursor-default border-white/8 bg-black/18 text-white/25'
                  : 'border-white/12 bg-[linear-gradient(180deg,rgba(18,20,25,0.96),rgba(6,8,12,0.94))] text-white/86 hover:border-[#ffd166]/45'
              }`}
            >
              <div className="mb-2 text-center text-[11px] uppercase tracking-[0.18em] text-white/46">Stock</div>
              <div className="flex items-center justify-center rounded-[18px] border border-dashed border-white/10 bg-black/22 p-3 sm:rounded-[22px] sm:p-4">
                {state.stock.length > 0 ? (
                  <GolfCard card={state.stock[0]} framed disabled={state.stock.length === 0} />
                ) : (
                  <div className="text-lg font-semibold text-white/26 sm:text-2xl">0</div>
                )}
              </div>
              <div className="mt-3 flex justify-center">
                <div className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-white/68 sm:text-xs">
                  {state.stock.length}
                </div>
              </div>
            </button>

            <div className="flex-1 rounded-[24px] border border-[#f4c86c]/22 bg-[linear-gradient(180deg,rgba(15,18,22,0.98),rgba(7,8,10,0.98))] p-3 shadow-[0_24px_80px_rgba(0,0,0,0.28)] sm:rounded-[30px] sm:p-4">
              <div className="mb-2 text-center text-[11px] uppercase tracking-[0.18em] text-white/46">Foundation</div>
              <div className="flex items-center justify-center rounded-[18px] border border-white/12 bg-black/26 p-3 sm:rounded-[22px] sm:p-4">
                {foundationTop ? <GolfCard card={foundationTop} framed /> : null}
              </div>
              <div className="mt-3 flex justify-center">
                {won ? (
                  <div className="rounded-full border border-[#8ef2d4]/28 bg-[#8ef2d4]/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-[#d8fff3] sm:text-xs">
                    Clear
                  </div>
                ) : stuck ? (
                  <div className="rounded-full border border-[#ffd166]/28 bg-[#ffd166]/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-[#ffe8ae] sm:text-xs">
                    Dead
                  </div>
                ) : (
                  <div className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-white/68 sm:text-xs">
                    {clearedCount} cleared
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
