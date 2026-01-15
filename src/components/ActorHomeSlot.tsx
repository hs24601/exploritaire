import { memo, useRef, useCallback } from 'react';
import type { ActorHomeSlot as ActorHomeSlotType, Actor } from '../engine/types';
import { getActorDefinition } from '../engine/actors';

interface ActorHomeSlotProps {
  slot: ActorHomeSlotType;
  metaCardId: string;
  homedActor: Actor | null; // The actor homed here, if any
  isDropTarget: boolean;
  useSimpleSquare?: boolean; // New prop for simple square design
  onDragOut?: (actor: Actor, clientX: number, clientY: number, rect: DOMRect) => void; // Allow dragging out
}

export const ActorHomeSlot = memo(function ActorHomeSlot({
  slot,
  metaCardId,
  homedActor,
  isDropTarget,
  useSimpleSquare = false,
  onDragOut,
}: ActorHomeSlotProps) {
  const isEmpty = slot.actorId === null;
  const slotRef = useRef<HTMLDivElement>(null);

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
    // Simple square design for Forest metacard
    const dimensions = { width: 20, height: 20 };

    return (
      <div
        ref={slotRef}
        data-actor-home-slot
        data-meta-card-id={metaCardId}
        data-slot-id={slot.id}
        onMouseDown={homedActor ? handleMouseDown : undefined}
        onTouchStart={homedActor ? handleTouchStart : undefined}
        className="rounded border-2 flex items-center justify-center transition-all"
        style={{
          width: dimensions.width,
          height: dimensions.height,
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
            {getActorDefinition(homedActor.definitionId)?.sprite}
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
      data-meta-card-id={metaCardId}
      data-slot-id={slot.id}
      onMouseDown={homedActor && onDragOut ? handleMouseDown : undefined}
      onTouchStart={homedActor && onDragOut ? handleTouchStart : undefined}
      className="rounded-md border-2 flex flex-col items-center justify-center transition-all relative"
      style={{
        width: dimensions.width,
        height: dimensions.height,
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
            {getActorDefinition(homedActor.definitionId)?.sprite}
          </span>
          <div
            className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-game-teal flex items-center justify-center"
            style={{ boxShadow: '0 0 8px #7fdbca' }}
          >
            <span className="text-[10px]">🏠</span>
          </div>
        </>
      ) : (
        // Empty slot
        <span className="text-2xl opacity-40">🏠</span>
      )}
    </div>
  );
});
