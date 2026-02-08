import { useState, useCallback, useRef, useEffect } from 'react';
import type { Card } from '../engine/types';

export interface DragState {
  card: Card | null;
  tableauIndex: number | null;
  position: { x: number; y: number };
  offset: { x: number; y: number };
  isDragging: boolean;
}

const initialDragState: DragState = {
  card: null,
  tableauIndex: null,
  position: { x: 0, y: 0 },
  offset: { x: 0, y: 0 },
  isDragging: false,
};

export function useDragDrop(onDrop: (tableauIndex: number, foundationIndex: number) => void) {
  const [dragState, setDragState] = useState<DragState>(initialDragState);
  const [lastDragEndAt, setLastDragEndAt] = useState(0);
  const dragStateRef = useRef(dragState);
  const onDropRef = useRef(onDrop);
  const foundationRefs = useRef<(HTMLDivElement | null)[]>([]);

  useEffect(() => {
    dragStateRef.current = dragState;
  }, [dragState]);

  useEffect(() => {
    onDropRef.current = onDrop;
  }, [onDrop]);

  const startDrag = useCallback((
    card: Card,
    tableauIndex: number,
    clientX: number,
    clientY: number,
    cardRect: DOMRect
  ) => {
    const offset = {
      x: clientX - cardRect.left,
      y: clientY - cardRect.top,
    };

    setDragState({
      card,
      tableauIndex,
      position: { x: clientX - offset.x, y: clientY - offset.y },
      offset,
      isDragging: true,
    });
  }, []);

  const updateDrag = useCallback((clientX: number, clientY: number) => {
    setDragState((prev) => ({
      ...prev,
      position: {
        x: clientX - prev.offset.x,
        y: clientY - prev.offset.y,
      },
    }));
  }, []);

  const endDrag = useCallback((clientX: number, clientY: number) => {
    const current = dragStateRef.current;
    if (!current.card || current.tableauIndex === null) {
      setLastDragEndAt(Date.now());
      setDragState(initialDragState);
      return;
    }

    const dropX = clientX;
    const dropY = clientY;
    if (import.meta.env.DEV) {
      console.debug('[drag] end', {
        cardId: current.card.id,
        tableauIndex: current.tableauIndex,
        dropX,
        dropY,
      });
    }

    // Check if dropped on a foundation
    for (let i = 0; i < foundationRefs.current.length; i++) {
      const ref = foundationRefs.current[i];
      if (!ref) continue;

      const rect = ref.getBoundingClientRect();
      if (
        dropX >= rect.left &&
        dropX <= rect.right &&
        dropY >= rect.top &&
        dropY <= rect.bottom
      ) {
        if (import.meta.env.DEV) {
          console.debug('[drag] hit foundation', { index: i, rect });
        }
        onDropRef.current(current.tableauIndex, i);
        break;
      }
    }

    setDragState(initialDragState);
    setLastDragEndAt(Date.now());
  }, []);

  const cancelDrag = useCallback(() => {
    setDragState(initialDragState);
    setLastDragEndAt(Date.now());
  }, []);

  const setFoundationRef = useCallback((index: number, ref: HTMLDivElement | null) => {
    foundationRefs.current[index] = ref;
  }, []);

  // Global mouse/touch move and up handlers
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!dragStateRef.current.isDragging) return;
      e.preventDefault();
      updateDrag(e.clientX, e.clientY);
    };

    const handleMouseUp = (e: MouseEvent) => {
      if (!dragStateRef.current.isDragging) return;
      endDrag(e.clientX, e.clientY);
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (!dragStateRef.current.isDragging) return;
      if (e.touches.length !== 1) return;
      e.preventDefault();
      const touch = e.touches[0];
      updateDrag(touch.clientX, touch.clientY);
    };

    const handleTouchEnd = (e: TouchEvent) => {
      if (!dragStateRef.current.isDragging) return;
      if (e.changedTouches.length !== 1) {
        cancelDrag();
        return;
      }
      const touch = e.changedTouches[0];
      endDrag(touch.clientX, touch.clientY);
    };

    const handleTouchCancel = () => {
      cancelDrag();
    };

    const handlePointerMove = (e: PointerEvent) => {
      if (!dragStateRef.current.isDragging) return;
      updateDrag(e.clientX, e.clientY);
    };

    const handlePointerUp = (e: PointerEvent) => {
      if (!dragStateRef.current.isDragging) return;
      endDrag(e.clientX, e.clientY);
    };

    const handlePointerCancel = () => {
      if (!dragStateRef.current.isDragging) return;
      cancelDrag();
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    document.addEventListener('touchmove', handleTouchMove, { passive: false, capture: true });
    document.addEventListener('touchend', handleTouchEnd, { capture: true });
    document.addEventListener('touchcancel', handleTouchCancel, { capture: true });
    document.addEventListener('pointermove', handlePointerMove, { capture: true });
    document.addEventListener('pointerup', handlePointerUp, { capture: true });
    document.addEventListener('pointercancel', handlePointerCancel, { capture: true });

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.removeEventListener('touchmove', handleTouchMove, { capture: true });
      document.removeEventListener('touchend', handleTouchEnd, { capture: true });
      document.removeEventListener('touchcancel', handleTouchCancel, { capture: true });
      document.removeEventListener('pointermove', handlePointerMove, { capture: true });
      document.removeEventListener('pointerup', handlePointerUp, { capture: true });
      document.removeEventListener('pointercancel', handlePointerCancel, { capture: true });
    };
  }, [updateDrag, endDrag, cancelDrag]);

  return {
    dragState,
    startDrag,
    setFoundationRef,
    lastDragEndAt,
  };
}
