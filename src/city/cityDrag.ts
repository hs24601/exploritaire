/**
 * Minimal pointer drag-and-drop for the city table (mouse and touch). A drag shows a ghost of the source element;
 * releasing over an element carrying data-drop calls onDrop with that key. A press without movement is a tap.
 */
import type { PointerEvent as ReactPointerEvent } from 'react';

type DragOptions = { onDrop: (key: string) => void; onTap?: () => void; disabled?: boolean };

export function startDrag(e: ReactPointerEvent<HTMLElement>, { onDrop, onTap, disabled }: DragOptions) {
  if (disabled || e.button !== 0) return;
  const source = e.currentTarget;
  const startX = e.clientX, startY = e.clientY;
  const pointer = e.pointerId;
  let ghost: HTMLElement | null = null, over: HTMLElement | null = null, offX = 0, offY = 0, scale = 1;
  e.preventDefault();

  const findDrop = (x: number, y: number) => {
    for (const el of document.elementsFromPoint(x, y)) {
      const hit = (el as HTMLElement).closest<HTMLElement>('[data-drop]');
      if (hit && !source.contains(hit)) return hit;
    }
    return null;
  };
  const move = (ev: PointerEvent) => {
    if (ev.pointerId !== pointer) return;
    if (!ghost && Math.hypot(ev.clientX - startX, ev.clientY - startY) < 6) return;
    if (!ghost) {
      const r = source.getBoundingClientRect();
      offX = startX - r.left; offY = startY - r.top;
      // Sources inside a scaled frame keep their look: size the ghost at layout size and scale it to match.
      scale = source.offsetWidth ? r.width / source.offsetWidth : 1;
      ghost = source.cloneNode(true) as HTMLElement;
      Object.assign(ghost.style, { position: 'fixed', left: '0', top: '0', width: `${source.offsetWidth || r.width}px`, height: `${source.offsetHeight || r.height}px`, margin: '0', pointerEvents: 'none', zIndex: '9000', transformOrigin: '0 0' });
      ghost.classList.add('city-ghost');
      document.body.append(ghost);
      source.classList.add('city-drag-source');
    }
    ghost.style.transform = `translate(${ev.clientX - offX}px, ${ev.clientY - offY}px) scale(${scale})`;
    const hit = findDrop(ev.clientX, ev.clientY);
    if (hit !== over) { over?.classList.remove('city-drop-over'); hit?.classList.add('city-drop-over'); over = hit; }
  };
  const finish = (ev: PointerEvent, cancelled: boolean) => {
    if (ev.pointerId !== pointer) return;
    removeEventListener('pointermove', move); removeEventListener('pointerup', up); removeEventListener('pointercancel', cancel);
    over?.classList.remove('city-drop-over');
    source.classList.remove('city-drag-source');
    if (!ghost) { if (!cancelled) onTap?.(); return; }
    ghost.remove();
    const hit = cancelled ? null : findDrop(ev.clientX, ev.clientY);
    if (hit?.dataset.drop) onDrop(hit.dataset.drop);
  };
  const up = (ev: PointerEvent) => finish(ev, false);
  const cancel = (ev: PointerEvent) => finish(ev, true);
  addEventListener('pointermove', move); addEventListener('pointerup', up); addEventListener('pointercancel', cancel);
}
