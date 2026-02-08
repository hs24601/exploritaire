import type { Card, CardSlot, CardSlotGroup, Tile, TileDefinition, ActorHomeSlot } from './types';
import { randomIdSuffix } from './constants';

// Tile definitions
export const TILE_DEFINITIONS: TileDefinition[] = [
  {
    id: 'sapling',
    name: 'Sapling',
    description: 'Feed the sapling with elemental essence',
    isProp: true,
    lockable: false,
    buildPileId: 'sapling',
    slotGroups: [],
  },
  {
    id: 'burrowing_den',
    name: 'Burrowing Den',
    description: 'Upgrade the den to house another adventuring creature',
    slotGroups: [
      { requirement: { suit: '💧' }, count: 2, label: 'Water' },
      { requirement: { suit: '⛰️' }, count: 2, label: 'Earth' },
    ],
  },
  {
    id: 'forest_01',
    name: 'Forest 01',
    description: 'A guided adventure through the basics',
    isBiome: true,
    slotGroups: [], // No card slots, only actor slots
  },
  {
    id: 'light_thicket_a',
    name: 'Light Thicket A',
    description: 'A guided adventure through the basics',
    isBiome: true,
    slotGroups: [],
  },
  {
    id: 'garden_grove',
    name: 'Garden Grove',
    description: 'A peaceful grove where resources grow',
    isBiome: true,
    slotGroups: [],
  },
  {
    id: 'pyramid_ruins',
    name: 'Pyramid Ruins',
    description: 'Ancient stones arranged in a mysterious pattern',
    isBiome: true,
    slotGroups: [],
  },
  {
    id: 'mystic_cross',
    name: 'Mystic Cross',
    description: 'A sacred arrangement of elemental cards',
    isBiome: true,
    slotGroups: [],
  },
  {
    id: 'overgrowth',
    name: 'Overgrowth',
    description: 'A climbing sequence tangled in verdant growth',
    isBiome: true,
    slotGroups: [],
  },
  {
    id: 'thicket',
    name: 'Thicket',
    description: 'A dense tangle of branching paths through wild growth',
    isBiome: true,
    blocksLight: true,
    slotGroups: [],
  },
  {
    id: 'verdant_thicket_a',
    name: 'Verdant Thicket A',
    description: 'A lush thicket teeming with verdant growth',
    isBiome: true,
    lightFilter: 'grove',
    lightBlockerShape: 'card',
    slotGroups: [],
  },
  {
    id: 'random_wilds',
    name: 'Random Wilds',
    description: 'An ever-shifting wilderness of elemental cards',
    isBiome: true,
    slotGroups: [],
  },
  {
    id: 'ironwood_grove',
    name: 'Ironwood Grove',
    description: 'Impenetrable ironwood trunks block the way',
    isProp: true,
    lockable: false,
    blocksLight: true,
    slotGroups: [],
  },
];

export const FOREST_PUZZLE_TILE_IDS = new Set([
  'forest_01',
  'light_thicket_a',
  'verdant_thicket_a',
]);

export function isForestPuzzleTile(definitionId?: string | null): boolean {
  return !!definitionId && FOREST_PUZZLE_TILE_IDS.has(definitionId);
}

/**
 * Gets a tile definition by ID
 */
export function getTileDefinition(definitionId: string): TileDefinition | null {
  return TILE_DEFINITIONS.find(d => d.id === definitionId) || null;
}

/**
 * Gets the display name for a tile, including upgrade level
 */
export function getTileDisplayName(tile: Tile): string {
  const definition = getTileDefinition(tile.definitionId);
  if (!definition) return 'Unknown';
  return tile.upgradeLevel > 0
    ? `${definition.name}+${tile.upgradeLevel}`
    : definition.name;
}

/**
 * Creates an actor home slot
 */
function createActorHomeSlot(tileDefId: string, index: number): ActorHomeSlot {
  return {
    id: `${tileDefId}-home-${index}-${Date.now()}`,
    actorId: null,
  };
}

