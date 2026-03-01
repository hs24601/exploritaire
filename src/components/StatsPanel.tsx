import { memo } from 'react';
import type { GameState } from '../engine/types';

interface StatsPanelProps {
  gameState: GameState;
  showGraphics: boolean;
}

export const StatsPanel = memo(function StatsPanel({ gameState, showGraphics }: StatsPanelProps) {
  void showGraphics;
  const cardsRemaining = gameState.tableaus.reduce((sum, t) => sum + t.length, 0);

  return (
    <div className="absolute top-[160px] right-5 flex flex-col gap-2 text-sm items-end text-game-white opacity-70">
      <div>Cards Remaining: {cardsRemaining}</div>
      <div>Stock: {gameState.stock.length}</div>
      <div>Turn: {gameState.turnCount}</div>
    </div>
  );
});
