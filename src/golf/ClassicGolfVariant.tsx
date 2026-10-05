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

const cardBaseClassName = 'relative flex aspect-[56/74] w-full min-w-0 flex-col justify-between overflow-hidden rounded-[calc(var(--classic-radius)*0.95)] border px-[calc(var(--classic-card-w)*0.14)] py-[calc(var(--classic-card-w)*0.12)] text-left transition';

const GolfCard = ({
  card,
  onClick,
  disabled = false,
  active = false,
  muted = false,
  className = '',
  style,
}: {
  card: Card;
  onClick?: () => void;
  disabled?: boolean;
  active?: boolean;
  muted?: boolean;
  className?: string;
  style?: React.CSSProperties;
}) => (
  <button
    type="button"
    onClick={onClick}
    disabled={disabled}
    style={style}
    className={`${cardBaseClassName} ${className} ${
      disabled
        ? 'cursor-default border-white/10 bg-[#080b10] text-white/30'
        : active
          ? 'border-[#8ef2d4]/70 bg-[linear-gradient(180deg,#0c1c18,#060a0c)] text-white shadow-[0_0_28px_rgba(110,255,217,0.18)]'
          : muted
            ? 'cursor-default border-white/8 bg-[linear-gradient(180deg,#0e1014,#080a0e)] text-white/62'
            : 'border-white/12 bg-[linear-gradient(180deg,#14161b,#080a0e)] text-white/92 hover:-translate-y-0.5 hover:border-[#ffd166]/38'
    }`}
  >
    <div className={`font-semibold leading-none ${muted ? 'text-[calc(var(--classic-card-w)*0.27)]' : 'text-[calc(var(--classic-card-w)*0.4)]'}`}>
      {rankLabel(card.rank)}
    </div>
    <div className={`text-right font-semibold ${muted ? 'text-[calc(var(--classic-card-w)*0.2)]' : 'text-[calc(var(--classic-card-w)*0.25)]'} ${isWarmSuit(card.suit) ? 'text-[#ff9797]' : 'text-[#cfd8ff]'}`}>
      {suitSymbol(card.suit)}
    </div>
  </button>
);

const EmptySlot = ({ emphasis = 'soft' }: { emphasis?: 'soft' | 'strong' }) => (
  <div
    className={`aspect-[56/74] w-full rounded-[calc(var(--classic-radius)*0.95)] border ${
      emphasis === 'strong'
        ? 'border-dashed border-white/10 bg-black/12'
        : 'border-dashed border-white/6 bg-black/10'
    }`}
  />
);

const PilePanel = ({
  label,
  accent,
  children,
  footer,
  action,
}: {
  label: string;
  accent: 'stock' | 'foundation';
  children: React.ReactNode;
  footer: React.ReactNode;
  action?: React.ReactNode;
}) => (
  <section
    className={`flex min-h-0 flex-col rounded-[calc(var(--classic-radius)*1.45)] border p-[clamp(0.7rem,1.8vmin,1.05rem)] shadow-[0_24px_80px_rgba(0,0,0,0.24)] ${
      accent === 'foundation'
        ? 'border-[#f4c86c]/22 bg-[linear-gradient(180deg,rgba(15,18,22,0.98),rgba(7,8,10,0.98))]'
        : 'border-white/12 bg-[linear-gradient(180deg,rgba(18,20,25,0.96),rgba(6,8,12,0.94))]'
    }`}
  >
    <div className="mb-[clamp(0.45rem,1.2vmin,0.7rem)] text-center text-[clamp(0.62rem,1.5vmin,0.78rem)] uppercase tracking-[0.24em] text-white/48">
      {label}
    </div>
    <div className="flex min-h-0 flex-1 items-center justify-center rounded-[calc(var(--classic-radius)*1.1)] border border-white/10 bg-black/22 p-[clamp(0.55rem,1.6vmin,0.9rem)]">
      {children}
    </div>
    <div className="mt-[clamp(0.55rem,1.4vmin,0.8rem)] flex justify-center">{footer}</div>
    {action ? <div className="mt-[clamp(0.45rem,1.2vmin,0.7rem)]">{action}</div> : null}
  </section>
);

