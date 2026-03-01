import type { MutableRefObject } from 'react';
import { getBiomeDefinition } from '../../engine/biomes';
import type { Actor, Card as CardType, EncounterDefinition, GameState, Move, PuzzleCompletedPayload, SelectedCard } from '../../engine/types';
import type { DragState } from '../../hooks/useDragDrop';
import type { EncounterCombatActions } from '../combat/contracts';
import { CombatGolf } from '../CombatGolf';
import { EventEncounter } from '../EventEncounter';

type SandboxOrimResult = { id: string; name: string; domain: 'puzzle' | 'combat' };

interface EncounterSceneProps {
  gameState: GameState;
  selectedCard: SelectedCard | null;
  validFoundationsForSelected: boolean[];
  tableauCanPlay: boolean[];
  noValidMoves: boolean;
  isWon: boolean;
  guidanceMoves: Move[];
  activeParty: Actor[];
  sandboxOrimIds: string[];
  orimTrayDevMode: boolean;
  orimTrayTab: 'puzzle' | 'combat';
  onOrimTrayTabChange: (tab: 'puzzle' | 'combat') => void;
  sandboxOrimSearch: string;
  onSandboxOrimSearchChange: (next: string) => void;
  sandboxOrimResults: SandboxOrimResult[];
  onAddSandboxOrim: (id: string) => void;
  onRemoveSandboxOrim: (id: string) => void;
  hasCollectedLoot: boolean;
  dragState: DragState;
  dragPositionRef?: MutableRefObject<{ x: number; y: number }>;
  handleDragStart: (card: CardType, tableauIndex: number, clientX: number, clientY: number, rect: DOMRect) => void;
  setFoundationRef: (index: number, el: HTMLDivElement | null) => void;
  foundationSplashHint?: {
    foundationIndex: number;
    directionDeg: number;
    token: number;
  } | null;
  rpgImpactSplashHint?: {
    side: 'player' | 'enemy';
    foundationIndex: number;
    directionDeg: number;
    token: number;
  } | null;
  handCards: CardType[];
  tooltipSuppressed: boolean;
  handleExitBiome: (mode: 'return' | 'abandon') => void;
  useGhostBackground: boolean;
  lightingEnabled: boolean;
  fps?: number;
  serverAlive?: boolean;
  infiniteStockEnabled: boolean;
  onToggleInfiniteStock: () => void;
  onOpenPoiEditorAt?: (x: number, y: number) => void;
  poiRewardResolvedAt?: number;
  benchSwapCount: number;
  infiniteBenchSwapsEnabled: boolean;
  onToggleInfiniteBenchSwaps: () => void;
  onConsumeBenchSwap: () => void;
  noRegretStatus: { canRewind: boolean; cooldown: number; actorId: string | null };
  paintLuminosityEnabled?: boolean;
  onTogglePaintLuminosity?: () => void;
  zenModeEnabled?: boolean;
  isGamePaused?: boolean;
  highPerformanceTimer?: boolean;
  timeScale?: number;
  onOpenSettings?: () => void;
  onTogglePause?: () => void;
  onToggleCombatSandbox: () => void;
  combatSandboxOpen?: boolean;
  wildAnalysis?: { key: string; sequence: Move[]; maxCount: number } | null;
  combatActions: EncounterCombatActions;
  explorationStepRef: MutableRefObject<(() => void) | null>;
  onPositionChange: (x: number, y: number) => void;
  forcedPerspectiveEnabled?: boolean;
  eventActions: {
    puzzleCompleted: (payload?: PuzzleCompletedPayload | null) => void;
    completeBiome: () => void;
  };
}

