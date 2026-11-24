import { ACTOR_INSPIRATION_MAX, type Card, type ProtoState } from '../protoState';

export const SLEEP_ICONS = { rest: '💤', noise: '🔔', itch: '🦟' } as const;
export const SLEEP_LABELS = { rest: 'Rest · +1 inspiration', noise: 'Noise · +1 wake', itch: 'Itch · +1 wake' } as const;
export const isDenRest = (state: ProtoState) => state.scene === 'exploration' && state.selectedBiomeId === 'hero-den';

export const REST_COLUMNS = 6;
export const REST_ROWS = 5;
/** One shuffled 52-card deck: four of each rank, 30 tableau cards, 22 stock. */
export const createSleepDeal = () => {
  const deck: Card[] = Array.from({ length: 52 }, (_, index) => ({
    id: `sleep-${index}`, rank: index % 13 + 1, sleep: 'rest',
  }));
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  return { tableau: Array.from({ length: REST_COLUMNS }, (_, i) => deck.slice(i * REST_ROWS, (i + 1) * REST_ROWS)), stock: deck.slice(30) };
};

export const drawSleepStock = (state: ProtoState): ProtoState => {
  if (!isDenRest(state) || !state.stock.length || !state.tableau.some(column => column.length) ||
    !state.worldActors.some(actor => actor.location === 'foundation' && actor.biomeId === 'hero-den')) return state;
  const slot = state.foundations[0];
  if (!slot) return state;
  const { sleep: _sleep, ...card } = state.stock[0];
  return { ...state, stock: state.stock.slice(1),
    foundations: [{ ...slot, card }],
    denRest: { ...state.denRest, restfulCards: state.denRest?.restfulCards ?? 0, disruptions: 0, started: true, receivingCard: card },
  };
};

/** Finite rest: expose the next card, without backfill or work costs. */
export const applySleepPlay = (state: ProtoState, columnIndex: number, foundationIndex: number, divine: boolean): ProtoState => {
  const column = state.tableau[columnIndex];
  const card = column[column.length - 1];
  const restful = card.sleep === 'rest';
  const rest = state.denRest ?? { restfulCards: 0, disruptions: 0 };
  return { ...state,
    tableau: state.tableau.map((column, index) => index === columnIndex ? column.slice(0, -1) : column),
    foundations: state.foundations.map((slot, index) => index === foundationIndex && slot
      ? { card, count: slot.count + 1, cards: [...slot.cards, card] } : slot),
    inspiration: divine ? state.inspiration : Math.min(state.maxInspiration, state.inspiration + (restful ? 1 : 0)),
    actorInspiration: divine ? state.actorInspiration : state.actorInspiration.map((value, index) => index === 0 ? Math.min(state.actorMaxInspiration?.[0] ?? ACTOR_INSPIRATION_MAX, value + (restful ? 1 : 0)) : value),
    denRest: { ...rest, started: true, receivingCard: card, restfulCards: rest.restfulCards + (!divine && restful ? 1 : 0), disruptions: 0 },
  };
};
