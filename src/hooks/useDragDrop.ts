import { useState, useCallback, useRef, useEffect } from 'react';
import { scheduleDragRafOnce } from './dragRafCoordinator';
import type { Card } from '../engine/types';

export interface DragState {
  card: Card | null;
  tableauIndex: number | null;
  position: { x: number; y: number };
  offset: { x: number; y: number };
  size?: { width: number; height: number };
  isDragging: boolean;
}

export interface DragMomentum {
  x: number;
  y: number;
}

export interface DragDropPerfSnapshot {
  moveAvgMs: number;
  moveP95Ms: number;
  moveMaxMs: number;
  endAvgMs: number;
  endP95Ms: number;
  endMaxMs: number;
  lastEndMs: number;
}

const initialDragState: DragState = {
  card: null,
  tableauIndex: null,
  position: { x: 0, y: 0 },
  offset: { x: 0, y: 0 },
  size: undefined,
  isDragging: false,
};

const DRAG_DEBUG = false;
const PERF_SAMPLE_CAP = 180;

const pushPerfSample = (buffer: number[], value: number) => {
  if (!Number.isFinite(value) || value < 0) return;
  buffer.push(value);
  if (buffer.length > PERF_SAMPLE_CAP) {
    buffer.splice(0, buffer.length - PERF_SAMPLE_CAP);
  }
};

