import {BRIDGE_CARD_WIDTH,BRIDGE_CARD_HEIGHT,bridgeCell} from './castleBridgePuzzle';
export type CardGlide={x:number;z:number;vx:number;vz:number};
export const CARD_FRICTION=3;
/** Exact exponential friction makes a flick independent of frame rate. */
export function advanceCardGlide(card:CardGlide,dt:number){
  const decay=Math.exp(-CARD_FRICTION*dt),travel=(1-decay)/CARD_FRICTION;
  card.x+=card.vx*travel;card.z+=card.vz*travel;card.vx*=decay;card.vz*=decay;
}
export function flickLanding(card:CardGlide,legal:(slot:number)=>boolean){
  return cardSlotAt(card.x+card.vx/CARD_FRICTION,card.z+card.vz/CARD_FRICTION,legal);
}
export function cardSlotAt(x:number,z:number,legal:(slot:number)=>boolean){
  let best:number|undefined,distance=Infinity;
  for(let slot=4;slot<16;slot++){
    if(!legal(slot))continue;const p=bridgeCell(slot),dx=Math.abs(x-p.x),dz=Math.abs(z-p.z),d=dx*dx+dz*dz;
    if(dx<=BRIDGE_CARD_WIDTH*.5+.18&&dz<=BRIDGE_CARD_HEIGHT*.5+.18&&d<distance){best=slot;distance=d;}
  }
  return best;
}
