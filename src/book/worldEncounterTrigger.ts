/** No battle state is constructed until a grounded, player-driven approach
 * reaches the enemy. Leaving reach rearms a retreated encounter. */
export function createWorldEncounterTrigger(point:{x:number;z:number},reach=2.2){
 let phase:'waiting'|'active'|'defeated'='waiting',latched=false;
 return {get phase(){return phase;},check(hero:{x:number;z:number;y:number;grounded:boolean},moved:boolean){
  const distance=Math.hypot(hero.x-point.x,hero.z-point.z);if(distance>reach+.8)latched=false;
  if(phase!=='waiting'||latched||!hero.grounded||Math.abs(hero.y)>.5||!moved||distance>reach)return false;
  latched=true;phase='active';return true;
 },finish(won:boolean){phase=won?'defeated':'waiting';}};
}
