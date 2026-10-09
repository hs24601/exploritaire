import { TradingCard } from './TradingCard';
import './ActorHoloCard.css';
import { ACTOR_HOLO_ART } from '../art/actorCardArt';
export { ACTOR_HOLO_ART } from '../art/actorCardArt';

/** Foundation rank stays live and overlaps the card's upper-right corner. */
export function ActorHoloCard({ actorId, name, rank, resource }: {
  actorId: string; name: string; rank: string; resource?: string;
}) {
  return <span className="actor-holocard" data-actor-holocard={actorId}>
    <TradingCard id={actorId} title={name} state="foundation"
      art={<img src={ACTOR_HOLO_ART[actorId]} alt={`${name} full-art portrait`} draggable={false} />} />
    <span className="actor-holocard__rank-bubble" role="img" aria-label={`${name} foundation rank ${rank}`}>
      <span className="battle-field__rank">{rank}</span>
    </span>
    {resource && <span className="actor-holocard__resource">{resource}</span>}
  </span>;
}
