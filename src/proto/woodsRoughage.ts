import { cellRoll } from './terrainAutotile';
import type { SpillDecal } from './tileSpill';
/** Stable cosmetic litter, contained within its owning woodland. */
export function woodsRoughage(id:string, f:{x:number;y:number;width:number;height:number}):SpillDecal[]{
 return Array.from({length:24},(_,i)=>{
 const roll=(salt:number)=>cellRoll(Math.round(f.x),Math.round(f.y),i*7+salt),size=5+roll(1)*6;
 return {id:id+'-roughage-'+i,art:['sprig-a.svg','clod-a.svg','pebble-b.svg','sprig-c.svg'][i%4],x:f.x+(roll(2)-.5)*(f.width-size),y:f.y+(roll(3)-.5)*(f.height-size),size,relief:1+roll(4),turn:([0,90,180,270] as const)[i%4],flip:roll(5)>.5,from:'woods',onto:'woods'};
 });
}
