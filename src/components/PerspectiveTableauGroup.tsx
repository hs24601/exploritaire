import { memo } from 'react';
import { Tableau } from './Tableau';
import type { GameState, SelectedCard, Move, Card as CardType } from '../engine/types';

interface PerspectiveTableauGroupProps {
  gameState: GameState;
  selectedCard: SelectedCard | null;
  onCardSelect: (card: CardType, tableauIndex: number) => void;
  guidanceMoves: Move[];
  showGraphics: boolean;
  cardScale: number;
  interactionMode: 'click' | 'dnd';
  handleDragStart?: (card: CardType, tableauIndex: number, clientX: number, clientY: number, rect: DOMRect) => void;
  isDragging?: boolean;
  draggingCardId?: string | null;
  revealNextRow?: boolean;
  tableauCanPlay?: boolean[];
  noValidMoves?: boolean;
}

export const PerspectiveTableauGroup = memo(function PerspectiveTableauGroup({
  gameState,
  selectedCard,
  onCardSelect,
  guidanceMoves,
  showGraphics,
  cardScale,
  interactionMode,
  handleDragStart,
  isDragging,
  draggingCardId,
  revealNextRow,
  tableauCanPlay = [],
  noValidMoves = false,
}: PerspectiveTableauGroupProps) {
  return (
    <div className="perspective-group-container">
      <div className="perspective-group-content flex items-start" style={{ gap: '0px' }}>
        {(gameState.tableaus || []).map((cards, idx) => (
          <Tableau
            key={idx}
            cards={cards}
            tableauIndex={idx}
            canPlay={tableauCanPlay[idx] ?? true}
            noValidMoves={noValidMoves}
            selectedCard={selectedCard}
            onCardSelect={onCardSelect}
            guidanceMoves={guidanceMoves}
            interactionMode={interactionMode}
            onDragStart={handleDragStart}
            draggingCardId={draggingCardId}
            isAnyCardDragging={isDragging}
            showGraphics={showGraphics}
            cardScale={cardScale}
            revealAllCards={true}
            layout="horizontal"
            revealNextRow={revealNextRow}
          />
        ))}
      </div>

      <style>{`
        .perspective-group-container {
          padding: 0;
          perspective: 2000px;
          display: flex;
          justify-content: center;
          overflow: visible;
          width: 100%;
        }

        .perspective-group-content {
          transform: perspective(80em) rotateY(-42deg) rotateX(2.4deg);
          box-shadow: 
            -20px 60px 123px -25px rgba(22, 31, 39, 0.6),
            -10px 35px 75px -35px rgba(19, 26, 32, 0.2);
          border-radius: 10px;
          border: 1px solid rgba(213, 220, 226, 0.4);
          border-bottom-color: rgba(184, 194, 204, 0.5);
          transition: box-shadow 1.2s ease;
          padding: 10px;
          background: rgba(10, 15, 20, 0.4);
          backdrop-filter: blur(4px);
          display: flex;
          flex-direction: row;
          align-items: flex-start;
          transform-style: preserve-3d;
        }

        .perspective-group-content:hover {
          box-shadow: 
            -30px 80px 140px -20px rgba(22, 31, 39, 0.7),
            -15px 45px 90px -30px rgba(19, 26, 32, 0.3);
          background: rgba(20, 25, 35, 0.5);
        }
      `}</style>
    </div>
  );
});
