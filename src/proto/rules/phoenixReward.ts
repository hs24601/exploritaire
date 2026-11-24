import type { BattleEvent, BattleState } from './battle';
import { iceTier } from './iceRewards';
import { outcome, pushEvents, withStatus } from './battleStatuses';

/** Trigger before defeat is finalized. Current enemy sequence stops immediately. */
export function triggerPhoenix(state: BattleState): BattleState {
 const hero=state.party.find(actor=>actor.id==='hero');
 if(!hero || hero.hp>0 || !hero.iceRewards?.includes('heart-of-the-phoenix') || (hero.phoenixRecharge ?? 0)!==0)return state;
 const tier=iceTier(hero,'heart-of-the-phoenix'), damage=[2,3,4,6][tier], heal=Math.min(hero.maxHp,[5,8,12,16][tier]);
 const events: Omit<BattleEvent,'id'>[]=[{kind:'heal',targetId:hero.id,amount:heal,label:'Heart of the Phoenix'}];
 const foes=state.foes.map(foe=>{
  if(foe.hp<=0)return foe;
  const hp=Math.max(0,foe.hp-damage);
  events.push({kind:'hit',sourceId:hero.id,targetId:foe.id,amount:foe.hp-hp,label:'Heart of the Phoenix · Fire'});
  if(hp===0)events.push({kind:'ko',sourceId:hero.id,targetId:foe.id});
  return hp>0 ? withStatus({...foe,hp,rimeFrozen:state.turn==='enemy' || foe.rimeFrozen}, {id:'stun',turns:1}) : {...foe,hp,statuses:[]};
 });
 const revived={...state,party:state.party.map(actor=>actor.id===hero.id?{...actor,hp:heal,phoenixRecharge:[-1,12,8,5][tier]}:actor),foes,result:null};
 const next=pushEvents(revived,events);
 return {...next,result:outcome(next)};
}
