import type { TravelCard, TravelJourney, TravelSegment } from './travelJourney';

export type TravelSequenceRule = 'step' | 'match' | 'skip';
export const sequenceLabel = (rule:TravelSequenceRule) => rule==='match'?'=':rule==='skip'?'±2':'±1';
export const sequenceDescription = (rule:TravelSequenceRule) => rule==='match'?'Match the receiving rank':rule==='skip'?'Play two ranks higher or lower':'Play one rank higher or lower';
export function travelCardPlayable(card:Pick<TravelCard,'rank'|'sequenceRule'|'khadRoot'>, rank:number) {
  if(card.khadRoot)return false;
  const distance=(card.rank-rank+13)%13;
  return distance===1||distance===12;
}
export const isDenseBerryStage=(segment:TravelSegment)=>!!segment.denseBerry && segment.traversalStage!=='exit';
/** Scenery identity survives the reward-free approach without making it a gathering deal. */
export const isDenseBerryScene=(segment:TravelSegment|undefined,segments:readonly TravelSegment[])=>!!segment &&
  (isDenseBerryStage(segment) || !!segment.tileId && segments.some(s=>s.tileId===segment.tileId && isDenseBerryStage(s)));

// A shared, padded envelope includes crowns, soil shadows and rotated cards.
// The third cluster stays above the bottom edge, using the upper field first.
// Anchor the stacks in the foliage rather than below the trunks.
export const DENSE_BERRY_BOUNDS = { width: 6.95, height: 7.3 };
export const DENSE_BERRY_CLUSTERS = [
  { x: .3, y: .3, width: 2.8, height: 3.5, cardX: .55, cardY: 1.15 },
  { x: 3.5, y: 1.05, width: 2.8, height: 3.5, cardX: 3.75, cardY: 1.9 },
  { x: 2, y: 3.45, width: 2.1, height: 2.9, cardX: 2.15, cardY: 4.05 },
];
export const DENSE_BERRY_PORTRAIT_BOUNDS = { width: 4.8, height: 12.05 };
export const DENSE_BERRY_PORTRAIT_CLUSTERS = [
  { x: .45, y: .3, width: 3, height: 3.7, cardX: .7, cardY: 1.3 },
  { x: 1.25, y: 4.15, width: 3, height: 3.7, cardX: 1.5, cardY: 5.15 },
  { x: .5, y: 8.1, width: 2.1, height: 2.9, cardX: .65, cardY: 8.7 },
];
const DENSE_BERRY_ROUTE = [0,2,4,1,3,5,2,0,3,1,4,5];

/** Reflow presentation only; card IDs, coverage, ranks and rewards stay fixed. */
export function denseBerryCardPose(card: TravelCard, portrait: boolean) {
  const pose = card.pose;
  if (!portrait || !pose) return pose;
  const index = Number(card.id.split('-').pop()), bush = Math.floor(DENSE_BERRY_ROUTE[index] / 2);
  const from = DENSE_BERRY_CLUSTERS[bush], to = DENSE_BERRY_PORTRAIT_CLUSTERS[bush];
  return from && to ? { ...pose, x: pose.x - from.cardX + to.cardX, y: pose.y - from.cardY + to.cardY } : pose;
}

/** Three crowns, two coverage stacks per bush. Every starting rank has a full route. */
export function dealDenseBerries(startRank:number, segment:number):TravelCard[][] {
  const columns:TravelCard[][]=Array.from({length:6},()=>[]);
  let rank=startRank;
  const deltas=[1,1,-1,-1,-1,1,1,1,1,-1,-1,-1];
  const route=DENSE_BERRY_ROUTE;
  deltas.forEach((delta,index)=>{
    rank=(rank-1+delta+13)%13+1;
    const column=route[index],bush=Math.floor(column/2),right=column%2,buried=index>=6;
    const cluster = DENSE_BERRY_CLUSTERS[bush];
    const x=cluster.cardX+right*.9;
    const y=cluster.cardY+(buried?0:.7);
    columns[column].unshift({id:`dense-${segment}-${index}`,segment,kind:'berry-patch',rank,
      ...([6,7,8,9,11].includes(index)?{resource:'mana' as const,foodSource:'berries' as const}:{}),
      pose:{x,y,rotation:(right?6:-7)+(buried?3:0),layer:buried?1:3}});
  });
  return columns;
}

/** Bounded exact search for this small authored puzzle; all rules are simulated. */
export function bestDenseBerryMove(journey:TravelJourney):number|null {
  const memo=new Map<string,{score:number;column:number|null}>();
  const visit=(columns:TravelCard[][],ranks:number[]):{score:number;column:number|null}=>{
    const key=columns.map(c=>c.length).join(',')+'|'+ranks.join(',');
    const cached=memo.get(key);if(cached)return cached;
    let best={score:0,column:null as number|null};
    const remaining=columns.reduce((n,c)=>n+c.length,0);
    for(let column=0;column<columns.length;column++){
      const card=columns[column][columns[column].length-1];if(!card||card.event)continue;
      for(let actor=0;actor<ranks.length;actor++){
        if(!travelCardPlayable(card,ranks[actor]))continue;
        const next=columns.map((c,i)=>i===column?c.slice(0,-1):c);
        const score=1+visit(next,ranks.map((rank,i)=>i===actor?card.rank:rank)).score;
        if(score>best.score)best={score,column};
        if(score===remaining){memo.set(key,best);return best;}
        // Normal travel auto-receives on the first legal party member.
        break;
      }
    }
    memo.set(key,best);return best;
  };
  return visit(journey.columns,Object.values(journey.memberRanks??{[journey.actorId]:journey.rank})).column;
}