const summarizePerfSamples = (samples: number[]) => {
  if (samples.length === 0) {
    return { avg: 0, p95: 0, max: 0 };
  }
  const sorted = [...samples].sort((a, b) => a - b);
  const avg = samples.reduce((sum, value) => sum + value, 0) / samples.length;
  const p95 = sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * 0.95))];
  const max = sorted[sorted.length - 1];
  return { avg, p95, max };
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
  const dragRafScheduledRef = useRef(false);
  const dragPositionRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const samplePointsRef = useRef<Array<{ x: number; y: number; t: number }>>([]);
  const pausedRef = useRef(paused);
  const dragMoveDurationsRef = useRef<number[]>([]);
  const dragEndDurationsRef = useRef<number[]>([]);
  const lastDragEndDurationRef = useRef(0);

  useEffect(() => {
    dragStateRef.current = dragState;
  }, [dragState]);

  useEffect(() => {
    const root = document.documentElement;
    if (dragState.isDragging) {
      root.classList.add('drag-perf-mode');
      return () => {
        root.classList.remove('drag-perf-mode');
      };
    }
    root.classList.remove('drag-perf-mode');
    return undefined;
  }, [dragState.isDragging]);

  useEffect(() => {
    onDropRef.current = onDrop;
  }, [onDrop]);

  useEffect(() => {
    pausedRef.current = paused;
    if (!paused) return;
    if (!dragStateRef.current.isDragging) return;
    dragRafScheduledRef.current = false;
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
      size: { width: cardRect.width, height: cardRect.height },
      isDragging: true,
    };
    dragPositionRef.current = { x: clientX - offset.x, y: clientY - offset.y };
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
    if (dragRafScheduledRef.current) return;
    dragRafScheduledRef.current = true;
    scheduleDragRafOnce(() => {
      dragRafScheduledRef.current = false;
      const pending = pendingPosRef.current;
      const current = dragStateRef.current;
      if (!pending || !current.isDragging) return;
      const nextX = pending.x - current.offset.x;
      const nextY = pending.y - current.offset.y;
      dragPositionRef.current = { x: nextX, y: nextY };
    });
  }, []);

  const endDrag = useCallback((clientX: number, clientY: number) => {
    const endStart = performance.now();
    const current = dragStateRef.current;
    if (!current.card || current.tableauIndex === null) {
      setLastDragEndAt(Date.now());
      setDragState(initialDragState);
      const endMs = performance.now() - endStart;
      lastDragEndDurationRef.current = endMs;
      pushPerfSample(dragEndDurationsRef.current, endMs);
      return;
    }
    pendingPosRef.current = null;
    dragRafScheduledRef.current = false;
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
    if (DRAG_DEBUG) {
      console.debug('[drag] end', {
        cardId: current.card.id,
        tableauIndex: current.tableauIndex,
        dropX,
        dropY,
      });
    }

    // Check if dropped on a foundation
    let hitFound = false;
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
        if (DRAG_DEBUG) {
          console.debug('[drag] hit foundation', { index: i, rect });
        }
        hitFound = true;
        onDropRef.current(current.tableauIndex, i, { x: dropX, y: dropY }, momentum);
        break;
      }
    }

    if (DRAG_DEBUG && !hitFound) {
      const refInfo = foundationRefs.current.map((ref, index) => ({
        index,
        rect: ref ? ref.getBoundingClientRect() : null,
      }));
      console.warn('[drag] no foundation hit', { foundationCount: foundationRefs.current.length, refInfo });
    }

    setDragState(initialDragState);
    setLastDragEndAt(Date.now());
    samplePointsRef.current = [];
    const endMs = performance.now() - endStart;
    lastDragEndDurationRef.current = endMs;
    pushPerfSample(dragEndDurationsRef.current, endMs);
  }, []);

  const cancelDrag = useCallback(() => {
    pendingPosRef.current = null;
    dragRafScheduledRef.current = false;
    samplePointsRef.current = [];
    dragStateRef.current = initialDragState;
    setDragState(initialDragState);
    setLastDragEndAt(Date.now());
  }, []);

  const setFoundationRef = useCallback((index: number, ref: HTMLDivElement | null) => {
    if (foundationRefs.current[index] === ref) return;
    foundationRefs.current[index] = ref;
    if (DRAG_DEBUG) {
      console.debug('[drag] set foundation ref', {
        index,
        hasRef: !!ref,
        foundationCount: foundationRefs.current.length,
      });
    }
  }, []);

  // Global mouse/touch move and up handlers
  useEffect(() => {
    const supportsPointer = typeof window !== 'undefined' && 'PointerEvent' in window;

    const handleMouseMove = (e: MouseEvent) => {
      if (!dragStateRef.current.isDragging) return;
      const moveStart = performance.now();
      updateDrag(e.clientX, e.clientY);
      pushPerfSample(dragMoveDurationsRef.current, performance.now() - moveStart);
    };

    const handleMouseUp = (e: MouseEvent) => {
      if (!dragStateRef.current.isDragging) return;
      endDrag(e.clientX, e.clientY);
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (!dragStateRef.current.isDragging) return;
      if (e.touches.length !== 1) return;
      const moveStart = performance.now();
      e.preventDefault();
      const touch = e.touches[0];
      updateDrag(touch.clientX, touch.clientY);
      pushPerfSample(dragMoveDurationsRef.current, performance.now() - moveStart);
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
      const moveStart = performance.now();
      // Prevent the browser from claiming the gesture as a scroll while we own the drag.
      // Without this, a downward swipe on mobile fires pointercancel (scroll wins) and
      // snaps the card back to its origin before it ever leaves the source column.
      if (e.pointerType !== 'mouse') {
        e.preventDefault();
      }
      updateDrag(e.clientX, e.clientY);
      pushPerfSample(dragMoveDurationsRef.current, performance.now() - moveStart);
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
      document.addEventListener('pointerup', handlePointerUp, { capture: true, passive: true });
      document.addEventListener('pointercancel', handlePointerCancel, { capture: true, passive: true });
      document.addEventListener('touchmove', handleTouchMoveSuppressScroll, { passive: false, capture: true });
    } else {
      document.addEventListener('mousemove', handleMouseMove, { passive: true });
      document.addEventListener('mouseup', handleMouseUp, { passive: true });
      document.addEventListener('touchmove', handleTouchMove, { passive: false, capture: true });
      document.addEventListener('touchend', handleTouchEnd, { capture: true, passive: true });
      document.addEventListener('touchcancel', handleTouchCancel, { capture: true, passive: true });
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

  const getPerfSnapshot = useCallback((): DragDropPerfSnapshot => {
    const move = summarizePerfSamples(dragMoveDurationsRef.current);
    const end = summarizePerfSamples(dragEndDurationsRef.current);
    return {
      moveAvgMs: move.avg,
      moveP95Ms: move.p95,
      moveMaxMs: move.max,
      endAvgMs: end.avg,
      endP95Ms: end.p95,
      endMaxMs: end.max,
      lastEndMs: lastDragEndDurationRef.current,
    };
  }, []);

  return {
    dragState,
    startDrag,
    setFoundationRef,
    lastDragEndAt,
    dragPositionRef,
    getPerfSnapshot,
  };
}
