import { useState, useCallback, useEffect, useRef } from 'react';

export interface CameraState {
  x: number;
  y: number;
  scale: number;
}

interface UseCameraControlsOptions {
  minScale?: number;
  maxScale?: number;
  zoomSensitivity?: number;
  initialState?: Partial<CameraState>;
  enabled?: boolean;
  zoomEnabled?: boolean;
  baseScale?: number;
  canStartPanAt?: (clientX: number, clientY: number) => boolean;
  listenOnWindow?: boolean;
  /** Coordinate model for the content element's transform.
   *  'scale' (default) — screenPos = translate + contentPos × effectiveScale.
   *    Use for both `transform: translate3d + scale()` AND `translate3d + CSS zoom`,
   *    because CSS zoom on the same element does NOT scale the translate values.
   *  'zoom' — screenPos = (translate + contentPos) × effectiveScale.
   *    Only needed if the translate IS scaled by an ancestor's zoom. */
  transformMode?: 'zoom' | 'scale';
  /** Zoom animation smoothing factor (0–1). Higher = snappier. Default: 0.18 */
  zoomSmoothing?: number;
}

interface UseCameraControlsResult {
  cameraState: CameraState;
  effectiveScale: number;
  containerRef: React.RefObject<HTMLDivElement | null>;
  contentRef: React.RefObject<HTMLDivElement | null>;
  isPanning: boolean;
  resetCamera: () => void;
  centerOn: (elementRef: HTMLElement | null) => void;
  setCameraState: React.Dispatch<React.SetStateAction<CameraState>>;
  startPanAt: (clientX: number, clientY: number, button?: number) => void;
  endPan: () => void;
}

const DEFAULT_CAMERA: CameraState = { x: 0, y: 0, scale: 1 };