/**
 * Creates a new tile instance from a definition
 */
export function createTile(definitionId: string): Tile | null {
  const definition = getTileDefinition(definitionId);
  if (!definition) return null;

  const slotGroups: CardSlotGroup[] = definition.slotGroups.map((groupDef, groupIdx) => ({
    slots: Array.from({ length: groupDef.count }, (_, slotIdx) => ({
      id: `${definitionId}-${groupIdx}-${slotIdx}`,
      requirement: groupDef.requirement,
      card: null,
    })),
    label: groupDef.label,
  }));

  return {
    definitionId,
    id: `${definitionId}-${Date.now()}-${randomIdSuffix()}`,
    createdAt: Date.now(),
    slotGroups,
    isComplete: false,
    isLocked: true,
    upgradeLevel: 0,
    actorHomeSlots: [], // Start with 0 slots, first upgrade adds slot
  };
}

/**
 * Creates initial tiles for a new game with default grid positions
 */
export function createInitialTiles(): Tile[] {
  const saplingCenter = { col: 4, row: 3 };
  const positions: Array<{ col: number; row: number }> = [];
  const ironwoodPositions = new Set([
    '2,3',
    '2,4',
    '2,5',
    '3,5',
    '4,5',
    '5,5',
    '6,5',
    '6,4',
  ]);
  const removedThicketPositions = new Set([
    '2,2',
  ]);

  for (let dy = -2; dy <= 2; dy += 1) {
    for (let dx = -2; dx <= 2; dx += 1) {
      if (Math.max(Math.abs(dx), Math.abs(dy)) !== 2) continue;
      positions.push({ col: saplingCenter.col + dx, row: saplingCenter.row + dy });
    }
  }

  const saplingTile = createTile('sapling');
  if (saplingTile) {
    saplingTile.gridPosition = saplingCenter;
  }

  const randomWilds = createTile('random_wilds');
  if (randomWilds) {
    randomWilds.gridPosition = { col: saplingCenter.col + 1, row: saplingCenter.row - 1 };
  }

  const tiles: Tile[] = [];
  const occupied = new Set<string>();

  if (saplingTile) {
    const key = `${saplingTile.gridPosition?.col},${saplingTile.gridPosition?.row}`;
    occupied.add(key);
    tiles.push(saplingTile);
  }

  if (randomWilds) {
    const key = `${randomWilds.gridPosition?.col},${randomWilds.gridPosition?.row}`;
    occupied.add(key);
    tiles.push(randomWilds);
  }

  const baseTiles = positions
    .map((pos) => {
      const key = `${pos.col},${pos.row}`;
      if (removedThicketPositions.has(key)) return null;
      const definitionId = ironwoodPositions.has(key) ? 'ironwood_grove' : 'thicket';
      const tile = createTile(definitionId);
      if (!tile) return null;
      tile.gridPosition = pos;
      occupied.add(key);
      return tile;
    })
    .filter(Boolean) as Tile[];

  const outerTilesByPos = new Map<string, 'thicket' | 'ironwood_grove'>();
  const addOuterTile = (pos: { col: number; row: number }, definitionId: 'thicket' | 'ironwood_grove') => {
    const key = `${pos.col},${pos.row}`;
    if (occupied.has(key)) return;
    outerTilesByPos.set(key, definitionId);
  };

  for (const tile of baseTiles) {
    const gp = tile.gridPosition;
    if (!gp) continue;
    const dx = Math.sign(gp.col - saplingCenter.col);
    const dy = Math.sign(gp.row - saplingCenter.row);
    const outerPos = { col: gp.col + dx, row: gp.row + dy };
    if (tile.definitionId === 'thicket') {
      addOuterTile(outerPos, 'thicket');
    } else if (tile.definitionId === 'ironwood_grove') {
      addOuterTile(outerPos, 'ironwood_grove');
    }
  }

  for (const [key, definitionId] of outerTilesByPos.entries()) {
    const [col, row] = key.split(',').map(Number);
    const tile = createTile(definitionId);
    if (!tile) continue;
    tile.gridPosition = { col, row };
    occupied.add(key);
    tiles.push(tile);
  }

  tiles.push(...baseTiles);

  return tiles;
}

