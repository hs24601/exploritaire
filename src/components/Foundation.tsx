import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import type { Card as CardType, InteractionMode } from '../engine/types';
import { CARD_SIZE } from '../engine/constants';
import { useCardScale } from '../contexts/CardScaleContext';
import { Card } from './Card';
import { NEON_COLORS } from '../utils/styles';

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
  showGraphics: boolean;
  manualPlayCounter?: number;
  showCompleteSticker?: boolean;
  countPosition?: 'above' | 'below' | 'none';
  maskValue?: boolean;
  revealValue?: number | null;
}

const FOUNDATION_TILT_MAX_DEG = 2.4;

const getFoundationTilt = (cardId: string) => {
  let hash = 0;
  for (let i = 0; i < cardId.length; i++) {
    hash = (hash * 31 + cardId.charCodeAt(i)) | 0;
  }
  const seed = Math.sin(hash * 0.17) * 10000;
  const normalized = seed - Math.floor(seed);
  return (normalized * 2 - 1) * FOUNDATION_TILT_MAX_DEG;
};

const getFoundationOffset = (cardId: string) => {
  let hash = 0;
  for (let i = 0; i < cardId.length; i++) {
    hash = (hash * 33 + cardId.charCodeAt(i)) | 0;
  }
  const seedX = Math.sin(hash * 0.27) * 10000;
  const seedY = Math.cos(hash * 0.41) * 10000;
  const normalizedX = seedX - Math.floor(seedX);
  const normalizedY = seedY - Math.floor(seedY);
  const maxOffset = 1.6;
  return {
    x: (normalizedX * 2 - 1) * maxOffset,
    y: (normalizedY * 2 - 1) * maxOffset,
  };
};

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
  showGraphics,
  manualPlayCounter = 0,
  showCompleteSticker = false,
  countPosition = 'below',
  maskValue = false,
  revealValue = null,
}: FoundationProps) {
  const globalScale = useCardScale();
  const cardWidth = CARD_SIZE.width * globalScale;
  const cardHeight = CARD_SIZE.height * globalScale;
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
  const lastCountRef = useRef(cards.length);
  const [comboPulse, setComboPulse] = useState(0);
  const foundationTiltRef = useRef(new Map<string, number>());
  const foundationOffsetRef = useRef(new Map<string, { x: number; y: number }>());
  useEffect(() => {
    cards.forEach((card) => {
      if (!foundationTiltRef.current.has(card.id)) {
        foundationTiltRef.current.set(card.id, getFoundationTilt(card.id));
      }
      if (!foundationOffsetRef.current.has(card.id)) {
        foundationOffsetRef.current.set(card.id, getFoundationOffset(card.id));
      }
    });
  }, [cards]);
  const stackCards = useMemo(() => cards.slice(-7), [cards]);
  const getTiltForCard = useCallback((cardId: string) => {
    return foundationTiltRef.current.get(cardId) ?? getFoundationTilt(cardId);
  }, []);
  const getOffsetForCard = useCallback((cardId: string) => {
    return foundationOffsetRef.current.get(cardId) ?? getFoundationOffset(cardId);
  }, []);

  useEffect(() => {
    const prevCount = lastCountRef.current;
    if (manualPlayCounter > 0 && cards.length > prevCount) {
      setComboPulse((prev) => prev + 1);
    }
    lastCountRef.current = cards.length;
  }, [cards.length, manualPlayCounter]);

  return (
    <div className="flex flex-col items-center gap-2 transition-opacity duration-300">
      {countPosition === 'above' && (
        <div
          className={`relative z-20 text-xs text-game-white ${isDimmed ? 'opacity-30' : 'opacity-60'}`}
        >
          {cards.length - 1}
        </div>
      )}
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
        <AnimatePresence>
          {comboPulse > 0 && (
            <motion.div
              key={comboPulse}
              initial={{ opacity: 0, scale: 0.3, rotate: -12, y: -6 }}
              animate={{ opacity: 1, scale: 1.25, rotate: 10, y: -22 }}
              exit={{ opacity: 0, scale: 1.6, rotate: 0, y: -32 }}
              transition={{ duration: 0.5, ease: 'backOut' }}
              className="absolute -top-10 -right-8 pointer-events-none"
            >
              <div className="relative">
                {(() => {
                  const comboLevel = Math.max(1, cards.length - 1);
                  const intensity = Math.min(comboLevel / 15, 1);
                  const scaleBoost = 0.9 + intensity * 0.6;
                  const glowAlpha = 0.25 + intensity * 0.55;
                  const showBurstText = comboLevel >= 5;
                  const showRing = comboLevel >= 3;
                  const showComplete = showCompleteSticker && comboLevel > 0;
                  return (
                    <>
                      <motion.div
                        initial={{ opacity: 0, scale: 0.6, rotate: -18 }}
                        animate={{ opacity: glowAlpha, scale: 1.1 + intensity * 0.4, rotate: -8 }}
                        exit={{ opacity: 0, scale: 1.4 + intensity * 0.4 }}
                        transition={{ duration: 0.35, ease: 'backOut' }}
                        className="absolute -inset-3 rounded-full"
                        style={{
                          background: `radial-gradient(circle, rgba(230,179,30,${glowAlpha}) 0%, rgba(230,179,30,0) 70%)`,
                          boxShadow: `0 0 ${24 + intensity * 30}px rgba(230, 179, 30, ${0.45 + intensity * 0.5})`,
                        }}
                      />
                      {showRing && (
                        <motion.div
                          initial={{ opacity: 0, scale: 0.5, rotate: 12 }}
                          animate={{ opacity: 0.6 + intensity * 0.35, scale: 1 + intensity * 0.3, rotate: 6 }}
                          exit={{ opacity: 0, scale: 1.3 + intensity * 0.3 }}
                          transition={{ duration: 0.4, ease: 'backOut' }}
                          className="absolute -inset-2 rotate-6"
                          style={{
                            background:
                              'repeating-conic-gradient(from 0deg, rgba(230,179,30,0.2) 0deg 10deg, rgba(10,10,10,0) 10deg 20deg)',
                            maskImage: 'radial-gradient(circle, black 55%, transparent 72%)',
                          }}
                        />
                      )}
                      {showBurstText && (
                        <>
                          <motion.div
                            initial={{ opacity: 0, y: -6, rotate: -8 }}
                            animate={{ opacity: 1, y: -14 - intensity * 10, rotate: 4 }}
                            exit={{ opacity: 0, y: -22 - intensity * 10 }}
                            transition={{ duration: 0.35, ease: 'backOut' }}
                            className="absolute -left-10 -top-4 text-[9px] font-bold tracking-[3px]"
                            style={{ color: NEON_COLORS.orange, textShadow: `0 0 10px ${NEON_COLORS.orangeRgba(0.9)}` }}
                          >
                            POW!
                          </motion.div>
                          <motion.div
                            initial={{ opacity: 0, y: 6, rotate: 8 }}
                            animate={{ opacity: 0.9, y: 14 + intensity * 10, rotate: -4 }}
                            exit={{ opacity: 0, y: 22 + intensity * 10 }}
                            transition={{ duration: 0.4, ease: 'backOut' }}
                            className="absolute -right-12 -bottom-4 text-[9px] font-bold tracking-[3px]"
                            style={{ color: NEON_COLORS.blue, textShadow: `0 0 10px ${NEON_COLORS.blueRgba(0.9)}` }}
                          >
                            BAM!
                          </motion.div>
                        </>
                      )}
                      <div
                        className="relative z-10 px-3 py-1 text-[10px] font-bold tracking-[3px] rounded border-2"
                        style={{
                          color: '#e6b31e',
                          borderColor: '#e6b31e',
                          background: 'rgba(10, 10, 10, 0.9)',
                          boxShadow: `0 0 ${12 + intensity * 18}px rgba(230, 179, 30, ${0.6 + intensity * 0.4})`,
                          textShadow: `0 0 ${6 + intensity * 8}px rgba(230, 179, 30, ${0.7 + intensity * 0.3})`,
                          transform: `scale(${scaleBoost})`,
                        }}
                      >
                        COMBO {comboLevel}
                      </div>
                      {showComplete && (
                        <div className="absolute -right-20 -top-12 z-20">
                          <svg
                            width="80"
                            height="80"
                            viewBox="0 0 120 120"
                            className="drop-shadow-[0_0_18px_rgba(230,179,30,0.7)]"
                          >
                            <polygon
                              points="60,6 72,38 106,38 78,58 90,92 60,72 30,92 42,58 14,38 48,38"
                              fill="#0a0a0a"
                              stroke="#e6b31e"
                              strokeWidth="4"
                            />
                          </svg>
                          <div
                            className="absolute inset-0 flex items-center justify-center text-[9px] font-bold tracking-[2px]"
                            style={{
                              color: '#e6b31e',
                              textShadow:
                                '-1px -1px 0 #000, 1px -1px 0 #000, -1px 1px 0 #000, 1px 1px 0 #000',
                            }}
                          >
                            COMPLETE!
                          </div>
                        </div>
                      )}
                    </>
                  );
                })()}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
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
        <div className="relative" style={{ width: cardWidth, height: cardHeight }}>
          {stackCards.map((card, stackIndex) => {
            const isTop = stackIndex === stackCards.length - 1;
            const tilt = stackCards.length <= 1 && isTop ? 0 : getTiltForCard(card.id);
            const offset = isTop ? { x: 0, y: 0 } : getOffsetForCard(card.id);
            return (
              <div
                key={card.id}
                style={{
                  position: 'absolute',
                  inset: 0,
                  transform: `translate(${offset.x}px, ${offset.y}px) rotate(${tilt.toFixed(2)}deg)`,
                  transformOrigin: 'center',
                  zIndex: 2 + stackIndex,
                  opacity: maskValue ? 0 : 1,
                  transition: 'opacity 0.4s ease',
                }}
              >
                <Card card={card} isFoundation isDimmed={isDimmed} showGraphics={showGraphics} />
              </div>
            );
          })}
          {maskValue && (
            <div
              className="absolute inset-0 rounded-lg flex items-center justify-center"
              style={{
                backgroundColor: 'rgba(0, 0, 0, 0.85)',
              }}
            >
              <div
                className="text-lg font-bold tracking-[2px]"
                style={{
                  color: '#f7d24b',
                  opacity: revealValue != null ? 1 : 0,
                  transition: 'opacity 0.9s ease',
                  textShadow: '0 0 8px rgba(230, 179, 30, 0.6)',
                }}
              >
                {revealValue}
              </div>
            </div>
          )}
        </div>
      </motion.div>
      {actorName && (
        <div
          className={`relative z-20 text-[10px] text-game-teal tracking-wider ${isDimmed ? 'opacity-30' : 'opacity-70'}`}
        >
          {actorName.toUpperCase()}
        </div>
      )}
      {countPosition === 'below' && (
        <div
          className={`relative z-20 text-xs text-game-white ${isDimmed ? 'opacity-30' : 'opacity-60'}`}
        >
          {cards.length - 1}
        </div>
      )}
    </div>
  );
});
