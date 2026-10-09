import { useState, useCallback, useEffect, useRef } from 'react';
import { CameraInteractionLock } from './cameraInteractionLock';

export interface CameraState {
  x: number;
  y: number;
  scale: number;
  /** Spin about the viewport centre, degrees clockwise on screen. The content
   * transform is rotate(yaw) translate(x, y) scale(scale), so x and y are in
   * the spun frame and a pan still follows the pointer at any angle. */
  yaw?: number;
}

/** Rotates a vector by `deg` degrees, clockwise on screen (CSS rotate()). */
export const rotateVector = (vector: { x: number; y: number }, deg: number) => {
  if (!deg) return { x: vector.x, y: vector.y };
  const radians = (deg * Math.PI) / 180;
  const c = Math.cos(radians), s = Math.sin(radians);
  return { x: vector.x * c - vector.y * s, y: vector.x * s + vector.y * c };
};

/** Degrees of spin per pixel of a right- or middle-button drag. */
const SPIN_DEG_PER_PX = 0.4;
/** How long a stepped or reset spin eases for. */
const SPIN_EASE_MS = 320;

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
  /** Content whose transform origin is the viewport center; zoom around that center. */
  centeredZoom?: boolean;
  /** Content-to-screen pan ratio per axis, e.g. for a camera-tilted table plane. Default 1. */
  panScale?: { x: number; y: number } | ((camera: CameraState) => { x: number; y: number });
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
  /** The camera as drawn this frame. `cameraState` only catches up every
   * 50-80 ms while the camera moves, to spare React renders. */
  getLiveCamera: () => CameraState;
  /** Calls `listener` every frame the camera moves; returns the unsubscribe. */
  onCameraFrame: (listener: (state: CameraState) => void) => () => void;
  /** Spins the camera to `yaw` degrees, easing unless `animate` is false. */
  spinTo: (yaw: number, animate?: boolean) => void;
  /** Spins to the next multiple of `step` degrees in its direction (eased). */
  spinStep: (step: number) => void;
  /** Pans as a screen drag of (dx, dy) px would, at any spin and tilt. */
  panBy: (dx: number, dy: number) => void;
  /** Brings `cameraState` up to the live camera. */
  syncCamera: () => void;
}

