/** Fixed POC placements. Rank bands radiate outward from the hearth in discovery order. */
export const SCATTER_LAYOUT: Record<string, readonly [number, number, number]> = {
  // Origin cards: North 9, East 5, South K. West already begins with A.
  'north-1': [37, 43, -5], 'east-1': [63, 42, 9], 'south-1': [22, 50, -7],
  // Second card of each individual foundation sequence.
  'north-2': [21, 33, -12], 'east-2': [74, 37, 11], 'south-2': [28, 64, 12], 'west-2': [75, 70, -12],
  // Third card of each sequence.
  'north-3': [14, 31, 13], 'east-3': [86, 31, -9], 'south-3': [18, 74, -8], 'west-3': [84, 76, 10],
  // Final cards are at the outer edge, reserved for a well-lit campfire.
  'north-4': [6, 18, 8], 'east-4': [94, 14, -14], 'south-4': [7, 86, -10], 'west-4': [93, 88, 7],
};

/** The wood pile replaces the original South King position. */
export const WOOD_PILE_CARD_ID = 'south-1';
export const WOOD_PILE_LAYOUT = SCATTER_LAYOUT[WOOD_PILE_CARD_ID];

/**
 * Cards no longer begin distributed around the table. A wood pile deals them
 * into this deliberately tight, slightly messy cluster near its own position.
 * Keeping the values visible while allowing overlap makes the object feel like
 * an opened deck rather than a second pre-laid tableau.
 */
export const WOOD_PILE_SPAWN_LAYOUT: Record<string, readonly [number, number, number]> = {
  'north-1': [33, 50, -5], 'east-1': [42, 50, 8],
  'north-2': [29, 55, -11], 'east-2': [47, 55, 10],
  'north-3': [34, 57, 7], 'east-3': [42, 57, -8],
  'north-4': [29, 61, -6], 'east-4': [47, 61, 7],
  'west-1': [28, 65, -4], 'west-2': [33, 63, 5], 'west-3': [39, 64, -5], 'west-4': [45, 65, 6],
  'south-2': [30, 69, -8], 'south-3': [38, 70, 4], 'south-4': [46, 71, -5],
  // The final King is revealed in the now-empty pile itself.
  'south-1': WOOD_PILE_LAYOUT,
};

/** A deliberate reveal order introduces one usable sequence card at a time. */
export const SCATTER_REVEAL_ORDER = [
  'north-1', 'east-1', 'north-2', 'east-2', 'north-3', 'east-3', 'north-4', 'east-4',
  'west-1', 'west-2', 'west-3', 'west-4', 'south-2', 'south-3', 'south-4',
  // The King shares the pile's original position, so it emerges as the pile empties.
  'south-1',
] as const;
