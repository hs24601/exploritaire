import type { Card, Element, GameState } from '../types';
import { ELEMENT_TO_SUIT, randomIdSuffix } from '../constants';
import { getBiomeDefinition } from '../biomes';
import { isCombatSessionActive } from '../combatSession';

function createRewardCard(element: Element, rank: number): Card {
  return {
    id: `reward-${element}-${rank}-${randomIdSuffix()}`,
    element,
    suit: ELEMENT_TO_SUIT[element],
    rank,
  };
}

function resolveBiomeRewardCards(state: GameState): Card[] {
  if (!state.currentBiome) return [];
  const biomeDef = getBiomeDefinition(state.currentBiome);
  if (!biomeDef) return [];

  const rewardCards: Card[] = [];
  biomeDef.rewards.cards.forEach(({ element, count }) => {
    for (let i = 0; i < count; i += 1) {
      const rank = 1 + (i % 13);
      rewardCards.push(createRewardCard(element, rank));
    }
  });
  return rewardCards;
}

function resolveBiomeBlueprintUnlocks(state: GameState): GameState['blueprints'] {
  if (!state.currentBiome) return state.blueprints;
  const biomeDef = getBiomeDefinition(state.currentBiome);
  if (!biomeDef?.rewards.blueprints?.length) return state.blueprints;

  let updatedBlueprints = state.blueprints;
  biomeDef.rewards.blueprints.forEach((blueprintId) => {
    const alreadyUnlocked = updatedBlueprints.some((blueprint) => blueprint.definitionId === blueprintId);
    if (alreadyUnlocked) return;
    updatedBlueprints = [
      ...updatedBlueprints,
      {
        definitionId: blueprintId,
        id: `blueprint-${blueprintId}-${Date.now()}`,
        unlockedAt: Date.now(),
        isNew: true,
      },
    ];
  });
  return updatedBlueprints;
}

export function completeEncounterFromBiomeRewards(state: GameState): GameState {
  if (!isCombatSessionActive(state)) return state;
  if (!state.currentBiome) return state;
  const biomeDef = getBiomeDefinition(state.currentBiome);
  if (!biomeDef) return state;

  const activeTileId = state.activeSessionTileId;
  const activeParty = activeTileId ? (state.tileParties[activeTileId] ?? []) : [];
  const rewardCards = resolveBiomeRewardCards(state);
  const updatedBlueprints = resolveBiomeBlueprintUnlocks(state);

  return {
    ...state,
    phase: 'garden',
    currentBiome: undefined,
    activeSessionTileId: undefined,
    biomeMovesCompleted: undefined,
    pendingCards: [...state.pendingCards, ...rewardCards],
    blueprints: updatedBlueprints,
    pendingBlueprintCards: [],
    tableaus: [],
    foundations: [],
    stock: [],
    tileParties: activeTileId
      ? { ...state.tileParties, [activeTileId]: [] }
      : state.tileParties,
    availableActors: activeParty.length > 0
      ? [...state.availableActors, ...activeParty]
      : state.availableActors,
  };
}
