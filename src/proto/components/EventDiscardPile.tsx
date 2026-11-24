import type { Card } from '../protoState';
import { EventCard } from './EventCard';
import {useState} from 'react';
import {useCardJumbo} from './CardJumbo';
export function EventDiscardPile({cards}:{cards:readonly Card[]}){
  const viewer=useCardJumbo();
  return <button type="button" className="event-discard" aria-label="Event discard pile" onClick={()=>viewer?.open({title:'Discard pile',content:<DiscardPages cards={cards} />})}>Discard pile · {cards.length}</button>;
}
function DiscardPages({cards}:{cards:readonly Card[]}){
  const [page,setPage]=useState(0);
  return <div className="event-card-details"><p>Discard pile · {cards.length}</p>{cards[page]?<EventCard card={cards[page]} disabled />:<p>No discarded events</p>}<div><button type="button" disabled={!page} onClick={()=>setPage(page-1)}>Previous</button><span> {cards.length?page+1:0}/{cards.length} </span><button type="button" disabled={page>=cards.length-1} onClick={()=>setPage(page+1)}>Next</button></div></div>;
}
