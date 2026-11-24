import { useLayoutEffect, useRef } from 'react';
import { gameTime } from '../../gameTime';
import { getCameraPlayback } from '../cameraDirector';
import { sceneActorBoxes } from '../sceneProjection';
import './OpeningCardDeal.css';
import { questTravelPose } from './questCardTravel';

/** Presentation only. Copies fly; the live interactive cards retain their slots. */
export function OpeningCardDeal({ enabled }: { enabled: boolean }) {
  const root = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const layer = root.current!, map = layer.closest<HTMLElement>('.proto-map')!;
    if (!enabled) { delete map.dataset.openingCards; return; }
    map.dataset.openingCards = 'pending';
    let frame = 0, armedAt: number | undefined, started: number | undefined, finished = false;
    const reduced = matchMedia('(prefers-reduced-motion: reduce)');
    const targets = () => [map.querySelector<HTMLElement>('[data-map-actor-card="hero"]'), map.querySelector<HTMLElement>('.day-objective__tracker:not([data-opening-flight-copy])')];
    const release = () => {
      finished = true; gameTime.cancelAnimationFrame(frame); layer.replaceChildren();
      map.dataset.openingCards = 'complete';
      map.dataset.openingQuest = 'waiting-travel';
      [...targets(), ...flights.map(flight => flight.card)].forEach(card => { if (card) { card.inert = false; delete card.dataset.openingLanded; } });
    };
    type Flight = { card: HTMLElement; node: HTMLElement; source?: { x: number; y: number }; landed: boolean };
    let flights: Flight[] = [];
    const tick = () => {
      if (finished) return;
      const now = gameTime.now();
      // Callout camera dispatch happens on its next game frame. Allow it to
      // register before checking movement; holding a shot is already arrival.
      if (document.hidden || now - armedAt! < 100 || started === undefined && (getCameraPlayback().moving || getCameraPlayback().paused)) {
        frame = gameTime.requestAnimationFrame(tick); return;
      }
      if (started === undefined) {
        const slots = targets();
        // Hero is introduced only after the ground quest has been picked up.
        const cards: (HTMLElement | null)[] = [];
        if (slots.some(card => !card) || cards.some(card => !card)) { frame = gameTime.requestAnimationFrame(tick); return; }
        if (reduced.matches) { release(); return; }
        started = now; map.dataset.openingCards = 'dealing';
        flights = cards.map(card => {
          const copy = card!.cloneNode(true) as HTMLElement;
          copy.classList.add('opening-card-deal__face');
          if (card!.dataset.subtaskCard) copy.dataset.dealtSubtask = card!.dataset.subtaskCard;
          if (card!.classList.contains('quest-subtask-deck__back')) copy.classList.add('opening-card-deal__face--back');
          copy.dataset.openingFlightCopy = 'true'; copy.removeAttribute('data-map-actor-card');
          copy.removeAttribute('aria-label'); copy.removeAttribute('role'); copy.removeAttribute('tabindex');
          copy.querySelectorAll('[id]').forEach(el => el.removeAttribute('id'));
          copy.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;max-width:none;max-height:none;margin:0;visibility:visible;pointer-events:none;';
          const node = document.createElement('div'); node.className = 'opening-card-deal__flight';
          const back = document.createElement('div'); back.className = 'opening-card-deal__back';
          node.append(back, copy); layer.append(node); card!.inert = true;
          return { card: card!, node, landed: false };
        });
      }
      const view = layer.getBoundingClientRect();
      flights.forEach((flight, index) => {
        if (flight.landed) return;
        const elapsed = now - started! - index * 110;
        if (elapsed < 0) { flight.node.hidden = true; return; }
        const actor = sceneActorBoxes()?.find(actor => actor.id === 'hero')?.box
          ?? map.querySelector<HTMLElement>('[data-board-piece="actor"][data-actor-id="hero"]')?.getBoundingClientRect();
        if (!flight.source && actor) flight.source = { x: (actor.left + actor.right) / 2 - view.left, y: (actor.top + actor.bottom) / 2 - view.top };
        if (!flight.source) return;
        const t = Math.min(1, elapsed / 650), {eased,lift,rotation,shadow} = questTravelPose(t);
        const target = flight.card.getBoundingClientRect();
        const x = flight.source.x + (target.left + target.width / 2 - view.left - flight.source.x) * eased;
        const y = flight.source.y + (target.top + target.height / 2 - view.top - flight.source.y) * eased - lift;
        const scale = .16 + .84 * eased;
        flight.node.hidden = false;
        flight.node.style.cssText = `width:${target.width}px;height:${target.height}px;left:${x}px;top:${y}px;opacity:${Math.min(1, .6 + t * 3)};transform:translate(-50%,-50%) perspective(900px) rotateY(${rotation}deg) scale(${scale});filter:${shadow};`;
        if (t === 1) { flight.landed = true; flight.node.remove(); flight.card.dataset.openingLanded = 'true'; flight.card.inert = false; }
      });
      if (flights.every(flight => flight.landed)) release();
      else frame = gameTime.requestAnimationFrame(tick);
    };
    const arm = () => { if (armedAt !== undefined || finished) return; armedAt = gameTime.now(); frame = gameTime.requestAnimationFrame(tick); };
    const revealQuest = () => { map.dataset.openingQuestRevealed = 'true'; };
    window.addEventListener('proto-opening-quest-reveal', revealQuest);
    window.addEventListener('proto-opening-card-deal', arm);
    return () => { window.removeEventListener('proto-opening-quest-reveal', revealQuest); delete map.dataset.openingQuestRevealed; window.removeEventListener('proto-opening-card-deal', arm); release(); delete map.dataset.openingCards; delete map.dataset.openingQuest; };
  }, [enabled]);
  return <div ref={root} className="opening-card-deal" aria-hidden="true" inert />;
}