const DEFAULT_CAMERA: CameraState = { x: 0, y: 0, scale: 1, yaw: 0 };

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
    centeredZoom = false,
    panScale,
  } = options;

  const initial = { ...DEFAULT_CAMERA, ...initialState };
  const [cameraState, setCameraState] = useState<CameraState>(initial);
  const effectiveScale = cameraState.scale * baseScale;
  const [isPanning, setIsPanning] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const objectGestureRef = useRef(new CameraInteractionLock());
  const suppressClickRef = useRef(false);

  // A ground tile can be tapped or used to move the camera. Consume the click
  // following a camera drag before it can activate the tile beneath release.
  useEffect(() => {
    if (!enabled) return;
    const container = containerRef.current;
    if (!container) return;
    const down = () => { suppressClickRef.current = false; };
    const click = (event: MouseEvent) => {
      if (event.detail === 0 || !suppressClickRef.current) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      suppressClickRef.current = false;
    };
    container.addEventListener('pointerdown', down, true);
    container.addEventListener('click', click, true);
    return () => {
      container.removeEventListener('pointerdown', down, true);
      container.removeEventListener('click', click, true);
    };
  }, [enabled]);

  const isCameraInteractiveTarget = (target: EventTarget | null) =>
    target instanceof Element && Boolean(target.closest('[data-camera-ignore="true"], [draggable="true"], [data-component="playing-card"]'));

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
    /** Where the fingers' midpoint started, for the pan that rides along. */
    startMid: { x: number; y: number };
  }>({
    active: false,
    startMid: { x: 0, y: 0 },
    startDistance: 0,
    startScale: 1,
    startX: 0,
    startY: 0,
    anchorWorld: { x: 0, y: 0 },
  });
  /** Three or more fingers: the camera's spin and each finger's angle about their centre when they landed. */
  const twistRef = useRef<{ startYaw: number; angles: Map<number, number> } | null>(null);
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
  const panScaleRef = useRef(panScale ?? { x: 1, y: 1 });
  panScaleRef.current = panScale ?? { x: 1, y: 1 };
  const livePanScale = () => typeof panScaleRef.current === 'function' ? panScaleRef.current(cameraRef.current) : panScaleRef.current;

  const frameListenersRef = useRef(new Set<(state: CameraState) => void>());
  const onCameraFrame = useCallback((listener: (state: CameraState) => void) => {
    frameListenersRef.current.add(listener);
    return () => { frameListenersRef.current.delete(listener); };
  }, []);
  const getLiveCamera = useCallback(() => cameraRef.current, []);

  const applyTransform = useCallback((state: CameraState) => {
    const el = contentRef.current;
    if (!el) return;
    const scale = state.scale * baseScaleRef.current;
    const yaw = state.yaw ?? 0;
    // scale3d so pieces standing up out of a tilted plane zoom with it instead of keeping their height.
    const transform = `rotate(${yaw}deg) translate3d(${state.x}px, ${state.y}px, 0) scale3d(${scale}, ${scale}, ${scale})`;
    el.style.transform = transform;
    const container = containerRef.current;
    if (container) {
      container.style.setProperty('--camera-transform', transform);
      // Live camera for layers that follow the table, e.g. the floor grid and
      // light shafts; pieces counter-rotate by --camera-yaw to face the camera.
      container.style.setProperty('--camera-x', `${state.x}px`);
      container.style.setProperty('--camera-y', `${state.y}px`);
      container.style.setProperty('--camera-scale', `${scale}`);
      container.style.setProperty('--camera-yaw', `${yaw}deg`);
      // Screen x of the table's origin offset, once spun.
      container.style.setProperty('--camera-sx', `${rotateVector(state, yaw).x}px`);
    }
    // Camera variables belong to this viewport. Publishing them on the document
    // invalidates styles for the entire game on every rotation frame.
    frameListenersRef.current.forEach((listener) => listener(state));
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
    if (objectGestureRef.current.locked) return;
    if (rafRef.current) return;
    animatingRef.current = true;

    const tick = () => {
      if (!animatingRef.current || objectGestureRef.current.locked) {
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
        // The zoom target carries no spin; keep the live one.
        const settled = { ...prev, x: target.x, y: target.y, scale: target.scale };
        cameraRef.current = settled;
        applyTransform(settled);
        lastStateSyncRef.current = performance.now();
        setCameraState(settled);
        rafRef.current = 0;
        return;
      }

      const next: CameraState = {
        ...prev,
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

  // Capture before native camera listeners or React drag handlers run. Merely
  // stopping React pointer propagation cannot stop touch listeners or queued zoom.
  useEffect(() => {
    if (!enabled) return;
    const freeze = () => {
      panButtonRef.current = null;
      pinchRef.current.active = false;
      touchPanRef.current.active = false;
      setIsPanning(false);
      animatingRef.current = false;
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = 0;
      wheelDeltaRef.current = 0;
      wheelAnchorRef.current = null;
      zoomTargetRef.current = { ...cameraRef.current };
      setCameraState(cameraRef.current);
    };
    const down = (event: PointerEvent) => {
      // Pieces only take the left button; the others spin the camera over them.
      if (event.pointerType === 'mouse' && event.button !== 0) return;
      if (!isCameraInteractiveTarget(event.target) && !objectGestureRef.current.locked) return;
      objectGestureRef.current.beginPointer(event.pointerId);
      freeze();
    };
    const up = (event: PointerEvent) => objectGestureRef.current.endPointer(event.pointerId);
    const drag = (event: DragEvent) => {
      if (!isCameraInteractiveTarget(event.target)) return;
      objectGestureRef.current.beginNativeDrag();
      freeze();
    };
    const clear = () => objectGestureRef.current.clear();
    document.addEventListener('pointerdown', down, true);
    document.addEventListener('pointerup', up, true);
    document.addEventListener('pointercancel', up, true);
    document.addEventListener('dragstart', drag, true);
    document.addEventListener('dragend', clear, true);
    document.addEventListener('drop', clear, true);
    window.addEventListener('blur', clear);
    return () => {
      document.removeEventListener('pointerdown', down, true);
      document.removeEventListener('pointerup', up, true);
      document.removeEventListener('pointercancel', up, true);
      document.removeEventListener('dragstart', drag, true);
      document.removeEventListener('dragend', clear, true);
      document.removeEventListener('drop', clear, true);
      window.removeEventListener('blur', clear);
      clear();
    };
  }, [enabled]);

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
    if (objectGestureRef.current.locked) return;
    const state = { ...DEFAULT_CAMERA };
    if (spinRafRef.current) cancelAnimationFrame(spinRafRef.current);
    spinRafRef.current = 0;
    zoomTargetRef.current = state;
    cameraRef.current = state;
    animatingRef.current = false;
    applyTransform(state);
    lastStateSyncRef.current = performance.now();
    setCameraState(state);
  }, [applyTransform]);

  const centerOn = useCallback((element: HTMLElement | null) => {
    if (objectGestureRef.current.locked) return;
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
    if (objectGestureRef.current.locked) return;
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
  // Spin: live transforms and subscribed drawing layers follow every frame;
  // React catches up when the gesture or animation settles.
  // ---------------------------------------------------------------------------
  const spinRafRef = useRef(0);
  const spinTargetRef = useRef(0);
  const setYawNow = useCallback((yaw: number, settled = true) => {
    const next = { ...cameraRef.current, yaw };
    cameraRef.current = next;
    applyTransform(next);
    const now = performance.now();
    if (settled) {
      lastStateSyncRef.current = now;
      setCameraState(next);
    }
  }, [applyTransform]);
  const spinTo = useCallback((target: number, animate = true) => {
    if (objectGestureRef.current.locked) return;
    if (spinRafRef.current) cancelAnimationFrame(spinRafRef.current);
    spinRafRef.current = 0;
    spinTargetRef.current = target;
    const from = cameraRef.current.yaw ?? 0;
    const reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
    if (!animate || reducedMotion || Math.abs(target - from) < 0.01) { setYawNow(target); return; }
    const startedAt = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - startedAt) / SPIN_EASE_MS);
      const eased = t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2;
      setYawNow(from + (target - from) * eased, t === 1);
      spinRafRef.current = t < 1 ? requestAnimationFrame(tick) : 0;
    };
    spinRafRef.current = requestAnimationFrame(tick);
  }, [setYawNow]);
  /** A step lands on the next multiple of `step` past the current angle (or
   * the one it is easing toward), so repeated presses keep a clean grid. */
  const spinStep = useCallback((step: number) => {
    const from = spinRafRef.current ? spinTargetRef.current : cameraRef.current.yaw ?? 0;
    const target = step > 0 ? Math.floor(from / step + 1e-6) * step + step : Math.ceil(from / -step - 1e-6) * -step + step;
    spinTargetRef.current = target;
    spinTo(target);
  }, [spinTo]);
  useEffect(() => () => { if (spinRafRef.current) cancelAnimationFrame(spinRafRef.current); }, []);
  /** Moves the table by a screen drag of (dx, dy) px, the way a pointer pan
   * would at the current spin and tilt. */
  const panBy = useCallback((dx: number, dy: number) => {
    if (objectGestureRef.current.locked) return;
    const delta = rotateVector({ x: dx * livePanScale().x, y: dy * livePanScale().y }, -(cameraRef.current.yaw ?? 0));
    const next = { ...cameraRef.current, x: cameraRef.current.x + delta.x, y: cameraRef.current.y + delta.y };
    cameraRef.current = next;
    zoomTargetRef.current = { ...zoomTargetRef.current, x: next.x, y: next.y };
    applyTransform(next);
    const now = performance.now();
    if (now - lastStateSyncRef.current > 50) {
      lastStateSyncRef.current = now;
      setCameraState(next);
    }
  }, [applyTransform]);
  /** Brings React state up to the live camera, e.g. when a keyboard pan stops. */
  const syncCamera = useCallback(() => setCameraState(cameraRef.current), []);

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
      if (objectGestureRef.current.locked) { e.preventDefault(); return; }
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
      // The wheel zooms over pieces too: grabbing a piece is a press, not a wheel.
      e.preventDefault();

      const mouseX = centeredZoom ? 0 : e.clientX - rect.left;
      const mouseY = centeredZoom ? 0 : e.clientY - rect.top;

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
      const next = { ...display, x: newX, y: newY, scale: newScale };
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
  }, [enabled, minScale, maxScale, zoomSensitivity, baseScale, startAnimation, canStartPanAt, centeredZoom]);

  // ---------------------------------------------------------------------------
  // Left-mouse-button pan; right or middle button spins
  // ---------------------------------------------------------------------------
  const mouseSpinRef = useRef<{ pointerId: number; startX: number; startYaw: number; moved: boolean } | null>(null);
  const rightPanRef = useRef<{ x: number; y: number; moved: boolean } | null>(null);
  const menuStateRef = useRef<{ swallowUntil: number; held: { target: EventTarget; x: number; y: number } | null }>({ swallowUntil: 0, held: null });
  useEffect(() => {
    if (!enabled) return;
    const container = containerRef.current;
    if (!container) return;

    const handlePointerDown = (e: PointerEvent) => {
      if (objectGestureRef.current.locked) return;
      if (e.pointerType !== 'mouse') return;
      // A sideways drag with the middle button spins the camera, over pieces
      // too (they only take the left button).
      if (e.button === 1) {
        e.preventDefault();
        if (spinRafRef.current) cancelAnimationFrame(spinRafRef.current);
        spinRafRef.current = 0;
        mouseSpinRef.current = { pointerId: e.pointerId, startX: e.clientX, startYaw: cameraRef.current.yaw ?? 0, moved: false };
        return;
      }
      // The left button pans from empty table; the right button pans from
      // anywhere, pieces included.
      if (e.button === 0 && (isCameraInteractiveTarget(e.target) || (canStartPanAt && !canStartPanAt(e.clientX, e.clientY)))) return;
      if (e.button !== 0 && e.button !== 2) return;
      e.preventDefault();
      rightPanRef.current = e.button === 2 ? { x: e.clientX, y: e.clientY, moved: false } : null;

      setIsPanning(true);
      panButtonRef.current = e.button;
      panStartRef.current = { x: e.clientX, y: e.clientY };
      const cur = cameraRef.current;
      cameraStartRef.current = { x: cur.x, y: cur.y };
      // Keep target in sync so animation doesn't fight the pan
      zoomTargetRef.current = { ...zoomTargetRef.current, x: cur.x, y: cur.y };
    };

    const handlePointerMove = (e: PointerEvent) => {
      if (objectGestureRef.current.locked) return;
      const spin = mouseSpinRef.current;
      if (spin && spin.pointerId === e.pointerId) {
        const dx = e.clientX - spin.startX;
        if (Math.abs(dx) > 3) spin.moved = true;
        if (spin.moved) {
          suppressClickRef.current = true;
          setYawNow(spin.startYaw + dx * SPIN_DEG_PER_PX, false);
        }
        return;
      }
      if (!isPanning) return;
      if (Math.hypot(e.clientX - panStartRef.current.x, e.clientY - panStartRef.current.y) > 3) {
        suppressClickRef.current = true;
      }
      const right = rightPanRef.current;
      if (right && Math.hypot(e.clientX - right.x, e.clientY - right.y) > 3) right.moved = true;

      // The drag in the table's (tilted) plane, turned into the spun frame.
      const delta = rotateVector({
        x: (e.clientX - panStartRef.current.x) * livePanScale().x,
        y: (e.clientY - panStartRef.current.y) * livePanScale().y,
      }, -(cameraRef.current.yaw ?? 0));
      const newX = cameraStartRef.current.x + delta.x;
      const newY = cameraStartRef.current.y + delta.y;

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

    // A right-button pan must not open a context menu (the dev menu included).
    // Some platforms fire it on press, some after release: while the button
    // is held it waits, and a press that ends without a drag gets it back.
    // Refs, not locals: ending the pan re-renders and re-binds these handlers
    // before the menu event arrives.
    const menuState = menuStateRef.current;
    const handlePointerUp = (e: PointerEvent) => {
      const spin = mouseSpinRef.current;
      if (spin && spin.pointerId === e.pointerId) { mouseSpinRef.current = null; setYawNow(cameraRef.current.yaw ?? 0); }
      if (panButtonRef.current === e.button) {
        const right = rightPanRef.current;
        if (e.button === 2 && right?.moved) menuState.swallowUntil = performance.now() + 400;
        rightPanRef.current = null;
        setIsPanning(false);
        panButtonRef.current = null;
        const menu = menuState.held;
        menuState.held = null;
        if (menu && right && !right.moved) menu.target.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true, clientX: menu.x, clientY: menu.y, button: 2 }));
      }
    };
    const handleContextMenu = (e: MouseEvent) => {
      if (!e.isTrusted) return;
      if (rightPanRef.current) {
        if (!rightPanRef.current.moved && e.target) menuState.held = { target: e.target, x: e.clientX, y: e.clientY };
        e.preventDefault();
        e.stopImmediatePropagation();
      } else if (performance.now() < menuState.swallowUntil) {
        e.preventDefault();
        e.stopImmediatePropagation();
      }
    };
    // Prevent the middle button's autoscroll/paste.
    const handleAuxClick = (e: MouseEvent) => {
      if (e.button === 1) e.preventDefault();
    };

    // Auxiliary buttons belong to the camera even when a piece stops bubbling.
    // Primary presses still respect object ownership and occupied grid squares.
    container.addEventListener('pointerdown', handlePointerDown, true);
    document.addEventListener('pointermove', handlePointerMove);
    document.addEventListener('pointerup', handlePointerUp);
    document.addEventListener('pointercancel', handlePointerUp);
    container.addEventListener('auxclick', handleAuxClick);
    window.addEventListener('contextmenu', handleContextMenu, true);

    return () => {
      container.removeEventListener('pointerdown', handlePointerDown, true);
      document.removeEventListener('pointermove', handlePointerMove);
      document.removeEventListener('pointerup', handlePointerUp);
      document.removeEventListener('pointercancel', handlePointerUp);
      container.removeEventListener('auxclick', handleAuxClick);
      window.removeEventListener('contextmenu', handleContextMenu, true);
    };
  }, [enabled, isPanning, setYawNow, canStartPanAt]);

  // ---------------------------------------------------------------------------
  // Touch: one finger pans, two pan and pinch-zoom, three or more spin
  // ---------------------------------------------------------------------------
  useEffect(() => {
    if (!enabled || !zoomEnabled) return;
    const container = containerRef.current;
    if (!container) return;
    const target: Window | HTMLDivElement = listenOnWindow ? window : container;

    const getDistance = (t1: Touch, t2: Touch) =>
      Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY);

    /** The fingers' centre, and each finger's angle about it, by touch id. */
    const centroid = (touches: TouchList) => {
      let x = 0, y = 0;
      for (const touch of Array.from(touches)) { x += touch.clientX; y += touch.clientY; }
      return { x: x / touches.length, y: y / touches.length };
    };
    const anglesAbout = (touches: TouchList, centre: { x: number; y: number }) =>
      new Map(Array.from(touches).map((touch) => [touch.identifier, (Math.atan2(touch.clientY - centre.y, touch.clientX - centre.x) * 180) / Math.PI]));
    const allInside = (touches: TouchList) => {
      const rect = container.getBoundingClientRect();
      return Array.from(touches).every((touch) => touch.clientX >= rect.left && touch.clientX <= rect.right && touch.clientY >= rect.top && touch.clientY <= rect.bottom);
    };

    /** Starts the gesture the fingers now on the glass make, from the camera
     * as it is: one finger pans, two pan and pinch-zoom together, three or
     * more spin. Called on every finger down or up, so changing the count
     * never jumps the camera. */
    const beginGesture = (touches: TouchList) => {
      touchPanRef.current.active = false;
      pinchRef.current.active = false;
      twistRef.current = null;
      const display = cameraRef.current;
      if (touches.length === 1) {
        const t = touches[0];
        if (canStartPanAt && !canStartPanAt(t.clientX, t.clientY)) return;
        // touch-action already disables scrolling; defer preventDefault to
        // movement so a stationary finger still produces the tile tap.
        touchPanRef.current = { active: true, startX: t.clientX, startY: t.clientY, camX: display.x, camY: display.y };
        return;
      }
      if (!allInside(touches)) return;
      if (touches.length === 2) {
        const rect = container.getBoundingClientRect();
        const t1 = touches[0], t2 = touches[1];
        const midX = centeredZoom ? 0 : (t1.clientX + t2.clientX) / 2 - rect.left;
        const midY = centeredZoom ? 0 : (t1.clientY + t2.clientY) / 2 - rect.top;
        const displayEffective = display.scale * baseScaleRef.current;
        const anchorWorld = transformModeRef.current === 'zoom'
          ? { x: midX / displayEffective - display.x, y: midY / displayEffective - display.y }
          : { x: (midX - display.x) / displayEffective, y: (midY - display.y) / displayEffective };
        pinchRef.current = {
          active: true,
          startDistance: getDistance(t1, t2),
          startScale: display.scale,
          startX: display.x,
          startY: display.y,
          anchorWorld,
          startMid: centroid(touches),
        };
        setIsPanning(false);
        return;
      }
      twistRef.current = { startYaw: display.yaw ?? 0, angles: anglesAbout(touches, centroid(touches)) };
      setIsPanning(false);
    };

    const handleTouchStart = (e: TouchEvent) => {
      if (objectGestureRef.current.locked) return;
      if (e.touches.length === 1 && isCameraInteractiveTarget(e.target)) return;
      beginGesture(e.touches);
    };

    const commit = (next: CameraState) => {
      cameraRef.current = next;
      zoomTargetRef.current = next;
      applyTransform(next);
      lastStateSyncRef.current = performance.now();
      setCameraState(next);
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (objectGestureRef.current.locked) { e.preventDefault(); return; }
      if (touchPanRef.current.active && e.touches.length === 1) {
        e.preventDefault();
        const t = e.touches[0];
        if (Math.hypot(t.clientX - touchPanRef.current.startX, t.clientY - touchPanRef.current.startY) > 3) {
          suppressClickRef.current = true;
        }
        // The drag in the table's (tilted) plane, turned into the spun frame.
        const delta = rotateVector({
          x: (t.clientX - touchPanRef.current.startX) * livePanScale().x,
          y: (t.clientY - touchPanRef.current.startY) * livePanScale().y,
        }, -(cameraRef.current.yaw ?? 0));
        commit({ ...cameraRef.current, x: touchPanRef.current.camX + delta.x, y: touchPanRef.current.camY + delta.y });
        return;
      }
      // Three or more fingers turning about their centre spin the camera.
      const twist = twistRef.current;
      if (twist && e.touches.length >= 3) {
        e.preventDefault();
        const now = anglesAbout(e.touches, centroid(e.touches));
        let sum = 0, count = 0;
        now.forEach((angle, id) => {
          const start = twist.angles.get(id);
          if (start === undefined) return;
          sum += ((angle - start + 540) % 360) - 180;
          count += 1;
        });
        if (count) {
          if (Math.abs(sum / count) > 1) suppressClickRef.current = true;
          setYawNow(twist.startYaw + sum / count, false);
        }
        return;
      }
      if (!pinchRef.current.active || e.touches.length !== 2) return;
      e.preventDefault();

      const rect = container.getBoundingClientRect();
      const t1 = e.touches[0];
      const t2 = e.touches[1];
      const pinch = pinchRef.current;
      const ratio = getDistance(t1, t2) / Math.max(1, pinch.startDistance);
      const mid = centroid(e.touches);
      if (Math.abs(ratio - 1) > .01 || Math.hypot(mid.x - pinch.startMid.x, mid.y - pinch.startMid.y) > 3) {
        suppressClickRef.current = true;
      }
      const nextEffective = Math.min(
        maxScaleRef.current * baseScaleRef.current,
        Math.max(minScaleRef.current * baseScaleRef.current, pinch.startScale * baseScaleRef.current * ratio),
      );
      const newScale = nextEffective / baseScaleRef.current;

      let newX: number, newY: number;
      if (centeredZoom) {
        // Zoom about the view centre, and pan with the fingers' midpoint.
        const k = newScale / pinch.startScale;
        const pan = rotateVector({
          x: (mid.x - pinch.startMid.x) * livePanScale().x,
          y: (mid.y - pinch.startMid.y) * livePanScale().y,
        }, -(cameraRef.current.yaw ?? 0));
        newX = pinch.startX * k + pan.x;
        newY = pinch.startY * k + pan.y;
      } else {
        // Anchored under the moving midpoint, which pans as it zooms.
        const midX = (t1.clientX + t2.clientX) / 2 - rect.left;
        const midY = (t1.clientY + t2.clientY) / 2 - rect.top;
        if (transformModeRef.current === 'zoom') {
          newX = midX / nextEffective - pinch.anchorWorld.x;
          newY = midY / nextEffective - pinch.anchorWorld.y;
        } else {
          newX = midX - pinch.anchorWorld.x * nextEffective;
          newY = midY - pinch.anchorWorld.y * nextEffective;
        }
      }
      commit({ ...cameraRef.current, x: newX, y: newY, scale: newScale });
    };

    // A finger lifted: carry on with the fingers left, from where the camera is.
    const handleTouchEnd = (e: TouchEvent) => {
      if (twistRef.current) setYawNow(cameraRef.current.yaw ?? 0);
      if (e.touches.length) beginGesture(e.touches);
      else {
        pinchRef.current.active = false;
        touchPanRef.current.active = false;
        twistRef.current = null;
      }
    };

    const onTouchStart: EventListener = (event) => handleTouchStart(event as TouchEvent);
    const onTouchMove: EventListener = (event) => handleTouchMove(event as TouchEvent);
    const onTouchEnd: EventListener = (event) => handleTouchEnd(event as TouchEvent);
    const onTouchCancel: EventListener = (event) => handleTouchEnd(event as TouchEvent);

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
  }, [enabled, zoomEnabled, applyTransform, canStartPanAt, listenOnWindow, centeredZoom, setYawNow]);

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
      if (objectGestureRef.current.locked) return;
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
    getLiveCamera,
    onCameraFrame,
    spinTo,
    spinStep,
    panBy,
    syncCamera,
  };
}
