import { useCallback, useEffect, useRef, type Dispatch, type RefObject } from 'react';
import type { Action } from '../rules/game';

function endpoints(action: Action): [string, string] | undefined {
  switch (action.type) {
    case 'sapling-play': return [`sapling-${action.column}`, '[data-drop="sapling-foundation"]'];
    case 'den-play': return [`den-${action.column}`, '[data-drop="dig-foundation"]'];
    case 'aspen-play': return [`aspen-${action.pile}`, `[data-drop="aspen-foundation"][data-index="${action.foundation}"] > .vg-aspen-card`];
    case 'aspen-play-card': return [`found-${action.card}`, `[data-drop="aspen-foundation"][data-index="${action.foundation}"] > .vg-aspen-card`];
    case 'play': return [`surface-${action.pile}`, '[data-drop="foundation"]'];
  }
}

/** Capture the source before dispatch replaces it. The flight never delays a receipt. */
export function useVillageReceiptFlight(root: RefObject<HTMLElement | null>, dispatch: Dispatch<Action>, blocked: boolean) {
  const current = useRef<Animation | null>(null);
  useEffect(() => () => current.current?.cancel(), []);
  useEffect(() => { if (blocked) current.current?.cancel(); }, [blocked]);

  return useCallback((action: Action) => {
    const route = endpoints(action);
    if (route || action.type === 'view' || action.type === 'aspen-overview' || action.type === 'reset' || action.type === 'rest') {
      current.current?.cancel();
    }
    const host = root.current;
    if (route && host && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
      const card = host.querySelector<HTMLElement>(`[data-receipt-source="${route[0]}"]`);
      const target = host.querySelector(route[1]);
      if (card && target && !card.matches(':disabled')) {
        const face = action.type === 'play' ? card.firstElementChild as HTMLElement : card;
        const start = (document.querySelector('.vg-ghost.is-corner-anchored') ?? face).getBoundingClientRect();
        const end = target.getBoundingClientRect();
        if (start.width && start.height && end.width && end.height) {
          const clone = face.cloneNode(true) as HTMLElement;
          const paint = getComputedStyle(face);
          clone.removeAttribute('id');
          clone.removeAttribute('data-receipt-source');
          clone.setAttribute('aria-hidden', 'true');
          clone.inert = true;
          clone.classList.add('vg-receipt-flight');
          Object.assign(clone.style, {
            left: `${start.left}px`, top: `${start.top}px`, width: `${start.width}px`, height: `${start.height}px`,
            color: paint.color, background: paint.background, boxShadow: paint.boxShadow, font: paint.font,
          });
          host.append(clone);
          const x = end.left + (end.width - start.width) / 2 - start.left;
          const y = end.top + (end.height - start.height) / 2 - start.top;
          const scale = Math.min(end.width / start.width, end.height / start.height);
          const animation = clone.animate([
            { transform: 'translate(0, 0) scale(1)' },
            { transform: `translate(${x * .55}px, ${y * .55 - 20}px) scale(${1 + (scale - 1) * .55})`, offset: .55 },
            { transform: `translate(${x}px, ${y}px) scale(${scale})` },
          ], { duration: 180, easing: 'cubic-bezier(.22, .65, .4, 1)' });
          current.current = animation;
          const clean = () => {
            clone.remove();
            if (current.current === animation) current.current = null;
          };
          animation.onfinish = clean;
          animation.oncancel = clean;
        }
      }
    }
    dispatch(action);
  }, [root, dispatch]);
}
