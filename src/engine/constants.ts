import type { Suit, GameConfig, Element, Card } from './types';

export const SUITS: Suit[] = ['💨', '⛰️', '🔥', '💧', '⭐', '🌙', '☀️'];

export const GAME_CONFIG: GameConfig = {
  tableauCount: 5,
  cardsPerTableau: 5,
  foundationCount: 3,
};

export const CARD_SIZE = {
  width: 62,
  height: 88,
} as const;

/** Sentinel tableauIndex value indicating a card dragged from the hand */
export const HAND_SOURCE_INDEX = -1;

export const ACTOR_CARD_SIZE = {
  width: 16,
  height: 23,
} as const;

export const TOKEN_SIZE = {
  width: 28,
  height: 28,
} as const;

export const Z_INDEX = {
  FLYOUT: 10000,
} as const;

export const COLORS = {
  gold: '#e6b31e',
  goldFaded: 'rgba(230, 179, 30, 0.3)',
  teal: '#7fdbca',
  tealFaded: 'rgba(127, 219, 202, 0.3)',
  red: '#ff6b6b',
  purple: '#8b5cf6',
  purpleFaded: 'rgba(139, 92, 246, 0.3)',
  pink: '#d946ef',
  pinkFaded: 'rgba(217, 70, 239, 0.3)',
  bgDark: '#0a0a0a',
  bgLight: '#111111',
  cardFace: '#0a0a0a',
  cardFaceAlt: '#111111',
  white: '#f0f0f0',
} as const;

export const SUIT_TO_ELEMENT: Record<Suit, Element> = {
  '💧': 'W',  // Water
  '⛰️': 'E',  // Earth
  '💨': 'A',  // Air
  '🔥': 'F',  // Fire
  '⭐': 'N',  // Non-elemental
  '🌙': 'D',  // Darkness
  '☀️': 'L',  // Light
};

export const ELEMENT_TO_SUIT: Record<Element, Suit> = {
  W: '💧',
  E: '⛰️',
  A: '💨',
  F: '🔥',
  N: '⭐',
  D: '🌙',
  L: '☀️',
};

export function getSuitDisplay(suit: Suit, showGraphics: boolean): string {
  return showGraphics ? suit : SUIT_TO_ELEMENT[suit];
}

export const SUIT_COLORS: Record<Suit, string> = {
  '💨': '#f0f0f0', // Air - white
  '💧': '#8b5cf6', // Water - purple
  '🔥': '#e6b31e', // Fire - warm gold/amber
  '⛰️': '#d946ef', // Earth - pink
  '⭐': '#7fdbca', // Neutral - teal
  '🌙': '#4c1d95', // Darkness - deep purple
  '☀️': '#fff5cc', // Light - bright cream/pale gold (distinct from Fire)
};

export const EFFECT_IDS = {
  ELEMENT_MATCHING: 'element_matching',
} as const;

// Wild sentinel for randomly generated biome foundations
export const WILD_SENTINEL_RANK = 0;

export function createWildSentinel(index: number): Card {
  return {
    rank: WILD_SENTINEL_RANK,
    suit: '⭐',
    element: 'N',
    id: `wild-sentinel-${index}-${Date.now()}`,
  };
}

export const ALL_ELEMENTS: Element[] = ['W', 'E', 'A', 'F', 'L', 'D', 'N'];

// Karma dealing: minimum number of tableau top cards that must be playable
// to any foundation for a deal to be considered valid
export const KARMA_DEALING_MIN_CARDS = 3;

// Maximum attempts for karma dealing before accepting the current deal
export const MAX_KARMA_DEALING_ATTEMPTS = 100;

// Distance threshold for token cluster proximity detection
export const TOKEN_PROXIMITY_THRESHOLD = 0.5;

// Standardized random ID suffix generation
export function randomIdSuffix(): string {
  return Math.random().toString(36).slice(2, 11);
}

// Garden grid configuration
export const GARDEN_GRID = {
  cellSize: 100, // Size of each grid cell in pixels
  cols: 12, // Number of columns
  rows: 10, // Number of rows
  strokeColor: 'rgba(200, 200, 200, 0.25)', // Grid line color (light gray)
  strokeWidth: 1.5,
} as const;
