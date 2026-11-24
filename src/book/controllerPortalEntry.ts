import type {MeadowPortalEnd} from './castleMeadowPortal';

/** A manual stick approach is deliberate portal intent. Ordinary navigation
 * routes never call this: unselected membranes remain route obstacles. */
export function controllerPortalEntry(doors:readonly MeadowPortalEnd[],hero:{x:number;y:number;z:number},direction:{x:number;z:number}){
 const amount=Math.hypot(direction.x,direction.z);
 if(amount<.15)return;
 return doors.filter(door=>{
  const depth=door.distance(hero.x,hero.z),toward=(direction.x*door.normal.x+direction.z*door.normal.z)/amount;
  return Math.abs(depth)<2.4&&Math.abs(door.lateral(hero.x,hero.z))<1.7
   && depth*toward<-.035&&Math.abs(toward)>.25
   && door.fitsHeroHeight(hero.y);
 }).sort((a,b)=>Math.abs(a.distance(hero.x,hero.z))-Math.abs(b.distance(hero.x,hero.z)))[0];
}
