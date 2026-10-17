import { gameTime } from '../../gameTime';
import { TradingCard, type TradingCardSection } from './TradingCard';
import { ACTOR_HOLO_LAYERS } from '../art/actorCardArt';
import { useArtStyle } from '../artStyle';
import { LayeredCardArt } from './LayeredCardArt';
import { TABLE_CARD_SCREEN_WIDTH, CARD_RATIO } from '../tableCardPlacement';
import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { tableObjectShadow, type TableLight } from '../protoLighting';

export type DetailsCardObject = {
  id: string;
  /** A compact actor inspection can initiate the map's normal travel gesture. */
  travelActorId?: string;
  name: string;
  badge: ReactNode;
  badgeLabel: string;
  art: ReactNode;
  descriptor: string;
  descriptorPreview?: string;
  trays: TradingCardSection[];
  footer?: ReactNode;
  jumboEditor?: ReactNode;
};

/** Object-agnostic card presentation; callers supply art and future tray content. */
export function DetailsCardViewer({ objects, anchor, timeOfDay, lights, position, onClose, onCloseObject, initialJumboId = null }: {
  objects: DetailsCardObject[]; anchor: HTMLElement; timeOfDay: number; lights: TableLight[];
  position: { x: number; y: number }; onClose: () => void; onCloseObject: (id: string) => void;
  initialJumboId?: string | null;
}) {
  const groupRef = useRef<HTMLDivElement>(null);
  const travelDrag = useRef<{ pointerId: number; actorId: string; x: number; y: number; moved: boolean; face: HTMLElement | null; source: HTMLElement; opacity: string; pointerEvents: string } | null>(null);
  const suppressClick = useRef(false);
  const endTravelDrag = () => {
    const drag = travelDrag.current;
    travelDrag.current = null;
    drag?.face?.remove();
    if (drag) {
      drag.source.style.opacity = drag.opacity;
      drag.source.style.pointerEvents = drag.pointerEvents;
    }
    if (drag?.moved) window.dispatchEvent(new CustomEvent('proto-actor-drag-end'));
  };
  useEffect(() => {
    const cancel = () => endTravelDrag();
    const escape = (event: KeyboardEvent) => { if (event.key === 'Escape') cancel(); };
    window.addEventListener('blur', cancel);
    window.addEventListener('keydown', escape, true);
    return () => { cancel(); window.removeEventListener('blur', cancel); window.removeEventListener('keydown', escape, true); };
  }, []);
  const previousFocusRef = useRef(document.activeElement instanceof HTMLElement ? document.activeElement : null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  const titleId = useId();
  const descriptorId = useId();
  const [jumboId, setJumboId] = useState<string | null>(initialJumboId);
  const [editing, setEditing] = useState(false);
  const jumboRef = useRef(jumboId);
  jumboRef.current = jumboId;
  const objectsRef = useRef(objects);
  objectsRef.current = objects;
  const dismissJumbo = () => {
    const abilityClose = groupRef.current?.querySelector<HTMLButtonElement>('.trading-card-ability-view [aria-label="Close ability card"]');
    if (abilityClose) { abilityClose.click(); return; }
    if (initialJumboId) closeRef.current();
    else setJumboId(null);
  };
  const lastJumboId = useRef<string | null>(null);
  const count = objects.length;
  const objectIds = objects.map(object => object.id).join('|');
  useEffect(() => {
    if (!jumboId) {
      setEditing(false);
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
      const jumboObject = objectsRef.current.find(object => object.id === jumboRef.current);
      const belowHeight = jumboObject && (jumboObject.trays.length || jumboObject.jumboEditor) ? 100 : 0;
      const width = jumboRef.current
        ? Math.min(window.innerHeight * .82 * CARD_RATIO, (window.innerHeight - margin * 2 - belowHeight) * CARD_RATIO, window.innerWidth - (jumboObject && ['hero','mochi'].includes(jumboObject.id) ? (window.innerWidth > 900 ? 280 : 190) : 64))
        : Math.min(TABLE_CARD_SCREEN_WIDTH, (window.innerWidth - margin * 2 - gap * (count - 1)) / count, (window.innerHeight - margin * 2) * CARD_RATIO);
      const height = width / CARD_RATIO;
      const groupWidth = jumboRef.current ? width : count * width + gap * (count - 1);
      const right = rect.right + 16;
      // Move the entire row together near edges, preserving actor → tile order.
      const left = jumboRef.current ? (window.innerWidth - width + (jumboObject && ['hero','mochi'].includes(jumboObject.id) ? (window.innerWidth > 900 ? 240 : 158) : 0)) / 2
        : Math.max(margin, Math.min(window.innerWidth - groupWidth - margin, right));
      const top = jumboRef.current ? (window.innerHeight - height - belowHeight) / 2 : Math.max(margin, Math.min(rect.top, window.innerHeight - height - margin));
      setPlacement(old => old.left === left && old.top === top && old.width === width ? old : { left, top, width });
      frame = gameTime.requestAnimationFrame(update);
    };
    update();
    const dismiss = (event: PointerEvent) => {
      if (!jumboRef.current && event.target instanceof Node && !groupRef.current?.contains(event.target) && !anchor.contains(event.target)) closeRef.current();
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        if (groupRef.current?.querySelector('.trading-card-ability-view')) return;
        event.preventDefault();
        event.stopImmediatePropagation();
        if (jumboRef.current) dismissJumbo(); else closeRef.current();
      }
      if (jumboRef.current && event.key === 'Tab') {
        const controls = Array.from(groupRef.current?.querySelectorAll<HTMLElement>('.details-card-viewer--jumbo button, .details-card-viewer--jumbo input, .details-card-viewer--jumbo [tabindex="0"]') ?? []);
        const available = controls.filter(control => !control.closest('[inert]'));
        const first = available[0], last = available[available.length - 1];
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
      }
    };
    document.addEventListener('pointerdown', dismiss);
    document.addEventListener('keydown', escape, true);
    return () => {
      gameTime.cancelAnimationFrame(frame);
      document.removeEventListener('pointerdown', dismiss);
      document.removeEventListener('keydown', escape, true);
      (previousFocus?.isConnected ? previousFocus : anchor).focus({ preventScroll: true });
    };
  }, [anchor, count, initialJumboId]);
  return createPortal(<>
    {jumboId && <div className="details-card-jumbo__backdrop" data-camera-ignore="true" onClick={dismissJumbo} />}
    <div ref={groupRef} className="details-card-group" role="group" aria-label="Inspected game cards" data-camera-ignore="true">
      {objects.map((object, index) => {
        const jumbo = jumboId === object.id;
        if (jumboId && !jumbo) return null;
        return <div key={object.id}
          className={`details-card-viewer details-card-viewer--floating${jumbo ? ' details-card-viewer--jumbo' : ''}`}
          role="dialog" tabIndex={-1} aria-modal={jumbo}
          aria-labelledby={`${titleId}-${object.id}`} aria-describedby={`${descriptorId}-${object.id}`}
          data-inspection-id={object.id} data-camera-ignore="true"
          onPointerDown={event => {
            if (jumbo || !object.travelActorId || travelDrag.current || event.button !== 0 || (event.target as HTMLElement).closest('button, input, a, [role="button"]')) return;
            event.preventDefault(); event.stopPropagation();
            suppressClick.current = false;
            event.currentTarget.setPointerCapture(event.pointerId);
            travelDrag.current = { pointerId: event.pointerId, actorId: object.travelActorId, x: event.clientX, y: event.clientY, moved: false, face: null, source: event.currentTarget, opacity: event.currentTarget.style.opacity, pointerEvents: event.currentTarget.style.pointerEvents };
          }}
          onPointerMove={event => {
            const drag = travelDrag.current;
            if (!drag || drag.pointerId !== event.pointerId) return;
            if (!drag.moved && Math.hypot(event.clientX - drag.x, event.clientY - drag.y) > 6) {
              drag.moved = true; suppressClick.current = true;
              const rect = event.currentTarget.getBoundingClientRect();
              const face = event.currentTarget.cloneNode(true) as HTMLElement;
              face.removeAttribute('data-inspection-id');
              face.removeAttribute('role'); face.removeAttribute('tabindex');
              face.querySelectorAll('[id]').forEach(node => node.removeAttribute('id'));
              face.setAttribute('aria-hidden', 'true'); face.inert = true;
              Object.assign(face.style, { position: 'fixed', width: `${rect.width}px`, height: `${rect.height}px`, zIndex: '100001', pointerEvents: 'none', opacity: '0.35', transform: 'translate(-50%, -50%)' });
              face.dataset.actorCardDragGhost = 'true';
              document.body.append(face); drag.face = face;
              // Keep the captured source mounted, but clear the terrain beneath it.
              drag.source.style.opacity = '0';
              drag.source.style.pointerEvents = 'none';
              window.dispatchEvent(new CustomEvent('proto-actor-drag-start', { detail: { actorId: drag.actorId, x: event.clientX, y: event.clientY } }));
            }
            if (drag.moved) {
              Object.assign(drag.face!.style, { left: `${event.clientX}px`, top: `${event.clientY}px` });
              window.dispatchEvent(new CustomEvent('proto-actor-drag-move', { detail: { actorId: drag.actorId, x: event.clientX, y: event.clientY } }));
            }
          }}
          onPointerUp={event => {
            const drag = travelDrag.current;
            if (!drag || drag.pointerId !== event.pointerId) return;
            if (drag.moved) {
              // Remove the floating row from hit testing before resolving the tile.
              const group = groupRef.current!;
              const previous = group.style.pointerEvents;
              group.style.pointerEvents = 'none';
              window.dispatchEvent(new CustomEvent('proto-actor-pointer-drop', { detail: { actorId: drag.actorId, x: event.clientX, y: event.clientY } }));
              group.style.pointerEvents = previous;
            }
            endTravelDrag();
          }}
          onPointerCancel={endTravelDrag}
          onLostPointerCapture={endTravelDrag}
          onClick={() => { if (suppressClick.current) { suppressClick.current = false; return; } if (!jumbo) setJumboId(object.id); }}
          onKeyDown={event => { if (!jumbo && event.key === 'Enter') { event.preventDefault(); setJumboId(object.id); } }}
          style={{
            left: placement.left + (jumbo ? 0 : index * (placement.width + 32)), top: placement.top,
            width: placement.width, height: placement.width / CARD_RATIO,
            touchAction: object.travelActorId && !jumbo ? 'none' : undefined,
            cursor: object.travelActorId && !jumbo ? 'grab' : undefined,
            boxShadow: tableObjectShadow(timeOfDay, { x: position.x + placement.width / 2, y: position.y }, 24, lights),
          }}>
          {jumbo && editing && object.jumboEditor ? <div className="actor-playtest-panel">
            <h2>{object.name} · Playtest</h2>{object.jumboEditor}
            <button type="button" className="tile-card-action details-card-jumbo__close" onClick={() => setEditing(false)}>Back to card</button>
          </div> : <TradingCard id={object.id} title={object.name} titleId={`${titleId}-${object.id}`} state={jumbo ? 'jumbo' : 'compact'}
            headerAction={<button type="button"
              className={`trading-card__badge trading-card__close${jumbo ? ' details-card-jumbo__close' : ''}`}
              aria-label={jumbo ? 'Close jumbo card' : 'Close details card'}
              onKeyDown={event => { if (event.key === 'Enter') event.stopPropagation(); }}
              onClick={event => { event.stopPropagation(); if (jumbo) dismissJumbo(); else onCloseObject(object.id); }}>
              <span aria-hidden="true">×</span>
            </button>} art={object.art}
            description={object.descriptor} descriptionPreview={object.descriptorPreview}
            descriptionId={`${descriptorId}-${object.id}`} footer={object.footer}
            belowCard={jumbo && object.jumboEditor ? <button type="button" className="tile-card-action" onClick={() => setEditing(true)}>Playtest values</button> : undefined}
            sections={object.trays.map(tray => ({ ...tray,
              icon: tray.icon ?? (tray.id === 'stats' ? '▤' : tray.id === 'equipment' ? '⚔' : tray.id === 'buffs' ? '✦' : undefined),
            }))} />}
        </div>;
      })}
    </div></>, document.body);
}

/** Actor portrait: the actor's sprite when it has one (and it loads), otherwise a code-native placeholder. */
export function ActorCardArt({ sprite, label }: { sprite?: string; label: string }) {
  const artStyle = useArtStyle();
  const [failedSprite, setFailedSprite] = useState<string | null>(null);
  const layers = artStyle === 'paint' && sprite && ACTOR_HOLO_LAYERS[sprite];
  if (layers) return <LayeredCardArt {...layers} label={label} />;
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
