export type RailAutoMode='idle'|'sequence'|'continuous';
export type RailAutoResult='played'|'waiting'|'complete';
/** Input ownership and pacing are independent of React renders and key repeat.
 * A tap plays one move; a hold continues only until its last owner lets go. */
export function createWorldRailAutoPlay(step:(continuous:boolean)=>RailAutoResult,interval=.12,onStart=()=>{}){
 const held=new Set<string>();let heldFor=0,elapsed=interval,mode:RailAutoMode='idle',exhausted=false,singlePlayed=false;
 return {
  get mode(){return mode;},get held(){return held.size>0;},
  press(owner:string){if(held.has(owner))return;const first=!held.size;held.add(owner);if(first){heldFor=0;elapsed=interval;exhausted=false;singlePlayed=false;mode='sequence';onStart();}},
  release(owner:string){held.delete(owner);if(!held.size&&(mode==='continuous'||singlePlayed))mode='idle';},
  stop(){held.clear();heldFor=0;mode='idle';elapsed=interval;exhausted=false;singlePlayed=false;},
  update(dt:number){
   if(held.size&&!exhausted){heldFor+=dt;if(heldFor>=.28)mode='continuous';}
   if(mode==='idle')return;
   if(mode==='sequence'&&singlePlayed){elapsed+=dt;if(!held.size)mode='idle';return;}
   elapsed+=dt;if(elapsed<interval)return;
   elapsed=0;const result=step(mode==='continuous');
   if(result==='played'&&mode==='sequence'){singlePlayed=true;if(!held.size)mode='idle';}
   if(result==='complete'){mode='idle';exhausted=true;}
  },
 };
}
