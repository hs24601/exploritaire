import { useLayoutEffect, useRef } from 'react';
import { gameTime } from '../../gameTime';
import { getCameraPlayback } from '../cameraDirector';
import { dragPreviewFrame, farthestPreviewCard } from '../dragPreview';
import { DragPreviewVisual } from './DragPreviewVisual';

/** Cross-panel visual only: never plays, hides or moves a real tableau card. */
export function TableauDragPreview({ enabled, cardIds, paused }: { enabled: boolean; cardIds: readonly string[]; paused: boolean }) {
  const root = useRef<HTMLDivElement>(null), input = useRef({ cardIds, paused });
  input.current = { cardIds, paused };
  const dismissed = useRef(false);
  useLayoutEffect(() => {
    const layer = root.current!, ghost = layer.querySelector<HTMLElement>('.actor-drag-preview__card')!;
    const hand = layer.querySelector<HTMLElement>('.actor-drag-preview__hand')!, ring = layer.querySelector<SVGElement>('circle')!;
    if (!enabled || dismissed.current) { layer.hidden = true; return; }
    const reduced = matchMedia('(prefers-reduced-motion: reduce)');
    let frame = 0, started: number | undefined, last = gameTime.now(), elapsed = 0, selected: HTMLElement | undefined, sourceWidth = 0;
    const stop = () => { dismissed.current = true; gameTime.cancelAnimationFrame(frame); layer.hidden = true; };
    const interact = (event: Event) => {
      if (event instanceof KeyboardEvent && !['Enter', ' '].includes(event.key)) return;
      if ((event.target as Element)?.closest?.('.travel-tableau [data-travel-card]')) stop();
    };
    const tick = () => {
      const now = gameTime.now(), delta = now - last; last = now;
      const target = document.querySelector<HTMLElement>('[data-map-actor-card="hero"]');
      const quest = document.querySelector<HTMLElement>('.day-objective__tracker .quest-card');
      const deck = document.querySelector<HTMLElement>('.quest-subtask-deck');
      if (!target || document.hidden || getCameraPlayback().moving || quest && quest.dataset.questUpdate !== 'idle' || deck && (deck.dataset.phase !== 'idle' || deck.dataset.stepId !== 'navigate-den')) {
        layer.hidden = true; started = undefined; frame = gameTime.requestAnimationFrame(tick); return;
      }
      if (input.current.paused) { frame = gameTime.requestAnimationFrame(tick); return; }
      started ??= now;
      if (now - started < 450) { frame = gameTime.requestAnimationFrame(tick); return; }
      const bounds = target.getBoundingClientRect(), to = { x: bounds.left + bounds.width / 2, y: bounds.top + bounds.height / 2 };
      const cards = input.current.cardIds.map(id => document.querySelector<HTMLElement>(`.travel-tableau [data-travel-card="${CSS.escape(id)}"]`))
        .filter((card): card is HTMLElement => Boolean(card && !card.hasAttribute('disabled')))
        .map(card => { const box = card.getBoundingClientRect(); return { card, x: box.left + box.width / 2, y: box.top + box.height / 2, box }; })
        .filter(({box}) => box.width > 0 && box.height > 0 && box.right > 0 && box.left < innerWidth && box.bottom > 0 && box.top < innerHeight);
      const source = farthestPreviewCard(cards, to);
      if (!source) { layer.hidden = true; frame = gameTime.requestAnimationFrame(tick); return; }
      if (source.card !== selected || source.card.offsetWidth !== sourceWidth) {
        selected = source.card; sourceWidth = selected.offsetWidth; elapsed = 0;
        const copy = selected.cloneNode(true) as HTMLElement, style = getComputedStyle(selected);
        copy.removeAttribute('data-travel-card'); copy.removeAttribute('id'); copy.removeAttribute('tabindex'); copy.removeAttribute('aria-label');
        copy.querySelectorAll('[id]').forEach(node => node.removeAttribute('id'));
        copy.style.cssText = 'position:static;inset:auto;width:100%;height:100%;transform:none;margin:0;';
        for (const key of Array.from(style)) if (key.startsWith('--')) ghost.style.setProperty(key, style.getPropertyValue(key));
        ghost.replaceChildren(copy); layer.dataset.previewSourceCard = selected.dataset.travelCard;
      }
      elapsed += delta;
      const { t, opacity, grabbing } = dragPreviewFrame(elapsed);
      const x = source.x + (to.x - source.x) * t, y = source.y + (to.y - source.y) * t;
      layer.hidden = false;
      ghost.style.width = `${selected.offsetWidth}px`; ghost.style.height = `${selected.offsetHeight}px`;
      ghost.style.left = `${x}px`; ghost.style.top = `${y}px`; ghost.style.opacity = String(reduced.matches ? 0 : opacity * .75);
      ghost.style.transform = `translate(-50%,-50%) rotate(${Math.sin(t * Math.PI) * -7}deg) scale(.94)`;
      hand.style.left = `${reduced.matches ? source.x : x}px`; hand.style.top = `${reduced.matches ? source.y : y}px`;
      hand.style.opacity = String(reduced.matches ? 1 : opacity); hand.dataset.grabbing = String(!reduced.matches && grabbing);
      ring.setAttribute('cx', String(to.x)); ring.setAttribute('cy', String(to.y));
      frame = gameTime.requestAnimationFrame(tick);
    };
    document.addEventListener('pointerdown', interact, true); document.addEventListener('keydown', interact, true);
    frame = gameTime.requestAnimationFrame(tick);
    return () => { gameTime.cancelAnimationFrame(frame); layer.hidden = true; ghost.replaceChildren(); document.removeEventListener('pointerdown', interact, true); document.removeEventListener('keydown', interact, true); };
  }, [enabled]);
  return <DragPreviewVisual layerRef={root} className="tableau-drag-preview" />;
}
