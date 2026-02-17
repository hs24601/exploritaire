import { useCallback, useEffect, useRef, useState } from 'react';
import type { PointerEvent as ReactPointerEvent } from 'react';

interface UseLongPressStateMachineOptions<TPayload> {
  holdMs: number;
  onLongPress: (payload: TPayload) => void;
  moveTolerancePx?: number;
}

interface StartLongPressArgs<TPayload> {
  id: string;
  payload: TPayload;
  event: ReactPointerEvent<Element>;
  suppressClick?: boolean;
}

const DEFAULT_MOVE_TOLERANCE_PX = 14;
const TOUCH_MOVE_TOLERANCE_PX = 28;
const MOUSE_MOVE_TOLERANCE_PX = 10;

export function useLongPressStateMachine<TPayload>({
  holdMs,
  onLongPress,
  moveTolerancePx = DEFAULT_MOVE_TOLERANCE_PX,
}: UseLongPressStateMachineOptions<TPayload>) {
  const [activeId, setActiveId] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const activeIdRef = useRef<string | null>(null);
  const activePayloadRef = useRef<TPayload | null>(null);
  const activeElementRef = useRef<HTMLElement | null>(null);
  const pointerIdRef = useRef<number | null>(null);
  const pointerTypeRef = useRef<string | null>(null);
  const originRef = useRef<{ x: number; y: number } | null>(null);
  const timerRef = useRef<number | null>(null);
  const rafRef = useRef<number | null>(null);
  const startTimeRef = useRef(0);
  const consumedClickIdsRef = useRef(new Set<string>());

  const cancelTimer = useCallback(() => {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const cancelProgressLoop = useCallback(() => {
    if (rafRef.current !== null) {
      window.cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
  }, []);

  const releasePointerCapture = useCallback(() => {
    const el = activeElementRef.current;
    const pointerId = pointerIdRef.current;
    if (!el || pointerId === null || !('releasePointerCapture' in el)) return;
    try {
      if (el.hasPointerCapture(pointerId)) {
        el.releasePointerCapture(pointerId);
      }
    } catch {
      // Ignore capture release errors from detached nodes.
    }
  }, []);

  const resetActivePress = useCallback(() => {
    cancelTimer();
    cancelProgressLoop();
    releasePointerCapture();
    activeIdRef.current = null;
    activePayloadRef.current = null;
    activeElementRef.current = null;
    pointerIdRef.current = null;
    pointerTypeRef.current = null;
    originRef.current = null;
    setActiveId(null);
    setProgress(0);
  }, [cancelProgressLoop, cancelTimer, releasePointerCapture]);

  const beginProgressLoop = useCallback(() => {
    cancelProgressLoop();
    const tick = () => {
      if (!activeIdRef.current) return;
      const elapsed = performance.now() - startTimeRef.current;
      setProgress(Math.max(0, Math.min(1, elapsed / holdMs)));
      rafRef.current = window.requestAnimationFrame(tick);
    };
    rafRef.current = window.requestAnimationFrame(tick);
  }, [cancelProgressLoop, holdMs]);

  const startLongPress = useCallback((args: StartLongPressArgs<TPayload>) => {
    const { id, payload, event, suppressClick = true } = args;
    if (event.pointerType === 'mouse' && event.button !== 0) return;
    if (event.pointerType !== 'mouse') {
      event.preventDefault();
      event.stopPropagation();
    }
    resetActivePress();
    activeIdRef.current = id;
    activePayloadRef.current = payload;
    activeElementRef.current = event.currentTarget as HTMLElement;
    pointerIdRef.current = event.pointerId;
    pointerTypeRef.current = event.pointerType;
    originRef.current = { x: event.clientX, y: event.clientY };
    startTimeRef.current = performance.now();
    setActiveId(id);
    setProgress(0);
    if ('setPointerCapture' in event.currentTarget) {
      try {
        event.currentTarget.setPointerCapture(event.pointerId);
      } catch {
        // Ignore capture errors from unsupported pointer sources.
      }
    }
    beginProgressLoop();
    timerRef.current = window.setTimeout(() => {
      const firedId = activeIdRef.current;
      const firedPayload = activePayloadRef.current;
      if (!firedId || firedPayload === null) return;
      if (suppressClick) consumedClickIdsRef.current.add(firedId);
      setProgress(1);
      onLongPress(firedPayload);
      resetActivePress();
    }, holdMs);
  }, [beginProgressLoop, holdMs, onLongPress, resetActivePress]);

  const handlePointerMove = useCallback((event: ReactPointerEvent<Element>) => {
    if (!activeIdRef.current) return;
    const pointerId = pointerIdRef.current;
    if (pointerId !== null && event.pointerId !== pointerId) return;
    const origin = originRef.current;
    if (!origin) return;
    const dx = event.clientX - origin.x;
    const dy = event.clientY - origin.y;
    const pointerType = pointerTypeRef.current;
    const tolerance = pointerType === 'touch'
      ? Math.max(moveTolerancePx, TOUCH_MOVE_TOLERANCE_PX)
      : (pointerType === 'mouse' ? Math.min(moveTolerancePx, MOUSE_MOVE_TOLERANCE_PX) : moveTolerancePx);
    if ((dx * dx) + (dy * dy) <= tolerance * tolerance) return;
    resetActivePress();
  }, [moveTolerancePx, resetActivePress]);

  const handlePointerEnd = useCallback(() => {
    resetActivePress();
  }, [resetActivePress]);

  const shouldSuppressClick = useCallback((id: string) => {
    if (!consumedClickIdsRef.current.has(id)) return false;
    consumedClickIdsRef.current.delete(id);
    return true;
  }, []);

  const isPressingId = useCallback((id: string) => activeId === id, [activeId]);
  const getProgressForId = useCallback((id: string) => (activeId === id ? progress : 0), [activeId, progress]);

  useEffect(() => () => {
    resetActivePress();
  }, [resetActivePress]);

  return {
    startLongPress,
    handlePointerMove,
    handlePointerEnd,
    shouldSuppressClick,
    isPressingId,
    getProgressForId,
  };
}
