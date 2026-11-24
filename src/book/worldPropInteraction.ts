import type {CastleGroundsNavigation} from './castleGroundsNavigation';
type Actor={x:number;y:number;z:number;grounded?:boolean};
type Target={point:{x:number;z:number};reach:number;interact:(actor:Actor)=>boolean};

/** An interaction belongs to one navigation request. Replacing or cancelling
 * that route must not leave a pickup queued for a later, unrelated walk. */
export function createWorldPropInteraction(navigation:CastleGroundsNavigation){
 let pending:{target:Target;destination:typeof navigation.destination}|undefined;
 const close=(actor:Actor,target:Target)=>actor.grounded!==false&&Math.hypot(actor.x-target.point.x,actor.z-target.point.z)<=target.reach;
 function use(actor:Actor,target:Target){pending=undefined;navigation.clear();return target.interact(actor);}
 return {
  get pending(){return Boolean(pending);},
  cancel(){pending=undefined;},
  request(actor:Actor,target:Target):'interacted'|'travelling'|'blocked'{
   pending=undefined;
   if(close(actor,target))return use(actor,target)?'interacted':'blocked';
   navigation.clear();
   if(!navigation.setAdjacentDestination(actor,{...target.point,radius:0,label:'sticker'},Math.max(0,target.reach-.3)))return 'blocked';
   pending={target,destination:navigation.destination};return 'travelling';
  },
  update(actor:Actor){
   if(!pending)return;
   if(navigation.destination!==pending.destination){pending=undefined;return;}
   if(close(actor,pending.target))return use(actor,pending.target);
  },
 };
}
