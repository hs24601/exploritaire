/** A tap plays one card; a hold replans each receipt, without stock/turn fallbacks. */
export function createWorldGridAutoSequence(grid:{autoStep:(draw?:boolean)=>boolean}){
 let stepped=false;
 return {reset(){stepped=false;},step(continuous:boolean){
   if(!continuous&&stepped)return false;stepped=true;return grid.autoStep(false);
 }};
}
