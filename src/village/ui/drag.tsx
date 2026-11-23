// One pointer-driven drag layer for cards and buildings (mouse, pen and touch).
// A press that doesn't move is a tap; a drag drops on the element under the
// pointer that carries data-drop="<kind>" (and data-index when it matters).
import { createContext, useCallback, useContext, useEffect, useRef, useState, type PointerEvent as RPointerEvent, type ReactNode } from 'react';

export interface DragPayload {
  kind: string;
  id: string | number;
  ghost: ReactNode;
  /** Ghost size in px, so it can be centred under the pointer. */
  width: number;
  height: number;
}

type DropHandler = (payload: DragPayload, target: { drop: string; index: number }) => void;
type TapHandler = (payload: DragPayload) => void;

interface DragApi {
  begin: (e: RPointerEvent, payload: DragPayload, onDrop: DropHandler, onTap?: TapHandler) => void;
  dragging: DragPayload | null;
  over: { drop: string; index: number } | null;
}

const Ctx = createContext<DragApi | null>(null);
const MOVE_THRESHOLD = 6;

function targetAt(x: number, y: number): { drop: string; index: number } | null {
  const el = document.elementFromPoint(x, y)?.closest<HTMLElement>('[data-drop]');
  if (!el) return null;
  return { drop: el.dataset.drop!, index: Number(el.dataset.index ?? -1) };
}

export function DragLayer({ children }: { children: ReactNode }) {
  const [dragging, setDragging] = useState<DragPayload | null>(null);
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const [over, setOver] = useState<{ drop: string; index: number } | null>(null);
  const session = useRef<{ start: { x: number; y: number }; payload: DragPayload; moved: boolean; onDrop: DropHandler; onTap?: TapHandler; pointerId: number } | null>(null);

  const begin = useCallback<DragApi['begin']>((e, payload, onDrop, onTap) => {
    if (e.button !== 0 && e.pointerType === 'mouse') return;
    e.preventDefault();
    session.current = { start: { x: e.clientX, y: e.clientY }, payload, moved: false, onDrop, onTap, pointerId: e.pointerId };
  }, []);

  useEffect(() => {
    const move = (e: PointerEvent) => {
      const s = session.current;
      if (!s || e.pointerId !== s.pointerId) return;
      if (!s.moved && Math.hypot(e.clientX - s.start.x, e.clientY - s.start.y) < MOVE_THRESHOLD) return;
      if (!s.moved) { s.moved = true; setDragging(s.payload); }
      setPos({ x: e.clientX, y: e.clientY });
      setOver(targetAt(e.clientX, e.clientY));
    };
    const up = (e: PointerEvent) => {
      const s = session.current;
      if (!s || e.pointerId !== s.pointerId) return;
      session.current = null;
      if (s.moved) {
        const t = targetAt(e.clientX, e.clientY);
        if (t) s.onDrop(s.payload, t);
      } else s.onTap?.(s.payload);
      setDragging(null);
      setOver(null);
    };
    const cancel = () => { session.current = null; setDragging(null); setOver(null); };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', cancel);
    return () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', cancel);
    };
  }, []);

  return (
    <Ctx.Provider value={{ begin, dragging, over }}>
      {children}
      {dragging && (
        <div className="vg-ghost" style={{ left: pos.x - dragging.width / 2, top: pos.y - dragging.height * 0.4, width: dragging.width, height: dragging.height }}>
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
