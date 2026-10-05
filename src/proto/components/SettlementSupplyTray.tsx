import { useEffect, useRef } from 'react';

export type SupplyItem = { id: string; label: string; glyph: string; count: number };

/** Left-side resource tracker: one row per resource, mirroring the quest tray's
 * frame and stow behavior. Tapping a stocked row places one on the table. */
export function SettlementSupplyTray({ items, open = true, onPlace, onClose }: {
  items: readonly SupplyItem[];
  open?: boolean;
  onPlace?: (id: string) => void;
  onClose?: () => void;
}) {
  const previous = useRef(new Map(items.map(item => [item.id, item.count])));
  const ref = useRef<HTMLElement>(null);
  useEffect(() => {
    const animations: Animation[] = [];
    const ghosts: HTMLElement[] = [];
    const actor = document.querySelector('[data-board-piece="actor"]')?.getBoundingClientRect();
    for (const item of items) {
      const increase = item.count - (previous.current.get(item.id) ?? 0);
      const destination = open ? ref.current?.querySelector(`[data-supply="${item.id}"]`)?.getBoundingClientRect() : undefined;
      if (increase > 0 && actor && destination) {
        for (let index = 0; index < Math.min(5, increase); index++) {
          const ghost = document.createElement('span');
          ghost.textContent = item.glyph;
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
    previous.current = new Map(items.map(item => [item.id, item.count]));
    return () => { animations.forEach(animation => animation.cancel()); ghosts.forEach(ghost => ghost.remove()); };
  }, [items, open]);
  const total = items.reduce((sum, item) => sum + item.count, 0);
  return <aside ref={ref} className="proto-supply-sidebar supply-tray" data-open={open} aria-hidden={!open} inert={!open} aria-label="Supplies"
    data-camera-ignore="true" onPointerDown={event => event.stopPropagation()}>
    <header className="supply-tray__header">
      <h2 className="supply-tray__plaque">Supplies</h2>
      <div className="supply-tray__controls">
        <span>{total} held</span>
        {onClose && <button type="button" className="supply-tray__toggle" aria-expanded={open} onClick={onClose}>← Stow tray</button>}
      </div>
    </header>
    <ul className="supply-tray__well">
      {items.map(item => <li key={item.id}>
        <button type="button" className="supply-row" data-supply={item.id} data-count={item.count} disabled={!onPlace || item.count < 1}
          onClick={() => onPlace?.(item.id)} title={item.count ? `Place one ${item.label} on the table` : undefined}
          aria-label={`${item.label}, ${item.count}${item.count && onPlace ? '. Place one on the table' : ''}`}>
          <span className="supply-row__token" aria-hidden="true">{item.glyph}</span>
          <span className="supply-row__label">{item.label}</span>
          <strong className="supply-row__count" aria-live="polite">{item.count}</strong>
        </button>
      </li>)}
    </ul>
  </aside>;
}
