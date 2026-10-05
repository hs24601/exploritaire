import { TABLE_CARD_SCREEN_WIDTH, CARD_RATIO } from '../tableCardPlacement';
import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { tableObjectShadow, type TableLight } from '../classicPlusLighting';

export type DetailsCardObject = {
  id: string;
  name: string;
  badge: ReactNode;
  badgeLabel: string;
  art: ReactNode;
  descriptor: string;
  trays: Array<{ id: string; label: string; content?: ReactNode }>;
};

/** Object-agnostic card presentation; callers supply art and future tray content. */
export function DetailsCardViewer({ object, anchor, timeOfDay, lights, position, onClose }: {
  object: DetailsCardObject; anchor: HTMLElement; timeOfDay: number; lights: TableLight[];
  position: { x: number; y: number }; onClose: () => void;
}) {
  const viewerRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  const titleId = useId();
  const descriptorId = useId();
  const [placement, setPlacement] = useState({ left: 0, top: 0, width: TABLE_CARD_SCREEN_WIDTH });
  useEffect(() => {
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    let frame = 0;
    const update = () => {
      if (!anchor.isConnected) { closeRef.current(); return; }
      const rect = anchor.getBoundingClientRect();
      const width = Math.min(TABLE_CARD_SCREEN_WIDTH, window.innerWidth - 24, (window.innerHeight - 24) * CARD_RATIO);
      const height = width / CARD_RATIO;
      const right = rect.right + 16;
      const left = Math.max(12, Math.min(window.innerWidth - width - 12, right + width <= window.innerWidth - 12 ? right : rect.left - width - 16));
      const top = Math.max(12, Math.min(rect.top, window.innerHeight - height - 12));
      setPlacement(old => old.left === left && old.top === top && old.width === width ? old : { left, top, width });
      frame = requestAnimationFrame(update);
    };
    update();
    const dismiss = (event: PointerEvent) => {
      if (event.target instanceof Node && !viewerRef.current?.contains(event.target) && !anchor.contains(event.target)) closeRef.current();
    };
    const escape = (event: KeyboardEvent) => { if (event.key === 'Escape') closeRef.current(); };
    document.addEventListener('pointerdown', dismiss);
    document.addEventListener('keydown', escape);
    viewerRef.current?.querySelector<HTMLButtonElement>('button')?.focus({ preventScroll: true });
    return () => {
      cancelAnimationFrame(frame);
      document.removeEventListener('pointerdown', dismiss);
      document.removeEventListener('keydown', escape);
      if (previousFocus?.isConnected) previousFocus.focus({ preventScroll: true });
    };
  }, [anchor]);
  return createPortal(<div ref={viewerRef} className="details-card-viewer details-card-viewer--floating" role="dialog"
    aria-modal="false" aria-labelledby={titleId} aria-describedby={descriptorId} data-camera-ignore="true"
    style={{ left: placement.left, top: placement.top, width: placement.width, height: placement.width * 88 / 63,
      boxShadow: tableObjectShadow(timeOfDay, { x: position.x + placement.width / 2, y: position.y }, 24, lights) }}>
    <article className="details-card" data-object-id={object.id}>
      <header className="details-card__header">
        <h2 id={titleId}>{object.name}</h2>
        <span className="details-card__badge" role="img" aria-label={object.badgeLabel}>{object.badge}</span>
      </header>
      <div className="details-card__art">{object.art}</div>
      <p id={descriptorId} className="details-card__descriptor" title={object.descriptor}>{object.descriptor}</p>
      <div className="details-card__trays">
        {object.trays.map((tray) => <section key={tray.id} className="details-card__tray" aria-label={tray.label}>
          <h3 title={tray.label}>{tray.id === 'stats' ? '▤' : tray.id === 'equipment' ? '⚔' : tray.id === 'buffs' ? '✦' : tray.label}</h3><div>{tray.content ?? <span aria-label="Not yet configured">—</span>}</div>
        </section>)}
      </div>
      <button type="button" className="details-card__close" onClick={onClose} autoFocus aria-label="Close Details Card Viewer">Close ×</button>
    </article>
  </div>, document.body);
}

/** Temporary code-native portrait, replaceable by object art without changing DCV. */
export function ActorCardArt() {
  return <svg viewBox="0 0 240 160" role="img" aria-label="Hero portrait placeholder" shapeRendering="crispEdges">
    <path fill="#142923" d="M0 0h240v160H0z" />
    <path fill="#214334" d="M0 20h30v100H0zm40-20h24v120H40zm128 0h24v120h-24zm42 20h30v100h-30z" />
    <path fill="#0a1717" d="M0 130h240v30H0z" />
    <path fill="#94784e" d="M98 25h44v12h12v36h-12v12H98V73H86V37h12z" />
    <path fill="#d5b887" d="M98 42h44v31H98z" />
    <path fill="#263449" d="M92 85h56v12h12v34H80V97h12z" />
    <path fill="#b38b40" d="M108 85h24v46h-24z" />
    <path fill="#46322c" d="M92 131h20v22H92zm36 0h20v22h-20z" />
    <path fill="#d1c8a9" d="M169 57h8v55h-8z" />
    <path fill="#e7b455" d="M159 104h28v6h-28z" />
    <path fill="#896944" d="M169 110h8v18h-8z" />
    <path fill="#243839" stroke="#b38b40" strokeWidth="4" d="M58 92h29v32l-15 15-14-15z" />
  </svg>;
}
