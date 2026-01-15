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
  const foundationRefs = useRef<(HTMLDivElement | null)[]>([]);

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
    if (!dragState.card || dragState.tableauIndex === null) {
      setDragState(initialDragState);
      return;
    }

    // Check if dropped on a foundation
    for (let i = 0; i < foundationRefs.current.length; i++) {
      const ref = foundationRefs.current[i];
      if (!ref) continue;

      const rect = ref.getBoundingClientRect();
      if (
        clientX >= rect.left &&
        clientX <= rect.right &&
        clientY >= rect.top &&
        clientY <= rect.bottom
      ) {
        onDrop(dragState.tableauIndex, i);
        break;
      }
    }

    setDragState(initialDragState);
  }, [dragState.card, dragState.tableauIndex, onDrop]);

  const cancelDrag = useCallback(() => {
    setDragState(initialDragState);
  }, []);

  const setFoundationRef = useCallback((index: number, ref: HTMLDivElement | null) => {
    foundationRefs.current[index] = ref;
  }, []);

  // Global mouse/touch move and up handlers
  useEffect(() => {
    if (!dragState.isDragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      e.preventDefault();
      updateDrag(e.clientX, e.clientY);
    };

    const handleMouseUp = (e: MouseEvent) => {
      endDrag(e.clientX, e.clientY);
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (e.touches.length !== 1) return;
      e.preventDefault();
      const touch = e.touches[0];
      updateDrag(touch.clientX, touch.clientY);
    };

    const handleTouchEnd = (e: TouchEvent) => {
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

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    document.addEventListener('touchmove', handleTouchMove, { passive: false });
    document.addEventListener('touchend', handleTouchEnd);
    document.addEventListener('touchcancel', handleTouchCancel);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.removeEventListener('touchmove', handleTouchMove);
      document.removeEventListener('touchend', handleTouchEnd);
      document.removeEventListener('touchcancel', handleTouchCancel);
    };
  }, [dragState.isDragging, updateDrag, endDrag, cancelDrag]);

  return {
    dragState,
    startDrag,
    setFoundationRef,
  };
}
