import { memo, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Tableau } from './Tableau';
import type { GameState, SelectedCard, Move, Card as CardType } from '../engine/types';

interface TestbedModalProps {
  open: boolean;
  onClose: () => void;
  gameState: GameState;
  selectedCard: SelectedCard | null;
  onCardSelect: (card: CardType, tableauIndex: number) => void;
  guidanceMoves: Move[];
  showGraphics: boolean;
}

export const TestbedModal = memo(function TestbedModal({
  open,
  onClose,
  gameState,
  selectedCard,
  onCardSelect,
  guidanceMoves,
  showGraphics,
}: TestbedModalProps) {
  const allCards = useMemo(() => (gameState.tableaus || []).flat(), [gameState.tableaus]);

  if (!open) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/80 backdrop-blur-md"
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.9, opacity: 0 }}
          className="relative w-full max-w-[95vw] h-[80vh] flex flex-col items-center justify-center p-8 bg-game-bg-dark border border-game-teal/30 rounded-3xl overflow-hidden"
          onClick={(e) => e.stopPropagation()}
        >
          <button
            onClick={onClose}
            className="absolute top-6 right-6 text-game-pink border border-game-pink/50 rounded-full w-10 h-10 flex items-center justify-center hover:bg-game-pink/10 transition-colors z-10"
          >
            ✕
          </button>

          <div className="absolute top-8 left-8">
            <h2 className="text-game-teal text-xl font-bold tracking-[0.3em] uppercase">Layout Testbed</h2>
            <p className="text-game-white/40 text-xs mt-1 tracking-widest">3D PERSPECTIVE STRIP EXPERIMENT</p>
          </div>

          <div className="flex items-center justify-center w-full h-full overflow-visible">
            <div className="testbed-container">
              <div className="testbed-content">
                <Tableau
                  cards={allCards}
                  tableauIndex={0}
                  canPlay={true}
                  noValidMoves={false}
                  selectedCard={selectedCard}
                  onCardSelect={onCardSelect}
                  guidanceMoves={guidanceMoves}
                  interactionMode="click"
                  showGraphics={showGraphics}
                  cardScale={1.4}
                  revealAllCards={true}
                  layout="horizontal"
                />
              </div>
            </div>
          </div>

          <style>{`
            .testbed-container {
              padding: 4em;
              perspective: 2000px;
              width: 100%;
              display: flex;
              justify-content: center;
              overflow: visible;
            }

            .testbed-content {
              transform: perspective(80em) rotateY(-42deg) rotateX(2.4deg);
              box-shadow: 
                -20px 60px 123px -25px rgba(22, 31, 39, 0.6),
                -10px 35px 75px -35px rgba(19, 26, 32, 0.2);
              border-radius: 10px;
              border: 1px solid rgba(213, 220, 226, 0.4);
              border-bottom-color: rgba(184, 194, 204, 0.5);
              transition: box-shadow 1.2s ease;
              padding: 2.5rem;
              background: rgba(10, 15, 20, 0.4);
              backdrop-filter: blur(4px);
              display: inline-block;
              transform-style: preserve-3d;
            }

            .testbed-content:hover {
              box-shadow: 
                -30px 80px 140px -20px rgba(22, 31, 39, 0.7),
                -15px 45px 90px -30px rgba(19, 26, 32, 0.3);
              background: rgba(20, 25, 35, 0.5);
            }
          `}</style>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
});
