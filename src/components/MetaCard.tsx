import { memo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { MetaCard as MetaCardType, Actor } from '../engine/types';
import { CARD_SIZE, SUIT_COLORS } from '../engine/constants';
import { getMetaCardDefinition, getMetaCardProgress, getMetaCardDisplayName } from '../engine/metaCards';
import { CardSlot } from './CardSlot';
import { ActorHomeSlot } from './ActorHomeSlot';

interface MetaCardProps {
  metaCard: MetaCardType;
  availableActors: Actor[];
  isPinned: boolean;
  onPinnedChange: (pinned: boolean) => void;
  activeDropSlot: string | null;
  cameraScale?: number;
  onClear?: () => void;
  onAdventure?: () => void; // For Forest metacard - triggers adventure start
  onDragActorOut?: (actor: Actor, clientX: number, clientY: number, rect: DOMRect) => void; // For dragging actors out
}

export const MetaCard = memo(function MetaCard({
  metaCard,
  availableActors,
  isPinned,
  onPinnedChange,
  activeDropSlot,
  cameraScale = 1,
  onClear,
  onAdventure,
  onDragActorOut,
}: MetaCardProps) {
  const [isImproveMode, setIsImproveMode] = useState(false);
  const definition = getMetaCardDefinition(metaCard.definitionId);
  const progress = getMetaCardProgress(metaCard);

  if (!definition) return null;

  const isComplete = metaCard.isComplete;
  const isForest = metaCard.definitionId === 'forest';
  const borderColor = isComplete ? '#7fdbca' : (isForest ? '#7fdbca' : '#8b5cf6');

  // Calculate dynamic font size with exponential scaling for more aggressive reduction
  // Constrained to prevent overflow: max 10px to fit within card borders
  // At zoom 1.0 = 9px, at 0.5 = 10px (capped), at 2.0 = ~5px
  const titleFontSize = Math.max(5, Math.min(10, 9 / Math.pow(cameraScale, 1.5)));

  // Hide button when zoomed out below 0.8
  const showButton = cameraScale >= 0.8;

  // Check if Forest has at least one actor assigned
  const hasActors = isForest && metaCard.actorHomeSlots.some(slot => slot.actorId !== null);

  // Determine if we should stack actor slots or show them all
  // Stack when zoomed out (< 1.2) OR when we have multiple slots that won't fit
  const shouldStackSlots = cameraScale < 1.2 || metaCard.actorHomeSlots.length > 1;

  // Count filled slots
  const filledSlotsCount = metaCard.actorHomeSlots.filter(slot => slot.actorId !== null).length;
  const totalSlotsCount = metaCard.actorHomeSlots.length;

  // Split name into words for intentional two-line layout
  const displayName = getMetaCardDisplayName(metaCard).toUpperCase();
  const words = displayName.split(' ');
  // For names like "BURROWING DEN", first word on line 1, rest on line 2
  const line1 = words[0] || '';
  const line2 = words.slice(1).join(' ') || '';

  return (
    <div className="flex flex-col items-center gap-3">
      {/* Card Face */}
      <motion.div
        whileHover={{ scale: 1.05, y: -5 }}
        style={{
          width: CARD_SIZE.width,
          height: CARD_SIZE.height,
          borderColor,
          boxShadow: isComplete
            ? `0 0 20px ${borderColor}66, inset 0 0 15px ${borderColor}11`
            : `0 0 15px ${borderColor}44, inset 0 0 10px ${borderColor}11`,
        }}
        className="
          bg-game-bg-dark border-2 rounded-lg
          flex flex-col items-start
          select-none relative
          transition-all duration-200
          p-2
        "
      >
        {/* Title at top - intentional two-line layout with dynamic sizing */}
        <div
          className="w-full text-center font-bold tracking-wide mb-1 px-1"
          style={{
            fontSize: `${titleFontSize}px`,
            color: borderColor,
            textShadow: `0 0 8px ${borderColor}66`,
            lineHeight: '0.95',
            overflow: 'hidden',
            textOverflow: 'clip',
          }}
        >
          <div>{line1}</div>
          {line2 && <div>{line2}</div>}
        </div>

        {/* Home slots beneath title - simple squares for Forest, regular for others */}
        {metaCard.actorHomeSlots.length > 0 && (
          <div className="w-full flex justify-center items-center gap-1 mb-2">
            {metaCard.actorHomeSlots.map(slot => {
              const homedActor = availableActors.find(a => a.id === slot.actorId);
              return (
                <ActorHomeSlot
                  key={slot.id}
                  slot={slot}
                  metaCardId={metaCard.id}
                  homedActor={homedActor || null}
                  isDropTarget={activeDropSlot === slot.id}
                  useSimpleSquare={isForest}
                  onDragOut={onDragActorOut}
                />
              );
            })}
          </div>
        )}

        {/* Progress indicator - centered */}
        <div className="flex-1 w-full flex items-center justify-center">
          <div
            className="text-2xl font-bold"
            style={{
              color: borderColor,
              textShadow: `0 0 10px ${borderColor}`,
            }}
          >
            {progress.current}/{progress.total}
          </div>
        </div>

        {/* Action button - lower right corner */}
        {showButton && (
          isForest ? (
            // Forest: "Go forth and adventure" button
            <button
              onClick={(e) => {
                e.stopPropagation();
                if (onAdventure) onAdventure();
              }}
              disabled={!hasActors}
              className="absolute bottom-1 right-1 w-6 h-6 flex items-center justify-center border border-game-teal text-game-teal rounded transition-opacity"
              style={{
                fontSize: '14px',
                opacity: hasActors ? 0.8 : 0.3,
                cursor: hasActors ? 'pointer' : 'not-allowed',
              }}
              title="Start Adventure"
            >
              ⚔️
            </button>
          ) : (
            // Other metacards: Improve button
            <button
              onClick={(e) => {
                e.stopPropagation();
                setIsImproveMode(!isImproveMode);
              }}
              className="absolute bottom-1 right-1 w-6 h-6 flex items-center justify-center border border-game-teal text-game-teal rounded opacity-60 hover:opacity-100 transition-opacity"
              style={{
                fontSize: '14px',
              }}
            >
              {isImproveMode ? '↓' : '↑'}
            </button>
          )
        )}

        {/* Complete indicator */}
        {isComplete && (
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-game-teal flex items-center justify-center"
            style={{ boxShadow: '0 0 8px #7fdbca' }}
          >
            <span className="text-[10px]">✓</span>
          </motion.div>
        )}
      </motion.div>

      {/* Expanded content - shows card upgrade slots when improve mode active */}
      <AnimatePresence>
        {isImproveMode && (
          <motion.div
            initial={{ opacity: 0, height: 0, scale: 0.95 }}
            animate={{ opacity: 1, height: 'auto', scale: 1 }}
            exit={{ opacity: 0, height: 0, scale: 0.95 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div
              className="bg-game-bg-dark border-2 rounded-lg p-4 min-w-[280px] max-w-[320px]"
              style={{
                borderColor,
                boxShadow: `0 0 20px ${borderColor}33, 0 10px 40px rgba(0, 0, 0, 0.5)`,
              }}
            >
              {/* Title */}
              <div
                className="text-sm font-bold tracking-wider mb-2"
                style={{
                  color: '#7fdbca',
                  textShadow: '0 0 8px rgba(127, 219, 202, 0.5)',
                }}
              >
                {definition.name.toUpperCase()}
              </div>

              {/* Description */}
              <div className="text-xs text-game-white opacity-80 mb-3">
                {definition.description}
              </div>

              {/* Slot Groups */}
              <div className="flex flex-col gap-3 mb-3">
                {metaCard.slotGroups.map((group, groupIdx) => (
                  <div key={groupIdx} className="flex flex-col gap-1">
                    {group.label && (
                      <div
                        className="text-[10px] tracking-wider opacity-60"
                        style={{ color: group.slots[0]?.requirement.suit ? SUIT_COLORS[group.slots[0].requirement.suit] : '#f0f0f0' }}
                      >
                        {group.label.toUpperCase()}
                      </div>
                    )}
                    <div className="flex gap-2 flex-wrap">
                      {group.slots.map((slot) => (
                        <CardSlot
                          key={slot.id}
                          slot={slot}
                          metaCardId={metaCard.id}
                          isDropTarget={activeDropSlot === slot.id}
                          size="sm"
                        />
                      ))}
                    </div>
                  </div>
                ))}
              </div>

              {/* Progress */}
              <div className="flex items-center justify-between pt-2 border-t border-game-purple/30">
                <div className="text-xs text-game-white opacity-60">
                  Progress: {progress.current}/{progress.total}
                </div>
                {isComplete && (
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    className="text-xs text-game-teal font-bold"
                  >
                    COMPLETE!
                  </motion.div>
                )}
              </div>

              {/* Clear button */}
              {progress.current > 0 && onClear && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onClear();
                  }}
                  className="mt-2 w-full text-xs text-game-pink border border-game-pink px-2 py-1 rounded opacity-60 hover:opacity-100 transition-opacity"
                >
                  RESET
                </button>
              )}

              {/* Hint */}
              <div className="mt-2 text-[10px] text-game-white opacity-40 text-center">
                Click CLOSE button to collapse
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
});
