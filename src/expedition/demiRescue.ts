import { apCap, createPlayableSandboxScenario, newActor, type BattleState, type BattleActor } from '../proto/rules/battle';
import { carrySeriesParty } from '../proto/rules/combatSeries';
import { stockCard } from '../proto/rules/skirmish';
import { MOTE_IDS, type LightMoteId, type MoteCounts } from '../proto/rules/lightMoteData';
export const RESCUE_SAVE='exploritaire.demi-rescue.v1';
export const STOPS=[
 {name:'The sheltering roots',detail:'Home Tree falls behind. Demi’s refuge lies beyond the cold passage.',hp:6,foes:1},
 {name:'The cold passage',detail:'The same narrow passage will be on the way home.',hp:8,foes:1},
 {name:'Demi’s refuge',detail:'Demi is stranded here. Recruiting her will stir the darkness and commit the party to the return journey.',hp:0,foes:0},
 {name:'The passage, awakened',detail:'The darkness has sensed its loss. The passage is crowded now.',hp:5,foes:2},
 {name:'The last roots',detail:'Home Tree is close. Two sentries stand between the party and safety.',hp:7,foes:2},
] as const;
export type RescueState={version:1; safe:boolean; recipes:string[]; collection:MoteCounts; departures:number; run:null|{
 id:number;stop:number;phase:'world'|'fight'|'boundary'|'refuge';joined:boolean;hero:BattleActor;demi?:BattleActor;earned:MoteCounts;battle?:BattleState;party?:BattleState;signature?:string};result?:string};