export function EncounterScene({
  gameState,
  selectedCard,
  validFoundationsForSelected,
  tableauCanPlay,
  noValidMoves,
  isWon,
  guidanceMoves,
  activeParty,
  sandboxOrimIds,
  orimTrayDevMode,
  orimTrayTab,
  onOrimTrayTabChange,
  sandboxOrimSearch,
  onSandboxOrimSearchChange,
  sandboxOrimResults,
  onAddSandboxOrim,
  onRemoveSandboxOrim,
  hasCollectedLoot,
  dragState,
  dragPositionRef,
  handleDragStart,
  setFoundationRef,
  foundationSplashHint,
  rpgImpactSplashHint,
  handCards,
  tooltipSuppressed,
  handleExitBiome,
  useGhostBackground,
  lightingEnabled,
  fps,
  serverAlive,
  infiniteStockEnabled,
  onToggleInfiniteStock,
  onOpenPoiEditorAt,
  poiRewardResolvedAt,
  benchSwapCount,
  infiniteBenchSwapsEnabled,
  onToggleInfiniteBenchSwaps,
  onConsumeBenchSwap,
  noRegretStatus,
  paintLuminosityEnabled,
  onTogglePaintLuminosity,
  zenModeEnabled,
  isGamePaused,
  highPerformanceTimer = false,
  timeScale,
  onOpenSettings,
  onTogglePause,
  onToggleCombatSandbox,
  combatSandboxOpen = false,
  wildAnalysis,
  combatActions,
  explorationStepRef,
  onPositionChange,
  forcedPerspectiveEnabled,
  eventActions,
}: EncounterSceneProps) {
  const isEventBiome = gameState.currentBiome
    ? getBiomeDefinition(gameState.currentBiome)?.biomeType === 'event'
    : false;

  const encounterDefinition: EncounterDefinition = (gameState.enemyActors ?? []).length > 0
    ? {
      type: 'combat',
      enemyActors: gameState.enemyActors ?? [],
      loot: gameState.rewardQueue ?? [],
    }
    : { type: 'puzzle' };

  if (isEventBiome) {
    return <EventEncounter gameState={gameState} actions={eventActions} />;
  }

  return (
    <CombatGolf
      gameState={gameState}
      encounterDefinition={encounterDefinition}
      selectedCard={selectedCard}
      validFoundationsForSelected={validFoundationsForSelected}
      tableauCanPlay={tableauCanPlay}
      noValidMoves={noValidMoves}
      isWon={isWon}
      guidanceMoves={guidanceMoves}
      activeParty={activeParty}
      sandboxOrimIds={sandboxOrimIds}
      orimTrayDevMode={orimTrayDevMode}
      orimTrayTab={orimTrayTab}
      onOrimTrayTabChange={onOrimTrayTabChange}
      sandboxOrimSearch={sandboxOrimSearch}
      onSandboxOrimSearchChange={onSandboxOrimSearchChange}
      sandboxOrimResults={sandboxOrimResults}
      onAddSandboxOrim={onAddSandboxOrim}
      onRemoveSandboxOrim={onRemoveSandboxOrim}
      hasCollectedLoot={hasCollectedLoot}
      dragState={dragState}
      dragPositionRef={dragPositionRef}
      handleDragStart={handleDragStart}
      setFoundationRef={setFoundationRef}
      foundationSplashHint={foundationSplashHint}
      rpgImpactSplashHint={rpgImpactSplashHint}
      handCards={handCards}
      tooltipSuppressed={tooltipSuppressed}
      handleExitBiome={handleExitBiome}
      useGhostBackground={useGhostBackground}
      lightingEnabled={lightingEnabled}
      fps={fps}
      serverAlive={serverAlive}
      infiniteStockEnabled={infiniteStockEnabled}
      onToggleInfiniteStock={onToggleInfiniteStock}
      onOpenPoiEditorAt={onOpenPoiEditorAt}
      poiRewardResolvedAt={poiRewardResolvedAt}
      benchSwapCount={benchSwapCount}
      infiniteBenchSwapsEnabled={infiniteBenchSwapsEnabled}
      onToggleInfiniteBenchSwaps={onToggleInfiniteBenchSwaps}
      onConsumeBenchSwap={onConsumeBenchSwap}
      noRegretStatus={noRegretStatus}
      paintLuminosityEnabled={paintLuminosityEnabled}
      onTogglePaintLuminosity={onTogglePaintLuminosity}
      zenModeEnabled={zenModeEnabled}
      isGamePaused={isGamePaused}
      timeScale={timeScale}
      onOpenSettings={onOpenSettings}
      onTogglePause={onTogglePause}
      onToggleCombatSandbox={onToggleCombatSandbox}
      combatSandboxOpen={combatSandboxOpen}
      highPerformanceTimer={highPerformanceTimer}
      wildAnalysis={wildAnalysis}
      actions={combatActions}
      explorationStepRef={explorationStepRef}
      onPositionChange={onPositionChange}
      forcedPerspectiveEnabled={forcedPerspectiveEnabled}
    />
  );
}
