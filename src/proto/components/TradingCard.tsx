import { useEffect, useRef, type PointerEvent, type ReactNode } from 'react';
import './TradingCard.css';
import { requestHoloDeviceTilt, useHoloDeviceTilt, type HoloTilt } from '../useHoloDeviceTilt';
import { GYRO_LOG_ENABLED, traceHoloCard, type HoloCardTrace } from '../holoDiagnostics';
import { holoTiltAngles } from '../holoTilt';
import { useCardJumbo } from './CardJumbo';

/** One icon on the jumbo card's strip; its label is the hover/tap explanation. */
export type TradingCardChip = { id: string; icon: ReactNode; value?: ReactNode; label: string };
export type TradingCardSection = { id: string; label: string; icon?: ReactNode; content?: ReactNode;
  /** Plain-text details, shown on hover/tap of the jumbo icon. */
  details?: string;
  /** Splits the section into several jumbo icons (e.g. HP and STA). */
  chips?: TradingCardChip[] };

/** Jumbo icons for a section: its own chips, or one icon carrying the section. */
const jumboChips = (section: TradingCardSection): TradingCardChip[] => section.chips ?? [{
  id: section.id, icon: section.icon ?? section.label, value: section.content ?? '—',
  label: `${section.label}: ${section.details ?? 'Not yet configured'}`,
}];
export type TradingCardProps = {
  id: string; title: ReactNode; titleId?: string; badge?: ReactNode; badgeLabel?: string; headerAction?: ReactNode;
  art: ReactNode; description?: string; descriptionPreview?: ReactNode; descriptionId?: string;
  sections?: TradingCardSection[]; footer?: ReactNode; finish?: 'diagonal-holo' | 'plain';
  state?: 'compact' | 'jumbo' | 'foundation';
};

/** Modular face: art, title, description, sections and footer remain real DOM slots.
 * Foil sits above the art but below the copy; pointer input never reaches the camera. */
export function TradingCard({ id, title, titleId, badge, badgeLabel, headerAction, art, description, descriptionPreview,
  descriptionId, sections = [], footer, finish = 'diagonal-holo', state = 'compact' }: TradingCardProps) {
  const jumboViewer = useCardJumbo();
  const openJumbo = (source:HTMLElement) => {
    const foundation=source.closest<HTMLButtonElement>('button[data-targetable="true"]');
    jumboViewer?.open({title:typeof title==='string'?title:'Card',content:<TradingCard id={id} title={title} badge={badge} badgeLabel={badgeLabel} art={art} description={description} sections={sections} footer={footer} finish={finish} state="jumbo" />,
      action:foundation?()=>foundation.click():undefined,actionLabel:'Choose foundation'});
  };
  const face = useRef<HTMLElement>(null);
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
      cancelAnimationFrame(frame.current);
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
    el.style.setProperty('--tilt-x', `${angles.x}deg`);
    el.style.setProperty('--tilt-y', `${angles.y}deg`);
    el.style.setProperty('--card-lift', `${lift}`);
    el.style.setProperty('--shadow-x', `${(50 - x) * .15}px`);
    if (GYRO_LOG_ENABLED) debug.current.frames++;
    trace();
  };
  const animate = () => {
    if (frame.current) { trace(); return; }
    let previous = performance.now();
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
      frame.current = settled ? 0 : requestAnimationFrame(tick);
      trace();
    };
    frame.current = requestAnimationFrame(tick);
    trace();
  };
  const interact = (event: PointerEvent<HTMLDivElement>) => {
    if (state === 'foundation') return;
    // Measure the stationary stage, never the rotating face: avoids hover feedback.
    const rect = event.currentTarget.getBoundingClientRect();
    if (reducedMotion.current) return;
    // Hold the pose over the icon strip so an icon never slides out from under
    // the pointer before its explanation appears.
    if (event.pointerType !== 'touch' && event.target instanceof Element && event.target.closest('.trading-card__chips')) return;
    pointerActive.current = true;
    target.current = { x: Math.max(0, Math.min(100, (event.clientX - rect.left) / rect.width * 100)),
      y: Math.max(0, Math.min(100, (event.clientY - rect.top) / rect.height * 100)), lift: 1 };
    face.current?.style.setProperty('--foil-active', '1');
    animate();
  };
  const reset = () => {
    pointerActive.current = false;
    if (state === 'foundation') {
      cancelAnimationFrame(frame.current); frame.current = 0;
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
  useHoloDeviceTilt(state !== 'foundation' && finish === 'diagonal-holo', `${id}:${state}`, tilt => {
    deviceTilt.current = tilt;
    if (!tilt && (document.hidden || reducedMotion.current)) {
      // Stop immediately while hidden/static; don't leave a spring queued for
      // the first frame after the page or motion preference resumes.
      cancelAnimationFrame(frame.current); frame.current = 0;
      pointerActive.current = false;
      target.current = motion.current = { x: 50, y: 50, lift: 0 };
      velocity.current = { x: 0, y: 0, lift: 0 };
      face.current?.style.setProperty('--foil-active', '0');
      paint(motion.current);
      return;
    }
    if (!pointerActive.current) reset();
  }, GYRO_LOG_ENABLED ? sensor => { debug.current.sensor = sensor; trace(); } : undefined);
  return <div className="trading-card-stage"
    tabIndex={state === 'foundation' ? 0 : undefined} role={state === 'foundation' ? 'button' : undefined} aria-haspopup={state === 'foundation' ? 'dialog' : undefined}
    onClick={event=>{if(state==='foundation'&&!event.currentTarget.closest('.proto-exploration-actor')){event.stopPropagation();openJumbo(event.currentTarget);}}}
    onKeyDown={event=>{if(state==='foundation'&&event.key==='Enter'&&!event.currentTarget.closest('.proto-exploration-actor')){event.preventDefault();event.stopPropagation();openJumbo(event.currentTarget);}}}
    onPointerMove={interact} onPointerDown={event => { if (state !== 'foundation') requestHoloDeviceTilt(); interact(event); }} onPointerLeave={reset} onPointerCancel={reset}
    onPointerUp={event => { if (event.pointerType === 'touch') reset(); }}>
    <article ref={face} className={`details-card trading-card trading-card--${finish} trading-card--${state}`} data-object-id={id} data-card-state={state}>
    <div className="trading-card__art">{art}</div>
    <div className="trading-card__foil" aria-hidden="true" />
    <div className="trading-card__glare" aria-hidden="true" />
    <header className="trading-card__header">
      <h2 id={titleId}>{title}</h2>
      {headerAction ?? (badge && <span className="trading-card__badge" role="img" aria-label={badgeLabel}>{badge}</span>)}
    </header>
    <div className="trading-card__body">
      {description && (state === 'jumbo' ? <section className="trading-card__full-description" aria-label="Description">
        <h3>Description</h3><p id={descriptionId}>{description}</p>
      </section> : <p id={descriptionId} className="trading-card__description" title={description}
        tabIndex={0} aria-label={description}>{descriptionPreview ?? description}</p>)}
      {!!sections.length && state === 'jumbo' && <div className="trading-card__chips" role="list" aria-label="Stats, equipment and effects">
        {sections.flatMap(section => jumboChips(section).map(chip => <span className="trading-card__chip" role="listitem" key={chip.id}
          data-section={section.id} data-chip={chip.id} title={chip.label} aria-label={chip.label} tabIndex={0}>
          <span className="trading-card__chip-icon" aria-hidden="true">{chip.icon}</span>
          {chip.value !== undefined && <span aria-hidden="true">{chip.value}</span>}
        </span>))}
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
  </div>;
}