export function useCameraControls(options: UseCameraControlsOptions = {}): UseCameraControlsResult {
  const {
    minScale = 0.25,
    maxScale = 3,
    zoomSensitivity = 0.001,
    initialState = {},
    enabled = true,
    zoomEnabled = true,
    baseScale = 1,
    canStartPanAt,
    listenOnWindow = false,
    transformMode = 'scale',
    zoomSmoothing = 0.18,
  } = options;

  const initial = { ...DEFAULT_CAMERA, ...initialState };
  const [cameraState, setCameraState] = useState<CameraState>(initial);
  const effectiveScale = cameraState.scale * baseScale;
  const [isPanning, setIsPanning] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  // Pan state
  const panStartRef = useRef({ x: 0, y: 0 });
  const cameraStartRef = useRef({ x: 0, y: 0 });
  const panButtonRef = useRef<number | null>(null);
  const pinchRef = useRef<{
    active: boolean;
    startDistance: number;
    startScale: number;
    startX: number;
    startY: number;
    anchorWorld: { x: number; y: number };
  }>({
    active: false,
    startDistance: 0,
    startScale: 1,
    startX: 0,
    startY: 0,
    anchorWorld: { x: 0, y: 0 },
  });
  const touchPanRef = useRef<{
    active: boolean;
    startX: number;
    startY: number;
    camX: number;
    camY: number;
  }>({
    active: false,
    startX: 0,
    startY: 0,
    camX: 0,
    camY: 0,
  });

  // Smooth zoom state — we animate toward zoomTargetRef
  const zoomTargetRef = useRef<CameraState>(initial);
  const cameraRef = useRef<CameraState>(initial);
  const animatingRef = useRef(false);
  const rafRef = useRef<number>(0);
  const wheelDeltaRef = useRef(0);
  const wheelAnchorRef = useRef<{ worldX: number; worldY: number; mouseX: number; mouseY: number } | null>(null);
  const wheelLastTsRef = useRef(0);
  const lastStateSyncRef = useRef(0);
  const debugRef = useRef({
    wheelCount: 0,
    lastDelta: 0,
    lastEventTs: 0,
    lastScale: initial.scale,
    lastTargetScale: initial.scale,
  });

  // Keep option refs current so the animation loop never goes stale
  const smoothingRef = useRef(zoomSmoothing);
  smoothingRef.current = zoomSmoothing;
  const zoomSensitivityRef = useRef(zoomSensitivity);
  zoomSensitivityRef.current = zoomSensitivity;
  const minScaleRef = useRef(minScale);
  minScaleRef.current = minScale;
  const maxScaleRef = useRef(maxScale);
  maxScaleRef.current = maxScale;
  const baseScaleRef = useRef(baseScale);
  baseScaleRef.current = baseScale;
  const transformModeRef = useRef(transformMode);
  transformModeRef.current = transformMode;

  const applyTransform = useCallback((state: CameraState) => {
    const el = contentRef.current;
    if (!el) return;
    const scale = state.scale * baseScaleRef.current;
    const transform = `translate3d(${state.x}px, ${state.y}px, 0) scale(${scale})`;
    el.style.transform = transform;
    const container = containerRef.current;
    if (container) {
      container.style.setProperty('--camera-transform', transform);
    }
    document.documentElement.style.setProperty('--camera-transform', transform);
  }, []);

  // Sync React state → cameraRef (for external setCameraState calls)
  useEffect(() => {
    cameraRef.current = cameraState;
  }, [cameraState]);

  // Ensure initial transform is applied once contentRef is ready
  useEffect(() => {
    applyTransform(cameraRef.current);
  }, [applyTransform]);

  // ---------------------------------------------------------------------------
  // Animation loop — lerps cameraState toward zoomTargetRef
  // ---------------------------------------------------------------------------
  const startAnimation = useCallback(() => {
    if (rafRef.current) return;
    animatingRef.current = true;

    const tick = () => {
      if (!animatingRef.current) {
        rafRef.current = 0;
        return;
      }

      // Consume any queued wheel input on the animation frame for smoother zoom.
      if (Math.abs(wheelDeltaRef.current) > 0.001) {
        const apply = wheelDeltaRef.current * 0.35;
        wheelDeltaRef.current -= apply;

        const delta = apply * zoomSensitivityRef.current * 0.5;
        const prevTargetScale = zoomTargetRef.current.scale;
        debugRef.current.lastDelta = delta;
        const nextEffective = Math.min(
          maxScaleRef.current * baseScaleRef.current,
          Math.max(
            minScaleRef.current * baseScaleRef.current,
            prevTargetScale * baseScaleRef.current * (1 + delta),
          ),
        );
        const newScale = nextEffective / baseScaleRef.current;
        debugRef.current.lastTargetScale = newScale;
        const anchor = wheelAnchorRef.current;

        if (anchor) {
          let newX: number, newY: number;
          if (transformModeRef.current === 'zoom') {
            newX = anchor.mouseX / nextEffective - anchor.worldX;
            newY = anchor.mouseY / nextEffective - anchor.worldY;
          } else {
            newX = anchor.mouseX - anchor.worldX * nextEffective;
            newY = anchor.mouseY - anchor.worldY * nextEffective;
          }
          zoomTargetRef.current = { x: newX, y: newY, scale: newScale };
        } else {
          zoomTargetRef.current = { ...zoomTargetRef.current, scale: newScale };
        }
      } else {
        wheelDeltaRef.current = 0;
      }

      const target = zoomTargetRef.current;
      const prev = cameraRef.current;
      const s = Math.min(Math.max(smoothingRef.current, 0.01), 1);

      const dx = target.x - prev.x;
      const dy = target.y - prev.y;
      const ds = target.scale - prev.scale;

      // Close enough — snap to target and stop (if no wheel input remains)
      if (
        Math.abs(dx) < 0.05 &&
        Math.abs(dy) < 0.05 &&
        Math.abs(ds) < 0.0001 &&
        Math.abs(wheelDeltaRef.current) < 0.001
      ) {
        animatingRef.current = false;
        wheelDeltaRef.current = 0;
        wheelAnchorRef.current = null;
        cameraRef.current = target;
        applyTransform(target);
        lastStateSyncRef.current = performance.now();
        setCameraState(target);
        rafRef.current = 0;
        return;
      }

      const next: CameraState = {
        x: prev.x + dx * s,
        y: prev.y + dy * s,
        scale: prev.scale + ds * s,
      };

      cameraRef.current = next;
      debugRef.current.lastScale = next.scale;
      applyTransform(next);

      const now = performance.now();
      if (now - lastStateSyncRef.current > 80) {
        lastStateSyncRef.current = now;
        setCameraState(next);
      }
      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  // ---------------------------------------------------------------------------
  // Public helpers
  // ---------------------------------------------------------------------------
  const resetCamera = useCallback(() => {
    const state = { ...DEFAULT_CAMERA };
    zoomTargetRef.current = state;
    cameraRef.current = state;
    animatingRef.current = false;
    applyTransform(state);
    lastStateSyncRef.current = performance.now();
    setCameraState(state);
  }, [applyTransform]);

  const centerOn = useCallback((element: HTMLElement | null) => {
    if (!element || !containerRef.current || !contentRef.current) return;

    const containerRect = containerRef.current.getBoundingClientRect();
    const contentRect = contentRef.current.getBoundingClientRect();
    const elementRect = element.getBoundingClientRect();

    const elementCenterX = elementRect.left - contentRect.left + elementRect.width / 2;
    const elementCenterY = elementRect.top - contentRect.top + elementRect.height / 2;

    const containerCenterX = containerRect.width / 2;
    const containerCenterY = containerRect.height / 2;

    setCameraState(prev => {
      // elementCenter is already in screen space; translate directly to center it
      const state = {
        ...prev,
        x: containerCenterX - elementCenterX,
        y: containerCenterY - elementCenterY,
      };
      zoomTargetRef.current = state;
      cameraRef.current = state;
      applyTransform(state);
      lastStateSyncRef.current = performance.now();
      return state;
    });
  }, [applyTransform, baseScale]);

  // Wrapped setter that keeps refs in sync (no animation)
  const setCamera = useCallback<React.Dispatch<React.SetStateAction<CameraState>>>((action) => {
    setCameraState(prev => {
      const next = typeof action === 'function' ? action(prev) : action;
      zoomTargetRef.current = next;
      cameraRef.current = next;
      applyTransform(next);
      lastStateSyncRef.current = performance.now();
      return next;
    });
  }, [applyTransform]);

  // ---------------------------------------------------------------------------
  // Mouse-wheel zoom
  // ---------------------------------------------------------------------------
  useEffect(() => {
    if (!enabled || !zoomEnabled) return;
    const container = containerRef.current;
    if (!container) return;
    const target: Window | HTMLDivElement = listenOnWindow ? window : container;

    const handleWheel = (e: WheelEvent) => {
      const activeContainer = containerRef.current;
      if (!activeContainer) return;
      const rect = activeContainer.getBoundingClientRect();
      // Ignore wheel events outside the camera container (e.g. overlays/side panels).
      if (
        e.clientX < rect.left ||
        e.clientX > rect.right ||
        e.clientY < rect.top ||
        e.clientY > rect.bottom
      ) {
        return;
      }
      if (canStartPanAt && !canStartPanAt(e.clientX, e.clientY)) {
        return;
      }
      e.preventDefault();

      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;

      // Scale accumulates on the TARGET so rapid scrolls compound.
      // When already animating, anchor the next target to the current target
      // instead of the lagging display to avoid "snap-back" jitter.
      let deltaPixels = e.deltaY;
      if (e.deltaMode === 1) deltaPixels *= 16;
      if (e.deltaMode === 2) deltaPixels *= rect.height;

      const now = performance.now();
      const display = cameraRef.current;
      const displayEffective = display.scale * baseScaleRef.current;

      // Re-anchor if wheel is idle or if we haven't started animating yet.
      if (!wheelAnchorRef.current || now - wheelLastTsRef.current > 80) {
        let worldX: number, worldY: number;
        if (transformModeRef.current === 'zoom') {
          worldX = mouseX / displayEffective - display.x;
          worldY = mouseY / displayEffective - display.y;
        } else {
          worldX = (mouseX - display.x) / displayEffective;
          worldY = (mouseY - display.y) / displayEffective;
        }
        wheelAnchorRef.current = { worldX, worldY, mouseX, mouseY };
      } else {
        wheelAnchorRef.current = {
          ...wheelAnchorRef.current,
          mouseX,
          mouseY,
        };
      }

      wheelLastTsRef.current = now;
      // Immediate zoom update to avoid stalled animation loops.
      const delta = -deltaPixels * zoomSensitivityRef.current * 0.175;
      const prevScale = display.scale;
      const nextEffective = Math.min(
        maxScaleRef.current * baseScaleRef.current,
        Math.max(
          minScaleRef.current * baseScaleRef.current,
          prevScale * baseScaleRef.current * (1 + delta),
        ),
      );
      const newScale = nextEffective / baseScaleRef.current;
      let newX = display.x;
      let newY = display.y;
      const anchor = wheelAnchorRef.current;
      if (anchor) {
        if (transformModeRef.current === 'zoom') {
          newX = anchor.mouseX / nextEffective - anchor.worldX;
          newY = anchor.mouseY / nextEffective - anchor.worldY;
        } else {
          newX = anchor.mouseX - anchor.worldX * nextEffective;
          newY = anchor.mouseY - anchor.worldY * nextEffective;
        }
      }
      const next = { x: newX, y: newY, scale: newScale };
      cameraRef.current = next;
      zoomTargetRef.current = next;
      applyTransform(next);
      lastStateSyncRef.current = now;
      setCameraState(next);
      wheelDeltaRef.current = 0;
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = 0;
      }
      animatingRef.current = false;
      debugRef.current.wheelCount += 1;
      debugRef.current.lastDelta = delta;
      debugRef.current.lastEventTs = now;
      debugRef.current.lastScale = next.scale;
      debugRef.current.lastTargetScale = next.scale;
      (window as unknown as { __cameraDebug?: unknown }).__cameraDebug = {
        ...debugRef.current,
        minScale: minScaleRef.current,
        maxScale: maxScaleRef.current,
        baseScale: baseScaleRef.current,
        effectiveScale: cameraRef.current.scale * baseScaleRef.current,
      };
    };

    // Listen on window so overlays don't block zoom; ignore events outside container bounds.
    window.addEventListener('wheel', handleWheel, { passive: false, capture: true });
    return () => window.removeEventListener('wheel', handleWheel, { capture: true });
  }, [enabled, minScale, maxScale, zoomSensitivity, baseScale, startAnimation, canStartPanAt]);

  // ---------------------------------------------------------------------------
  // Middle-mouse-button pan
  // ---------------------------------------------------------------------------
  useEffect(() => {
    if (!enabled) return;
    const container = containerRef.current;
    if (!container) return;

    const handleMouseDown = (e: MouseEvent) => {
      // Middle mouse button (button 1)
      if (e.button !== 1) return;
      e.preventDefault();

      setIsPanning(true);
      panButtonRef.current = 1;
      panStartRef.current = { x: e.clientX, y: e.clientY };
      const cur = cameraRef.current;
      cameraStartRef.current = { x: cur.x, y: cur.y };
      // Keep target in sync so animation doesn't fight the pan
      zoomTargetRef.current = { ...zoomTargetRef.current, x: cur.x, y: cur.y };
    };

    const handleMouseMove = (e: MouseEvent) => {
      if (!isPanning) return;

      const deltaX = e.clientX - panStartRef.current.x;
      const deltaY = e.clientY - panStartRef.current.y;
      const newX = cameraStartRef.current.x + deltaX;
      const newY = cameraStartRef.current.y + deltaY;

      const next = { ...cameraRef.current, x: newX, y: newY };
      cameraRef.current = next;
      applyTransform(next);
      const now = performance.now();
      if (now - lastStateSyncRef.current > 50) {
        lastStateSyncRef.current = now;
        setCameraState(next);
      }
      zoomTargetRef.current = { ...zoomTargetRef.current, x: newX, y: newY };
    };

    const handleMouseUp = (e: MouseEvent) => {
      if (panButtonRef.current === e.button) {
        setIsPanning(false);
        panButtonRef.current = null;
      }
    };

    // Prevent context menu on middle click
    const handleContextMenu = (e: MouseEvent) => {
      if (e.button === 1) {
        e.preventDefault();
      }
    };

    container.addEventListener('mousedown', handleMouseDown);
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    container.addEventListener('auxclick', handleContextMenu);

    return () => {
      container.removeEventListener('mousedown', handleMouseDown);
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      container.removeEventListener('auxclick', handleContextMenu);
    };
  }, [enabled, isPanning]);

  // ---------------------------------------------------------------------------
  // Touch pinch zoom
  // ---------------------------------------------------------------------------
  useEffect(() => {
    if (!enabled || !zoomEnabled) return;
    const container = containerRef.current;
    if (!container) return;
    const target: Window | HTMLDivElement = listenOnWindow ? window : container;

    const getDistance = (t1: Touch, t2: Touch) =>
      Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY);

    const handleTouchStart = (e: TouchEvent) => {
      if (e.touches.length === 1) {
        const t = e.touches[0];
        if (canStartPanAt && !canStartPanAt(t.clientX, t.clientY)) {
          touchPanRef.current.active = false;
          return;
        }
        e.preventDefault();
        touchPanRef.current = {
          active: true,
          startX: t.clientX,
          startY: t.clientY,
          camX: cameraRef.current.x,
          camY: cameraRef.current.y,
        };
        return;
      }
      if (e.touches.length !== 2) return;
      const rect = container.getBoundingClientRect();
      const t1 = e.touches[0];
      const t2 = e.touches[1];
      if (
        t1.clientX < rect.left ||
        t1.clientX > rect.right ||
        t1.clientY < rect.top ||
        t1.clientY > rect.bottom ||
        t2.clientX < rect.left ||
        t2.clientX > rect.right ||
        t2.clientY < rect.top ||
        t2.clientY > rect.bottom
      ) {
        return;
      }
      const midX = (t1.clientX + t2.clientX) / 2 - rect.left;
      const midY = (t1.clientY + t2.clientY) / 2 - rect.top;
      const distance = getDistance(t1, t2);

      const display = cameraRef.current;
      const displayEffective = display.scale * baseScaleRef.current;
      let worldX: number, worldY: number;
      if (transformModeRef.current === 'zoom') {
        worldX = midX / displayEffective - display.x;
        worldY = midY / displayEffective - display.y;
      } else {
        worldX = (midX - display.x) / displayEffective;
        worldY = (midY - display.y) / displayEffective;
      }

      pinchRef.current = {
        active: true,
        startDistance: distance,
        startScale: display.scale,
        startX: display.x,
        startY: display.y,
        anchorWorld: { x: worldX, y: worldY },
      };
      setIsPanning(false);
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (touchPanRef.current.active && e.touches.length === 1) {
        e.preventDefault();
        const t = e.touches[0];
        const deltaX = t.clientX - touchPanRef.current.startX;
        const deltaY = t.clientY - touchPanRef.current.startY;
        const next = {
          ...cameraRef.current,
          x: touchPanRef.current.camX + deltaX,
          y: touchPanRef.current.camY + deltaY,
        };
        cameraRef.current = next;
        zoomTargetRef.current = { ...zoomTargetRef.current, x: next.x, y: next.y };
        applyTransform(next);
        lastStateSyncRef.current = performance.now();
        setCameraState(next);
        return;
      }
      if (!pinchRef.current.active) return;
      if (e.touches.length !== 2) return;
      e.preventDefault();

      const rect = container.getBoundingClientRect();
      const t1 = e.touches[0];
      const t2 = e.touches[1];
      const midX = (t1.clientX + t2.clientX) / 2 - rect.left;
      const midY = (t1.clientY + t2.clientY) / 2 - rect.top;
      const distance = getDistance(t1, t2);
      const ratio = distance / Math.max(1, pinchRef.current.startDistance);

      const nextEffective = Math.min(
        maxScaleRef.current * baseScaleRef.current,
        Math.max(
          minScaleRef.current * baseScaleRef.current,
          pinchRef.current.startScale * baseScaleRef.current * ratio,
        ),
      );
      const newScale = nextEffective / baseScaleRef.current;

      let newX = pinchRef.current.startX;
      let newY = pinchRef.current.startY;
      if (transformModeRef.current === 'zoom') {
        newX = midX / nextEffective - pinchRef.current.anchorWorld.x;
        newY = midY / nextEffective - pinchRef.current.anchorWorld.y;
      } else {
        newX = midX - pinchRef.current.anchorWorld.x * nextEffective;
        newY = midY - pinchRef.current.anchorWorld.y * nextEffective;
      }

      const next = { x: newX, y: newY, scale: newScale };
      cameraRef.current = next;
      zoomTargetRef.current = next;
      applyTransform(next);
      lastStateSyncRef.current = performance.now();
      setCameraState(next);
    };

    const handleTouchEnd = () => {
      pinchRef.current.active = false;
      touchPanRef.current.active = false;
    };

    const onTouchStart: EventListener = (event) => handleTouchStart(event as TouchEvent);
    const onTouchMove: EventListener = (event) => handleTouchMove(event as TouchEvent);
    const onTouchEnd: EventListener = () => handleTouchEnd();
    const onTouchCancel: EventListener = () => handleTouchEnd();

    target.addEventListener('touchstart', onTouchStart, { passive: false });
    target.addEventListener('touchmove', onTouchMove, { passive: false });
    target.addEventListener('touchend', onTouchEnd);
    target.addEventListener('touchcancel', onTouchCancel);
    return () => {
      target.removeEventListener('touchstart', onTouchStart);
      target.removeEventListener('touchmove', onTouchMove);
      target.removeEventListener('touchend', onTouchEnd);
      target.removeEventListener('touchcancel', onTouchCancel);
    };
  }, [enabled, zoomEnabled, applyTransform, canStartPanAt, listenOnWindow]);

  // Keep cameraStartRef fresh when not panning
  useEffect(() => {
    if (!isPanning) {
      cameraStartRef.current = { x: cameraState.x, y: cameraState.y };
    }
  }, [isPanning, cameraState.x, cameraState.y]);

  return {
    cameraState,
    effectiveScale,
    containerRef,
    contentRef,
    isPanning,
    resetCamera,
    centerOn,
    setCameraState: setCamera,
    startPanAt: (clientX: number, clientY: number, button = 0) => {
      setIsPanning(true);
      panButtonRef.current = button;
      panStartRef.current = { x: clientX, y: clientY };
      const cur = cameraRef.current;
      cameraStartRef.current = { x: cur.x, y: cur.y };
      zoomTargetRef.current = { ...zoomTargetRef.current, x: cur.x, y: cur.y };
    },
    endPan: () => {
      setIsPanning(false);
      panButtonRef.current = null;
    },
  };
}
