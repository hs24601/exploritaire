import { useState, useCallback } from 'react';
import type { GameState, Actor } from '../engine/types';
import { NodeEdgeTableau } from './NodeEdgeTableau';
import { FoundationActor } from './FoundationActor';
import { GameButton } from './GameButton';
import { getBiomeDefinition } from '../engine/biomes';
import { checkNodeTableauComplete } from '../engine/nodeTableau';
import { NO_MOVES_BADGE_STYLE } from '../utils/styles';

interface NodeEdgeBiomeScreenProps {
  gameState: GameState;
  activeParty: Actor[];
  onPlayCard: (nodeId: string, foundationIndex: number) => void;
  onComplete: () => void;
  onExit: (mode: 'return' | 'abandon') => void;
  onAutoSolve: () => void;
  hasCollectedLoot: boolean;
  noValidMoves: boolean;
  showGraphics: boolean;
}

export function NodeEdgeBiomeScreen({
  gameState,
  activeParty,
  onPlayCard,
  onComplete,
  onExit,
  onAutoSolve,
  hasCollectedLoot,
  noValidMoves,
  showGraphics,
}: NodeEdgeBiomeScreenProps) {
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);

  const biomeDef = gameState.currentBiome
    ? getBiomeDefinition(gameState.currentBiome)
    : null;

  const isComplete = gameState.nodeTableau
    ? checkNodeTableauComplete(gameState.nodeTableau)
    : false;

  const handleNodeClick = useCallback((nodeId: string) => {
    setSelectedNodeId(nodeId);
  }, []);

  const handleFoundationClick = useCallback((foundationIndex: number) => {
    if (!selectedNodeId) return;
    onPlayCard(selectedNodeId, foundationIndex);
    setSelectedNodeId(null);
  }, [selectedNodeId, onPlayCard]);

  if (!gameState.nodeTableau) return null;

  return (
    <div className="w-full h-full flex flex-col items-center justify-center p-8">
      {/* Header */}
      <div className="mb-4 text-center flex items-center gap-3">
        <div>
          <h2 className="text-2xl text-game-gold mb-1" data-card-face>
            {biomeDef?.name || 'Node Tableau'}
          </h2>
          <p className="text-sm text-game-teal opacity-80" data-card-face>
            {biomeDef?.description}
          </p>
        </div>
      </div>

      {/* Main play area */}
      <div className="flex gap-8 items-center">
        {/* Foundations */}
        <div className="flex flex-col gap-3 items-center">
          {gameState.foundations.map((foundation, idx) => {
            const actor = activeParty[idx];
            const hasStamina = (actor?.stamina ?? 0) > 0;
            return (
              <FoundationActor
                key={idx}
                cards={foundation}
                index={idx}
                onFoundationClick={handleFoundationClick}
                canReceive={selectedNodeId !== null && hasStamina}
                isGuidanceTarget={false}
                isDimmed={!hasStamina}
                interactionMode={gameState.interactionMode}
                showGraphics={showGraphics}
                actor={actor}
                actorDeck={actor ? gameState.actorDecks[actor.id] : undefined}
                orimInstances={gameState.orimInstances}
                orimDefinitions={gameState.orimDefinitions}
                isPartied
              />
            );
          })}
          <div className="mt-2 flex items-center gap-2">
            <GameButton
              onClick={() => onExit(hasCollectedLoot ? 'return' : 'abandon')}
              color={hasCollectedLoot ? 'teal' : 'red'}
              size="sm"
            >
              {hasCollectedLoot ? 'RETURN' : 'ABANDON'}
            </GameButton>
            <GameButton onClick={onAutoSolve} color="gold" size="sm">
              HINT
            </GameButton>
            {noValidMoves && (
              <div
                className="px-4 py-2 text-xs tracking-wider rounded-md border-2 font-mono inline-flex items-center justify-center"
                style={NO_MOVES_BADGE_STYLE}
              >
                !
              </div>
            )}
          </div>
        </div>

        {/* Node Tableau */}
        <NodeEdgeTableau
          nodes={gameState.nodeTableau}
          onNodeClick={handleNodeClick}
          selectedNodeId={selectedNodeId}
          canvasWidth={1200}
          canvasHeight={700}
          showGraphics={showGraphics}
        />
      </div>

      {/* Progress & Controls */}
      <div className="mt-4 flex items-center gap-4">
        <span className="text-sm text-game-teal">
          Moves: {gameState.biomeMovesCompleted || 0}
        </span>

        {isComplete && (
          <GameButton onClick={onComplete} color="gold">
            Complete Adventure
          </GameButton>
        )}

      </div>
    </div>
  );
}
