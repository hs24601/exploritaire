import { gameTime } from '../../gameTime';
import { createPortal } from 'react-dom';
import { useEffect, useRef, useState, type PointerEvent, type ReactNode } from 'react';
import { availableMovesFor } from '../rules/battleAbilities';
import './TradingCard.css';
import {assignedMovesFor,assignMove,useActorLoadouts} from '../actorLoadouts';
import { requestHoloDeviceTilt, useHoloDeviceTilt, type HoloTilt } from '../useHoloDeviceTilt';
import { GYRO_LOG_ENABLED, traceHoloCard, type HoloCardTrace } from '../holoDiagnostics';
import { holoTiltAngles } from '../holoTilt';
import { useCardJumbo } from './CardJumbo';
import { AbilityArtwork } from './AbilityArtwork';

/** One icon on the jumbo card's strip; its label is the hover/tap explanation. */
export type TradingCardChip = { id: string; icon: ReactNode; value?: ReactNode; label: string };
export type TradingCardSection = { id: string; label: string; icon?: ReactNode; content?: ReactNode;
  /** Plain-text details, shown on hover/tap of the jumbo icon. */
  details?: string;
  /** Splits the section into several jumbo icons (e.g. HP and INSP). */
  chips?: TradingCardChip[] };

/** Jumbo icons for a section: its own chips, or one icon carrying the section. */
const jumboChips = (section: TradingCardSection): TradingCardChip[] => section.chips ?? [{
  id: section.id, icon: section.icon ?? section.label, value: section.content ?? '—',
  label: `${section.label}: ${section.details ?? 'Not yet configured'}`,
}];
export type TradingCardProps = {
  id: string; title: ReactNode; titleId?: string; badge?: ReactNode; badgeLabel?: string; headerAction?: ReactNode;
  art: ReactNode; description?: string; descriptionPreview?: ReactNode; descriptionId?: string;
  cornerAdornment?: ReactNode;
  sections?: TradingCardSection[]; footer?: ReactNode; belowCard?: ReactNode; finish?: 'diagonal-holo' | 'plain';
  state?: 'compact' | 'jumbo' | 'foundation';
  /** A parent card control owns input (for example the combat ability fan). */
  interactive?: boolean;
  /** Read motion from the owning ability control without adding nested input. */
  motionFromParent?: boolean;
  className?: string;
};

/** Modular face: art, title, description, sections and footer remain real DOM slots.
 * Foil sits above the art but below the copy; pointer input never reaches the camera. */
