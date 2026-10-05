import { useEffect, useRef, useState, type MutableRefObject, type PointerEvent, type ReactNode, type WheelEvent } from 'react';

type Point = { x: number; y: number };
export type Camera = Point & { scale: number };
type Viewport = { width: number; height: number };
export type CanvasTarget = { xRatio: number; yRatio: number; label: string; elementRef?: MutableRefObject<HTMLElement | null> };

export const MIN_SCALE = .65 / 3;
const MAX_SCALE = 2.35;
const HEARTH_BEACON_SCALE = .85;
const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
export const shouldPanWithPointers = (pointerType: string, count: number) => pointerType !== 'touch' || count >= 2;
/** Both auxiliary mouse buttons are camera gestures; primary click stays for play. */
export const isMousePanButton = (button: number) => button === 1 || button === 2;
export const shouldShowTargetBeacon = (scale: number, hasOffscreenIndicator: boolean) => scale < HEARTH_BEACON_SCALE && !hasOffscreenIndicator;

export function getOffscreenTargetIndicator(camera: Camera, viewport: Viewport, target: CanvasTarget) {
  const targetPoint = { x: camera.x + viewport.width * target.xRatio * camera.scale, y: camera.y + viewport.height * target.yRatio * camera.scale };
  // Keep the offscreen affordance clear of a target that is only just beyond the edge.
  // This avoids the arrow obscuring a partially visible card at the viewport boundary.
  const inset = 72;
  const isOffscreen = targetPoint.x < inset || targetPoint.x > viewport.width - inset || targetPoint.y < inset || targetPoint.y > viewport.height - inset;
  if (!isOffscreen) return null;
  const x = clamp(targetPoint.x, inset, viewport.width - inset);
  const y = clamp(targetPoint.y, inset, viewport.height - inset);
  return { x, y, angle: Math.atan2(targetPoint.y - y, targetPoint.x - x) * 180 / Math.PI };
}

const getRenderedTargetPoint = (camera: Camera, viewport: Viewport, target: CanvasTarget, canvas: HTMLElement | null): Point => {
  const targetRect = target.elementRef?.current?.getBoundingClientRect();
  const canvasRect = canvas?.getBoundingClientRect();
  if (targetRect && canvasRect) return { x: targetRect.left - canvasRect.left + targetRect.width / 2, y: targetRect.top - canvasRect.top + targetRect.height / 2 };
  return { x: camera.x + viewport.width * target.xRatio * camera.scale, y: camera.y + viewport.height * target.yRatio * camera.scale };
};

