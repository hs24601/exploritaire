import { memo, useState, useCallback, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { motion } from 'framer-motion';
import type { Actor, Card, BuildPileProgress, MetaCard as MetaCardType, Suit } from '../engine/types';
import { SUIT_COLORS } from '../engine/constants';
import {
  getBuildPileDefinition,
  canAddToBuildPile,
} from '../engine/buildPiles';
import { findSlotById, canAddCardToSlot, canAssignActorToHomeSlot } from '../engine/metaCards';
import { getActorDefinition, getActorValueDisplay } from '../engine/actors';
import { useCameraControls } from '../hooks/useCameraControls';
import { Sapling } from './Sapling';
import { MetaCard } from './MetaCard';
import { AmbientVignette } from './LightRenderer';
import { GardenGrid } from './GardenGrid';
import { gridToPixel, getGridDimensions, centerInCell, pixelToGrid } from '../utils/gridUtils';
import { GARDEN_GRID, CARD_SIZE } from '../engine/constants';

interface GardenScreenProps {
  collectedCards: Card[];
  pendingCards: Card[];
  buildPileProgress: BuildPileProgress[];
  metaCards: MetaCardType[];
  availableActors: Actor[];
  adventureQueue: (Actor | null)[];
  onStartAdventure: () => void;
  onStartBiome: (biomeId: string) => void;
  onAssignCardToBuildPile: (cardId: string, buildPileId: string) => void;
  onAssignCardToMetaCardSlot: (cardId: string, metaCardId: string, slotId: string) => void;
  onAssignActorToQueue: (actorId: string, slotIndex: number) => void;
  onAssignActorToMetaCardHome: (actorId: string, metaCardId: string, slotId: string) => void;
  onClearBuildPileProgress: (buildPileId: string) => void;
  onClearMetaCardProgress: (metaCardId: string) => void;
  onClearAllProgress: () => void;
  onResetGame: () => void;
  onUpdateMetaCardPosition: (metaCardId: string, col: number, row: number) => void;
  onUpdateActorPosition: (actorId: string, col: number, row: number) => void;
  onRemoveActorFromMetaCardHome: (actorId: string) => void;
}

type DragType = 'card' | 'actor' | 'metacard';
type DropTargetType = 'phase' | 'buildPile' | 'adventureSlot' | 'metaCardSlot' | 'actorHomeSlot';

interface DragState {
  type: DragType;
  card: Card | null;
  actor: Actor | null;
  metaCard: MetaCardType | null;
  position: { x: number; y: number };
  offset: { x: number; y: number };
  isDragging: boolean;
}

// Draggable pending card
const PendingCard = memo(function PendingCard({
  card,
  isNeeded,
  isDragging,
  onMouseDown,
  onTouchStart,
}: {
  card: Card;
  isNeeded: boolean;
  isDragging: boolean;
  onMouseDown: (e: React.MouseEvent) => void;
  onTouchStart: (e: React.TouchEvent) => void;
}) {
  const suitColor = SUIT_COLORS[card.suit];

  return (
    <motion.div
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
      <span className="text-lg">{card.suit}</span>
      <span className="text-xs font-bold" style={{ color: suitColor }}>
        {card.rank === 1 ? 'A' : card.rank === 11 ? 'J' : card.rank === 12 ? 'Q' : card.rank === 13 ? 'K' : card.rank}
      </span>
    </motion.div>
  );
});

// Actor card component
const ActorCard = memo(function ActorCard({
  actor,
  isDragging,
  onMouseDown,
  onTouchStart,
  onClick,
}: {
  actor: Actor;
  isDragging: boolean;
  onMouseDown?: (e: React.MouseEvent) => void;
  onTouchStart?: (e: React.TouchEvent) => void;
  onClick?: () => void;
}) {
  const definition = getActorDefinition(actor.definitionId);
  if (!definition) return null;

  return (
    <motion.div
      onMouseDown={onMouseDown}
      onTouchStart={onTouchStart}
      onClick={onClick}
      whileHover={{ scale: 1.05 }}
      style={{
        width: CARD_SIZE.width,
        height: CARD_SIZE.height,
        borderColor: '#7fdbca',
        boxShadow: '0 0 15px rgba(127, 219, 202, 0.4)',
        opacity: isDragging ? 0 : 1,
        cursor: onMouseDown ? 'grab' : onClick ? 'pointer' : 'default',
        touchAction: 'none',
      }}
      className="rounded-lg border-2 flex flex-col items-center bg-game-bg-dark transition-all select-none p-1"
    >
      <div className="flex flex-col gap-0 items-center mb-1">
        {definition.titles.map((title, idx) => (
          <span key={idx} className="text-[8px] text-game-white opacity-60 leading-tight">
            {title}
          </span>
        ))}
      </div>
      <div className="flex-1 flex items-center justify-center">
        <span className="text-2xl">{definition.sprite}</span>
      </div>
      <span className="text-xs font-bold text-game-teal">
        {getActorValueDisplay(actor.currentValue)}
      </span>
    </motion.div>
  );
});

// Drag preview portal
const DragPreview = memo(function DragPreview({
  type,
  card,
  actor,
  position,
}: {
  type: DragType;
  card: Card | null;
  actor: Actor | null;
  position: { x: number; y: number };
}) {
  if (type === 'card' && card) {
    const suitColor = SUIT_COLORS[card.suit];
    return createPortal(
      <div
        style={{
          position: 'fixed',
          left: position.x,
          top: position.y,
          zIndex: 9999,
          pointerEvents: 'none',
          transform: 'rotate(5deg) scale(1.1)',
        }}
      >
        <div
          className="w-12 h-16 rounded-md border-2 flex flex-col items-center justify-center bg-game-bg-dark"
          style={{
            borderColor: suitColor,
            boxShadow: `0 8px 30px rgba(0,0,0,0.5), 0 0 15px ${suitColor}66`,
          }}
        >
          <span className="text-lg">{card.suit}</span>
          <span className="text-xs font-bold" style={{ color: suitColor }}>
            {card.rank === 1 ? 'A' : card.rank === 11 ? 'J' : card.rank === 12 ? 'Q' : card.rank === 13 ? 'K' : card.rank}
          </span>
        </div>
      </div>,
      document.body
    );
  }

  if (type === 'actor' && actor) {
    const definition = getActorDefinition(actor.definitionId);
    if (!definition) return null;

    return createPortal(
      <div
        style={{
          position: 'fixed',
          left: position.x,
          top: position.y,
          zIndex: 9999,
          pointerEvents: 'none',
          transform: 'rotate(5deg) scale(1.1)',
        }}
      >
        <div
          style={{
            width: CARD_SIZE.width,
            height: CARD_SIZE.height,
            borderColor: '#7fdbca',
            boxShadow: '0 8px 30px rgba(0,0,0,0.5), 0 0 15px rgba(127, 219, 202, 0.5)',
          }}
          className="rounded-lg border-2 flex flex-col items-center justify-center bg-game-bg-dark p-1"
        >
          <span className="text-[8px] text-game-white opacity-60 mb-1">
            {definition.name}
          </span>
          <div className="flex-1 flex items-center justify-center">
            <span className="text-2xl">{definition.sprite}</span>
          </div>
          <span className="text-xs font-bold text-game-teal">
            {getActorValueDisplay(actor.currentValue)}
          </span>
        </div>
      </div>,
      document.body
    );
  }

  return null;
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

export const GardenScreen = memo(function GardenScreen({
  collectedCards,
  pendingCards,
  buildPileProgress,
  metaCards,
  availableActors,
  adventureQueue,
  onStartAdventure,
  onStartBiome,
  onAssignCardToBuildPile,
  onAssignCardToMetaCardSlot,
  onAssignActorToQueue,
  onAssignActorToMetaCardHome,
  onClearBuildPileProgress,
  onClearMetaCardProgress,
  onClearAllProgress,
  onResetGame,
  onUpdateMetaCardPosition,
  onUpdateActorPosition,
  onRemoveActorFromMetaCardHome,
}: GardenScreenProps) {
  // Sapling is locked at grid position (2, 3)
  const SAPLING_POSITION = { col: 2, row: 3 };

  // TODO: Implement drag/drop to update positions using:
  // onUpdateMetaCardPosition and onUpdateActorPosition
  console.log('Position update handlers available:', { onUpdateMetaCardPosition, onUpdateActorPosition });
  // Camera controls
  const {
    cameraState,
    containerRef,
    contentRef,
    isPanning,
    centerOn,
  } = useCameraControls({
    minScale: 0.5,
    maxScale: 3,
    zoomSensitivity: 0.002,
  });

  // Ref to the garden center for centering
  const gardenCenterRef = useRef<HTMLDivElement>(null);

  // Center on garden when component mounts
  useEffect(() => {
    const timer = setTimeout(() => {
      centerOn(gardenCenterRef.current);
    }, 100);
    return () => clearTimeout(timer);
  }, [centerOn]);

  // DND state
  const [dragState, setDragState] = useState<DragState>({
    type: 'card',
    card: null,
    actor: null,
    metaCard: null,
    position: { x: 0, y: 0 },
    offset: { x: 0, y: 0 },
    isDragging: false,
  });

  // Pinned meta-card state
  // Active drop target for meta-card slots (when tooltip is pinned)
  const [activeMetaCardSlot, setActiveMetaCardSlot] = useState<string | null>(null);

  // Refs for stable closures
  const dragStateRef = useRef(dragState);
  dragStateRef.current = dragState;
  const onAssignCardToBuildPileRef = useRef(onAssignCardToBuildPile);
  onAssignCardToBuildPileRef.current = onAssignCardToBuildPile;
  const buildPileProgressRef = useRef(buildPileProgress);
  buildPileProgressRef.current = buildPileProgress;
  const onAssignActorToQueueRef = useRef(onAssignActorToQueue);
  onAssignActorToQueueRef.current = onAssignActorToQueue;
  const onAssignActorToMetaCardHomeRef = useRef(onAssignActorToMetaCardHome);
  onAssignActorToMetaCardHomeRef.current = onAssignActorToMetaCardHome;
  const onAssignCardToMetaCardSlotRef = useRef(onAssignCardToMetaCardSlot);
  onAssignCardToMetaCardSlotRef.current = onAssignCardToMetaCardSlot;
  const metaCardsRef = useRef(metaCards);
  metaCardsRef.current = metaCards;
  const onUpdateActorPositionRef = useRef(onUpdateActorPosition);
  onUpdateActorPositionRef.current = onUpdateActorPosition;
  const onRemoveActorFromMetaCardHomeRef = useRef(onRemoveActorFromMetaCardHome);
  onRemoveActorFromMetaCardHomeRef.current = onRemoveActorFromMetaCardHome;

  // Start drag for card
  const startCardDrag = useCallback((card: Card, clientX: number, clientY: number, rect: DOMRect) => {
    const offset = { x: clientX - rect.left, y: clientY - rect.top };
    setDragState({
      type: 'card',
      card,
      actor: null,
      metaCard: null,
      position: { x: clientX - offset.x, y: clientY - offset.y },
      offset,
      isDragging: true,
    });
  }, []);

  // Start drag for actor
  const startActorDrag = useCallback((actor: Actor, clientX: number, clientY: number, rect: DOMRect) => {
    const offset = { x: clientX - rect.left, y: clientY - rect.top };
    setDragState({
      type: 'actor',
      card: null,
      actor,
      metaCard: null,
      position: { x: clientX - offset.x, y: clientY - offset.y },
      offset,
      isDragging: true,
    });
  }, []);

  // Handle dragging actor out of Forest metacard
  const handleDragActorOut = useCallback((actor: Actor, clientX: number, clientY: number, rect: DOMRect) => {
    startActorDrag(actor, clientX, clientY, rect);
  }, [startActorDrag]);

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
      const current = dragStateRef.current;
      const elements = document.elementsFromPoint(clientX, clientY);

      if (current.type === 'card' && current.card) {
        const currentBuildPiles = buildPileProgressRef.current;
        const currentMetaCards = metaCardsRef.current;

        for (const element of elements) {
          const buildPileDropTarget = element.closest('[data-build-pile-target]');
          if (buildPileDropTarget) {
            const buildPileId = buildPileDropTarget.getAttribute('data-build-pile-id');
            if (buildPileId) {
              const pile = currentBuildPiles.find(p => p.definitionId === buildPileId);
              if (pile) {
                const definition = getBuildPileDefinition(pile);
                if (definition && canAddToBuildPile(current.card, pile, definition)) {
                  onAssignCardToBuildPileRef.current(current.card.id, buildPileId);
                }
              }
            }
            break;
          }

          // Meta-card slot drop target
          const metaCardSlot = element.closest('[data-meta-card-slot]');
          if (metaCardSlot) {
            const metaCardId = metaCardSlot.getAttribute('data-meta-card-id');
            const slotId = metaCardSlot.getAttribute('data-slot-id');
            if (metaCardId && slotId) {
              const metaCard = currentMetaCards.find(mc => mc.id === metaCardId);
              if (metaCard) {
                const slot = findSlotById(metaCard, slotId);
                if (slot && canAddCardToSlot(current.card, slot)) {
                  onAssignCardToMetaCardSlotRef.current(current.card.id, metaCardId, slotId);
                }
              }
            }
            break;
          }
        }
      }

      if (current.type === 'actor' && current.actor) {
        let foundTarget = false;

        for (const element of elements) {
          // Check for actor home slot first
          const actorHomeSlot = element.closest('[data-actor-home-slot]');
          if (actorHomeSlot) {
            const metaCardId = actorHomeSlot.getAttribute('data-meta-card-id');
            const slotId = actorHomeSlot.getAttribute('data-slot-id');
            if (metaCardId && slotId) {
              onAssignActorToMetaCardHomeRef.current(current.actor.id, metaCardId, slotId);
              foundTarget = true;
            }
            break;
          }

          const adventureSlot = element.closest('[data-adventure-slot]');
          if (adventureSlot) {
            const slotIndex = parseInt(adventureSlot.getAttribute('data-adventure-slot') || '-1', 10);
            if (slotIndex >= 0) {
              onAssignActorToQueueRef.current(current.actor.id, slotIndex);
              foundTarget = true;
            }
            break;
          }
        }

        // If no specific target found, handle free-form positioning
        if (!foundTarget) {
          // Remove from any metacard home
          onRemoveActorFromMetaCardHomeRef.current(current.actor.id);

          // Get the transform values from contentRef
          const contentRect = contentRef.current?.getBoundingClientRect();

          if (contentRect) {
            // Calculate position relative to the transformed content
            const relativeX = clientX - contentRect.left;
            const relativeY = clientY - contentRect.top;

            // Convert to grid coordinates
            const gridPos = pixelToGrid(relativeX, relativeY);

            // Update actor position
            onUpdateActorPositionRef.current(current.actor.id, gridPos.col, gridPos.row);
          }
        }
      }

      setDragState({ type: 'card', card: null, actor: null, metaCard: null, position: { x: 0, y: 0 }, offset: { x: 0, y: 0 }, isDragging: false });
    };

    const onMouseMove = (e: MouseEvent) => {
      e.preventDefault();
      handleMove(e.clientX, e.clientY);
    };
    const onMouseUp = (e: MouseEvent) => {
      if (e.button === 0) handleEnd(e.clientX, e.clientY);
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

  // Get active drop target
  const getDropTargetInfo = useCallback((): { type: DropTargetType; key: string } | null => {
    if (!dragState.isDragging) return null;
    const centerX = dragState.position.x + (dragState.type === 'actor' ? CARD_SIZE.width / 2 : 24);
    const centerY = dragState.position.y + (dragState.type === 'actor' ? CARD_SIZE.height / 2 : 32);

    const elements = document.elementsFromPoint(centerX, centerY);

    if (dragState.type === 'card' && dragState.card) {
      for (const element of elements) {
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

        // Meta-card slot drop target detection
        const metaCardSlot = element.closest('[data-meta-card-slot]');
        if (metaCardSlot) {
          const metaCardId = metaCardSlot.getAttribute('data-meta-card-id');
          const slotId = metaCardSlot.getAttribute('data-slot-id');
          if (metaCardId && slotId) {
            const metaCard = metaCards.find(mc => mc.id === metaCardId);
            if (metaCard) {
              const slot = findSlotById(metaCard, slotId);
              if (slot && canAddCardToSlot(dragState.card, slot)) {
                return { type: 'metaCardSlot', key: slotId };
              }
            }
          }
        }
      }
    }

    if (dragState.type === 'actor' && dragState.actor) {
      for (const element of elements) {
        // Check for actor home slots
        const actorHomeSlot = element.closest('[data-actor-home-slot]');
        if (actorHomeSlot) {
          const metaCardId = actorHomeSlot.getAttribute('data-meta-card-id');
          const slotId = actorHomeSlot.getAttribute('data-slot-id');
          if (metaCardId && slotId) {
            const metaCard = metaCards.find(mc => mc.id === metaCardId);
            if (metaCard && canAssignActorToHomeSlot(metaCard, slotId)) {
              return { type: 'actorHomeSlot', key: slotId };
            }
          }
        }

        const adventureSlot = element.closest('[data-adventure-slot]');
        if (adventureSlot) {
          const slotIndex = adventureSlot.getAttribute('data-adventure-slot');
          if (slotIndex !== null && adventureQueue[parseInt(slotIndex, 10)] === null) {
            return { type: 'adventureSlot', key: slotIndex };
          }
        }
      }
    }

    return null;
  }, [dragState, buildPileProgress, adventureQueue, metaCards]);

  const activeDropTarget = getDropTargetInfo();

  // Update activeMetaCardSlot when dragging
  useEffect(() => {
    if (activeDropTarget?.type === 'metaCardSlot') {
      setActiveMetaCardSlot(activeDropTarget.key);
    } else {
      setActiveMetaCardSlot(null);
    }
  }, [activeDropTarget]);

  // Get grid dimensions
  const gridDimensions = getGridDimensions();

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
            transform: `translate(${cameraState.x}px, ${cameraState.y}px) scale(${cameraState.scale})`,
            transformOrigin: '0 0',
            willChange: 'transform',
          }}
        >
          {/* Grid-based garden layout */}
          <div
            ref={gardenCenterRef}
            className="relative bg-game-bg-dark/50 rounded-xl"
            style={{
              width: gridDimensions.width,
              height: gridDimensions.height,
            }}
          >
            {/* Visual grid */}
            <GardenGrid opacity={1} />

            {/* Title - centered at top */}
            <div
              className="absolute text-2xl text-center tracking-[4px] text-game-teal"
              style={{
                left: gridToPixel(4, 0).x,
                top: gridToPixel(0, 0).y + 20,
                textShadow: '0 0 20px #7fdbca',
              }}
            >
              GARDEN
            </div>

            {/* Adventure Section - Now replaced by Forest metacard (rendered below with other metacards) */}

            {/* Available Actors - draggable with stored positions */}
            {availableActors
              .filter(actor => {
                // Hide actors that are in Forest metacard
                const forestMetaCard = metaCards.find(mc => mc.definitionId === 'forest');
                if (!forestMetaCard) return true;
                return !forestMetaCard.actorHomeSlots.some(slot => slot.actorId === actor.id);
              })
              .map((actor) => {
                // Use stored position or fallback to default
                const gridPos = actor.gridPosition || { col: 3, row: 2 };
                const position = centerInCell(gridPos.col, gridPos.row, CARD_SIZE.width, CARD_SIZE.height);
                return (
                  <div
                    key={actor.id}
                    className="absolute"
                    style={{
                      left: position.x,
                      top: position.y,
                    }}
                  >
                    <ActorCard
                      actor={actor}
                      isDragging={dragState.actor?.id === actor.id}
                      onMouseDown={(e) => {
                        if (e.button !== 0) return;
                        e.preventDefault();
                        const rect = e.currentTarget.getBoundingClientRect();
                        startActorDrag(actor, e.clientX, e.clientY, rect);
                      }}
                      onTouchStart={(e) => {
                        if (e.touches.length === 1) {
                          const rect = e.currentTarget.getBoundingClientRect();
                          startActorDrag(actor, e.touches[0].clientX, e.touches[0].clientY, rect);
                        }
                      }}
                    />
                  </div>
                );
              })}

            {/* Sapling - locked position */}
            {buildPileProgress.map((pile) => {
              const isBuildPileDropTarget = activeDropTarget?.type === 'buildPile' && activeDropTarget.key === pile.definitionId;
              const position = centerInCell(SAPLING_POSITION.col, SAPLING_POSITION.row, CARD_SIZE.width, CARD_SIZE.height);
              return (
                <div
                  key={pile.definitionId}
                  className="absolute"
                  style={{
                    left: position.x,
                    top: position.y,
                  }}
                >
                  <Sapling
                    progress={pile}
                    isDropTarget={isBuildPileDropTarget}
                    draggedCard={dragState.card}
                    onClear={() => onClearBuildPileProgress(pile.definitionId)}
                  />
                </div>
              );
            })}

            {/* Meta-Cards (Burrowing Den, etc.) - draggable with stored positions */}
            {metaCards.map((metaCard) => {
              // Use stored position or fallback to default
              const gridPos = metaCard.gridPosition || { col: 4, row: 3 };
              const position = centerInCell(gridPos.col, gridPos.row, CARD_SIZE.width, CARD_SIZE.height);
              return (
                <div
                  key={metaCard.id}
                  className="absolute"
                  style={{
                    left: position.x,
                    top: position.y,
                  }}
                >
                  <MetaCard
                    metaCard={metaCard}
                    availableActors={availableActors}
                    activeDropSlot={activeMetaCardSlot}
                    cameraScale={cameraState.scale}
                    onClear={() => onClearMetaCardProgress(metaCard.id)}
                    onAdventure={metaCard.definitionId === 'forest' ? onStartAdventure : undefined}
                    onDragActorOut={handleDragActorOut}
                  />
                </div>
              );
            })}

            {/* Garden Grove Biome Card */}
            <div
              className="absolute"
              style={{
                left: centerInCell(6, 3, CARD_SIZE.width, CARD_SIZE.height).x,
                top: centerInCell(6, 3, CARD_SIZE.width, CARD_SIZE.height).y,
              }}
            >
              <motion.div
                onClick={() => onStartBiome('garden_grove')}
                whileHover={{ scale: 1.05, y: -5 }}
                whileTap={{ scale: 0.98 }}
                style={{
                  width: CARD_SIZE.width,
                  height: CARD_SIZE.height,
                  borderColor: '#10b981',
                  boxShadow: '0 0 15px rgba(16, 185, 129, 0.4)',
                  cursor: 'pointer',
                }}
                className="bg-game-bg-dark border-2 rounded-lg flex flex-col items-center justify-center p-2 select-none"
              >
                <div className="text-[8px] text-green-400 font-bold tracking-wide mb-1">
                  BIOME
                </div>
                <div className="text-2xl mb-1">🌳</div>
                <div className="text-xs font-bold text-green-400 text-center leading-tight">
                  GARDEN
                  <br />
                  GROVE
                </div>
              </motion.div>
            </div>

            {/* Pending Cards Section - positioned at bottom */}
            {pendingCards.length > 0 && (
              <div
                className="absolute"
                style={{
                  left: gridToPixel(1, 7).x,
                  top: gridToPixel(0, 7).y + 20,
                  width: GARDEN_GRID.cellSize * 10,
                }}
              >
                <div className="text-xs text-game-purple mb-3 tracking-wider text-center">
                  DRAG CARDS TO ASSIGN
                </div>
                <div className="flex flex-wrap gap-2 justify-center">
                  {pendingCards.map((card) => {
                    const isDragging = dragState.card?.id === card.id;

                    return (
                      <PendingCard
                        key={card.id}
                        card={card}
                        isNeeded={false}
                        isDragging={isDragging}
                        onMouseDown={(e) => {
                          if (e.button !== 0) return;
                          e.preventDefault();
                          const rect = e.currentTarget.getBoundingClientRect();
                          startCardDrag(card, e.clientX, e.clientY, rect);
                        }}
                        onTouchStart={(e) => {
                          if (e.touches.length === 1) {
                            const rect = e.currentTarget.getBoundingClientRect();
                            startCardDrag(card, e.touches[0].clientX, e.touches[0].clientY, rect);
                          }
                        }}
                      />
                    );
                  })}
                </div>
              </div>
            )}

            {/* This Round Summary - positioned near bottom */}
            {collectedCards.length > 0 && (
              <div
                className="absolute"
                style={{
                  left: gridToPixel(2, 8).x,
                  top: gridToPixel(0, 8).y + 20,
                  width: GARDEN_GRID.cellSize * 8,
                }}
              >
                <div className="text-sm mb-4 text-center opacity-60 text-game-white">
                  This Round: +{collectedCards.length} cards
                </div>

                <div className="flex justify-center gap-4 mb-6">
                  {(['💨', '⛰️', '🔥', '💧'] as Suit[]).map((suit) => {
                    const count = collectedCards.filter((c) => c.suit === suit).length;
                    const suitColor = SUIT_COLORS[suit];

                    return (
                      <div
                        key={suit}
                        className="text-center p-3 bg-transparent rounded-lg min-w-[60px]"
                        style={{
                          border: `1px solid ${suitColor}44`,
                          boxShadow: count > 0 ? `0 0 8px ${suitColor}33` : 'none',
                          opacity: count > 0 ? 1 : 0.4,
                        }}
                      >
                        <div className="text-2xl mb-1">{suit}</div>
                        <div
                          className="text-lg font-bold"
                          style={{ color: suitColor, textShadow: `0 0 8px ${suitColor}` }}
                        >
                          +{count}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Clear all progress button - bottom right corner */}
            <div className="absolute flex flex-col gap-2" style={{ right: 20, bottom: 20 }}>
              <button
                onClick={onClearAllProgress}
                className="text-xs text-game-pink border border-game-pink px-3 py-1 rounded opacity-40 hover:opacity-100 transition-opacity"
                style={{
                  textShadow: '0 0 8px #d946ef',
                }}
              >
                CLEAR ALL PROGRESS
              </button>
              <button
                onClick={onResetGame}
                className="text-xs text-game-red border border-game-red px-3 py-1 rounded opacity-40 hover:opacity-100 transition-opacity"
                style={{
                  textShadow: '0 0 8px #ff6b6b',
                }}
              >
                RESET GAME
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Ambient vignette overlay for atmosphere */}
      <AmbientVignette intensity={0.6} color="#0a0a15" />

      {/* Camera info overlay */}
      <CameraInfo scale={cameraState.scale} isPanning={isPanning} />

      {/* Drag preview */}
      {dragState.isDragging && (
        <DragPreview
          type={dragState.type}
          card={dragState.card}
          actor={dragState.actor}
          position={dragState.position}
        />
      )}
    </motion.div>
  );
});
