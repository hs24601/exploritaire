import { memo, useMemo, useState, useCallback, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { motion } from 'framer-motion';
import type { Card, ChallengeProgress, BuildPileProgress, Suit } from '../engine/types';
import { SUIT_COLORS, getSuitDisplay } from '../engine/constants';
import {
  getCurrentChallenge,
  getRequirementProgress,
  isChallengeComplete,
} from '../engine/challenges';
import {
  getBuildPileDefinition,
  canAddToBuildPile,
} from '../engine/buildPiles';
import { useCameraControls } from '../hooks/useCameraControls';
import { Sapling } from './Sapling';
import { AmbientVignette } from './LightRenderer';

interface CampScreenProps {
  pendingCards: Card[];
  challengeProgress: ChallengeProgress;
  buildPileProgress: BuildPileProgress[];
  onNewGame: () => void;
  onAssignCard: (cardId: string) => void;
  onAssignCardToBuildPile: (cardId: string, buildPileId: string) => void;
  onClearPhaseProgress: (phaseId: number) => void;
  onClearBuildPileProgress: (buildPileId: string) => void;
  showGraphics?: boolean;
  showLighting?: boolean;
}

interface DragState {
  card: Card | null;
  position: { x: number; y: number };
  offset: { x: number; y: number };
  isDragging: boolean;
}

// Element-only card component for phase targets
const ElementCard = memo(function ElementCard({
  suit,
  filled,
  isDropTarget,
  dropKey,
  showGraphics,
}: {
  suit: Suit;
  filled: boolean;
  isDropTarget: boolean;
  dropKey: string;
  showGraphics: boolean;
}) {
  const suitColor = SUIT_COLORS[suit];
  const suitDisplay = getSuitDisplay(suit, showGraphics);

  return (
    <div
      data-card-face
      data-drop-target={dropKey}
      data-drop-suit={suit}
      className="w-12 h-16 rounded-md border-2 flex items-center justify-center transition-all"
      style={{
        borderColor: filled ? suitColor : `${suitColor}66`,
        backgroundColor: filled ? `${suitColor}22` : 'transparent',
        boxShadow: isDropTarget
          ? `0 0 20px ${suitColor}, inset 0 0 10px ${suitColor}33`
          : filled
            ? `0 0 8px ${suitColor}44`
            : 'none',
        transform: isDropTarget ? 'scale(1.1)' : 'scale(1)',
      }}
    >
      <span
        className="text-2xl"
        style={{
          opacity: filled ? 1 : 0.5,
          filter: filled ? 'none' : 'grayscale(50%)',
        }}
      >
        {suitDisplay}
      </span>
    </div>
  );
});

// Draggable pending card
const PendingCard = memo(function PendingCard({
  card,
  isNeeded,
  isDragging,
  showGraphics,
  onMouseDown,
  onTouchStart,
}: {
  card: Card;
  isNeeded: boolean;
  isDragging: boolean;
  showGraphics: boolean;
  onMouseDown: (e: React.MouseEvent) => void;
  onTouchStart: (e: React.TouchEvent) => void;
}) {
  const suitColor = SUIT_COLORS[card.suit];
  const suitDisplay = getSuitDisplay(card.suit, showGraphics);

  return (
    <motion.div
      data-card-face
      onMouseDown={onMouseDown}
      onTouchStart={onTouchStart}
      whileHover={{ scale: 1.1 }}
      className="w-12 h-16 rounded-md border-2 flex flex-col items-center justify-center bg-game-bg-dark transition-all select-none"
      style={{
        borderColor: isNeeded ? suitColor : `${suitColor}44`,
        boxShadow: isNeeded ? `0 0 10px ${suitColor}66` : 'none',
        opacity: isDragging ? 0 : isNeeded ? 1 : 0.5,
        cursor: 'grab',
        touchAction: 'none',
      }}
    >
      <span className="text-lg">{suitDisplay}</span>
      <span
        className="text-xs font-bold"
        style={{ color: suitColor }}
      >
        {card.rank === 1 ? 'A' : card.rank === 11 ? 'J' : card.rank === 12 ? 'Q' : card.rank === 13 ? 'K' : card.rank}
      </span>
    </motion.div>
  );
});

// Drag preview portal
function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

const DragPreview = memo(function DragPreview({
  card,
  position,
  offset,
  showText,
  showGraphics,
}: {
  card: Card;
  position: { x: number; y: number };
  offset: { x: number; y: number };
  showText: boolean;
  showGraphics: boolean;
}) {
  const suitColor = SUIT_COLORS[card.suit];
  const suitDisplay = getSuitDisplay(card.suit, showGraphics);
  const [rotation, setRotation] = useState(0);
  const lastRef = useRef<{ x: number; y: number; t: number } | null>(null);

  useEffect(() => {
    const now = performance.now();
    const pointerX = position.x + offset.x;
    const pointerY = position.y + offset.y;
    const grabTilt = ((offset.x - 24) / 48) * -10;
    const last = lastRef.current;
    if (last) {
      const dt = Math.max(16, now - last.t);
      const vx = (pointerX - last.x) / dt;
      const vy = (pointerY - last.y) / dt;
      const momentumTilt = clamp(vx * 120, -6, 6) + clamp(vy * -40, -3, 3);
      const target = clamp(grabTilt + momentumTilt, -10, 10);
      setRotation((prev) => prev + (target - prev) * 0.35);
    } else {
      setRotation(grabTilt);
    }
    lastRef.current = { x: pointerX, y: pointerY, t: now };
  }, [position.x, position.y, offset.x, offset.y]);

  return createPortal(
    <div
      style={{
        position: 'fixed',
        left: position.x,
        top: position.y,
        zIndex: 9999,
        pointerEvents: 'none',
        transform: `rotate(${rotation}deg) scale(1.05)`,
        transformOrigin: `${offset.x}px ${offset.y}px`,
      }}
      className={showText ? '' : 'textless-mode'}
    >
      <div
        className="w-12 h-16 rounded-md border-2 flex flex-col items-center justify-center bg-game-bg-dark"
        style={{
          borderColor: suitColor,
          boxShadow: `0 8px 30px rgba(0,0,0,0.5), 0 0 15px ${suitColor}66`,
        }}
        data-card-face
      >
        <span className="text-lg">{suitDisplay}</span>
        <span className="text-xs font-bold" style={{ color: suitColor }}>
          {card.rank === 1 ? 'A' : card.rank === 11 ? 'J' : card.rank === 12 ? 'Q' : card.rank === 13 ? 'K' : card.rank}
        </span>
      </div>
    </div>,
    document.body
  );
});

// Camera info overlay
const CameraInfo = memo(function CameraInfo({
  scale,
  isPanning,
}: {
  scale: number;
  isPanning: boolean;
}) {
  return (
    <div className="absolute bottom-4 left-4 text-xs text-game-purple opacity-60 font-mono z-50 pointer-events-none">
      <div>Zoom: {Math.round(scale * 100)}%</div>
      <div className="opacity-50 mt-1">
        {isPanning ? 'Panning...' : 'Middle-click + drag to pan'}
      </div>
      <div className="opacity-50">Scroll to zoom</div>
    </div>
  );
});

export const CampScreen = memo(function CampScreen({
  pendingCards,
  challengeProgress,
  buildPileProgress,
  onNewGame,
  onAssignCard,
  onAssignCardToBuildPile,
  onClearPhaseProgress,
  onClearBuildPileProgress,
  showGraphics = false,
  showLighting = true,
}: CampScreenProps) {
  const currentChallenge = getCurrentChallenge(challengeProgress);
  const isComplete = currentChallenge
    ? isChallengeComplete(currentChallenge, challengeProgress)
    : false;

  // Camera controls
  const {
    cameraState,
    effectiveScale,
    containerRef,
    contentRef,
    isPanning,
    setCameraState,
  } = useCameraControls({
    minScale: 0.0167,
    maxScale: 2,
    zoomSensitivity: 0.002,
    baseScale: 3,
  });

  // Ref to the Phase 1 challenge section for centering
  const phase1Ref = useRef<HTMLDivElement>(null);
  const hasCenteredRef = useRef(false);
  const effectiveScaleRef = useRef(effectiveScale);
  effectiveScaleRef.current = effectiveScale;

  // Center on Phase 1 when component mounts
  useEffect(() => {
    if (hasCenteredRef.current) return;
    let timer = 0;
    const attemptCenter = () => {
      const container = containerRef.current;
      const content = contentRef.current;
      const phase = phase1Ref.current;
      if (!container || !content || !phase) {
        timer = window.setTimeout(attemptCenter, 100);
        return;
      }
      const containerRect = container.getBoundingClientRect();
      const contentRect = content.getBoundingClientRect();
      const phaseRect = phase.getBoundingClientRect();
      const phaseCenterX = phaseRect.left - contentRect.left + phaseRect.width / 2;
      const phaseCenterY = phaseRect.top - contentRect.top + phaseRect.height / 2;
      const scale = effectiveScaleRef.current;
      setCameraState((prev) => ({
        ...prev,
        x: containerRect.width / 2 - phaseCenterX * scale,
        y: containerRect.height / 2 - phaseCenterY * scale,
      }));
      hasCenteredRef.current = true;
    };
    timer = window.setTimeout(attemptCenter, 100);
    return () => window.clearTimeout(timer);
  }, [containerRef, contentRef, setCameraState]);

  // DND state
  const [dragState, setDragState] = useState<DragState>({
    card: null,
    position: { x: 0, y: 0 },
    offset: { x: 0, y: 0 },
    isDragging: false,
  });

  // Ref to always have current drag state (avoids stale closure in event handlers)
  const dragStateRef = useRef(dragState);
  dragStateRef.current = dragState;

  // Ref for neededSuits to avoid stale closure
  const neededSuitsRef = useRef(new Set<Suit>());

  // Ref for onAssignCard to avoid stale closure
  const onAssignCardRef = useRef(onAssignCard);
  onAssignCardRef.current = onAssignCard;

  // Ref for onAssignCardToBuildPile to avoid stale closure
  const onAssignCardToBuildPileRef = useRef(onAssignCardToBuildPile);
  onAssignCardToBuildPileRef.current = onAssignCardToBuildPile;

  // Ref for buildPileProgress to avoid stale closure
  const buildPileProgressRef = useRef(buildPileProgress);
  buildPileProgressRef.current = buildPileProgress;

  // Get suits needed for current challenge
  const neededSuits = useMemo(() => {
    if (!currentChallenge) return new Set<Suit>();
    const needed = new Set<Suit>();
    for (const req of currentChallenge.requirements) {
      const progress = getRequirementProgress(req, challengeProgress);
      if (!progress.complete) {
        needed.add(req.suit);
      }
    }
    neededSuitsRef.current = needed;
    return needed;
  }, [currentChallenge, challengeProgress]);

  // Start drag (only on left mouse button)
  const startDrag = useCallback((card: Card, clientX: number, clientY: number, rect: DOMRect) => {
    const offset = { x: clientX - rect.left, y: clientY - rect.top };
    setDragState({
      card,
      position: { x: clientX - offset.x, y: clientY - offset.y },
      offset,
      isDragging: true,
    });
  }, []);

  // Handle mouse/touch events for drag
  useEffect(() => {
    if (!dragState.isDragging) return;

    const handleMove = (clientX: number, clientY: number) => {
      setDragState((prev) => ({
        ...prev,
        position: { x: clientX - prev.offset.x, y: clientY - prev.offset.y },
      }));
    };

    const handleEnd = (clientX: number, clientY: number) => {
      // Use refs to get current values (avoids stale closure on first drag)
      const currentCard = dragStateRef.current.card;
      const currentNeededSuits = neededSuitsRef.current;
      const currentBuildPiles = buildPileProgressRef.current;

      if (currentCard) {
        // Use browser's native hit testing - much more robust than ref-based approach
        const elements = document.elementsFromPoint(clientX, clientY);

        for (const element of elements) {
          // Check for phase drop target
          const phaseDropTarget = element.closest('[data-drop-target]');
          if (phaseDropTarget) {
            const targetSuit = phaseDropTarget.getAttribute('data-drop-suit') as Suit;
            if (currentCard.suit === targetSuit && currentNeededSuits.has(targetSuit)) {
              onAssignCardRef.current(currentCard.id);
            }
            break;
          }

          // Check for build pile drop target
          const buildPileDropTarget = element.closest('[data-build-pile-target]');
          if (buildPileDropTarget) {
            const buildPileId = buildPileDropTarget.getAttribute('data-build-pile-id');
            if (buildPileId) {
              // Check if card can be added to this pile
              const pile = currentBuildPiles.find(p => p.definitionId === buildPileId);
              if (pile) {
                const definition = getBuildPileDefinition(pile);
                if (definition && canAddToBuildPile(currentCard, pile, definition)) {
                  onAssignCardToBuildPileRef.current(currentCard.id, buildPileId);
                }
              }
            }
            break;
          }
        }
      }
      setDragState({ card: null, position: { x: 0, y: 0 }, offset: { x: 0, y: 0 }, isDragging: false });
    };

    const onMouseMove = (e: MouseEvent) => {
      e.preventDefault();
      handleMove(e.clientX, e.clientY);
    };
    const onMouseUp = (e: MouseEvent) => {
      // Only handle left mouse button release
      if (e.button === 0) {
        handleEnd(e.clientX, e.clientY);
      }
    };
    const onTouchMove = (e: TouchEvent) => {
      if (e.touches.length === 1) {
        e.preventDefault();
        handleMove(e.touches[0].clientX, e.touches[0].clientY);
      }
    };
    const onTouchEnd = (e: TouchEvent) => {
      if (e.changedTouches.length === 1) {
        handleEnd(e.changedTouches[0].clientX, e.changedTouches[0].clientY);
      }
    };

    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
    document.addEventListener('touchmove', onTouchMove, { passive: false });
    document.addEventListener('touchend', onTouchEnd);

    return () => {
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
      document.removeEventListener('touchmove', onTouchMove);
      document.removeEventListener('touchend', onTouchEnd);
    };
  }, [dragState.isDragging]);

  // Check if currently dragging over a target using browser hit testing
  const getDropTargetInfo = useCallback((): { type: 'phase' | 'buildPile'; key: string } | null => {
    if (!dragState.isDragging || !dragState.card) return null;
    const centerX = dragState.position.x + 24; // half of card width
    const centerY = dragState.position.y + 32; // half of card height

    const elements = document.elementsFromPoint(centerX, centerY);
    for (const element of elements) {
      // Check phase drop target
      const phaseDropTarget = element.closest('[data-drop-target]');
      if (phaseDropTarget) {
        const dropKey = phaseDropTarget.getAttribute('data-drop-target');
        const targetSuit = phaseDropTarget.getAttribute('data-drop-suit') as Suit;
        if (dragState.card.suit === targetSuit && neededSuits.has(targetSuit) && dropKey) {
          return { type: 'phase', key: dropKey };
        }
      }

      // Check build pile drop target
      const buildPileDropTarget = element.closest('[data-build-pile-target]');
      if (buildPileDropTarget) {
        const buildPileId = buildPileDropTarget.getAttribute('data-build-pile-id');
        if (buildPileId) {
          const pile = buildPileProgress.find(p => p.definitionId === buildPileId);
          if (pile) {
            const definition = getBuildPileDefinition(pile);
            if (definition && canAddToBuildPile(dragState.card, pile, definition)) {
              return { type: 'buildPile', key: buildPileId };
            }
          }
        }
      }
    }
    return null;
  }, [dragState, neededSuits, buildPileProgress]);

  const activeDropTarget = getDropTargetInfo();

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="absolute inset-0 overflow-hidden"
      style={{ cursor: isPanning ? 'grabbing' : 'default' }}
    >
      {/* Camera viewport container */}
      <div
        ref={containerRef as React.RefObject<HTMLDivElement>}
        className="w-full h-full"
        style={{ cursor: isPanning ? 'grabbing' : 'default' }}
      >
        {/* Transformable content wrapper */}
        <div
          ref={contentRef as React.RefObject<HTMLDivElement>}
          style={{
            transformOrigin: '0 0',
            willChange: 'transform',
          }}
        >
          {/* Camp content panel */}
          <div
            className="bg-game-bg-dark p-8 rounded-xl border-2 border-game-purple min-w-[400px] max-w-[600px] flex flex-col items-center"
            style={{
              boxShadow: '0 0 40px rgba(139, 92, 246, 0.4), inset 0 0 40px rgba(139, 92, 246, 0.07)',
            }}
          >
            <div
              className="text-2xl mb-5 text-center tracking-[4px] text-game-gold"
              style={{ textShadow: '0 0 20px #e6b31e' }}
            >
              CAMP
            </div>

            {/* Challenge Section - This is what we center on */}
            {currentChallenge && (
              <div
                ref={phase1Ref}
                className="w-full mb-6 p-4 rounded-lg border"
                style={{
                  borderColor: isComplete ? '#7fdbca' : 'rgba(139, 92, 246, 0.4)',
                  boxShadow: isComplete
                    ? '0 0 20px rgba(127, 219, 202, 0.3)'
                    : '0 0 10px rgba(139, 92, 246, 0.2)',
                }}
              >
                <div className="flex justify-between items-center mb-3">
                  <div
                    className="text-sm tracking-widest"
                    style={{
                      color: isComplete ? '#7fdbca' : '#8b5cf6',
                      textShadow: isComplete ? '0 0 10px #7fdbca' : 'none',
                    }}
                  >
                    {currentChallenge.name.toUpperCase()}
                  </div>
                  {isComplete && (
                    <motion.div
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      className="text-game-teal text-xs tracking-wider"
                      style={{ textShadow: '0 0 10px #7fdbca' }}
                    >
                      COMPLETE!
                    </motion.div>
                  )}
                </div>
                <div className="text-xs text-game-white opacity-70 mb-4">
                  {currentChallenge.description}
                </div>

                {/* Requirements as element cards */}
                <div className="flex gap-6 justify-center">
                  {currentChallenge.requirements.map((req, reqIdx) => {
                    const progress = getRequirementProgress(req, challengeProgress);

                    return (
                      <div key={reqIdx} className="flex flex-col items-center gap-2">
                        <div className="flex gap-1">
                          {Array.from({ length: req.count }).map((_, slotIdx) => {
                            const isFilled = slotIdx < progress.current;
                            const dropKey = `${req.suit}-${reqIdx}-${slotIdx}`;
                            const isDropTarget = activeDropTarget?.type === 'phase' && activeDropTarget.key === dropKey;

                            return (
                              <ElementCard
                                key={slotIdx}
                                suit={req.suit}
                                filled={isFilled}
                                isDropTarget={isDropTarget}
                                dropKey={dropKey}
                                showGraphics={showGraphics}
                              />
                            );
                          })}
                        </div>
                        <div
                          className="text-xs"
                          style={{
                            color: progress.complete ? SUIT_COLORS[req.suit] : 'rgba(240,240,240,0.5)',
                          }}
                        >
                          {progress.current}/{progress.required}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Clear progress button for completed phase */}
                {isComplete && (
                  <button
                    onClick={() => onClearPhaseProgress(currentChallenge.id)}
                    className="mt-4 text-xs text-game-pink border border-game-pink px-3 py-1 rounded opacity-60 hover:opacity-100 transition-opacity"
                    style={{ textShadow: '0 0 8px #d946ef' }}
                  >
                    CLEAR PHASE PROGRESS
                  </button>
                )}
              </div>
            )}

            {/* Sapling and Adventure Section */}
            <div className="flex items-center gap-8 mb-6">
              {/* Adventure button - left of tree */}
              <motion.button
                onClick={onNewGame}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className="bg-transparent text-game-teal border-2 border-game-teal py-3 px-5 text-sm font-mono font-bold rounded-md cursor-pointer tracking-widest hover:shadow-neon-teal transition-all"
                style={{
                  textShadow: '0 0 10px #7fdbca',
                  boxShadow: '0 0 15px rgba(127, 219, 202, 0.3)',
                }}
              >
                ADVENTURE
              </motion.button>

              {/* Sapling */}
              {buildPileProgress.length > 0 && buildPileProgress.map((pile) => {
                const isBuildPileDropTarget = activeDropTarget?.type === 'buildPile' && activeDropTarget.key === pile.definitionId;
                return (
                  <Sapling
                    key={pile.definitionId}
                    progress={pile}
                    isDropTarget={isBuildPileDropTarget}
                    draggedCard={dragState.card}
                    showGraphics={showGraphics}
                    onClear={() => onClearBuildPileProgress(pile.definitionId)}
                  />
                );
              })}
            </div>

            {/* Pending Cards Section */}
            {pendingCards.length > 0 && (
              <div className="w-full mb-6">
                <div className="text-xs text-game-purple mb-3 tracking-wider text-center">
                  DRAG CARDS TO PHASE TARGETS
                </div>
                <div className="flex flex-wrap gap-2 justify-center">
                  {pendingCards.map((card) => {
                    const isNeeded = neededSuits.has(card.suit);
                    const isDragging = dragState.card?.id === card.id;

                    return (
                      <PendingCard
                        key={card.id}
                        card={card}
                        isNeeded={isNeeded}
                        isDragging={isDragging}
                        showGraphics={showGraphics}
                        onMouseDown={(e) => {
                          // Only start drag on left mouse button
                          if (e.button !== 0) return;
                          e.preventDefault();
                          const rect = e.currentTarget.getBoundingClientRect();
                          startDrag(card, e.clientX, e.clientY, rect);
                        }}
                        onTouchStart={(e) => {
                          if (e.touches.length === 1) {
                            const rect = e.currentTarget.getBoundingClientRect();
                            startDrag(card, e.touches[0].clientX, e.touches[0].clientY, rect);
                          }
                        }}
                      />
                    );
                  })}
                </div>
              </div>
            )}

          </div>
        </div>
      </div>

      {/* Ambient vignette overlay for atmosphere */}
      {showLighting && <AmbientVignette intensity={0.6} color="#0a0a15" />}

      {/* Camera info overlay (fixed position, outside camera transform) */}
      <CameraInfo scale={cameraState.scale} isPanning={isPanning} />

      {/* Drag preview (fixed position portal) */}
      {dragState.isDragging && dragState.card && (
        <DragPreview
          card={dragState.card}
          position={dragState.position}
          offset={dragState.offset}
          showText={true}
          showGraphics={showGraphics}
        />
      )}
    </motion.div>
  );
});

