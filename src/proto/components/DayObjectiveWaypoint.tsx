import { useLayoutEffect, useRef, useState } from 'react';
import { gameTime } from '../../gameTime';
import { getCameraPlayback } from '../cameraDirector';
import type { DayObjective } from '../dayObjectives';
import { TABLE_GRID } from '../gridCoordinates';
import './DayObjectiveWaypoint.css';
import { ActorDragPreview } from './ActorDragPreview';
import { QuestSubtaskDeck } from './QuestSubtaskDeck';

type Point = { x: number; y: number };
type Props = {
  objective: DayObjective;
  project: (point: Point) => Point;
  onCameraFrame: (callback: () => void) => () => void;
  onFocus: () => void;
  showActorDragPreview?: boolean;
};

/** A fixed quest tracker; only its optional ground feedback follows the camera. */
export function DayObjectiveWaypoint(props: Props) {
  const layer = useRef<HTMLDivElement>(null), input = useRef(props);
  const [hovered, setHovered] = useState(false), [focused, setFocused] = useState(false), [tapped, setTapped] = useState(false);
  const [automaticOpacity, setAutomaticOpacity] = useState(0);
  const manualActive = hovered || focused || tapped;
  const active = manualActive || automaticOpacity > 0;
  useLayoutEffect(() => {
    let frame = 0;
    const cancel = () => { gameTime.cancelAnimationFrame(frame); setAutomaticOpacity(0); };
    const highlight = (event: Event) => {
      if ((event as CustomEvent<string>).detail !== input.current.objective.biomeId) return;
      cancel(); setAutomaticOpacity(1);
      let fadeStarted: number | undefined;
      const tick = () => {
        const playback = getCameraPlayback();
        // Wait for actual arrival or manual takeover; the shared clock preserves pause.
        if (playback.playing) {
          fadeStarted = undefined;
          frame = gameTime.requestAnimationFrame(tick); return;
        }
        fadeStarted ??= gameTime.now();
        const progress = Math.min(1, (gameTime.now() - fadeStarted) / 800);
        setAutomaticOpacity(1 - progress * progress * (3 - 2 * progress));
        if (progress < 1) frame = gameTime.requestAnimationFrame(tick);
      };
      frame = gameTime.requestAnimationFrame(tick);
    };
    window.addEventListener('proto-quest-highlight', highlight);
    window.addEventListener('proto-quest-highlight-cancel', cancel);
    return () => { gameTime.cancelAnimationFrame(frame); window.removeEventListener('proto-quest-highlight', highlight); window.removeEventListener('proto-quest-highlight-cancel', cancel); };
  }, [props.objective.biomeId, props.objective.label]);
  input.current = props;
  useLayoutEffect(() => {
    setAutomaticOpacity(0);
    setTapped(false); setHovered(false); setFocused(false);
  }, [props.objective.biomeId, props.objective.label]);
  const measure = useRef<() => void>(() => {});
  // The tracker is fixed UI: measure it on mount, resize and React commits,
  // never inside the camera frame, where layout reads stalled every frame.
  useLayoutEffect(() => { measure.current(); });
  useLayoutEffect(() => {
    const element = layer.current!, map = element.closest('.proto-map')!;
    const tracker = element.querySelector<HTMLElement>('.day-objective__tracker')!;
    const pin = element.querySelector('.day-objective__pin')!;
    const line = pin.querySelector('line')!, ring = pin.querySelector('circle')!, grid = pin.querySelector('polygon')!;
    let layout = { width: 0, height: 0, top: 0, left: 0, right: 0, bottom: 0, boxWidth: 0, boxHeight: 0 };
    measure.current = () => {
      const view = element.getBoundingClientRect();
      const config = map.querySelector('.art-settings__cog')?.getBoundingClientRect();
      const controls = map.querySelector('.proto-travel-controls')?.getBoundingClientRect();
      let top = Math.max(12, (config?.bottom ?? view.top + 40) - view.top + 12);
      const x = view.width - tracker.offsetWidth - 12;
      // A wrapping travel toolbar may occupy the same right-hand corner.
      if (controls && controls.right > view.left + x && controls.bottom > view.top + top) top = controls.bottom - view.top + 12;
      const actor = map.querySelector('[data-map-actor-card="hero"]')?.getBoundingClientRect();
      if (actor && actor.right > view.left + x && actor.bottom > view.top + top) top = actor.bottom - view.top + 12;
        const actorDebug = map.querySelector('.actor-map-card__debug')?.getBoundingClientRect();
        if (actorDebug && actorDebug.right > view.left + x && actorDebug.bottom > view.top + top) top = actorDebug.bottom - view.top + 12;
      tracker.style.maxHeight = `${Math.max(80, view.height - top - 64)}px`;
      if (tracker.style.top !== `${top}px`) tracker.style.top = `${top}px`;
      const box = tracker.getBoundingClientRect();
      layout = { width: view.width, height: view.height, top, left: box.left - view.left, right: box.right - view.left,
        bottom: box.bottom - view.top, boxWidth: box.width, boxHeight: box.height };
      place();
    };
    const place = () => {
      const point = input.current.project(input.current.objective.position);
      const { top, left, right, bottom } = layout, box = { width: layout.boxWidth, height: layout.boxHeight };
      element.dataset.offscreen = String(point.x < 0 || point.x > layout.width || point.y < 0 || point.y > layout.height);
      line.setAttribute('x1', String(Math.max(left, Math.min(right, point.x))));
      line.setAttribute('y1', String(Math.max(top, Math.min(bottom, point.y))));
      line.setAttribute('x2', String(point.x)); line.setAttribute('y2', String(point.y));
      ring.setAttribute('cx', String(point.x)); ring.setAttribute('cy', String(point.y));
      const bounds = TABLE_GRID.bounds(TABLE_GRID.atWorld(input.current.objective.position));
      grid.setAttribute('points', [[bounds.left, bounds.top], [bounds.right, bounds.top], [bounds.right, bounds.bottom], [bounds.left, bounds.bottom]]
        .map(([x, y]) => { const p = input.current.project({ x, y }); return `${p.x},${p.y}`; }).join(' '));
      const arrow = element.querySelector<SVGElement>('.day-objective__arrow')!;
      arrow.style.transform = `rotate(${Math.atan2(point.y - top - box.height / 2, point.x - left - box.width / 2)}rad)`;
      if (element.style.visibility !== 'visible') element.style.visibility = 'visible';
    };
    measure.current();
    const unsubscribe = props.onCameraFrame(place), resize = new ResizeObserver(() => measure.current());
    resize.observe(element); resize.observe(tracker);
    const controls = map.querySelector('.proto-travel-controls'); if (controls) resize.observe(controls);
    return () => { unsubscribe(); resize.disconnect(); measure.current = () => {}; };
  }, [props.objective, props.project, props.onCameraFrame]);
  useLayoutEffect(() => {
    const clear = (event: PointerEvent) => { if (!layer.current?.querySelector('.day-objective__tracker')?.contains(event.target as Node)) { setTapped(false); window.dispatchEvent(new Event('proto-quest-highlight-cancel')); } };
    const reset = () => { setTapped(false); setHovered(false); setFocused(false); };
    document.addEventListener('pointerdown', clear); window.addEventListener('blur', reset);
    return () => { document.removeEventListener('pointerdown', clear); window.removeEventListener('blur', reset); };
  }, []);
  const { objective } = props;
  const firstTrip = Boolean(objective.quest);
  return <div ref={layer} className="day-objective" data-day-objective={objective.biomeId} data-active={active} style={{ visibility: 'hidden' }}>
    {props.showActorDragPreview && objective.label === 'Check the nearby bush' && <ActorDragPreview targetId={objective.biomeId} target={objective.position} project={props.project} />}
    <svg className="day-objective__pin" aria-hidden="true" style={{ opacity: manualActive ? 1 : automaticOpacity }}><polygon className="day-objective__grid" /><line /><circle r="8" /></svg>
    <section className={`day-objective__tracker${firstTrip ? ' day-objective__tracker--card' : ''}`} aria-label="Quest tracker" data-camera-ignore="true" onPointerDown={event => event.stopPropagation()}
      onPointerEnter={event=>{if(event.pointerType!=='touch')setHovered(true);}} onPointerLeave={()=>setHovered(false)}
      onFocus={event=>{if(event.target.matches(':focus-visible'))setFocused(true);}} onBlur={()=>setFocused(false)}>
      {firstTrip ? <>
        {objective.quest && <QuestSubtaskDeck key={objective.quest.id} quest={objective.quest} />}
        <button className="day-objective__card-locate" type="button" onClick={()=>{setTapped(value=>!value);props.onFocus();}} aria-label="Center map on quest target">
          <span>{objective.reference}</span><svg className="day-objective__arrow" viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14m-6-6 6 6-6 6" /></svg>
        </button>
      </> : <>
      <span className="day-objective__heading">Current quest</span>
      <div className="day-objective__row">
        <button className="day-objective__title" type="button" data-grid-reference={objective.reference}
          aria-label={`Show objective: ${objective.label} · ${objective.reference}`} aria-pressed={tapped}
          onPointerEnter={event => { if (event.pointerType !== 'touch') setHovered(true); }} onPointerLeave={() => setHovered(false)}
          onFocus={event => { if (event.currentTarget.matches(':focus-visible')) setFocused(true); }} onBlur={() => setFocused(false)}
          onKeyDown={event => { if (event.key === 'Escape') { setTapped(false); setFocused(false); setHovered(false); } }}
          onClick={event => { event.stopPropagation(); setTapped(value => !value); }}>
          <strong>{objective.label}</strong><span className="day-objective__reference">{objective.reference}</span>
        </button>
        <button className="day-objective__locate" type="button" aria-label="Center map on quest target" title="Center map on quest target"
          onClick={event => { event.stopPropagation(); setTapped(true); props.onFocus(); }}>
          <svg className="day-objective__arrow" viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14m-6-6 6 6-6 6" /></svg>
        </button>
      </div>
      </>}
    </section>
  </div>;
}
