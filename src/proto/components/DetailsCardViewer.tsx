import { TradingCard } from './TradingCard';
import { TABLE_CARD_SCREEN_WIDTH, CARD_RATIO } from '../tableCardPlacement';
import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { tableObjectShadow, type TableLight } from '../protoLighting';

export type DetailsCardObject = {
  id: string;
  name: string;
  badge: ReactNode;
  badgeLabel: string;
  art: ReactNode;
  descriptor: string;
  descriptorPreview?: string;
  trays: Array<{ id: string; label: string; icon?: ReactNode; content?: ReactNode; details?: ReactNode }>;
  footer?: ReactNode;
};

/** Object-agnostic card presentation; callers supply art and future tray content. */
export function DetailsCardViewer({ objects, anchor, timeOfDay, lights, position, onClose, onCloseObject }: {
  objects: DetailsCardObject[]; anchor: HTMLElement; timeOfDay: number; lights: TableLight[];
  position: { x: number; y: number }; onClose: () => void; onCloseObject: (id: string) => void;
}) {
  const groupRef = useRef<HTMLDivElement>(null);
  const previousFocusRef = useRef(document.activeElement instanceof HTMLElement ? document.activeElement : null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  const titleId = useId();
  const descriptorId = useId();
  const [jumboId, setJumboId] = useState<string | null>(null);
  const jumboRef = useRef(jumboId);
  jumboRef.current = jumboId;
  const lastJumboId = useRef<string | null>(null);
  const count = objects.length;
  const objectIds = objects.map(object => object.id).join('|');
  useEffect(() => {
    if (!jumboId) {
      const returning = lastJumboId.current && groupRef.current?.querySelector<HTMLElement>(`[data-inspection-id="${lastJumboId.current}"]`);
      (returning || groupRef.current?.querySelector<HTMLElement>('.details-card-viewer'))?.focus({ preventScroll: true });
      return;
    }
    lastJumboId.current = jumboId;
    const root = document.getElementById('root');
    const wasInert = root?.inert ?? false;
    const wasBlurred = root?.classList.contains('details-card-game-blurred') ?? false;
    if (root) { root.inert = true; root.classList.add('details-card-game-blurred'); }
    groupRef.current?.querySelector<HTMLButtonElement>('.details-card-jumbo__close')?.focus({ preventScroll: true });
    return () => { if (root) { root.inert = wasInert; if (!wasBlurred) root.classList.remove('details-card-game-blurred'); } };
  }, [jumboId, objectIds]);
  const [placement, setPlacement] = useState({ left: 0, top: 0, width: TABLE_CARD_SCREEN_WIDTH });
  useEffect(() => {
    const previousFocus = previousFocusRef.current;
    let frame = 0;
    const update = () => {
      if (!anchor.isConnected) { closeRef.current(); return; }
      const rect = anchor.getBoundingClientRect();
      // Reserve space for the stronger card's perspective sweep near screen edges.
      const margin = 32;
      const gap = 32;
      const width = jumboRef.current
        ? Math.min(window.innerHeight * .82 * CARD_RATIO, window.innerWidth * .82)
        : Math.min(TABLE_CARD_SCREEN_WIDTH, (window.innerWidth - margin * 2 - gap * (count - 1)) / count, (window.innerHeight - margin * 2) * CARD_RATIO);
      const height = width / CARD_RATIO;
      const groupWidth = jumboRef.current ? width : count * width + gap * (count - 1);
      const right = rect.right + 16;
      // Move the entire row together near edges, preserving actor → tile order.
      const left = jumboRef.current ? (window.innerWidth - width) / 2
        : Math.max(margin, Math.min(window.innerWidth - groupWidth - margin, right));
      const top = jumboRef.current ? (window.innerHeight - height) / 2 : Math.max(margin, Math.min(rect.top, window.innerHeight - height - margin));
      setPlacement(old => old.left === left && old.top === top && old.width === width ? old : { left, top, width });
      frame = requestAnimationFrame(update);
    };
    update();
    const dismiss = (event: PointerEvent) => {
      if (!jumboRef.current && event.target instanceof Node && !groupRef.current?.contains(event.target) && !anchor.contains(event.target)) closeRef.current();
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        if (jumboRef.current) setJumboId(null); else closeRef.current();
      }
      if (jumboRef.current && event.key === 'Tab') {
        const controls = Array.from(groupRef.current?.querySelectorAll<HTMLElement>('.details-card-viewer--jumbo button, .details-card-viewer--jumbo [tabindex="0"]') ?? []);
        const first = controls[0], last = controls[controls.length - 1];
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
      }
    };
    document.addEventListener('pointerdown', dismiss);
    document.addEventListener('keydown', escape);
    return () => {
      cancelAnimationFrame(frame);
      document.removeEventListener('pointerdown', dismiss);
      document.removeEventListener('keydown', escape);
      (previousFocus?.isConnected ? previousFocus : anchor).focus({ preventScroll: true });
    };
  }, [anchor, count]);
  return createPortal(<>
    {jumboId && <div className="details-card-jumbo__backdrop" data-camera-ignore="true" onClick={() => setJumboId(null)} />}
    <div ref={groupRef} className="details-card-group" role="group" aria-label="Inspected game cards" data-camera-ignore="true">
      {objects.map((object, index) => {
        const jumbo = jumboId === object.id;
        if (jumboId && !jumbo) return null;
        return <div key={object.id}
          className={`details-card-viewer details-card-viewer--floating${jumbo ? ' details-card-viewer--jumbo' : ''}`}
          role="dialog" tabIndex={-1} aria-modal={jumbo}
          aria-labelledby={`${titleId}-${object.id}`} aria-describedby={`${descriptorId}-${object.id}`}
          data-inspection-id={object.id} data-camera-ignore="true"
          onClick={() => { if (!jumbo) setJumboId(object.id); }}
          onKeyDown={event => { if (!jumbo && event.key === 'Enter') { event.preventDefault(); setJumboId(object.id); } }}
          style={{
            left: placement.left + (jumbo ? 0 : index * (placement.width + 32)), top: placement.top,
            width: placement.width, height: placement.width / CARD_RATIO,
            boxShadow: tableObjectShadow(timeOfDay, { x: position.x + placement.width / 2, y: position.y }, 24, lights),
          }}>
          <TradingCard id={object.id} title={object.name} titleId={`${titleId}-${object.id}`} state={jumbo ? 'jumbo' : 'compact'}
            headerAction={<button type="button"
              className={`trading-card__badge trading-card__close${jumbo ? ' details-card-jumbo__close' : ''}`}
              aria-label={jumbo ? 'Close jumbo card' : 'Close details card'}
              onKeyDown={event => { if (event.key === 'Enter') event.stopPropagation(); }}
              onClick={event => { event.stopPropagation(); if (jumbo) setJumboId(null); else onCloseObject(object.id); }}>
              <span aria-hidden="true">×</span>
            </button>} art={object.art}
            description={object.descriptor} descriptionPreview={object.descriptorPreview}
            descriptionId={`${descriptorId}-${object.id}`} footer={object.footer}
            sections={object.trays.map(tray => ({ ...tray,
              icon: tray.icon ?? (tray.id === 'stats' ? '▤' : tray.id === 'equipment' ? '⚔' : tray.id === 'buffs' ? '✦' : undefined),
            }))} />
        </div>;
      })}
    </div></>, document.body);
}

/** Actor portrait: the actor's sprite when it has one (and it loads), otherwise a code-native placeholder. */
export function ActorCardArt({ sprite, label }: { sprite?: string; label: string }) {
  const [failedSprite, setFailedSprite] = useState<string | null>(null);
  if (sprite && sprite !== failedSprite) {
    return <img className="details-card__sprite" src={sprite} alt={`${label} portrait`} draggable={false} onError={() => setFailedSprite(sprite)} />;
  }
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
