import { useLayoutEffect, useRef } from 'react';
import { gameTime } from '../../gameTime';
import { getCameraPlayback } from '../cameraDirector';
import './ActorDragPreview.css';
import { DragPreviewVisual } from './DragPreviewVisual';
import { dragPreviewFrame } from '../dragPreview';

type Point = { x: number; y: number };

/** A visual demonstration only: never dispatches actor movement or drop events. */
export function ActorDragPreview({ targetId, target, project }: { targetId: string; target: Point; project: (point: Point) => Point }) {
  const root = useRef<HTMLDivElement>(null);
  const input = useRef({ target, project }); input.current = { target, project };
  useLayoutEffect(() => {
    const layer = root.current!, ghost = layer.querySelector<HTMLElement>('.actor-drag-preview__card')!;
    const hand = layer.querySelector<HTMLElement>('.actor-drag-preview__hand')!;
    const ring = layer.querySelector<SVGElement>('.actor-drag-preview__destination')!;
    const map = layer.closest('.proto-map') ?? layer.parentElement!;
    const reduced = matchMedia('(prefers-reduced-motion: reduce)');
    let frame = 0, started: number | undefined, armed = false, dismissed = false;
    const hide = () => { layer.hidden = true; };
    const stop = () => { dismissed = true; armed = false; gameTime.cancelAnimationFrame(frame); hide(); };
    const tick = () => {
      if (!armed || dismissed) return;
      const card = map.querySelector<HTMLElement>('[data-map-actor-card="hero"]');
      if (!card || getCameraPlayback().playing || document.hidden || map.getAttribute('data-opening-cards') === 'pending' || map.getAttribute('data-opening-cards') === 'dealing') {
        hide(); started = undefined; frame = gameTime.requestAnimationFrame(tick); return;
      }
      if (!ghost.firstChild) { const copy = card.cloneNode(true) as HTMLElement; copy.removeAttribute('tabindex'); copy.removeAttribute('role'); copy.removeAttribute('data-map-actor-card'); copy.querySelectorAll('[id]').forEach(el => el.removeAttribute('id')); ghost.append(copy); }
      layer.hidden = false;
      const bounds = layer.getBoundingClientRect(), source = card.getBoundingClientRect();
      const from = { x: source.left - bounds.left + source.width / 2, y: source.top - bounds.top + source.height / 2 };
      const to = input.current.project(input.current.target);
      const visible = to.x > 12 && to.x < bounds.width - 12 && to.y > 12 && to.y < bounds.height - 12;
      layer.hidden = !visible;
      started ??= gameTime.now();
      const { t, opacity, grabbing } = dragPreviewFrame(gameTime.now() - started);
      const x = from.x + (to.x - from.x) * t, y = from.y + (to.y - from.y) * t;
      ghost.style.cssText = `width:${source.width}px;height:${source.height}px;left:${x}px;top:${y}px;opacity:${reduced.matches ? 0 : opacity * .75};transform:translate(-50%,-50%) rotate(${Math.sin(t * Math.PI) * -7}deg) scale(.94)`;
      hand.style.left = `${reduced.matches ? from.x : x}px`; hand.style.top = `${reduced.matches ? from.y : y}px`;
      hand.style.opacity = String(reduced.matches ? 1 : opacity);
      hand.dataset.grabbing = String(grabbing);
      ring.setAttribute('cx', String(to.x)); ring.setAttribute('cy', String(to.y));
      frame = gameTime.requestAnimationFrame(tick);
    };
    const start = (event: Event) => { if ((event as CustomEvent<string>).detail !== targetId || armed || dismissed) return; armed = true; frame = gameTime.requestAnimationFrame(tick); };
    const pointer = (event: PointerEvent) => { if ((event.target as Element).closest?.('[data-map-actor-card="hero"]')) stop(); };
    window.addEventListener('proto-quest-highlight', start);
    window.addEventListener('proto-actor-drag-start', stop);
    map.addEventListener('pointerdown', pointer as EventListener);
    return () => { gameTime.cancelAnimationFrame(frame); window.removeEventListener('proto-quest-highlight', start); window.removeEventListener('proto-actor-drag-start', stop); map.removeEventListener('pointerdown', pointer as EventListener); };
  }, [targetId]);
  return <DragPreviewVisual layerRef={root} />;
}
