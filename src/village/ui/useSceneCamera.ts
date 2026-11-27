import { useEffect, useRef, useState, type KeyboardEvent, type MouseEvent, type PointerEvent, type RefObject } from 'react';

type Point = { x: number; y: number };
const rest = { x: 0, y: 0, zoom: 1 };
const midpoint = (a: Point, b: Point) => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });
const distance = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y);
const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));
const keyPan: Partial<Record<string, [number, number]>> = { ArrowLeft: [50, 0], ArrowRight: [-50, 0], ArrowUp: [0, 50], ArrowDown: [0, -50] };

export function useSceneCamera(scene: RefObject<HTMLDivElement | null>, frame: string, mapMode = false, enabled = true) {
  const [manual, setManual] = useState<{ frame: string; x: number; y: number; zoom: number }>();
  const controls = useRef({ frame });
  controls.current.frame = frame;
  const pointers = useRef(new Map<number, Point>());
  const moved = useRef(false);
  const reset = () => setManual(undefined);
  useEffect(() => { setManual(previous => previous?.frame === frame ? previous : undefined); }, [frame]);
  const local = (x: number, y: number, el: HTMLDivElement) => {
    const bounds = el.getBoundingClientRect();
    return { x: x - bounds.left, y: y - bounds.top };
  };
  const update = (el: HTMLDivElement, start: Point, end: Point, factor = 1) => {
    const activeFrame = controls.current.frame;
    const { clientWidth: width, clientHeight: height } = el;
    setManual(previous => {
      const current = previous?.frame === activeFrame ? previous : rest;
      const zoom = clamp(current.zoom * factor, mapMode ? .3 : .55, 3);
      const ratio = zoom / current.zoom;
      return { frame: activeFrame, zoom,
        x: clamp(end.x - (start.x - current.x) * ratio, -width * zoom, width),
        y: clamp(end.y - (start.y - current.y) * ratio, -height * zoom, height) };
    });
  };
  useEffect(() => {
    const el = scene.current;
    if (!el || !enabled) return;
    const wheel = (event: WheelEvent) => {
      event.preventDefault();
      const anchor = local(event.clientX, event.clientY, el);
      const pixels = event.deltaY * (event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? el.clientHeight : 1);
      update(el, anchor, anchor, Math.exp(-pixels * .002));
    };
    const release = (event: globalThis.PointerEvent) => { pointers.current.delete(event.pointerId); };
    const cancel = () => { pointers.current.clear(); };
    el.addEventListener('wheel', wheel, { passive: false });
    window.addEventListener('pointerup', release);
    window.addEventListener('pointercancel', release);
    window.addEventListener('blur', cancel);
    return () => {
      el.removeEventListener('wheel', wheel);
      window.removeEventListener('pointerup', release);
      window.removeEventListener('pointercancel', release);
      window.removeEventListener('blur', cancel);
    };
  }, [scene, enabled]);

  const start = (event: PointerEvent<HTMLDivElement>) => {
    const points = pointers.current;
    if (!enabled || points.size >= 2) return;
    if (!points.size) moved.current = false;
    const target = event.target as Element;
    if (mapMode && event.button === 0) {
      if (event.pointerType === 'mouse' ? target.closest('.vg-map') : target.closest('.vg-party, .vg-standee')) return;
    } else if (event.button !== 0 && event.button !== 1 && !(mapMode && event.button === 2)) return;
    if (event.button !== 0) event.preventDefault();
    points.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (points.size === 2) {
      moved.current = true;
      for (const pointer of points.keys()) event.currentTarget.setPointerCapture(pointer);
    }
  };
  const move = (event: PointerEvent<HTMLDivElement>) => {
    const points = pointers.current;
    const previous = points.get(event.pointerId);
    if (!previous) return;
    const next = { x: event.clientX, y: event.clientY };
    if (!moved.current && distance(previous, next) < 6) return;
    const el = event.currentTarget;
    if (!el.hasPointerCapture(event.pointerId)) el.setPointerCapture(event.pointerId);
    moved.current = true;
    points.set(event.pointerId, next);
    const other = [...points].find(([id]) => id !== event.pointerId)?.[1];
    const from = other ? midpoint(previous, other) : previous;
    const to = other ? midpoint(next, other) : next;
    update(el, local(from.x, from.y, el), local(to.x, to.y, el),
      other ? distance(next, other) / Math.max(1, distance(previous, other)) : 1);
  };
  const end = (event: PointerEvent<HTMLDivElement>) => { pointers.current.delete(event.pointerId); };
  const click = (event: MouseEvent<HTMLDivElement>) => {
    if (!moved.current || event.detail === 0) return;
    moved.current = false;
    event.stopPropagation();
    event.preventDefault();
  };
  const key = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.currentTarget !== event.target) return;
    const el = event.currentTarget;
    const start = { x: el.clientWidth / 2, y: el.clientHeight / 2 };
    const offset = keyPan[event.key];
    if (offset) update(el, start, { x: start.x + offset[0], y: start.y + offset[1] });
    else if (event.key === '+' || event.key === '=') update(el, start, start, 1.2);
    else if (event.key === '-') update(el, start, start, 1 / 1.2);
    else if (event.key === 'Home') reset();
    else return;
    event.preventDefault();
  };
  return { manual: manual?.frame === frame ? manual : undefined, reset, handlers: {
    onPointerDown: start, onPointerMove: move, onPointerUp: end, onPointerCancel: end,
    onLostPointerCapture: (event: PointerEvent<HTMLDivElement>) => { if (event.target === event.currentTarget) end(event); },
    onClickCapture: click, onKeyDown: key,
  } };
}