export const ClassicGolfVariant = () => {
  const [state, setState] = useState<ClassicState>(() => createInitialState());

  const foundationTop = state.foundation[state.foundation.length - 1] ?? null;
  const topCards = useMemo(
    () => state.tableau.map((column) => column[column.length - 1] ?? null),
    [state.tableau],
  );
  const playableColumns = useMemo(
    () =>
      topCards.reduce<number[]>(
        (list, card, index) =>
          card && foundationTop && isAdjacentRank(card.rank, foundationTop.rank)
            ? [...list, index]
            : list,
        [],
      ),
    [foundationTop, topCards],
  );
  const clearedCount = state.tableau.reduce(
    (sum, column) => sum + (TABLEAU_ROWS - column.length),
    0,
  );
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
        tableau: prev.tableau.map((innerColumn, index) =>
          index === columnIndex ? innerColumn.slice(0, -1) : innerColumn,
        ),
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
    <div
      className="h-[100dvh] overflow-hidden bg-[radial-gradient(circle_at_top,rgba(20,38,31,0.24),transparent_38%),linear-gradient(180deg,#05060a,#090d12_38%,#06070a)] p-[clamp(0.6rem,1.8vmin,1.2rem)] text-white"
      style={{
        ['--classic-card-w' as string]: 'clamp(2.45rem, min(9.4vw, 11dvh), 5.25rem)',
        ['--classic-gap' as string]: 'clamp(0.3rem, 1vmin, 0.9rem)',
        ['--classic-stack-step' as string]: 'clamp(1.25rem, min(5.4dvh, calc(var(--classic-card-w)*0.52)), 2.7rem)',
        ['--classic-radius' as string]: 'clamp(0.8rem, 1.7vmin, 1.35rem)',
      }}
    >
      <div className="mx-auto flex h-full w-full max-w-[1680px] min-h-0 flex-col gap-[clamp(0.55rem,1.4vmin,1rem)]">
        <header className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="text-[clamp(1.05rem,2.2vmin,1.45rem)] font-semibold tracking-[0.16em] text-white/94 uppercase">
              Classic
            </div>
            <div className="text-[clamp(0.68rem,1.5vmin,0.92rem)] text-white/50">
              Play highlighted front cards. Draw when the board stalls.
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[clamp(0.6rem,1.4vmin,0.8rem)] font-semibold uppercase tracking-[0.18em] text-white/70">
              {won ? 'clear' : stuck ? 'dead end' : `${playableColumns.length} live`}
            </div>
            <button
              type="button"
              onClick={() => setState(createInitialState())}
              className="rounded-full border border-white/18 bg-black/35 px-4 py-2 text-[clamp(0.66rem,1.5vmin,0.9rem)] font-semibold uppercase tracking-[0.2em] text-white/86 transition hover:border-[#ffd166]/55 hover:text-white"
            >
              Redeal
            </button>
          </div>
        </header>

        <div className="grid min-h-0 flex-1 gap-[clamp(0.55rem,1.4vmin,1rem)] md:grid-cols-[minmax(0,1fr)_minmax(12.5rem,17rem)]">
          <section className="flex min-h-0 flex-col rounded-[calc(var(--classic-radius)*1.75)] border border-white/10 bg-black/20 p-[clamp(0.6rem,1.6vmin,1.2rem)] shadow-[0_24px_90px_rgba(0,0,0,0.24)]">
            <div className="flex min-h-0 flex-1 items-center rounded-[calc(var(--classic-radius)*1.3)] border border-[#8ef2d4]/18 bg-[linear-gradient(180deg,rgba(14,22,20,0.44),rgba(9,12,14,0.28))] p-[clamp(0.55rem,1.4vmin,0.9rem)]">
              <div
                className="grid w-full"
                style={{
                  gridTemplateColumns: 'repeat(7, minmax(0, var(--classic-card-w)))',
                  gap: 'var(--classic-gap)',
                  justifyContent: 'space-between',
                }}
              >
                {Array.from({ length: TABLEAU_COLUMNS }, (_, columnIndex) => {
                  const column = state.tableau[columnIndex] ?? [];
                  const topPadding = TABLEAU_ROWS - column.length;
                  return (
                    <div
                      key={`tableau-column-${columnIndex}`}
                      className="relative"
                      style={{
                        width: 'var(--classic-card-w)',
                        height: 'calc((var(--classic-card-w) * 74 / 56) + (var(--classic-stack-step) * 4))',
                      }}
                    >
                      {column.length === 0 ? (
                        <div className="absolute bottom-0 left-0 w-full">
                          <EmptySlot key={`top-empty-${columnIndex}`} emphasis="strong" />
                        </div>
                      ) : null}
                      {column.map((card, cardIndex) => {
                        const stackIndex = topPadding + cardIndex;
                        const isTopCard = cardIndex === column.length - 1;
                        const playable = isTopCard && foundationTop
                          ? isAdjacentRank(card.rank, foundationTop.rank)
                          : false;
                        return (
                          <GolfCard
                            key={card.id}
                            card={card}
                            active={playable}
                            muted={!isTopCard}
                            disabled={!playable}
                            onClick={playable ? () => playColumn(columnIndex) : undefined}
                            style={{
                              position: 'absolute',
                              left: 0,
                              top: 0,
                              transform: `translateY(calc(var(--classic-stack-step) * ${stackIndex}))`,
                              zIndex: stackIndex + 1,
                            }}
                          />
                        );
                      })}
                    </div>
                  );
                })}
              </div>
            </div>
          </section>

          <aside className="grid min-h-0 grid-cols-2 gap-[clamp(0.55rem,1.4vmin,1rem)] md:grid-cols-1">
            <PilePanel
              label="Stock"
              accent="stock"
              footer={
                <div className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[clamp(0.6rem,1.4vmin,0.82rem)] font-semibold uppercase tracking-[0.16em] text-white/70">
                  {state.stock.length} left
                </div>
              }
              action={
                <button
                  type="button"
                  onClick={drawStock}
                  disabled={state.stock.length === 0}
                  className={`w-full rounded-full border px-3 py-2 text-[clamp(0.62rem,1.4vmin,0.82rem)] font-semibold uppercase tracking-[0.18em] transition ${
                    state.stock.length === 0
                      ? 'cursor-default border-white/8 bg-white/4 text-white/28'
                      : 'border-[#ffd166]/28 bg-[#ffd166]/10 text-[#ffe8ae] hover:border-[#ffd166]/48 hover:bg-[#ffd166]/14'
                  }`}
                >
                  Draw
                </button>
              }
            >
              {state.stock.length > 0 ? (
                <div className="w-[min(100%,var(--classic-card-w))]">
                  <GolfCard card={state.stock[0]} disabled />
                </div>
              ) : (
                <div className="text-[clamp(1.3rem,3.4vmin,2rem)] font-semibold text-white/26">0</div>
              )}
            </PilePanel>

            <PilePanel
              label="Foundation"
              accent="foundation"
              footer={
                won ? (
                  <div className="rounded-full border border-[#8ef2d4]/28 bg-[#8ef2d4]/10 px-3 py-1 text-[clamp(0.6rem,1.4vmin,0.82rem)] font-semibold uppercase tracking-[0.16em] text-[#d8fff3]">
                    Clear
                  </div>
                ) : stuck ? (
                  <div className="rounded-full border border-[#ffd166]/28 bg-[#ffd166]/10 px-3 py-1 text-[clamp(0.6rem,1.4vmin,0.82rem)] font-semibold uppercase tracking-[0.16em] text-[#ffe8ae]">
                    Dead
                  </div>
                ) : (
                  <div className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[clamp(0.6rem,1.4vmin,0.82rem)] font-semibold uppercase tracking-[0.16em] text-white/70">
                    {clearedCount} cleared
                  </div>
                )
              }
            >
              {foundationTop ? (
                <div className="w-[min(100%,var(--classic-card-w))]">
                  <GolfCard card={foundationTop} disabled />
                </div>
              ) : (
                <EmptySlot emphasis="strong" />
              )}
            </PilePanel>
          </aside>
        </div>
      </div>
    </div>
  );
};
