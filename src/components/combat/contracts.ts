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
  playCardInRandomBiome: (tableauIndex: number, foundationIndex: number) => boolean;
  playEnemyCardInRandomBiome: (tableauIndex: number, foundationIndex: number) => boolean;
  playFromHand: (card: CardType, foundationIndex: number, useWild?: boolean) => boolean;
  playFromStock: (foundationIndex: number, useWild?: boolean, force?: boolean) => boolean;
  completeBiome: () => void;
  autoSolveBiome: () => void;
  playCardInNodeBiome: (nodeId: string, foundationIndex: number) => void;
  endRandomBiomeTurn: () => void;
  endExplorationTurnInRandomBiome: () => void;
  advanceRandomBiomeTurn: () => void;
  tickRpgCombat: RpgTickAction;
  setEnemyDifficulty: (difficulty: GameState['enemyDifficulty']) => void;
  rewindLastCard: () => boolean;
  swapPartyLead: (actorId: string) => void;
  playWildAnalysisSequence: () => void;
  spawnRandomEnemyInRandomBiome: () => void;
  setBiomeTableaus: (tableaus: CardType[][]) => void;
  addRpgHandCard: (card: CardType) => boolean;
  applyKeruArchetype: (archetype: 'felis') => boolean;
  puzzleCompleted: (payload?: PuzzleCompletedPayload | null) => void;
  startBiome: (tileId: string, biomeId: string) => void;
}

export interface CombatSandboxActionsContract {
  newGame: (preserveProgress?: boolean) => void;
  startBiome: (tileId: string, biomeId: string) => void;
  spawnRandomEnemyInRandomBiome: () => void;
  spawnEnemyActorInRandomBiome: (definitionId: string, foundationIndex: number) => void;
  rerollRandomBiomeDeal: () => void;
  endRandomBiomeTurn: () => void;
  advanceRandomBiomeTurn: () => void;
  cleanupDefeatedEnemies: () => void;
  setEnemyDifficulty: (difficulty: GameState['enemyDifficulty']) => void;
  setCombatFlowMode: (mode: NonNullable<GameState['combatFlowMode']>) => void;
  selectCard: (card: CardType, tableauIndex: number) => void;
  playToFoundation: (foundationIndex: number) => boolean;
  playFromTableau: (tableauIndex: number, foundationIndex: number) => boolean;
  playFromHand: (card: CardType, foundationIndex: number, useWild?: boolean) => boolean;
  playFromHandToEnemyFoundation: (card: CardType, enemyFoundationIndex: number) => boolean;
  playCardInRandomBiome: (tableauIndex: number, foundationIndex: number) => boolean;
  playEnemyCardInRandomBiome: (tableauIndex: number, foundationIndex: number) => boolean;
  setBiomeTableaus: (tableaus: CardType[][]) => void;
  setBiomeFoundations: (foundations: CardType[][]) => void;
  restoreCombatLabSnapshot?: (snapshot: Partial<GameState>) => boolean;
  autoPlayNextMove?: () => void;
  completeBiome?: () => void;
  endExplorationTurnInRandomBiome?: () => void;
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
  tickRpgCombat?: RpgTickAction;
  updateEquippedRelics?: (equippedRelics: RelicInstanceLike[]) => void;
  devInjectOrimToActor?: (
    actorId: string,
    orimDefinitionId: string,
    foundationIndex?: number,
    dropPoint?: { x: number; y: number }
  ) => void;
}
