import { gameTime } from '../../gameTime';
import { useLayoutEffect, useRef, useState, type CSSProperties } from 'react';
import { getVisualTableLighting, rgba } from '../protoLighting';
import { useGlobalLights } from '../globalLighting';
import { tableauCardBrightness, type TableauLamp } from '../tableauLighting';
import './TableauLighting.css';

const FOUNDATION_FACES = '.travel-foundation-actor,.proto-occupied-foundation-face,.battle-field__team[data-team="party"] .battle-field__actor-card';

/** Presentation only: each occupied foundation lights the physical card rack.
 * It never contributes to world discovery or gameplay light sampling. */
export function TableauLighting({ hours }: { hours: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const globalLights = useGlobalLights();
  const frame = getVisualTableLighting(hours);
  const [lamps, setLamps] = useState<TableauLamp[]>([]);
  useLayoutEffect(() => {
    const field = ref.current?.parentElement;
    if (!field) return;
    let raf = 0;
    const touched = new Set<HTMLElement>();
    const measure = () => {
      raf = 0;
      const bounds = field.getBoundingClientRect();
      const cards = Array.from(field.querySelectorAll<HTMLElement>('.proto-tableau-stage .playing-card,.battle-field__column .playing-card'));
      const centers = cards.map(card => {
        const rect = card.getBoundingClientRect();
        return { x: rect.x + rect.width / 2 - bounds.x, y: rect.y + rect.height / 2 - bounds.y };
      });
      const sources = Array.from(field.querySelectorAll<HTMLElement>(FOUNDATION_FACES)).filter(face => face.offsetWidth && face.offsetHeight);
      const next = sources.map(face => {
        resize.observe(face);
        const rect = face.getBoundingClientRect();
        const x = rect.x + rect.width / 2 - bounds.x, y = rect.y + rect.height / 2 - bounds.y;
        // Reach every card, even when the foundation shelf moves to the side.
        const reach = Math.max(80, ...centers.map(card => Math.hypot(card.x - x, card.y - y)));
        return { x, y, radius: reach * 2 };
      });
      setLamps(previous => JSON.stringify(previous) === JSON.stringify(next) ? previous : next);
      cards.forEach((card, index) => {
        touched.add(card);
        card.style.setProperty('--tableau-card-brightness', String(tableauCardBrightness(frame.ambient, centers[index], next)));
      });
      field.dataset.tableauLightSources = String(next.length);
    };
    const schedule = () => { if (!raf) raf = gameTime.requestAnimationFrame(measure); };
    const resize = new ResizeObserver(schedule);
    resize.observe(field);
    const mutation = new MutationObserver(schedule);
    mutation.observe(field, { childList: true, subtree: true });
    window.addEventListener('resize', schedule);
    measure();
    return () => {
      gameTime.cancelAnimationFrame(raf); resize.disconnect(); mutation.disconnect();
      window.removeEventListener('resize', schedule);
      touched.forEach(card => card.style.removeProperty('--tableau-card-brightness'));
      delete field.dataset.tableauLightSources;
    };
  }, [hours, globalLights]);
  const masks = lamps.map(lamp => `radial-gradient(circle ${lamp.radius * .45}px at ${lamp.x}px ${lamp.y}px, #0000001f, #000 100%)`).join(',');
  return <div ref={ref} className="tableau-lighting" aria-hidden="true" data-darkness={frame.darkness} data-foundation-lights={lamps.length}>
    <div className="tableau-lighting__shade" style={{ background: rgba(frame.skyTint, 1), opacity: frame.darkness, maskImage: masks || undefined, maskComposite: 'intersect' } as CSSProperties} />
    <div className="tableau-lighting__glow" style={{ opacity: globalLights ? 1 - frame.daylight : 0, background: lamps.map(lamp => `radial-gradient(circle ${lamp.radius * .45}px at ${lamp.x}px ${lamp.y}px, #ffe0a018, #ffe0a000 100%)`).join(',') || undefined }} />
  </div>;
}