export function TradingCard({ id, title, titleId, badge, badgeLabel, headerAction, art, description, descriptionPreview,
  descriptionId, sections = [], footer, belowCard, cornerAdornment, finish = 'diagonal-holo', state = 'compact', interactive = true, motionFromParent = false, className = '' }: TradingCardProps) {
  const jumboViewer = useCardJumbo();
  const openJumbo = (source:HTMLElement) => {
    const foundation=source.closest<HTMLButtonElement>('button[data-targetable="true"]');
    jumboViewer?.open({title:typeof title==='string'?title:'Card',content:<TradingCard id={id} title={title} badge={badge} badgeLabel={badgeLabel} art={art} description={description} sections={sections} footer={footer} belowCard={belowCard} finish={finish} state="jumbo" />,
      action:foundation?()=>foundation.click():undefined,actionLabel:'Choose foundation'});
  };
  const face = useRef<HTMLElement>(null);
  const [selectedMove, setSelectedMove] = useState<string | null>(null);
  const abilityClose = useRef<HTMLButtonElement>(null);
  const abilitySource = useRef<HTMLButtonElement | null>(null);
  useActorLoadouts();
  const moves = state === 'jumbo' ? assignedMovesFor(id) : [];
  const catalogue = state === 'jumbo' ? availableMovesFor(id) : [];
  const available = catalogue.filter(m=>!moves.some(a=>a.name===m.name));
  const drag=useRef<{name:string;x:number;y:number;moved:boolean}|null>(null);
  const transferProps=(name:string)=>({
    onPointerDown:(e:PointerEvent<HTMLButtonElement>)=>{e.stopPropagation();e.currentTarget.setPointerCapture(e.pointerId);drag.current={name,x:e.clientX,y:e.clientY,moved:false};},
    onPointerMove:(e:PointerEvent<HTMLButtonElement>)=>{e.stopPropagation();if(drag.current&&Math.hypot(e.clientX-drag.current.x,e.clientY-drag.current.y)>8){drag.current.moved=true;setMoving({name,x:e.clientX,y:e.clientY});}},
    onPointerUp:(e:PointerEvent<HTMLButtonElement>)=>{e.stopPropagation();setMoving(null);if(drag.current?.moved){const tray=document.elementFromPoint(e.clientX,e.clientY)?.closest<HTMLElement>('[data-loadout-tray]');if(tray?.dataset.loadoutActor===id)assignMove(id,name,tray.dataset.loadoutTray==='assigned',document.elementFromPoint(e.clientX,e.clientY)?.closest<HTMLElement>('[data-loadout-move]')?.dataset.loadoutMove);}},
    onPointerCancel:()=>{drag.current=null;setMoving(null);},
    onKeyDown:(e:React.KeyboardEvent<HTMLButtonElement>)=>{if(e.key==='Delete'){e.preventDefault();assignMove(id,name,false);}if(e.key==='Enter'&&e.shiftKey){e.preventDefault();assignMove(id,name,true);}},
  });
  useEffect(()=>{const clear=()=>{drag.current=null;setMoving(null);};window.addEventListener('blur',clear);return()=>window.removeEventListener('blur',clear);},[]);
  const move = catalogue.find(entry => entry.name === selectedMove);
  const [moving,setMoving]=useState<{name:string;x:number;y:number}|null>(null);
  const frozen = !!move;
  const closeAbility = () => setSelectedMove(null);
  useEffect(() => { if (!selectedMove) abilitySource.current?.focus({ preventScroll: true }); }, [selectedMove]);
  useEffect(() => {
    if (!move) return;
    abilityClose.current?.focus({ preventScroll: true });
  }, [move]);
  const frame = useRef(0);
  const target = useRef({ x: 50, y: 50, lift: 0 });
  const motion = useRef({ x: 50, y: 50, lift: 0 });
  const velocity = useRef({ x: 0, y: 0, lift: 0 });
  const reducedMotion = useRef(false);
  const pointerActive = useRef(false);
  const deviceTilt = useRef<HoloTilt | null>(null);
  const debug = useRef<HoloCardTrace>({ sensor: null, input: 'idle', target: target.current, frames: 0, queued: false });
  const trace = () => {
    if (!GYRO_LOG_ENABLED) return;
    debug.current.input = pointerActive.current ? 'pointer' : deviceTilt.current ? 'sensor' : 'idle';
    debug.current.target = target.current;
    debug.current.queued = frame.current !== 0;
    traceHoloCard(face.current, debug.current);
  };
  useEffect(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => { reducedMotion.current = media.matches; };
    update(); media.addEventListener('change', update);
    return () => {
      gameTime.cancelAnimationFrame(frame.current);
      // Effect replay can cancel a frame after a sensor has already queued it.
      // Release the handle so subsequent readings can restart the spring.
      frame.current = 0;
      media.removeEventListener('change', update);
    };
  }, []);
  const paint = ({ x, y, lift }: HoloTilt) => {
    const el = face.current;
    if (!el) return;
    const angles = holoTiltAngles({ x, y });
    el.style.setProperty('--foil-x', `${x}%`);
    el.style.setProperty('--foil-y', `${y}%`);
    el.style.setProperty('--art-shift-x', `${Math.max(-1, Math.min(1, (x - 50) / 50))}`);
    el.style.setProperty('--art-shift-y', `${Math.max(-1, Math.min(1, (y - 50) / 50))}`);
    el.style.setProperty('--tilt-x', `${angles.x}deg`);
    el.style.setProperty('--tilt-y', `${angles.y}deg`);
    el.style.setProperty('--card-lift', `${lift}`);
    el.style.setProperty('--shadow-x', `${(50 - x) * .15}px`);
    if (GYRO_LOG_ENABLED) debug.current.frames++;
    trace();
  };
  const animate = () => {
    if (frame.current) { trace(); return; }
    let previous = gameTime.now();
    const tick = (now: number) => {
      const dt = Math.min((now - previous) / 1000, 1 / 30);
      previous = now;
      let settled = true;
      for (const key of ['x', 'y', 'lift'] as const) {
        // A damped spring follows fast pointer changes and eases back to rest.
        velocity.current[key] += ((target.current[key] - motion.current[key]) * 190 - velocity.current[key] * 24) * dt;
        motion.current[key] += velocity.current[key] * dt;
        if (Math.abs(target.current[key] - motion.current[key]) > .001 || Math.abs(velocity.current[key]) > .001) settled = false;
      }
      if (settled) { motion.current = { ...target.current }; velocity.current = { x: 0, y: 0, lift: 0 }; }
      const el = face.current;
      if (!el) { frame.current = 0; return; }
      paint(motion.current);
      frame.current = settled ? 0 : gameTime.requestAnimationFrame(tick);
      trace();
    };
    frame.current = gameTime.requestAnimationFrame(tick);
    trace();
  };
  const interact = (event: PointerEvent<HTMLDivElement>) => {
    if (!interactive || state === 'foundation' || frozen) return;
    // Measure the stationary stage, never the rotating face: avoids hover feedback.
    const rect = event.currentTarget.getBoundingClientRect();
    if (reducedMotion.current) return;
    // Hold the pose over the icon strip so an icon never slides out from under
    // the pointer before its explanation appears.
    if (event.pointerType !== 'touch' && event.target instanceof Element && event.target.closest('.trading-card__chips,.trading-card__abilities')) return;
    pointerActive.current = true;
    target.current = { x: Math.max(0, Math.min(100, (event.clientX - rect.left) / rect.width * 100)),
      y: Math.max(0, Math.min(100, (event.clientY - rect.top) / rect.height * 100)), lift: 1 };
    face.current?.style.setProperty('--foil-active', '1');
    animate();
  };
  const reset = () => {
    pointerActive.current = false;
    if (state === 'foundation' || frozen) {
      gameTime.cancelAnimationFrame(frame.current); frame.current = 0;
      deviceTilt.current = null;
      target.current = motion.current = { x: 50, y: 50, lift: 0 };
      velocity.current = { x: 0, y: 0, lift: 0 };
      face.current?.style.setProperty('--foil-active', '0');
      paint(motion.current);
      return;
    }
    target.current = deviceTilt.current ?? { x: 50, y: 50, lift: 0 };
    face.current?.style.setProperty('--foil-active', target.current.lift > 0 ? '1' : '0');
    animate();
  };
  useEffect(() => {
    if (!motionFromParent) return;
    const host = face.current?.parentElement?.parentElement;
    if (!host) return;
    const follow = (event: globalThis.PointerEvent) => {
      if (reducedMotion.current || frozen) return;
      const rect = host.getBoundingClientRect();
      pointerActive.current = true;
      target.current = { x: Math.max(0, Math.min(100, (event.clientX - rect.left) / rect.width * 100)),
        y: Math.max(0, Math.min(100, (event.clientY - rect.top) / rect.height * 100)), lift: 1 };
      face.current?.style.setProperty('--foil-active', '1');
      animate();
    };
    const focus = () => {
      if (reducedMotion.current || frozen) return;
      target.current = { x: 58, y: 42, lift: 1 };
      face.current?.style.setProperty('--foil-active', '1');
      animate();
    };
    const release = (event: globalThis.PointerEvent) => { if (event.pointerType === 'touch') reset(); };
    host.addEventListener('pointerenter', follow);
    host.addEventListener('pointermove', follow);
    host.addEventListener('pointerdown', follow);
    host.addEventListener('pointerleave', reset);
    host.addEventListener('pointercancel', reset);
    host.addEventListener('pointerup', release);
    host.addEventListener('focusin', focus);
    host.addEventListener('focusout', reset);
    window.addEventListener('blur', reset);
    return () => {
      host.removeEventListener('pointerenter', follow); host.removeEventListener('pointermove', follow);
      host.removeEventListener('pointerdown', follow); host.removeEventListener('pointerleave', reset);
      host.removeEventListener('pointercancel', reset); host.removeEventListener('pointerup', release);
      host.removeEventListener('focusin', focus); host.removeEventListener('focusout', reset);
      window.removeEventListener('blur', reset);
    };
  }, [motionFromParent, frozen]);
  useEffect(() => { if (frozen) reset(); }, [frozen]);
  useHoloDeviceTilt(interactive && state !== 'foundation' && !frozen && finish === 'diagonal-holo', `${id}:${state}`, tilt => {
    deviceTilt.current = tilt;
    if (!tilt && (document.hidden || reducedMotion.current)) {
      // Stop immediately while hidden/static; don't leave a spring queued for
      // the first frame after the page or motion preference resumes.
      gameTime.cancelAnimationFrame(frame.current); frame.current = 0;
      pointerActive.current = false;
      target.current = motion.current = { x: 50, y: 50, lift: 0 };
      velocity.current = { x: 0, y: 0, lift: 0 };
      face.current?.style.setProperty('--foil-active', '0');
      paint(motion.current);
      return;
    }
    if (!pointerActive.current) reset();
  }, GYRO_LOG_ENABLED ? sensor => { debug.current.sensor = sensor; trace(); } : undefined);
  return <div className={`trading-card-stage ${className}${move ? ' trading-card-stage--ability-open' : ''}`}
    tabIndex={state === 'foundation' ? 0 : undefined} role={state === 'foundation' ? 'button' : undefined} aria-haspopup={state === 'foundation' ? 'dialog' : undefined}
    onClick={event=>{if(state==='foundation'&&!event.currentTarget.closest('.proto-exploration-actor')){
      // Let an armed tableau choice reach its foundation's gameplay handler.
      if(event.currentTarget.closest('button[data-targetable="true"]'))return;
      event.stopPropagation();openJumbo(event.currentTarget);
    }}}
    onKeyDown={event=>{if(move && event.key==='Escape'){event.preventDefault();event.stopPropagation();closeAbility();return;}if(state==='foundation'&&event.key==='Enter'&&!event.currentTarget.closest('.proto-exploration-actor')){
      event.preventDefault();event.stopPropagation();
      const target=event.currentTarget.closest<HTMLButtonElement>('button[data-targetable="true"]');
      if(target)target.click();else openJumbo(event.currentTarget);
    }}}
    onPointerMove={interact} onPointerDown={event => { if (interactive && state !== 'foundation') requestHoloDeviceTilt(); interact(event); }} onPointerLeave={reset} onPointerCancel={reset}
    onPointerUp={event => { if (event.pointerType === 'touch') reset(); }}>
    {moving && createPortal(<div className="loadout-drag-label" style={{left:moving.x+12,top:moving.y+12}} aria-hidden="true">{moving.name}</div>,document.body)}
    {!!catalogue.length && <aside inert={frozen} className="trading-card__available trading-card__abilities" data-loadout-tray="available" data-loadout-actor={id} aria-label="Available abilities"><h3>Available abilities</h3><p>Drag to assign or remove. Drop on an assigned ability to replace it. {moves.length}/4 assigned.</p>{available.map(entry=><button type="button" key={entry.name} data-loadout-move={entry.name} {...transferProps(entry.name)} title="Drag to assign or Shift+Enter" onClick={e=>{e.stopPropagation();if(drag.current?.moved){drag.current=null;return;}abilitySource.current=e.currentTarget;setSelectedMove(entry.name);}}>{entry.name}</button>)}{!available.length&&<p>All abilities assigned</p>}</aside>}
    <article ref={face} inert={frozen} className={`details-card trading-card trading-card--${finish} trading-card--${state}${frozen ? ' trading-card--frozen' : ''}`} data-object-id={id} data-card-state={state}>
    <div className="trading-card__art">{art}</div>
    <div className="trading-card__foil" aria-hidden="true" />
    <div className="trading-card__glare" aria-hidden="true" />
    {cornerAdornment}
    <header className="trading-card__header">
      <h2 id={titleId}>{title}</h2>
      {headerAction ?? (badge && <span className="trading-card__badge" role="img" aria-label={badgeLabel}>{badge}</span>)}
    </header>
    <div className="trading-card__body" data-card-layer="overlay">
      {description && (state === 'jumbo' ? <section className="trading-card__full-description" data-card-layer="description" aria-label="Description">
        <h3>Description</h3><p id={descriptionId}>{description}</p>
      </section> : <p id={descriptionId} className="trading-card__description" title={description}
        tabIndex={interactive?0:undefined} aria-label={description}>{descriptionPreview ?? description}</p>)}
      {!!catalogue.length && <div data-loadout-tray="assigned" data-loadout-actor={id} className="trading-card__abilities" data-card-layer="abilities" role="group" aria-label={`${typeof title === 'string' ? title : 'Actor'} abilities`}>
        {!moves.length && <p>Drop abilities here</p>}{moves.map(entry => <button type="button" key={entry.name} data-loadout-move={entry.name} {...transferProps(entry.name)} title="Drag to remove or press Delete" aria-pressed={selectedMove === entry.name}
          onClick={event => { event.stopPropagation(); if(drag.current?.moved){drag.current=null;return;} abilitySource.current = event.currentTarget; setSelectedMove(entry.name); }}>
          <span aria-hidden="true">{entry.name === 'Fetch' ? '↥' : entry.name === 'Dig' ? '⛏' : entry.name === 'Takedown' ? '✦' : entry.name === 'Vice Grip' ? '⛓' : id === 'mochi' ? '✤' : '⚔'}</span>{entry.name}
        </button>)}
      </div>}
      {!!sections.length && state !== 'jumbo' && <div className="trading-card__sections">
        {sections.map(section => <section className="trading-card__section" key={section.id} data-section={section.id}
          aria-label={section.label} title={state === 'compact' ? section.label : undefined} tabIndex={0}>
          <h3>{section.icon ?? section.label}</h3>
          <div>{section.content ?? <span aria-label="Not yet configured">—</span>}</div>
        </section>)}
      </div>}
      {footer && <footer className="trading-card__footer">{footer}</footer>}
    </div>
    </article>
    {state === 'jumbo' && (!!sections.length || belowCard) && <div className="trading-card__below" inert={frozen}
      onPointerMove={event => event.stopPropagation()} onPointerDown={event => event.stopPropagation()}>
      {!!sections.length && <div className="trading-card__chips" role="list" aria-label="Stats, equipment and effects">
        {sections.flatMap(section => jumboChips(section).map(chip => <span className="trading-card__chip" role="listitem" key={chip.id}
          data-section={section.id} data-chip={chip.id} title={chip.label} aria-label={chip.label} tabIndex={0}>
          <span className="trading-card__chip-icon" aria-hidden="true">{chip.icon}</span>
          {chip.value !== undefined && <span aria-hidden="true">{chip.value}</span>}
        </span>))}
      </div>}
      {belowCard && <div className="trading-card__below-action">{belowCard}</div>}
    </div>}
    {move && <div className="trading-card-ability-view"
      role="group" aria-label={`${move.name} ability card`} data-camera-ignore="true"
      onClick={event => event.stopPropagation()} onPointerMove={event => event.stopPropagation()}
      onPointerDown={event => event.stopPropagation()} onPointerLeave={event => event.stopPropagation()}
      onKeyDown={event => { if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); closeAbility(); } }}>
      <TradingCard id={`ability-${id}-${move.name}`} title={move.name} art={<AbilityArtwork name={move.name} fallback={art} />} state="jumbo"
        description={move.description} footer={`${move.name==='Dig'?'Variable':move.cost} AP${move.name === 'Vice Grip' ? ' minimum' : ''}`}
        headerAction={<button ref={abilityClose} type="button" className="trading-card__badge trading-card__close" aria-label="Close ability card" onClick={closeAbility}>×</button>} />
    </div>}
  </div>;
}
