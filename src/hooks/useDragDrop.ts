import { useState, useCallback, useRef, useEffect } from 'react';
import type { Card } from '../engine/types';

export interface DragState {
  card: Card | null;
  tableauIndex: number | null;
  position: { x: number; y: number };
  offset: { x: number; y: number };
  isDragging: boolean;
}

export interface DragMomentum {
  x: number;
  y: number;
}

const initialDragState: DragState = {
  card: null,
  tableauIndex: null,
  position: { x: 0, y: 0 },
  offset: { x: 0, y: 0 },
  isDragging: false,
};

export function useDragDrop(
  onDrop: (
    tableauIndex: number,
    foundationIndex: number,
    dropPoint?: { x: number; y: number },
    momentum?: DragMomentum
  ) => void,
  paused = false
) {
  const [dragState, setDragState] = useState<DragState>(initialDragState);
  const [lastDragEndAt, setLastDragEndAt] = useState(0);
  const dragStateRef = useRef(dragState);
  const onDropRef = useRef(onDrop);
  const foundationRefs = useRef<(HTMLDivElement | null)[]>([]);
  const pendingPosRef = useRef<{ x: number; y: number } | null>(null);
  const samplePointsRef = useRef<Array<{ x: number; y: number; t: number }>>([]);
  const rafRef = useRef<number | null>(null);
  const pausedRef = useRef(paused);

  useEffect(() => {
    dragStateRef.current = dragState;
  }, [dragState]);

  useEffect(() => {
    onDropRef.current = onDrop;
  }, [onDrop]);

  useEffect(() => {
    pausedRef.current = paused;
    if (!paused) return;
    if (!dragStateRef.current.isDragging) return;
    if (rafRef.current !== null) {
      window.cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    pendingPosRef.current = null;
    samplePointsRef.current = [];
    dragStateRef.current = initialDragState;
    setDragState(initialDragState);
    setLastDragEndAt(Date.now());
  }, [paused]);

  const startDrag = useCallback((
    card: Card,
    tableauIndex: number,
    clientX: number,
    clientY: number,
    cardRect: DOMRect
  ) => {
    if (pausedRef.current) return;
    const offset = {
      x: clientX - cardRect.left,
      y: clientY - cardRect.top,
    };

    const next: DragState = {
      card,
      tableauIndex,
      position: { x: clientX - offset.x, y: clientY - offset.y },
      offset,
      isDragging: true,
    };
    // Sync the ref immediately — before React re-renders and before useEffect runs —
    // so that pointermove / pointercancel / touchmove handlers see isDragging = true
    // from the very first event after the drag begins.
    dragStateRef.current = next;
    setDragState(next);
    samplePointsRef.current = [{ x: clientX, y: clientY, t: performance.now() }];
  }, []);

  const updateDrag = useCallback((clientX: number, clientY: number) => {
    if (pausedRef.current) return;
    pendingPosRef.current = { x: clientX, y: clientY };
    samplePointsRef.current.push({ x: clientX, y: clientY, t: performance.now() });
    if (samplePointsRef.current.length > 8) {
      samplePointsRef.current.shift();
    }
    if (rafRef.current !== null) return;
    rafRef.current = window.requestAnimationFrame(() => {
      rafRef.current = null;
      const pending = pendingPosRef.current;
      const current = dragStateRef.current;
      if (!pending || !current.isDragging) return;
      const nextX = pending.x - current.offset.x;
      const nextY = pending.y - current.offset.y;
      setDragState((prev) => {
        if (!prev.isDragging) return prev;
        if (prev.position.x === nextX && prev.position.y === nextY) return prev;
        return {
          ...prev,
          position: { x: nextX, y: nextY },
        };
      });
    });
  }, []);

  const endDrag = useCallback((clientX: number, clientY: number) => {
    const current = dragStateRef.current;
    if (!current.card || current.tableauIndex === null) {
      setLastDragEndAt(Date.now());
      setDragState(initialDragState);
      return;
    }
    if (rafRef.current !== null) {
      window.cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    pendingPosRef.current = null;
    let momentum: DragMomentum | undefined;
    const samples = samplePointsRef.current;
    if (samples.length >= 2) {
      const latest = samples[samples.length - 1];
      const earliestWindow = latest.t - 80;
      const anchor = [...samples].reverse().find((entry) => entry.t <= earliestWindow) ?? samples[0];
      const dx = latest.x - anchor.x;
      const dy = latest.y - anchor.y;
      if (Math.abs(dx) + Math.abs(dy) > 0.01) {
        momentum = { x: dx, y: dy };
      }
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
        onDropRef.current(current.tableauIndex, i, { x: dropX, y: dropY }, momentum);
        break;
      }
    }

    setDragState(initialDragState);
    setLastDragEndAt(Date.now());
    samplePointsRef.current = [];
  }, []);

  const cancelDrag = useCallback(() => {
    if (rafRef.current !== null) {
      window.cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    pendingPosRef.current = null;
    samplePointsRef.current = [];
    dragStateRef.current = initialDragState;
    setDragState(initialDragState);
    setLastDragEndAt(Date.now());
  }, []);

  const setFoundationRef = useCallback((index: number, ref: HTMLDivElement | null) => {
    foundationRefs.current[index] = ref;
  }, []);

  // Global mouse/touch move and up handlers
  useEffect(() => {
    const supportsPointer = typeof window !== 'undefined' && 'PointerEvent' in window;

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
      // Prevent the browser from claiming the gesture as a scroll while we own the drag.
      // Without this, a downward swipe on mobile fires pointercancel (scroll wins) and
      // snaps the card back to its origin before it ever leaves the source column.
      e.preventDefault();
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

    // On touch devices that support Pointer Events, the browser still fires the
    // underlying touchmove stream and uses it to decide whether to scroll.
    // preventDefault() on pointermove has NO effect on this decision — only
    // preventDefault() on touchmove suppresses scroll. Without this, any vertical
    // drag fires pointercancel (browser claims the gesture for scroll) and the
    // card snaps back to its origin.
    const handleTouchMoveSuppressScroll = (e: TouchEvent) => {
      if (dragStateRef.current.isDragging) {
        e.preventDefault();
      }
    };

    if (supportsPointer) {
      document.addEventListener('pointermove', handlePointerMove, { capture: true, passive: false });
      document.addEventListener('pointerup', handlePointerUp, { capture: true });
      document.addEventListener('pointercancel', handlePointerCancel, { capture: true });
      document.addEventListener('touchmove', handleTouchMoveSuppressScroll, { passive: false, capture: true });
    } else {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      document.addEventListener('touchmove', handleTouchMove, { passive: false, capture: true });
      document.addEventListener('touchend', handleTouchEnd, { capture: true });
      document.addEventListener('touchcancel', handleTouchCancel, { capture: true });
    }

    return () => {
      if (supportsPointer) {
        document.removeEventListener('pointermove', handlePointerMove, { capture: true });
        document.removeEventListener('pointerup', handlePointerUp, { capture: true });
        document.removeEventListener('pointercancel', handlePointerCancel, { capture: true });
        document.removeEventListener('touchmove', handleTouchMoveSuppressScroll, { capture: true });
      } else {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
        document.removeEventListener('touchmove', handleTouchMove, { capture: true });
        document.removeEventListener('touchend', handleTouchEnd, { capture: true });
        document.removeEventListener('touchcancel', handleTouchCancel, { capture: true });
      }
    };
  }, [updateDrag, endDrag, cancelDrag]);

  return {
    dragState,
    startDrag,
    setFoundationRef,
    lastDragEndAt,
  };
}
