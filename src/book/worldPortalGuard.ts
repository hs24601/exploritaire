import type {MeadowPortalEnd} from './castleMeadowPortal';
/** Portal intent belongs to the exact clicked doorway, not a proximity flag. */
export function createWorldPortalGuard(){
 let armed:MeadowPortalEnd|undefined,releasedAt:{x:number;z:number}|undefined;
 return {arm(door?:MeadowPortalEnd,point?:{x:number;z:number}){armed=door;releasedAt=door?undefined:point&&{x:point.x,z:point.z};},get armed(){return armed;},
  blocked(doors:readonly MeadowPortalEnd[],x:number,z:number,r=.45,y?:number){return doors.some(door=>{
   // A cancelled route may already be inside the membrane. Permit escape on
   // that route, without retaining permission to teleport through the card.
   const escaping=releasedAt&&Math.abs(door.distance(releasedAt.x,releasedAt.z))<1.31&&Math.abs(door.lateral(releasedAt.x,releasedAt.z))<2.93;
   const separateFloor=y!==undefined&&(y>door.door.y+7.3||y+1.3<door.door.y);
   if(door===armed||escaping||separateFloor)return false;
   return Math.abs(door.distance(x,z))<.85+r&&Math.abs(door.lateral(x,z))<2.47+r;
  });},
  permits(door:MeadowPortalEnd|undefined){return !!door&&armed===door;},
 };
}