/** Lightweight Pointer Events camera: two-finger touch pan/pinch, middle/right-mouse pan, and wheel zoom. */
export function PannableCanvas({ children, target, worldRef, onCameraChange }: { children: ReactNode; target?: CanvasTarget; worldRef?: MutableRefObject<HTMLDivElement | null>; onCameraChange?: (camera: Camera) => void }) {
  const [camera, setCamera] = useState<Camera>({ x: 0, y: 0, scale: 1 });
  const [isPanning, setIsPanning] = useState(false);
  const [viewport, setViewport] = useState<Viewport>({ width: 0, height: 0 });
  const canvasRef = useRef<HTMLElement | null>(null);
  const pointers = useRef(new Map<number, Point>());
  const previousCenter = useRef<Point | null>(null);
  const previousDistance = useRef<number | null>(null);
  const suppressClick = useRef(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const updateViewport = () => { const { width, height } = canvas.getBoundingClientRect(); setViewport({ width, height }); };
    updateViewport();
    const observer = new ResizeObserver(updateViewport);
    observer.observe(canvas);
    return () => observer.disconnect();
  }, []);
  useEffect(() => { onCameraChange?.(camera); }, [camera, onCameraChange]);

  const zoomAt = (point: Point, nextScale: number) => setCamera((current) => {
    const scale = clamp(nextScale, MIN_SCALE, MAX_SCALE);
    const worldX = (point.x - current.x) / current.scale;
    const worldY = (point.y - current.y) / current.scale;
    return { scale, x: point.x - worldX * scale, y: point.y - worldY * scale };
  });
  const pair = () => [...pointers.current.values()].slice(0, 2);
  const centerOf = ([a, b]: Point[]) => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });
  const distanceOf = ([a, b]: Point[]) => Math.hypot(a.x - b.x, a.y - b.y);
  const pointFor = (event: PointerEvent<HTMLElement> | WheelEvent<HTMLElement>): Point => {
    const bounds = event.currentTarget.getBoundingClientRect();
    return { x: event.clientX - bounds.left, y: event.clientY - bounds.top };
  };
  const onPointerDown = (event: PointerEvent<HTMLElement>) => {
    if (event.pointerType === 'mouse' && !isMousePanButton(event.button)) return;
    const point = pointFor(event);
    pointers.current.set(event.pointerId, point);
    // A single touch remains available to cards. Only a second touch claims the
    // gesture for camera movement, avoiding accidental board pans while playing.
    if (!shouldPanWithPointers(event.pointerType, pointers.current.size)) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    setIsPanning(true);
    if (pointers.current.size === 1) previousCenter.current = point;
    if (pointers.current.size >= 2) { const points = pair(); previousCenter.current = centerOf(points); previousDistance.current = distanceOf(points); }
  };
  const onPointerMove = (event: PointerEvent<HTMLElement>) => {
    if (!pointers.current.has(event.pointerId)) return;
    const point = pointFor(event);
    pointers.current.set(event.pointerId, point);
    if (!shouldPanWithPointers(event.pointerType, pointers.current.size)) return;
    if (pointers.current.size >= 2) {
      event.preventDefault();
      const points = pair(); const center = centerOf(points); const distance = distanceOf(points);
      if (previousCenter.current && previousDistance.current) {
        const factor = distance / previousDistance.current;
        setCamera((current) => {
          const scale = clamp(current.scale * factor, MIN_SCALE, MAX_SCALE);
          const worldX = (previousCenter.current!.x - current.x) / current.scale;
          const worldY = (previousCenter.current!.y - current.y) / current.scale;
          return { scale, x: center.x - worldX * scale, y: center.y - worldY * scale };
        });
        if (event.pointerType !== 'mouse' || (event.buttons & 1)) suppressClick.current = true;
      }
      previousCenter.current = center; previousDistance.current = distance;
      return;
    }
    if (previousCenter.current) {
      const dx = point.x - previousCenter.current.x; const dy = point.y - previousCenter.current.y;
      if (Math.hypot(dx, dy) > 1) { setCamera((current) => ({ ...current, x: current.x + dx, y: current.y + dy })); if (event.pointerType !== 'mouse' || (event.buttons & 1)) suppressClick.current = true; }
      previousCenter.current = point;
    }
  };
  const onPointerEnd = (event: PointerEvent<HTMLElement>) => {
    pointers.current.delete(event.pointerId);
    if (!pointers.current.size) { previousCenter.current = null; previousDistance.current = null; setIsPanning(false); return; }
    if (event.pointerType === 'touch' && pointers.current.size < 2) { previousCenter.current = null; previousDistance.current = null; setIsPanning(false); return; }
    if (pointers.current.size === 1) { previousCenter.current = [...pointers.current.values()][0]; previousDistance.current = null; }
  };
  const onWheel = (event: WheelEvent<HTMLElement>) => { event.preventDefault(); zoomAt(pointFor(event), camera.scale * (event.deltaY < 0 ? 1.12 : .89)); };
  const targetPoint = target ? getRenderedTargetPoint(camera, viewport, target, canvasRef.current) : null;
  const indicator = target && targetPoint ? getOffscreenTargetIndicator({ ...camera, x: targetPoint.x - viewport.width * target.xRatio * camera.scale, y: targetPoint.y - viewport.height * target.yRatio * camera.scale }, viewport, target) : null;
  const beacon = targetPoint && shouldShowTargetBeacon(camera.scale, !!indicator) ? targetPoint : null;
  return <section ref={canvasRef} className={`pannable-canvas ${isPanning ? 'is-panning' : ''}`} aria-label="Draggable and zoomable hearth canvas" onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerEnd} onPointerCancel={onPointerEnd} onWheel={onWheel} onClickCapture={(event) => { if (suppressClick.current) { event.preventDefault(); event.stopPropagation(); suppressClick.current = false; } }}>
    <div ref={worldRef} className="pannable-world" style={{ transform: `translate(${camera.x}px, ${camera.y}px) scale(${camera.scale})` }}>{children}</div>
    {indicator && <div className="canvas-target-indicator" data-testid="hearth-direction-indicator" style={{ left: indicator.x, top: indicator.y }} aria-label={`${target?.label} is offscreen`}><span style={{ transform: `rotate(${indicator.angle}deg)` }}>➤</span><b>{target?.label}</b></div>}
    {beacon && <div className="canvas-target-beacon" data-testid="hearth-zoom-beacon" style={{ left: beacon.x, top: beacon.y }} aria-label={`${target!.label} beacon`}><span>♨</span><b>{target!.label}</b></div>}
  </section>;
}
