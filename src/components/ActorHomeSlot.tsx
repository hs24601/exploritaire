import { memo, useRef, useCallback } from 'react';
import type { ActorHomeSlot as ActorHomeSlotType, Actor } from '../engine/types';
import { getActorDisplayGlyph } from '../engine/actors';
import { GARDEN_GRID } from '../engine/constants';
import { GAME_BORDER_WIDTH } from '../utils/styles';

interface ActorHomeSlotProps {
  slot: ActorHomeSlotType;
  tileId: string;
  homedActor: Actor | null; // The actor homed here, if any
  isDropTarget: boolean;
  useSimpleSquare?: boolean; // New prop for simple square design
  onDragOut?: (actor: Actor, clientX: number, clientY: number, rect: DOMRect) => void; // Allow dragging out
  showGraphics: boolean;
}

export const ActorHomeSlot = memo(function ActorHomeSlot({
  slot,
  tileId,
  homedActor,
  isDropTarget,
  useSimpleSquare = false,
  onDragOut,
  showGraphics,
}: ActorHomeSlotProps) {
  const isEmpty = slot.actorId === null;
  const slotRef = useRef<HTMLDivElement>(null);
  const homeIndicator = showGraphics ? '??' : 'H';
  const emptyIndicator = showGraphics ? '??' : 'E';

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (!onDragOut || !homedActor || !slotRef.current) return;
    e.preventDefault();
    e.stopPropagation();
    const rect = slotRef.current.getBoundingClientRect();
    onDragOut(homedActor, e.clientX, e.clientY, rect);
  }, [onDragOut, homedActor]);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (!onDragOut || !homedActor || !slotRef.current) return;
    if (e.touches.length !== 1) return;
    e.stopPropagation();
    const touch = e.touches[0];
    const rect = slotRef.current.getBoundingClientRect();
    onDragOut(homedActor, touch.clientX, touch.clientY, rect);
  }, [onDragOut, homedActor]);

  if (useSimpleSquare) {
    // Simple square design for Forest tile
    const size = Math.round(GARDEN_GRID.cellSize * 0.28);
    const dimensions = { width: size, height: size };

    return (
      <div
        ref={slotRef}
        data-actor-home-slot
        data-tile-id={tileId}
        data-slot-id={slot.id}
        onMouseDown={homedActor ? handleMouseDown : undefined}
        onTouchStart={homedActor ? handleTouchStart : undefined}
        className="rounded flex items-center justify-center transition-all"
        style={{
          width: dimensions.width,
          height: dimensions.height,
          borderWidth: GAME_BORDER_WIDTH,
          borderColor: isEmpty ? 'rgba(127, 219, 202, 0.4)' : '#7fdbca',
          borderStyle: isEmpty ? 'dashed' : 'solid',
          backgroundColor: isEmpty ? 'transparent' : 'rgba(127, 219, 202, 0.2)',
          boxShadow: isDropTarget
            ? '0 0 10px #7fdbca'
            : isEmpty ? 'none' : '0 0 4px rgba(127, 219, 202, 0.4)',
          transform: isDropTarget ? 'scale(1.1)' : 'scale(1)',
          cursor: homedActor ? 'grab' : 'default',
        }}
      >
        {homedActor && (
          <span className="text-[12px]">
            {getActorDisplayGlyph(homedActor.definitionId, showGraphics)}
          </span>
        )}
      </div>
    );
  }

  // Original design for Burrowing Den (home slots)
  const dimensions = { width: 48, height: 64 };

  return (
    <div
      ref={slotRef}
      data-actor-home-slot
      data-tile-id={tileId}
      data-slot-id={slot.id}
      onMouseDown={homedActor && onDragOut ? handleMouseDown : undefined}
      onTouchStart={homedActor && onDragOut ? handleTouchStart : undefined}
      className="rounded-md flex flex-col items-center justify-center transition-all relative"
      style={{
        width: dimensions.width,
        height: dimensions.height,
        borderWidth: GAME_BORDER_WIDTH,
        borderColor: isEmpty ? 'rgba(127, 219, 202, 0.4)' : '#7fdbca',
        borderStyle: isEmpty ? 'dashed' : 'solid',
        backgroundColor: isEmpty ? 'transparent' : 'rgba(127, 219, 202, 0.1)',
        boxShadow: isDropTarget
          ? '0 0 20px #7fdbca, inset 0 0 10px rgba(127, 219, 202, 0.3)'
          : isEmpty ? 'none' : '0 0 8px rgba(127, 219, 202, 0.4)',
        transform: isDropTarget ? 'scale(1.1)' : 'scale(1)',
        cursor: homedActor && onDragOut ? 'grab' : 'default',
      }}
    >
      {homedActor ? (
        // Show home indicator (not full actor)
        <>
          <span className="text-2xl">
            {getActorDisplayGlyph(homedActor.definitionId, showGraphics)}
          </span>
          <div
            className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-game-teal flex items-center justify-center"
            style={{ boxShadow: '0 0 8px #7fdbca' }}
          >
            <span className="text-[10px]">{homeIndicator}</span>
          </div>
        </>
      ) : (
        // Empty slot
        <span className="text-2xl opacity-40">{emptyIndicator}</span>
      )}
    </div>
  );
});




