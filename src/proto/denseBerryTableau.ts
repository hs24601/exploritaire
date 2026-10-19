import type { TravelCard, TravelJourney, TravelSegment } from './travelJourney';

export type TravelSequenceRule = 'step' | 'match' | 'skip';
export const sequenceLabel = (rule:TravelSequenceRule) => rule==='match'?'=':rule==='skip'?'±2':'±1';
export const sequenceDescription = (rule:TravelSequenceRule) => rule==='match'?'Match the receiving rank':rule==='skip'?'Play two ranks higher or lower':'Play one rank higher or lower';
export function travelCardPlayable(card:Pick<TravelCard,'rank'|'sequenceRule'>, rank:number) {
  const distance=(card.rank-rank+13)%13;
  return card.sequenceRule==='match'?distance===0:card.sequenceRule==='skip'?distance===2||distance===11:distance===1||distance===12;
}
export const isDenseBerryStage=(segment:TravelSegment)=>!!segment.denseBerry && segment.traversalStage!=='exit';

/** Three crowns, two coverage stacks per bush. Every starting rank has a full route. */
export function dealDenseBerries(startRank:number, segment:number):TravelCard[][] {
  const columns:TravelCard[][]=Array.from({length:6},()=>[]);
  let rank=startRank;
  const deltas=[1,0,2,-1,-2,0,1,2,0,-2,-1,-1];
  deltas.forEach((delta,index)=>{
    rank=(rank-1+delta+13)%13+1;
    const column=index%6,bush=Math.floor(column/2),right=column%2,buried=index>=6;
    const x=[.25,2.2,4.15][bush]+right*.9;
    const y=(bush===1?1.2:1.55)+(buried?0:.85);
    columns[column].unshift({id:`dense-${segment}-${index}`,segment,kind:'berry-patch',rank,
      sequenceRule:delta===0?'match':Math.abs(delta)===2?'skip':'step',
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
