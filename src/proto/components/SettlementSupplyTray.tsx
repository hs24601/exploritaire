import { useEffect, useRef, useState } from 'react';
import { PinnedToast } from './PinnedToast';

export type SupplyItem = {
  id: string;
  label: string;
  glyph: string;
  count: number;
  /** Short category shown in the details, e.g. "Gathered resource · food". */
  kind?: string;
  /** What this resource is used for, one line each. */
  uses?: string[];
};

/** Slim left-side resource tracker: icon and count per resource, mirroring the
 * quest tray's frame and stow behavior. Tapping a resource opens its details. */
export function SettlementSupplyTray({ items, open = true, onPlace, onClose }: {
  items: readonly SupplyItem[];
  open?: boolean;
  onPlace?: (id: string) => void;
  onClose?: () => void;
}) {
  const previous = useRef(new Map(items.map(item => [item.id, item.count])));
  const ref = useRef<HTMLElement>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = open ? items.find(item => item.id === selectedId) : undefined;
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
  return <aside ref={ref} className="proto-supply-sidebar supply-tray" data-open={open} aria-hidden={!open} inert={!open} aria-label="Supplies"
    data-camera-ignore="true" onPointerDown={event => event.stopPropagation()}>
    <header className="supply-tray__header">
      <h2 className="supply-tray__title">Supplies</h2>
      {onClose && <button type="button" className="supply-tray__toggle" aria-label="Stow tray" aria-expanded={open} title="Stow tray" onClick={() => { setSelectedId(null); onClose(); }}><span className="pull-tab__grip" aria-hidden="true" /></button>}
    </header>
    <ul className="supply-tray__well">
      {items.map(item => <li key={item.id}>
        <button type="button" className="supply-row" data-supply={item.id} data-count={item.count} aria-haspopup="dialog"
          aria-expanded={selected?.id === item.id} aria-label={`${item.label}, ${item.count}`} title={item.label}
          onClick={() => setSelectedId(current => current === item.id ? null : item.id)}>
          <span className="supply-row__token" aria-hidden="true">{item.glyph}</span>
          <strong className="supply-row__count" aria-hidden="true">{item.count}</strong>
        </button>
      </li>)}
    </ul>
    {selected && <SupplyDetails item={selected} tray={ref.current} onPlace={onPlace} onDismiss={() => setSelectedId(null)} />}
  </aside>;
}

/** Details for the tapped resource, pinned beside the tray. */
function SupplyDetails({ item, tray, onPlace, onDismiss }: { item: SupplyItem; tray: HTMLElement | null; onPlace?: (id: string) => void; onDismiss: () => void }) {
  return <PinnedToast className="supply-details" title={item.label} subtitle={item.kind} icon={item.glyph} dismissOnOutside
    anchor={tray?.querySelector(`[data-supply="${item.id}"]`) ?? null} edge={tray} onClose={onDismiss}>
    <p className="supply-details__held">Held <strong>{item.count}</strong></p>
    {item.uses?.length ? <ul className="supply-details__uses">{item.uses.map(use => <li key={use}>{use}</li>)}</ul> : null}
    {onPlace && <button type="button" className="supply-details__place" disabled={item.count < 1} onClick={() => onPlace(item.id)}>Place 1 on table</button>}
  </PinnedToast>;
}