export const initialRescue=():RescueState=>({version:1,safe:false,recipes:[],collection:{},departures:0,run:null});
export const runKey=(s:RescueState)=>s.run?`${s.run.id}:${s.run.stop}`:'';
export const moteCapacity=(counts:MoteCounts)=>Math.min(6,Object.values(counts).reduce((n,v)=>n+(v??0),0));
export function prepareActor(a:BattleActor):BattleActor {const next={...a,baseAPCap:0,motesGrantAP:true,innateBurnChance:0,inspiration:0,iceRewards:[],harness:undefined};return {...next,charge:Math.min(a.charge,apCap(next))};}
export function rescueBattle(s:RescueState):BattleState {
 const r=s.run!,stop=STOPS[r.stop],fresh=createPlayableSandboxScenario(stop.foes===2?'101':'100');
 const seed=(r.id*2654435761+r.stop*173)>>>0;fresh.seed=seed;fresh.effectSeed=seed;
 fresh.columns=fresh.columns.map((p,c)=>p.map((_,i)=>stockCard(seed,c*4+i)));
 fresh.foes=fresh.foes.map((f,i)=>({...f,name:r.joined?`Surge Mote ${i+1}`:'Weakened Mote',hp:stop.hp,profile:{...f.profile,maxHp:stop.hp}}));
 const carried=r.party?carrySeriesParty(r.party,fresh):fresh;
 return {...carried,expeditionKeru:[],keruInvoke:undefined,cir:undefined,cirCompanion:undefined,keruExpedition:undefined,keruSelection:undefined,momentum:{...fresh.momentum!,decayEnabled:false},party:[prepareActor(r.hero),...(r.demi?[prepareActor(r.demi)]:[])].map(a=>({...a,targetId:fresh.foes[0].id}))};
}
function end(s:RescueState,won:boolean,reason:string):RescueState {
 const r=s.run!;const collection=won?Object.fromEntries(MOTE_IDS.map(id=>[id,(s.collection[id]??0)+(r.earned[id]??0)])):s.collection;
 return {...s,run:null,collection,safe:s.safe||(won&&r.joined),result:reason};
}
export type RescueAction={type:'depart'}|{type:'enter'}|{type:'advance'}|{type:'recruit'}|{type:'abort'}|{type:'battle';key:string;battle:BattleState}|{type:'transfer';id:LightMoteId;from:'hero'|'demi'};
export function rescueReducer(s:RescueState,a:RescueAction):RescueState {
 const r=s.run;
 if(a.type==='depart')return r||s.safe?s:{...s,departures:s.departures+1,result:undefined,run:{id:s.departures+1,stop:0,phase:'world',joined:false,hero:prepareActor({...newActor('hero'),lightMotes:{},charge:0}),earned:{}}};
 if(!r)return s;
 switch(a.type){
 case 'abort':return !r.joined&&r.phase!=='fight'?end(s,true,'Returned before recruitment. Collected motes are secured.'):s;
 case 'enter':return r.phase==='world'?{...s,run:{...r,phase:'fight',battle:rescueBattle(s),signature:undefined}}:s;
 case 'advance':{
  if(r.phase!=='boundary')return s;
  if(r.stop===4)return end(s,true,'Demi is home. She is permanently safe.');
  const stop=r.stop+1;return {...s,run:{...r,stop,phase:stop===2?'refuge':'world',battle:undefined,signature:undefined}};
 }
 case 'recruit':return r.phase==='refuge'&&!r.joined?{...s,run:{...r,joined:true,stop:3,phase:'world',demi:prepareActor({...newActor('dem'),name:'Demi',hp:24,maxHp:24,rank:6,charge:0,lightMotes:{}})}}:s;
 case 'transfer':{
  if(r.phase==='fight'||!r.demi)return s;
  const donor=a.from==='hero'?r.hero:r.demi,receiver=a.from==='hero'?r.demi:r.hero;
  if(!(donor.lightMotes?.[a.id])||Object.values(receiver.lightMotes??{}).reduce((n,v)=>n+(v??0),0)>=6)return s;
  const from=prepareActor({...donor,lightMotes:{...donor.lightMotes,[a.id]:donor.lightMotes![a.id]!-1}}),to=prepareActor({...receiver,lightMotes:{...receiver.lightMotes,[a.id]:(receiver.lightMotes?.[a.id]??0)+1}});
  return {...s,run:{...r,hero:a.from==='hero'?from:to,demi:a.from==='hero'?to:from},recipes:[...new Set([...s.recipes,...((to.lightMotes?.['frost-mote']??0)>=2?[to.id==='hero'?'Ice Climber':'Glacial Armor']:[])])]};
 }
 case 'battle':{
  if(r.phase!=='fight'||a.key!==runKey(s)||!r.battle)return s;
  const b=a.battle,signature=JSON.stringify([b.nextEventId,b.round,b.turn,b.result,b.party,b.columns,b.foes.map(f=>[f.hp,f.rank,f.statuses])]);if(signature===r.signature)return s;
  const hero=b.party.find(x=>x.id==='hero')!,demi=b.party.find(x=>x.id==='dem');
  let next={...s,run:{...r,battle:b,party:b,hero,demi,signature}};
  if(b.result==='lost'||hero.hp<=0||r.joined&&(!demi||demi.hp<=0))return end(next,false,'The expedition failed. Unbanked motes are lost. Demi’s rescue can be attempted again.');
  if(b.result==='won'){
   const reward=r.stop<2?'frost-mote':'verdant-mote';
   const recovered=(actor:BattleActor)=>({...actor,hp:Math.min(actor.maxHp,actor.hp+3)});
   next={...next,recipes:[...new Set([...s.recipes,...(r.stop===1?['Ice Climber']:[])])],run:{...next.run,phase:'boundary' as const,hero:prepareActor({...recovered(hero),lightMotes:{...hero.lightMotes,[reward]:(hero.lightMotes?.[reward]??0)+1}}),demi:demi?recovered(demi):undefined,earned:{...r.earned,[reward]:(r.earned[reward]??0)+1}}};
  }
  return next;
 }
 }
 return s;
}
export function decodeRescue(raw:string|null):RescueState|null {
 try {if(!raw)return null;const s=JSON.parse(raw) as RescueState;if(s.version!==1||typeof s.safe!=='boolean'||!Array.isArray(s.recipes)||!s.collection||!Number.isInteger(s.departures))return null;
 if(s.run){const r=s.run;if(!Number.isInteger(r.stop)||!STOPS[r.stop]||!['world','fight','boundary','refuge'].includes(r.phase)||!r.hero||r.hero.id!=='hero'||!Number.isFinite(r.hero.hp)||!r.earned||r.phase==='fight'&&(!r.battle||!Array.isArray(r.battle.columns)||!Array.isArray(r.battle.party)))return null;}return s;
 }catch{return null;}
}
