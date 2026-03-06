import type { Card as CardType, GameState, PuzzleCompletedPayload } from '../../engine/types';

export type RpgTickAction = (nowMs: number) => boolean | void;
export type RelicInstanceLike = {
  instanceId: string;
  relicId: string;
  enabled: boolean;
  level?: number;
};

export interface EncounterCombatActions {
  selectCard: (card: CardType, tableauIndex: number) => void;
  playToFoundation: (foundationIndex: number) => boolean;
  playCardDirect: (tableauIndex: number, foundationIndex: number) => boolean;
  // Canonical combat actions (mode-agnostic).
  playTableauCard: (tableauIndex: number, foundationIndex: number) => boolean;
  playEnemyTableauCard: (tableauIndex: number, foundationIndex: number) => boolean;
  advanceTurn: () => void;
  endTurn: () => void;
  endExplorationTurn?: () => void;
  completeEncounter: () => void;
  spawnEnemy: () => void;
  setCombatTableaus: (tableaus: CardType[][]) => void;
  playFromHand: (card: CardType, foundationIndex: number, useWild?: boolean) => boolean;
  playFromStock: (foundationIndex: number, useWild?: boolean, force?: boolean) => boolean;
  autoSolveBiome: () => void;
  playCardInNodeBiome: (nodeId: string, foundationIndex: number) => void;
  tickRpgCombat: RpgTickAction;
  setEnemyDifficulty: (difficulty: GameState['enemyDifficulty']) => void;
  rewindLastCard: () => boolean;
  swapPartyLead: (actorId: string) => void;
  playWildAnalysisSequence: () => void;
  addRpgHandCard: (card: CardType) => boolean;
  applyKeruArchetype: (archetype: 'felis') => boolean;
  puzzleCompleted: (payload?: PuzzleCompletedPayload | null) => void;
  startBiome: (tileId: string, biomeId: string) => void;
}

export interface CombatSandboxActionsContract {
  newGame: (preserveProgress?: boolean) => void;
  startBiome: (tileId: string, biomeId: string) => void;
  // Canonical combat actions (mode-agnostic).
  playTableauCard: (tableauIndex: number, foundationIndex: number) => boolean;
  playEnemyTableauCard: (tableauIndex: number, foundationIndex: number) => boolean;
  advanceTurn: () => void;
  endTurn: () => void;
  endExplorationTurn?: () => void;
  completeEncounter?: () => void;
  spawnEnemy: () => void;
  spawnEnemyActor: (definitionId: string, foundationIndex: number) => void;
  setCombatTableaus: (tableaus: CardType[][]) => void;
  setCombatFoundations: (foundations: CardType[][]) => void;
  setCombatActiveSide?: (side: 'player' | 'enemy') => void;
  rerollRandomBiomeDeal: () => void;
  cleanupDefeatedEnemies: () => void;
  setEnemyDifficulty: (difficulty: GameState['enemyDifficulty']) => void;
  setCombatFlowMode: (mode: NonNullable<GameState['combatFlowMode']>) => void;
  selectCard: (card: CardType, tableauIndex: number) => void;
  playToFoundation: (foundationIndex: number) => boolean;
  playFromTableau: (tableauIndex: number, foundationIndex: number) => boolean;
  playFromHand: (card: CardType, foundationIndex: number, useWild?: boolean) => boolean;
  playFromHandToEnemyFoundation: (card: CardType, enemyFoundationIndex: number) => boolean;
  restoreCombatLabSnapshot?: (snapshot: Partial<GameState>) => boolean;
  autoPlayNextMove?: () => void;
  playRpgHandCardOnActor?: (
    cardId: string,
    side: 'player' | 'enemy',
    actorIndex: number
  ) => boolean;
  playEnemyRpgHandCardOnActor?: (
    enemyActorIndex: number,
    cardId: string,
    targetActorIndex: number
  ) => boolean;
  spendActorAp?: (actorId: string, amount: number) => boolean;
  tickRpgCombat?: RpgTickAction;
  updateEquippedRelics?: (equippedRelics: RelicInstanceLike[]) => void;
  devInjectOrimToActor?: (
    actorId: string,
    orimDefinitionId: string,
    foundationIndex?: number,
    dropPoint?: { x: number; y: number }
  ) => void;
}
