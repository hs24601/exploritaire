import { gameTime } from '../../gameTime';
import { chooseAbilityDropTarget, type AbilityDropTarget } from '../combatDropTargets';
import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';

/**
 * Drag an actor's ability card onto a living actor, by mouse or touch through the same
 * pointer path. Tray selection arms an ability; a card click can inspect it,
 * and pressing a target spends the armed ability. `aim.foeId` is the actor target overlapped by the card (or focused while armed),
 * for the preview.
 */
export type AbilityAim = { actorId: string; foeId: string | null; mode: 'drag' | 'armed'; x: number; y: number };

const DRAG_START_PX = 6;

/** Match the centered drag visual at the current pointer, including the first
 * move before its portal mounts. Preview and release share this hit test. */
const foeAt = (x: number, y: number) => {
  const visual = document.querySelector<HTMLElement>('.ability-card-drag .ability-card')?.getBoundingClientRect();
  const width = visual?.width || 150;
  const height = visual?.height || width * 88 / 63;
  // UI overlays must not act as a route to a slime behind them.
  const surface = document.elementFromPoint(x, y);
  if (surface?.closest('.proto-world-minimap, .combat-demo__tools')) return null;
  const targets: AbilityDropTarget[] = [];
  for (const target of document.querySelectorAll<HTMLElement>('[data-battle-target][data-targetable="true"], [data-scene-target][data-targetable="true"]')) {
    const rect = target.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) continue;
    targets.push({ id: (target.dataset.battleTarget ?? target.dataset.sceneTarget)!, left: rect.left, top: rect.top, right: rect.right, bottom: rect.bottom,
      scene: target.dataset.sceneTarget !== undefined, depth: Number(target.dataset.depth ?? 0) });
  }
  return chooseAbilityDropTarget(targets, x, y, width, height);
};

export function useAbilityDrag(onSpend: (actorId: string, foeId: string) => void) {
  const [aim, setAim] = useState<AbilityAim | null>(null);
  const [holding, setHolding] = useState(false);
  const holdingRef = useRef(false);
  const hold = (value: boolean) => { holdingRef.current = value; setHolding(value); };
  const press = useRef<{ actorId: string; pointerId: number; x: number; y: number; moved: boolean } | null>(null);
  const inspectOnClick = useRef(false);
  const spend = useRef(onSpend); spend.current = onSpend;
  useEffect(() => {
    if (!aim) return;
    const key = (event: KeyboardEvent) => { if (event.key === 'Escape') { event.stopPropagation(); press.current=null; hold(false); setAim(null); } };
    window.addEventListener('keydown', key, true);
    return () => window.removeEventListener('keydown', key, true);
  }, [aim]);
  useEffect(() => {
    const release = () => { if (holdingRef.current) { holdingRef.current = false; setHolding(false); press.current = null; setAim(null); } };
    const visibility = () => { if (document.hidden) release(); };
    window.addEventListener('blur', release); document.addEventListener('visibilitychange', visibility);
    return () => { window.removeEventListener('blur', release); document.removeEventListener('visibilitychange', visibility); };
  }, []);

  // A stationary held card must keep targeting the live projection during orbit,
  // zoom or actor movement. Reuse the exact hit test used for release.
  const dragging = aim?.mode === 'drag';
  useEffect(() => {
    if (!dragging) return;
    let frame = 0;
    const update = () => {
      setAim(current => {
        if (current?.mode !== 'drag') return current;
        const foeId = foeAt(current.x, current.y);
        return foeId === current.foeId ? current : { ...current, foeId };
      });
      frame = gameTime.requestAnimationFrame(update);
    };
    frame = gameTime.requestAnimationFrame(update);
    return () => gameTime.cancelAnimationFrame(frame);
  }, [dragging]);

  const prime = (actorId: string) => setAim({actorId,foeId:null,mode:'armed',x:0,y:0});

  /** Props for the ability card. */
  const cardProps = (actorId: string, enabled: boolean, onInspect?: (anchor: HTMLElement) => void) => ({
    onPointerDown: (event: ReactPointerEvent<HTMLElement>) => {
      if ((!enabled && !onInspect) || (event.pointerType === 'mouse' && event.button !== 0)) return;
      event.currentTarget.setPointerCapture(event.pointerId);
      inspectOnClick.current = false;
      press.current = { actorId, pointerId: event.pointerId, x: event.clientX, y: event.clientY, moved: false };
      hold(true);
    },
    onPointerMove: (event: ReactPointerEvent<HTMLElement>) => {
      const current = press.current;
      if (!current || current.pointerId !== event.pointerId) return;
      if (!current.moved && Math.hypot(event.clientX - current.x, event.clientY - current.y) < DRAG_START_PX) return;
      current.moved = true;
      if (!enabled) return;
      setAim({ actorId, foeId: foeAt(event.clientX, event.clientY), mode: 'drag', x: event.clientX, y: event.clientY });
    },
    onPointerUp: (event: ReactPointerEvent<HTMLElement>) => {
      const current = press.current;
      if (!current || current.pointerId !== event.pointerId) return;
      press.current = null;
      hold(false);
      if (!current.moved) {
        // Open on the resulting click, after touch capture has been released.
        // Opening here would retarget that click to the new jumbo backdrop.
        inspectOnClick.current = true;
        setAim({actorId,foeId:null,mode:'armed',x:0,y:0}); return;
      }
      if (!enabled) return;
      const foeId = foeAt(event.clientX, event.clientY);
      if (foeId) {setAim(null); spend.current(actorId, foeId);}
      else setAim({actorId,foeId:null,mode:'armed',x:0,y:0});
    },
    onPointerCancel: () => { press.current = null; inspectOnClick.current = false; hold(false); setAim((current) => (current?.mode === 'drag' ? null : current)); },
    onLostPointerCapture: (event: ReactPointerEvent<HTMLElement>) => {
      if (press.current?.pointerId === event.pointerId) { press.current = null; hold(false); setAim(null); }
    },
    // Inspect after a completed tap/click; keyboard activation arrives with detail 0.
    onClick: (event: { detail: number; currentTarget: HTMLElement }) => {
      if (event.detail === 0 || inspectOnClick.current) {
        inspectOnClick.current = false;
        if (onInspect) onInspect(event.currentTarget); else if (enabled) prime(actorId);
      }
    },
  });

  /** Props for an actor target while an ability is armed: hover or focus previews, a press spends. */
  const foeProps = (foeId: string) => ({
    onPointerEnter: () => setAim((current) => (current?.mode === 'armed' ? { ...current, foeId } : current)),
    onPointerLeave: () => setAim((current) => (current?.mode === 'armed' && current.foeId === foeId ? { ...current, foeId: null } : current)),
    onFocus: () => setAim((current) => (current?.mode === 'armed' ? { ...current, foeId } : current)),
    onBlur: () => setAim((current) => (current?.mode === 'armed' && current.foeId === foeId ? { ...current, foeId: null } : current)),
    onClick: () => {
      const current = aim;
      if (current?.mode !== 'armed') return;
      setAim(null);
      spend.current(current.actorId, foeId);
    },
  });

  return { aim, holding, holdingRef, cardProps, foeProps, prime, cancel: () => {press.current=null; hold(false); setAim(null);} };
}
