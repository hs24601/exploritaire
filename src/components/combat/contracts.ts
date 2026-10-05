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
  playEnemyCardDirect: (tableauIndex: number, foundationIndex: number) => boolean;
  playFromHand: (card: CardType, foundationIndex: number, useWild?: boolean) => boolean;
  playFromStock: (foundationIndex: number, useWild?: boolean, force?: boolean) => boolean;
  completeEncounter: () => void;
  autoSolveEncounter: () => void;
  endTurn: () => void;
  endRestTurn: () => void;
  advanceTurn: () => void;
  tickRpgCombat: RpgTickAction;
  setEnemyDifficulty: (difficulty: GameState['enemyDifficulty']) => void;
  rewindLastCard: () => boolean;
  swapPartyLead: (actorId: string) => void;
  playWildAnalysisSequence: () => void;
  spawnEnemy: () => void;
  setTableaus: (tableaus: CardType[][]) => void;
  addRpgHandCard: (card: CardType) => boolean;
  applyKeruArchetype: (archetype: 'felis') => boolean;
  puzzleCompleted: (payload?: PuzzleCompletedPayload | null) => void;
  startEncounter: (seedId?: string) => void;
}

export interface CombatSandboxActionsContract {
  newGame: (preserveProgress?: boolean) => void;
  startEncounter: (seedId?: string) => void;
  spawnEnemy: () => void;
  spawnEnemyActor: (definitionId: string, foundationIndex: number) => void;
  reshuffleTableaus: () => void;
  endTurn: () => void;
  advanceTurn: () => void;
  endRestTurn?: () => void;
  cleanupDefeatedEnemies: () => void;
  setEnemyDifficulty: (difficulty: GameState['enemyDifficulty']) => void;
  setCombatFlowMode: (mode: NonNullable<GameState['combatFlowMode']>) => void;
  setActiveSide?: (side: 'player' | 'enemy') => void;
  selectCard: (card: CardType, tableauIndex: number) => void;
  playToFoundation: (foundationIndex: number) => boolean;
  playFromTableau: (tableauIndex: number, foundationIndex: number) => boolean;
  playEnemyFromTableau: (tableauIndex: number, foundationIndex: number) => boolean;
  playFromHand: (card: CardType, foundationIndex: number, useWild?: boolean) => boolean;
  playFromHandToEnemyFoundation: (card: CardType, enemyFoundationIndex: number) => boolean;
  setTableaus: (tableaus: CardType[][]) => void;
  setFoundations: (foundations: CardType[][]) => void;
  restoreCombatLabSnapshot?: (snapshot: Partial<GameState>) => boolean;
  autoPlayNextMove?: () => void;
  completeEncounter?: () => void;
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
