import {apCap,type BattleActor,type BattleEvent,type BattleState} from './battle';
import {isSilenced} from './battleStatuses';
import type {RarityTier} from './keruInvokeData';
export type GritBuff={tier:RarityTier;turn:number;enemies:string[]};
/** Explicit draft entries preserve the requested exact cost/proc limit at every rarity. */
export const GRIT_TIERS=[{name:'Common',cost:2,ap:1},{name:'Rare',cost:2,ap:1},{name:'Epic',cost:2,ap:1},{name:'Legendary',cost:2,ap:1}] as const;
export const gritDescription='Buff keru · Costs the target kin 2 AP. Exhausted after use for the run. When that kin is attacked, gain 1 AP, once per attacking enemy per turn, up to maximum AP. Blocked/evaded attacks count; damage-over-time and passive retaliation do not. Does not stack.';
export function useGrit(s:BattleState,id:string,tier:RarityTier=0):BattleState{
 const a=s.party.find(a=>a.id===id);if(!a||a.hp<=0||a.disarmed||a.turnSpent||a.controller==='npc'||isSilenced(s,id)||s.result||s.turn!=='party'||s.gritExhausted||s.party.some(a=>a.grit)||a.charge<2||![0,1,2,3].includes(tier)||s.adeptFrenzy)return s;
 return {...s,gritExhausted:true,party:s.party.map(a=>a.id===id?{...a,charge:a.charge-2,grit:{tier,turn:s.round??0,enemies:[]}}:a)};
}
export function gritOnAttack(s:BattleState,a:BattleActor,enemyId:string):BattleActor{
 const g=a.grit;if(!g||a.hp<=0)return a;const turn=s.round??0,enemies=g.turn===turn?g.enemies:[];if(enemies.includes(enemyId))return a;
 return {...a,charge:Math.min(apCap(a),a.charge+1),grit:{...g,turn,enemies:[...enemies,enemyId]}};
}
export function gritFromEvents(s:BattleState,events:Omit<BattleEvent,'id'>[],onDamageProc?:(foeId:string,kinId:string)=>void):BattleActor[]{
 let party=s.party;
 for(const event of events){
  const foeId=event.sourceId;
  if(event.kind!=='enemy-hit'||!foeId||!s.foes.some(f=>f.id===foeId)||['Thorns','Indominable'].includes(event.label??''))continue;
  party=party.map(actor=>{
   if(actor.id!==event.targetId)return actor;
   const next=gritOnAttack(s,actor,foeId);
   if(next!==actor&&(event.amount??0)>0)onDamageProc?.(foeId,actor.id);
   return next;
  });
 }
 return party;
}
