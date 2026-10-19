import { TradingCard } from './TradingCard';
import './ActorHoloCard.css';
import { ACTOR_HOLO_ART } from '../art/actorCardArt';
import { ActorCardArt } from './DetailsCardViewer';
import { FoodCollectionFx, type FoodLanding } from './FoodCollectionFx';
import { useEffect, useRef, useState } from 'react';
export { ACTOR_HOLO_ART } from '../art/actorCardArt';

/** Optional foundation rank stays live; rest's separate receiving card owns its rank. */
export function ActorHoloCard({ actorId, name, rank, resource, foodLanding, receivedResources, relocated = false }: {
  relocated?: boolean;
  actorId: string; name: string; rank: string; resource?: string; foodLanding?: FoodLanding;
  /** Live resource amounts; only positive changes produce receipt feedback. */
  receivedResources?: Readonly<Record<string, number>>;
}) {
  const previous = useRef(receivedResources);
  const sequence = useRef(0);
  const [receipt, setReceipt] = useState<FoodLanding>();
  useEffect(() => {
    const before = previous.current;
    previous.current = receivedResources;
    const gained = before && receivedResources && Object.keys(receivedResources).find(key => receivedResources[key] > (before[key] ?? 0));
    if (gained) setReceipt({ id: `${actorId}-receipt-${++sequence.current}`, x: 20 + Math.random() * 60, y: 25 + Math.random() * 45,
      berries: false, glyph: gained === 'inspiration' ? '💫' : gained === 'AP' ? '✦' : '✨' });
  }, [receivedResources, actorId]);
  if (actorId === 'hero' && relocated) return <span data-unified-actor-placeholder="true" />;
  return <span className="actor-holocard" data-actor-holocard={actorId} data-has-value={Boolean(rank)}>
    <TradingCard id={actorId} title={name} state="foundation"
      art={<ActorCardArt sprite={ACTOR_HOLO_ART[actorId]} label={name} />}
      sections={[...(rank ? [{id:'rank',label:'Foundation rank',content:rank,details:rank}] : []),...(resource ? [{id:'resource',label:'Collected resource',content:resource,details:resource}] : [])]} />
    {rank && <span className="actor-holocard__identity" aria-label={`${name} foundation rank ${rank}`}>
      <strong className="actor-holocard__value">{rank}</strong>
    </span>}
    {resource && <span className="actor-holocard__resource">{resource}</span>}
    {foodLanding && <FoodCollectionFx key={foodLanding.id} landing={foodLanding} />}
    {receipt && <FoodCollectionFx key={receipt.id} landing={receipt} />}
  </span>;
}
