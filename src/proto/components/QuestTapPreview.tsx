import { useEffect, useLayoutEffect, useRef, useState, type RefObject } from 'react';
import { createPortal } from 'react-dom';
import { gameTime } from '../../gameTime';
import { getCameraPlayback } from '../cameraDirector';

/** Screen-space spotlight; corner markers preserve the real ground-card silhouette. */
export function QuestTapPreview({ card, paused }: { card: RefObject<HTMLDivElement | null>; paused: boolean }) {
  const [host, setHost] = useState<HTMLElement | null>(null);
  const layer = useRef<HTMLDivElement>(null);
  const pause = useRef(paused); pause.current = paused;
  useEffect(() => { setHost(card.current?.closest<HTMLElement>('.proto-map') ?? null); }, [card]);
  useLayoutEffect(() => {
    if (!host || !layer.current || !card.current) return;
    const source = card.current, overlay = layer.current;
    const corners = ['0,0','100%,0','100%,100%','0,100%'].map(pair => {
      const marker = document.createElement('i');
      const [left, top] = pair.split(',');
      marker.style.cssText = `position:absolute;left:${left};top:${top};width:0;height:0;pointer-events:none`;
      source.append(marker); return marker;
    });
    const path = overlay.querySelector('path')!, cue = overlay.querySelector<HTMLElement>('.quest-tap-preview__cue')!;
    const hand = overlay.querySelector<SVGElement>('.actor-drag-preview__hand')!;
    const ring = overlay.querySelector<SVGElement>('.quest-tap-preview__ring')!;
    const reduced = matchMedia('(prefers-reduced-motion: reduce)');
    let frame = 0, elapsed = 0, fadeElapsed = 0, wasReady = false, last = gameTime.now();
    const tick = () => {
      const now = gameTime.now(), delta = pause.current ? 0 : now - last; elapsed += delta; last = now;
      const ready = host.dataset.openingCards === 'complete' && !getCameraPlayback().playing && !document.querySelector('.card-jumbo') && !source.hasAttribute('data-picking-up');
      // Start gently after camera arrival, including when returning from inspection.
      // Use game time so pausing freezes the dimmer along with the tap preview.
      fadeElapsed = ready ? (wasReady ? fadeElapsed + delta : 0) : 0;
      wasReady = ready;
      const fade = Math.min(1, fadeElapsed / 1200);
      overlay.style.opacity = String(reduced.matches ? 1 : fade * fade * (3 - 2 * fade));
      overlay.hidden = !ready;
      if (ready) {
        const bounds = overlay.getBoundingClientRect();
        const points = corners.map(marker => { const r = marker.getBoundingClientRect(); return [r.left - bounds.left, r.top - bounds.top]; });
        path.setAttribute('d', `M0 0H${bounds.width}V${bounds.height}H0Z M${points.map(p => p.join(' ')).join('L')}Z`);
        const x = points.reduce((sum,p) => sum+p[0],0)/4, y = points.reduce((sum,p) => sum+p[1],0)/4;
        cue.style.left = `${x}px`; cue.style.top = `${y}px`;
        const t = elapsed % 2600, press = t >= 850 && t < 1120;
        hand.style.transform = reduced.matches ? 'translate(-18px,-9px) rotate(-14deg)' : `translate(${press ? -18 : -8}px,${press ? -9 : -25}px) rotate(-14deg) scale(${press ? .9 : 1})`;
        ring.style.opacity = reduced.matches ? '.65' : t >= 850 && t < 1500 ? String(1-(t-850)/650) : '0';
        ring.style.transform = `translate(-50%,-50%) scale(${reduced.matches ? 1 : 1+Math.max(0,t-850)/650})`;
      }
      frame = gameTime.requestAnimationFrame(tick);
    };
    tick();
    return () => { gameTime.cancelAnimationFrame(frame); corners.forEach(marker => marker.remove()); };
  }, [host, card]);
  return host && createPortal(<div ref={layer} className="quest-tap-preview" hidden aria-hidden="true" inert>
    <svg className="quest-tap-preview__scrim"><path fill="#02060bd1" fillRule="evenodd" /></svg>
    <div className="quest-tap-preview__cue"><span className="quest-tap-preview__ring" /><svg className="actor-drag-preview__hand" viewBox="0 0 64 76"><path d="M24 40V12c0-8 11-8 11 0v21-9c0-7 10-7 10 0v12-5c0-6 10-6 10 0v8c9-3 10 4 8 12l-5 17c-2 6-6 9-13 9H30c-5 0-9-3-12-7L5 46c-4-7 3-12 8-7l11 11" /></svg><span className="quest-tap-preview__label">Tap here</span></div>
  </div>, host);
}