/**
 * Checks if an actor can be assigned to a home slot
 */
export function canAssignActorToHomeSlot(
  tile: Tile,
  slotId: string
): boolean {
  const slot = tile.actorHomeSlots.find(s => s.id === slotId);
  return slot !== null && slot !== undefined && slot.actorId === null;
}

/**
 * Finds a home slot by ID within a tile
 */
export function findHomeSlotById(
  tile: Tile,
  slotId: string
): ActorHomeSlot | null {
  return tile.actorHomeSlots.find(s => s.id === slotId) || null;
}

/**
 * Upgrades a tile: increments level, clears card slots, adds new home slot
 */
export function upgradeTile(tile: Tile): Tile {
  const newLevel = tile.upgradeLevel + 1;

  // Clear all card slots (cards are consumed)
  const clearedSlotGroups = tile.slotGroups.map(group => ({
    ...group,
    slots: group.slots.map(s => ({ ...s, card: null })),
  }));

  // Add a new home slot
  const newHomeSlot = createActorHomeSlot(tile.definitionId, newLevel);

  return {
    ...tile,
    upgradeLevel: newLevel,
    slotGroups: clearedSlotGroups,
    isComplete: false,
    actorHomeSlots: [...tile.actorHomeSlots, newHomeSlot],
  };
}

/**
 * Checks if a card can be added to a specific slot
 */
export function canAddCardToSlot(card: Card, slot: CardSlot): boolean {
  // Slot already has a card
  if (slot.card !== null) return false;

  const req = slot.requirement;

  // Check suit requirement
  if (req.suit && card.suit !== req.suit) return false;

  // Check rank requirements
  if (req.minRank !== undefined && card.rank < req.minRank) return false;
  if (req.maxRank !== undefined && card.rank > req.maxRank) return false;

  return true;
}

/**
 * Finds a slot by ID within a tile
 */
export function findSlotById(tile: Tile, slotId: string): CardSlot | null {
  for (const group of tile.slotGroups) {
    const slot = group.slots.find(s => s.id === slotId);
    if (slot) return slot;
  }
  return null;
}

/**
 * Adds a card to a specific slot in a tile
 * Returns updated tile or null if invalid
 */
export function addCardToTile(
  tile: Tile,
  slotId: string,
  card: Card
): Tile | null {
  const slot = findSlotById(tile, slotId);
  if (!slot || !canAddCardToSlot(card, slot)) return null;

  // Create updated slot groups with the card added
  const newSlotGroups = tile.slotGroups.map(group => ({
    ...group,
    slots: group.slots.map(s =>
      s.id === slotId ? { ...s, card } : s
    ),
  }));

  // Check if all slots are now filled
  const isComplete = newSlotGroups.every(group =>
    group.slots.every(s => s.card !== null)
  );

  return {
    ...tile,
    slotGroups: newSlotGroups,
    isComplete,
  };
}

/**
 * Gets the progress of a tile (filled slots / total slots)
 */
export function getTileProgress(tile: Tile): { current: number; total: number } {
  let current = 0;
  let total = 0;

  for (const group of tile.slotGroups) {
    for (const slot of group.slots) {
      total++;
      if (slot.card !== null) current++;
    }
  }

  return { current, total };
}

/**
 * Clears all cards from a tile (resets progress)
 */
export function clearTile(tile: Tile): Tile {
  const newSlotGroups = tile.slotGroups.map(group => ({
    ...group,
    slots: group.slots.map(s => ({ ...s, card: null })),
  }));

  return {
    ...tile,
    slotGroups: newSlotGroups,
    isComplete: false,
  };
}

/**
 * Clears a specific tile in the array by ID
 */
export function clearTileProgress(
  tiles: Tile[],
  tileId: string
): Tile[] {
  return tiles.map(tile =>
    tile.id === tileId ? clearTile(tile) : tile
  );
}
