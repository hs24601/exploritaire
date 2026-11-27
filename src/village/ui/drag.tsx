// One pointer-driven drag layer for cards and buildings (mouse, pen and touch).
// A press that doesn't move is a tap; a drag drops on the element under the
// pointer that carries data-drop="<kind>" (and data-index when it matters).
import { createContext, useCallback, useContext, useEffect, useRef, useState, type PointerEvent as RPointerEvent, type ReactNode } from 'react';

export interface DragPayload {
  kind: string;
  id: string | number;
  ghost: ReactNode;
  origin?: Element | null;
  /** Ghost size in px. Cards can place their upper-left corner at the pointer. */
  width: number;
  height: number;
  anchor?: 'top-left';
}

type DropHandler = (payload: DragPayload, target: { drop: string; index: number }) => void;
type TapHandler = (payload: DragPayload) => void;
type DragHold = { duration: number; onStart: () => void; onEnd: () => void; onHold: () => DragPayload };
type DragSession = { start: { x: number; y: number }; payload: DragPayload; anchor: Element; origin?: Element; moved: boolean; held: boolean;
  onDrop: DropHandler; onTap?: TapHandler; pointerId: number; stopHold?: () => void };

interface DragApi {
  begin: (e: RPointerEvent, payload: DragPayload, onDrop: DropHandler, onTap?: TapHandler, hold?: DragHold) => void;
  dragging: DragPayload | null;
  over: { drop: string; index: number } | null;
}

const Ctx = createContext<DragApi | null>(null);
const MOVE_THRESHOLD = 6;

type DropResolver = (clientX: number, clientY: number) => { drop: string; index: number } | null;
const resolvers = new WeakMap<Element, DropResolver>();

/**
 * Lets one element answer drops itself (the isometric map's canvas works out the
 * tile under the pointer). Returns the cleanup.
 */
export function setDropResolver(el: Element, resolve: DropResolver): () => void {
  resolvers.set(el, resolve);
  return () => { if (resolvers.get(el) === resolve) resolvers.delete(el); };
}

function targetAt(x: number, y: number): { drop: string; index: number } | null {
  const under = document.elementFromPoint(x, y);
  const resolve = under && resolvers.get(under);
  if (resolve) return resolve(x, y);
  const el = under?.closest<HTMLElement>('[data-drop]');
  if (!el) return null;
  return { drop: el.dataset.drop!, index: Number(el.dataset.index ?? -1) };
}

export function DragLayer({ children }: { children: ReactNode }) {
  const [dragging, setDragging] = useState<DragPayload | null>(null);
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const [over, setOver] = useState<{ drop: string; index: number } | null>(null);
  const session = useRef<DragSession | null>(null);

  const begin = useCallback<DragApi['begin']>((e, payload, onDrop, onTap, hold) => {
    if ((e.button !== 0 && e.pointerType === 'mouse') || session.current) return;
    e.preventDefault();
    const current: DragSession = { start: { x: e.clientX, y: e.clientY }, payload, anchor: e.currentTarget, moved: false, held: false, onDrop, onTap, pointerId: e.pointerId };
    session.current = current;
    if (!hold) return;
    hold.onStart();
    const timer = window.setTimeout(() => {
      if (session.current !== current) return;
      current.held = true;
      current.payload = hold.onHold();
    }, hold.duration);
    current.stopHold = () => { window.clearTimeout(timer); current.stopHold = undefined; hold.onEnd(); };
  }, []);

  useEffect(() => {
    const move = (e: PointerEvent) => {
      const s = session.current;
      if (!s || e.pointerId !== s.pointerId) return;
      if (!s.moved && Math.hypot(e.clientX - s.start.x, e.clientY - s.start.y) < MOVE_THRESHOLD) return;
      if (!s.moved) {
        s.stopHold?.();
        s.moved = true;
        s.origin = s.payload.origin ?? s.anchor;
        s.origin.setAttribute('data-vg-drag-origin', '');
        setDragging(s.payload);
      }
      setPos({ x: e.clientX, y: e.clientY });
      setOver(targetAt(e.clientX, e.clientY));
    };
    const up = (e: PointerEvent) => {
      const s = session.current;
      if (!s || e.pointerId !== s.pointerId) return;
      session.current = null;
      s.stopHold?.();
      s.origin?.removeAttribute('data-vg-drag-origin');
      if (s.moved && !e.defaultPrevented) {
        const t = targetAt(e.clientX, e.clientY);
        if (t) s.onDrop(s.payload, t);
      } else if (!s.held && !e.defaultPrevented) s.onTap?.(s.payload);
      setDragging(null);
      setOver(null);
    };
    const clearSession = () => {
      session.current?.stopHold?.();
      session.current?.origin?.removeAttribute('data-vg-drag-origin');
      session.current = null;
    };
    const cancel = () => { clearSession(); setDragging(null); setOver(null); };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', cancel);
    window.addEventListener('blur', cancel);
    return () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', cancel);
      window.removeEventListener('blur', cancel);
      clearSession();
    };
  }, []);

  return (
    <Ctx.Provider value={{ begin, dragging, over }}>
      {children}
      {dragging && (
        <div className={`vg-ghost${dragging.anchor === 'top-left' ? ' is-corner-anchored' : ''}`} aria-hidden="true" style={{
          left: dragging.anchor === 'top-left' ? pos.x : pos.x - dragging.width / 2,
          top: dragging.anchor === 'top-left' ? pos.y : pos.y - dragging.height * 0.4,
          width: dragging.width, height: dragging.height,
        }}>
          {dragging.ghost}
        </div>
      )}
    </Ctx.Provider>
  );
}

export function useDrag(): DragApi {
  const api = useContext(Ctx);
  if (!api) throw new Error('useDrag needs a DragLayer');
  return api;
}
