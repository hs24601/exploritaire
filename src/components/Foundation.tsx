import { memo, useCallback } from 'react';
import { motion } from 'framer-motion';
import type { Card as CardType, InteractionMode } from '../engine/types';
import { Card } from './Card';

interface FoundationProps {
  cards: CardType[];
  index: number;
  onFoundationClick: (index: number) => void;
  canReceive: boolean;
  isGuidanceTarget?: boolean;
  isDimmed?: boolean;
  interactionMode: InteractionMode;
  isDragTarget?: boolean;
  setDropRef?: (index: number, ref: HTMLDivElement | null) => void;
  actorName?: string;
}

export const Foundation = memo(function Foundation({
  cards,
  index,
  onFoundationClick,
  canReceive,
  isGuidanceTarget = false,
  isDimmed = false,
  interactionMode,
  isDragTarget = false,
  setDropRef,
  actorName,
}: FoundationProps) {
  const topCard = cards[cards.length - 1];
  const showClickHighlight = interactionMode === 'click' && (canReceive || isGuidanceTarget);
  const showDragHighlight = interactionMode === 'dnd' && isDragTarget;
  const showHighlight = showClickHighlight || showDragHighlight;
  const highlightColor = isGuidanceTarget ? '#7fdbca' : '#e6b31e';

  const refCallback = useCallback(
    (ref: HTMLDivElement | null) => {
      if (setDropRef) {
        setDropRef(index, ref);
      }
    },
    [setDropRef, index]
  );

  return (
    <div className="flex flex-col items-center gap-2 transition-opacity duration-300">
      <motion.div
        ref={refCallback}
        onClick={interactionMode === 'click' ? () => onFoundationClick(index) : undefined}
        whileHover={showClickHighlight ? { scale: 1.05 } : {}}
        whileTap={showClickHighlight ? { scale: 0.98 } : {}}
        animate={
          showHighlight
            ? { scale: [1, 1.03, 1] }
            : { scale: 1 }
        }
        transition={
          showHighlight
            ? { duration: 1.2, repeat: Infinity, ease: 'easeInOut' }
            : {}
        }
        className={`relative ${showClickHighlight ? 'cursor-pointer' : 'cursor-default'}`}
      >
        {showHighlight && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: [0.4, 0.8, 0.4] }}
            transition={{ duration: 1.2, repeat: Infinity, ease: 'easeInOut' }}
            className="absolute -inset-1.5 border-[3px] rounded-xl pointer-events-none z-10"
            style={{
              borderColor: showDragHighlight ? '#7fdbca' : highlightColor,
              boxShadow: `0 0 20px ${showDragHighlight ? '#7fdbca' : highlightColor}, inset 0 0 10px ${showDragHighlight ? '#7fdbca' : highlightColor}33`,
            }}
          />
        )}
        <Card card={topCard} isFoundation isDimmed={isDimmed} />
      </motion.div>
      {actorName && (
        <div
          className={`text-[10px] text-game-teal tracking-wider ${isDimmed ? 'opacity-30' : 'opacity-70'}`}
        >
          {actorName.toUpperCase()}
        </div>
      )}
      <div
        className={`text-xs text-game-white ${isDimmed ? 'opacity-30' : 'opacity-60'}`}
      >
        {cards.length - 1}
      </div>
    </div>
  );
});
