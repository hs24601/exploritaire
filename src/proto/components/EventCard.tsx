import type { CSSProperties } from 'react';
import { rankLabel, type Card } from '../protoState';
import { eventChangesRank, eventRequirements } from '../eventCards';
import { useCardJumbo } from './CardJumbo';
import './EventCard.css';

export function EventCard({card,disabled,buried,style,cardRef,onPlay,onDiscard,actionLabel='Play event'}:{card:Card;disabled?:boolean;buried?:boolean;style?:CSSProperties;
  cardRef?:(node:HTMLButtonElement|null)=>void;onPlay?:()=>void;onDiscard?:()=>void;actionLabel?:string}){
  const viewer=useCardJumbo(),event=card.event!;
  const inspect=()=>viewer?.open({title:event.title,ratio:63/88,content:<article className="event-card-details" tabIndex={0} aria-label={`${event.title} details`}>
    <span>EVENT</span><h2>{event.title}</h2><div className="event-card-symbol" aria-hidden="true">✦</div>
    {event.effect.type==='search'&&<p>{event.effect.stamina} STA · {event.effect.cards} extra cards · up to 1 {event.effect.reward}. Optional; discard to pass through.</p>}
    <p>{event.description}</p><p>{eventRequirements(event)}</p>
    {eventChangesRank(event)&&<p>Rank {rankLabel(card.rank)}</p>}
    {event.effect.type==='resource'&&<p>Reward: {event.effect.amount} {event.effect.resource}</p>}
    {event.effect.type==='notice'&&<p>{event.effect.message}</p>}
    {buried&&<p>This card is visible but covered. Expose it, or use a permitted solution such as Dig.</p>}
    </article>,actions:[...(!disabled&&onPlay?[{label:actionLabel,run:onPlay}]:[]),...(!buried&&onDiscard?[{label:'Discard event',run:onDiscard}]:[])]});
  return <button ref={cardRef} type="button" className={`playing-card event-card${buried?' event-card--buried':''}`} style={style} data-event-card={event.id} data-event-instance={card.id}
    data-buried={buried||undefined} data-gameplay-disabled={disabled||undefined} aria-label={`Inspect ${event.title}${buried?' · covered':''}`} aria-haspopup="dialog" onClick={inspect}>
    <span className="event-card-name">{buried?'✦':event.title}</span>{!buried&&<span className="event-card-symbol" aria-hidden="true">{eventChangesRank(event)?rankLabel(card.rank):'✦'}</span>}
  </button>;
}
