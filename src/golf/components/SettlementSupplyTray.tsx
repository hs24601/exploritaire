import { useEffect, useRef } from 'react';
import { WORLD_ITEMS } from '../classicPlusCrafting';

export type SupplyResource = 'wood' | 'berries' | 'herbs';
export type SupplyBalances = Record<SupplyResource, number>;
const resources: SupplyResource[] = ['wood', 'berries', 'herbs'];

/** Screen-space storage; only deliberately drawn ingredients become table tokens. */
export function SettlementSupplyTray({ balances, onDraw }: { balances: SupplyBalances; onDraw: (resource: SupplyResource, count: number) => void }) {
  const previous = useRef(balances);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const animations: Animation[] = [];
    const ghosts: HTMLElement[] = [];
    const actor = document.querySelector('[data-board-piece="actor"]')?.getBoundingClientRect();
    for (const resource of resources) {
      const increase = balances[resource] - previous.current[resource];
      const destination = ref.current?.querySelector(`[data-supply="${resource}"]`)?.getBoundingClientRect();
      if (increase > 0 && actor && destination) {
        for (let index = 0; index < Math.min(5, increase); index++) {
          const ghost = document.createElement('span');
          ghost.textContent = WORLD_ITEMS[resource].glyph;
          ghost.className = 'settlement-supply-flight';
          ghost.style.left = actor.left + actor.width / 2 + 'px';
          ghost.style.top = actor.top + actor.height / 2 + 'px';
          document.body.appendChild(ghost);
          const dx = destination.left + destination.width / 2 - actor.left - actor.width / 2;
          const dy = destination.top + destination.height / 2 - actor.top - actor.height / 2;
          const animation = ghost.animate([
            { transform: 'translate(-50%, -50%) scale(.6)', opacity: 0 },
            { transform: `translate(${dx * .5}px, ${dy * .5 - 70}px) scale(1)`, opacity: 1, offset: .5 },
            { transform: `translate(${dx}px, ${dy}px) scale(.5)`, opacity: 0 },
          ], { duration: 650, delay: index * 70, easing: 'ease-in-out' });
          animation.onfinish = () => ghost.remove();
          animations.push(animation); ghosts.push(ghost);
        }
      }
    }
    previous.current = balances;
    return () => { animations.forEach(animation => animation.cancel()); ghosts.forEach(ghost => ghost.remove()); };
  }, [balances]);
  return <div ref={ref} className="settlement-supply-tray" data-camera-ignore="true" onPointerDown={event => event.stopPropagation()}>
    <header>Settlement supplies <span>Draw ingredients onto the table to craft</span></header>
    <div className="settlement-supply-tray__slots">
      {resources.map(resource => <section key={resource} data-supply={resource} aria-label={WORLD_ITEMS[resource].label}>
        <div><span aria-hidden="true">{WORLD_ITEMS[resource].glyph}</span> {WORLD_ITEMS[resource].label} <strong aria-live="polite">{balances[resource]}</strong></div>
        <div>{[1, 3].map(count => <button key={count} type="button" disabled={balances[resource] < count} onClick={() => onDraw(resource, count)} aria-label={`Draw ${count} ${WORLD_ITEMS[resource].label}`}><span className="supply-draw-prefix">Draw </span>{count}</button>)}</div>
      </section>)}
    </div>
  </div>;
}
