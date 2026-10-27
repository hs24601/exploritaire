import type { TravelPlan } from '../travelJourney';
import './TradingCard.css';
import { useRef, useState } from 'react';
import { STORY_CARD_WIDTH } from './TableStoryCard';

/** Static shared trading-card frame: confirmation controls stay steady. */
export function TravelDestinationCard({ plan, stamina, onConfirm, onCancel, onEditRoute, scale = 1.7 }: { plan: TravelPlan; stamina: number; onConfirm: () => void; onCancel: () => void; onEditRoute: () => void; scale?: number }) {
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const drag = useRef<{ id: number; x: number; y: number; origin: typeof offset } | null>(null);
  const route = plan.segments.map(s => s.title).filter((title, i, list) => i === 0 || title !== list[i - 1]).join(' → ');
  return <section className="travel-confirm" role="dialog" aria-label="Confirm journey" onKeyDown={event => { if (event.key === 'Escape') onCancel(); }} data-camera-ignore="true">
    <div className="travel-confirm-card trading-card-stage" style={{ '--travel-card-width': `${STORY_CARD_WIDTH * scale / 1.7}px`, translate: `${offset.x}px ${offset.y}px` } as React.CSSProperties}
      onPointerDown={event => { if (event.button !== 0 || (event.target as HTMLElement).closest('button,.travel-confirm-copy')) return; event.stopPropagation(); event.preventDefault(); event.currentTarget.setPointerCapture(event.pointerId); drag.current = { id: event.pointerId, x: event.clientX, y: event.clientY, origin: offset }; }}
      onPointerMove={event => { const d = drag.current; if (!d || d.id !== event.pointerId) return; event.stopPropagation(); const card = event.currentTarget.getBoundingClientRect(), parent = event.currentTarget.parentElement!.getBoundingClientRect(); const x = d.origin.x + event.clientX - d.x, y = d.origin.y + event.clientY - d.y; setOffset({ x: Math.max(-(parent.width-card.width)/2, Math.min((parent.width-card.width)/2, x)), y: Math.max(-(parent.height-card.height)/2, Math.min((parent.height-card.height)/2, y)) }); }}
      onPointerUp={() => { drag.current = null; }} onLostPointerCapture={() => { drag.current = null; }} onPointerCancel={() => { if (drag.current) setOffset(drag.current.origin); drag.current = null; }}>
      <article className="details-card trading-card trading-card--plain trading-card--compact">
        <div className="trading-card__art" aria-hidden="true"><img src={`${import.meta.env.BASE_URL}assets/runtime/ui/quests/hero-snuffling-berries-paint-bobtail-v2.png`} alt="" draggable={false} /></div>
        <header className="trading-card__header"><h2>Travel destination</h2></header>
        <div className="travel-confirm-copy" tabIndex={0} aria-label="Journey details">
          <p className="travel-confirm-estimate">{plan.segments.length} cells · {plan.cards} cards<br /><strong>Estimated {plan.estimate.toFixed(1)} STA</strong></p>
          <p>{route || 'Current position'}</p>
          <p>Streaks reduce effort up to 20%. Unknown terrain may hide encounters.</p>
          {plan.estimate > stamina && <p role="status">Not enough stamina for this route.</p>}
        </div>
        <footer className="travel-confirm-actions"><button type="button" onClick={onConfirm} disabled={plan.estimate > stamina}>Confirm journey</button><button type="button" onClick={onEditRoute}>Edit route</button><button type="button" onClick={onCancel}>Cancel</button></footer>
      </article>
    </div>
  </section>;
}
