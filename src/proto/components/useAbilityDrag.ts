import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';

/**
 * Drag an actor's ability card onto a foe, by mouse or touch through the same
 * pointer path. A tap (or Enter) arms the card instead; tapping a foe then
 * spends it. `aim.foeId` is the foe under the pointer (or focused while armed),
 * for the preview.
 */
export type AbilityAim = { actorId: string; foeId: string | null; mode: 'drag' | 'armed'; x: number; y: number };

const DRAG_START_PX = 6;

/** The targetable foe under a screen point, if any. */
const foeAt = (x: number, y: number) => {
  for (const element of document.elementsFromPoint(x, y)) {
    const target = (element as HTMLElement).closest<HTMLElement>('[data-battle-target][data-targetable="true"]');
    if (target) return target.dataset.battleTarget ?? null;
  }
  return null;
};

export function useAbilityDrag(onSpend: (actorId: string, foeId: string) => void) {
  const [aim, setAim] = useState<AbilityAim | null>(null);
  const press = useRef<{ actorId: string; pointerId: number; x: number; y: number; moved: boolean } | null>(null);
  const spend = useRef(onSpend); spend.current = onSpend;
  useEffect(() => {
    if (!aim) return;
    const key = (event: KeyboardEvent) => { if (event.key === 'Escape') { event.stopPropagation(); setAim(null); } };
    window.addEventListener('keydown', key, true);
    return () => window.removeEventListener('keydown', key, true);
  }, [aim]);

  const toggleArmed = (actorId: string) => setAim((current) => current?.mode === 'armed' && current.actorId === actorId ? null : { actorId, foeId: null, mode: 'armed', x: 0, y: 0 });

  /** Props for the ability card. */
  const cardProps = (actorId: string, enabled: boolean) => ({
    onPointerDown: (event: ReactPointerEvent<HTMLElement>) => {
      if (!enabled || (event.pointerType === 'mouse' && event.button !== 0)) return;
      event.currentTarget.setPointerCapture(event.pointerId);
      press.current = { actorId, pointerId: event.pointerId, x: event.clientX, y: event.clientY, moved: false };
    },
    onPointerMove: (event: ReactPointerEvent<HTMLElement>) => {
      const current = press.current;
      if (!current || current.pointerId !== event.pointerId) return;
      if (!current.moved && Math.hypot(event.clientX - current.x, event.clientY - current.y) < DRAG_START_PX) return;
      current.moved = true;
      setAim({ actorId, foeId: foeAt(event.clientX, event.clientY), mode: 'drag', x: event.clientX, y: event.clientY });
    },
    onPointerUp: (event: ReactPointerEvent<HTMLElement>) => {
      const current = press.current;
      if (!current || current.pointerId !== event.pointerId) return;
      press.current = null;
      if (!current.moved) { toggleArmed(actorId); return; }
      const foeId = foeAt(event.clientX, event.clientY);
      setAim(null);
      if (foeId) spend.current(actorId, foeId);
    },
    onPointerCancel: () => { press.current = null; setAim((current) => (current?.mode === 'drag' ? null : current)); },
    // Pointer presses are handled above; keyboard activation arrives as a detail-0 click.
    onClick: (event: { detail: number }) => { if (enabled && event.detail === 0) toggleArmed(actorId); },
  });

  /** Props for a foe while an ability is armed: hover or focus previews, a press spends. */
  const foeProps = (foeId: string) => ({
    onPointerEnter: () => setAim((current) => (current?.mode === 'armed' ? { ...current, foeId } : current)),
    onPointerLeave: () => setAim((current) => (current?.mode === 'armed' && current.foeId === foeId ? { ...current, foeId: null } : current)),
    onFocus: () => setAim((current) => (current?.mode === 'armed' ? { ...current, foeId } : current)),
    onClick: () => {
      const current = aim;
      if (current?.mode !== 'armed') return;
      setAim(null);
      spend.current(current.actorId, foeId);
    },
  });

  return { aim, cardProps, foeProps, cancel: () => setAim(null) };
}
