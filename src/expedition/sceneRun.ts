import { apCap, createPlayableSandboxScenario, type BattleState } from '../proto/rules/battle';
import { carrySeriesParty } from '../proto/rules/combatSeries';
import { stockCard } from '../proto/rules/skirmish';
import type { IceRewardPick } from '../proto/rules/iceRewards';
import { isLightMote, MOTE_IDS, type LightMoteId, type MoteCounts } from '../proto/rules/lightMoteData';

export const SCENE_SAVE_KEY = 'exploritaire.mote-trials.v3';
export const BALANCE = { hp: 32, baseAP: 3, burnChance: .1, scenes: 5, recovery: 4, carryCollection: false } as const;
export type Affinity = 'ember' | 'splash' | 'frost' | 'gale';
export type CombatNode = { id: string; stage: number; row: number; name: string; affinity: Affinity; foes: number; hp: number; risk: string; hint: string };
export const MAJOR_REWARDS: IceRewardPick['id'][] = ['ice-armor','stone-shell','heart-of-the-phoenix','regrowth','thorns','whiteout','glacial-lance','shatterstrike','rime-retort','ember-cadence','flowing-current','tailwind'];
export const milestone = (stage: number) => stage === 3 || stage === 5;
const AFFINITIES: Affinity[] = ['ember', 'splash', 'frost', 'gale'];
const MOTE_PATHS: Record<Affinity, LightMoteId[]> = {
 ember: ['ember-mote','cinder-mote','spark-mote'], splash: ['splash-mote','verdant-mote','spark-mote'],
 frost: ['frost-mote','pebble-mote','splash-mote'], gale: ['gale-mote','verdant-mote','ember-mote'],
};
const MAJOR_PATHS: Record<Affinity, IceRewardPick['id'][]> = {
 ember: ['ember-cadence','heart-of-the-phoenix','thorns'], splash: ['flowing-current','regrowth','tailwind'],
 frost: ['ice-armor','glacial-lance','rime-retort'], gale: ['tailwind','stone-shell','whiteout'],
};
export function createNodes(): CombatNode[] {
 const start: CombatNode = { id:'1-start',stage:1,row:1,name:'First spark',affinity:'ember',foes:1,hp:6,risk:'1 weakened Mote · 6 HP',hint:'Ember / Splash / Frost mote' };
 return [start,...Array.from({length:4},(_,depth)=>AFFINITIES.map((affinity,row)=>{
  const stage=depth+2, foes=row===3 && stage>=3?2:1, hp=foes===2?stage+1:stage+5;
  const name=({ember:'Cinder drift',splash:'Ripple knot',frost:'Frost ring',gale:'Crosswind'} as const)[affinity];
  return {id:`${stage}-${affinity}`,stage,row,name,affinity,foes,hp,risk:`${foes===2?'Hard · ':''}${foes} Mote${foes===2?'s':''} · ${hp} HP each`,hint:milestone(stage)?({ember:'Fire ability',splash:'Recovery / AP ability',frost:'Ice ability',gale:'Evasion / guard ability'} as const)[affinity]:({ember:'Ember / Cinder / Spark',splash:'Splash / Verdant / Spark',frost:'Frost / Pebble / Splash',gale:'Gale / Verdant / Ember'} as const)[affinity]};
 })).flat()];
}
export const connected = (a: CombatNode, b: CombatNode) => b.stage === a.stage+1 && (a.stage===1 || Math.abs(a.row-b.row)!==2);
export type Run = { id:number; stage:number; nodeId:string; nodes:CombatNode[]; visited:string[]; phase:'scene'|'reward'|'route';
 hp:number; maxHp:number; ap:number; rank:number; completed:number; motes:MoteCounts; earnedMotes:MoteCounts;
 rewards:IceRewardPick[]; earned:IceRewardPick[]; offers:IceRewardPick[]; battle?:BattleState; party?:BattleState; signature?:string };
export type Profile = { motes:MoteCounts; rewards:IceRewardPick[]; xp:number; departures:number; returns:number };
export type Home = { reason:string; completed:number; motes:MoteCounts; rewards:IceRewardPick[]; pending:IceRewardPick[]; path:string[] };
export type SceneState = { version:3; profile:Profile; run:Run|null; home:Home|null };
export const currentNode = (run:Run) => run.nodes.find(n=>n.id===run.nodeId)!;
export const nextNodes = (run:Run) => run.nodes.filter(n=>connected(currentNode(run),n));
export const sceneKey = (run:Run) => `${run.id}:${run.nodeId}`;
const mergeRewards = (a:IceRewardPick[],b:IceRewardPick[]) => {
 const picks=new Map(a.map(p=>[p.id,{...p}]));for(const p of b){const old=picks.get(p.id);if(!old || old.tier<p.tier)picks.set(p.id,{...p});}return [...picks.values()];
};
const addMotes = (a:MoteCounts,b:MoteCounts) => Object.fromEntries(MOTE_IDS.map(id=>[id,(a[id]??0)+(b[id]??0)]).filter(([,n])=>Number(n)>0)) as MoteCounts;
export const moteTotal = (motes:MoteCounts) => Object.values(motes).reduce((n,v)=>n+(v??0),0);
export function rewardOffers(run:Run):IceRewardPick[] {
 if(run.stage===1)return ['ember-mote','splash-mote','frost-mote'].map(id=>({id:id as LightMoteId,tier:0}));
 const node=currentNode(run);
 if(milestone(run.stage))return MAJOR_PATHS[node.affinity].map(id=>({id,tier:Math.min(3,(run.rewards.find(p=>p.id===id)?.tier??-1)+1) as IceRewardPick['tier']}));
 const pool=[...MOTE_PATHS[node.affinity],...MOTE_IDS.filter(id=>!MOTE_PATHS[node.affinity].includes(id))].filter(id=>(run.motes[id]??0)<3);
 return pool.slice(0,3).map(id=>({id,tier:0}));
}
export function createSceneBattle(run:Run):BattleState {
 const node=currentNode(run), fresh=createPlayableSandboxScenario(node.foes===2?'101':'100');
 const seed=(Math.imul(run.id,2654435761)+run.stage*101+node.row*29)>>>0;
 fresh.seed=seed;fresh.effectSeed=seed;
 fresh.columns=fresh.columns.map((pile,column)=>pile.map((_,depth)=>stockCard(seed,column*4+depth)));
 fresh.foes=fresh.foes.map((foe,i)=>({...foe,name:node.foes===1?'Weakened Mote':`Mote ${i+1}`,hp:node.hp,profile:{...foe.profile,maxHp:node.hp}}));
 const previous=run.party?carrySeriesParty(run.party,fresh):fresh;
 const party=previous.party.filter(a=>a.id==='hero').map(a=>{
  const actor={...a,hp:run.hp,maxHp:run.maxHp,rank:run.rank,baseAPCap:BALANCE.baseAP,innateBurnChance:BALANCE.burnChance,lightMotes:{...run.motes},moteSpendSeed:a.moteSpendSeed??(seed^0x12345678),harness:undefined,
   iceArmor:Math.max(a.iceArmor??0,Math.min(6,(a.iceArmor??0)+(run.motes['pebble-mote']??0))),foundationCards:[{id:`mote-${sceneKey(run)}`,rank:run.rank}],iceRewards:run.rewards.map(p=>p.id),iceRewardTiers:Object.fromEntries(run.rewards.map(p=>[p.id,p.tier]))};
  return {...actor,charge:Math.min(apCap(actor),run.ap)};
 });
 return {...previous,expeditionKeru:[],keruInvoke:undefined,cir:undefined,cirCompanion:undefined,keruSelection:undefined,keruExpedition:undefined,maxAP:false,
  momentum:{...previous.momentum!,decayEnabled:false},party};
}
function enterScene(run:Run):Run {const next={...run,phase:'scene' as const,offers:[],signature:undefined};return {...next,battle:createSceneBattle(next)};}
function depart(state:SceneState):SceneState {
 const nodes=createNodes(),motes=BALANCE.carryCollection?Object.fromEntries(Object.entries(state.profile.motes).map(([id,n])=>[id,Math.min(3,n??0)])):{};
 const run=enterScene({id:state.profile.departures+1,stage:1,nodeId:nodes[0].id,nodes,visited:[],phase:'scene',hp:BALANCE.hp,maxHp:BALANCE.hp,ap:0,rank:2,completed:0,
  motes,earnedMotes:{},rewards:BALANCE.carryCollection?[...state.profile.rewards]:[],earned:[],offers:[]});
 return {...state,profile:{...state.profile,departures:run.id},run,home:null};
}
export function initialSceneState():SceneState {return depart({version:3,profile:{motes:{},rewards:[],xp:0,departures:0,returns:0},run:null,home:null});}
function rope(state:SceneState,reason:string):SceneState {
 const run=state.run;if(!run)return state;
 return {...state,run:null,profile:{...state.profile,motes:addMotes(state.profile.motes,run.earnedMotes),rewards:mergeRewards(state.profile.rewards,run.earned),xp:state.profile.xp+run.completed,returns:state.profile.returns+1},
  home:{reason,completed:run.completed,motes:run.earnedMotes,rewards:run.earned,pending:run.phase==='reward'?run.offers:[],path:run.visited}};
}
export function sceneBattleSignature(b:BattleState){return JSON.stringify([b.nextEventId,b.result,b.round,b.turn,b.columns,b.party,b.foes.map(f=>[f.id,f.hp,f.rank,f.statuses])]);}
export type SceneAction={type:'start'}|{type:'rope'}|{type:'choose-node';nodeId:string}|{type:'battle';key:string;battle:BattleState}|{type:'reward';key?:string;pick:IceRewardPick};
export function sceneReducer(state:SceneState,action:SceneAction):SceneState {
 const run=state.run;
 if(action.type==='start')return !run&&!state.home?.pending.length?depart(state):state;
 if(action.type==='rope')return rope(state,'Escape Rope · all earned powers kept.');
 if(action.type==='reward'&&!run){
  if(!state.home?.pending.some(p=>p.id===action.pick.id&&p.tier===action.pick.tier))return state;
  const id=action.pick.id;
  return isLightMote(id)?{...state,profile:{...state.profile,motes:addMotes(state.profile.motes,{[id]:1})},home:{...state.home,motes:addMotes(state.home.motes,{[id]:1}),pending:[]}}:
   {...state,profile:{...state.profile,rewards:mergeRewards(state.profile.rewards,[action.pick])},home:{...state.home,rewards:mergeRewards(state.home.rewards,[action.pick]),pending:[]}};
 }
 if(!run)return state;
 if('key'in action&&action.key!==sceneKey(run))return state;
 switch(action.type){
  case 'choose-node':{
   const node=nextNodes(run).find(n=>n.id===action.nodeId);
   return run.phase==='route'&&node?{...state,run:enterScene({...run,nodeId:node.id,stage:node.stage})}:state;
  }
  case 'battle':{
   if(!run.battle||action.battle.sandboxScenario!==run.battle.sandboxScenario)return state;
   const battle=action.battle,signature=sceneBattleSignature(battle),hero=battle.party.find(a=>a.id==='hero');
   if(signature===run.signature||!hero)return state;
   if(run.phase==='reward')return battle.result==='won'&&hero.hp===run.hp?{...state,run:{...run,battle,party:battle,signature}}:state;
   if(run.phase!=='scene')return state;
   let next:Run={...run,battle,party:battle,hp:hero.hp,ap:hero.charge,rank:hero.rank,signature};
   if(battle.result==='won'){
    next={...next,completed:run.completed+1,visited:[...run.visited,run.nodeId],phase:'reward',hp:Math.min(run.maxHp,hero.hp+BALANCE.recovery),offers:rewardOffers(run)};
   }
   const synced={...state,run:next};
   return hero.hp<=0||battle.result==='lost'?rope(synced,'Hero is spent. All earned powers are kept.'):synced;
  }
  case 'reward':{
   if(action.key!==sceneKey(run)||run.phase!=='reward'||!run.offers.some(p=>p.id===action.pick.id&&p.tier===action.pick.tier))return state;
   const id=action.pick.id, next={...state,run:{...run,phase:'route' as const,battle:undefined,offers:[],
    motes:isLightMote(id)?addMotes(run.motes,{[id]:1}):run.motes,earnedMotes:isLightMote(id)?addMotes(run.earnedMotes,{[id]:1}):run.earnedMotes,
    rewards:isLightMote(id)?run.rewards:mergeRewards(run.rewards,[action.pick]),earned:isLightMote(id)?run.earned:mergeRewards(run.earned,[action.pick])}};
   return run.completed===BALANCE.scenes?rope(next,'Five fights complete. Your powers are secured.'):next;
  }
 }
 return state;
}
/** v3 isolates combat tuning. Older Seed/travel saves remain untouched. */
export function decodeSceneSave(raw:string|null):SceneState|null {
 if(!raw)return null;
 try{
  const s=JSON.parse(raw) as SceneState;
  const n=(v:unknown)=>typeof v==='number'&&Number.isFinite(v)&&v>=0;
  const motes=(v:MoteCounts)=>v&&typeof v==='object'&&Object.entries(v).every(([id,c])=>isLightMote(id)&&n(c)&&Number.isInteger(c));
  const picks=(v:IceRewardPick[])=>Array.isArray(v)&&v.every(p=>p&&(isLightMote(p.id)||MAJOR_REWARDS.includes(p.id))&&Number.isInteger(p.tier)&&p.tier>=0&&p.tier<=3);
  const battle=(b:BattleState)=>b&&Array.isArray(b.party)&&b.party.some(a=>a.id==='hero'&&n(a.hp))&&Array.isArray(b.foes)&&Array.isArray(b.columns)&&b.columns.every(p=>Array.isArray(p)&&p.every(c=>c&&typeof c.id==='string'&&n(c.rank)))&&Array.isArray(b.events)&&n(b.seed)&&b.tutorial;
  if(s.version!==3||!s.profile||!motes(s.profile.motes)||!picks(s.profile.rewards)||![s.profile.xp,s.profile.departures,s.profile.returns].every(n))return null;
  const r=s.run;
  if(r&&(!Array.isArray(r.nodes)||r.nodes.length!==17||!r.nodes.some(v=>v.id===r.nodeId)||!Array.isArray(r.visited)||!['scene','reward','route'].includes(r.phase)||![r.id,r.stage,r.hp,r.maxHp,r.ap,r.rank,r.completed].every(n)||r.stage<1||r.stage>5||!motes(r.motes)||!motes(r.earnedMotes)||!picks(r.rewards)||!picks(r.earned)||!picks(r.offers)||r.battle&&!battle(r.battle)||r.party&&!battle(r.party)||r.phase==='scene'&&!r.battle||r.phase==='reward'&&r.offers.length!==3))return null;
  if(s.home&&(!motes(s.home.motes)||!picks(s.home.rewards)||!picks(s.home.pending)||typeof s.home.reason!=='string'||!Array.isArray(s.home.path)))return null;
  return r&&!s.home||!r&&s.home?s:null;
 }catch{return null;}
}
/** Import the old collection only: builds, resources and Seed state are retired. */
export function restoreSceneSave(raw:string|null,legacyRaw:string|null):SceneState {
 const saved=decodeSceneSave(raw);if(saved)return saved;
 const fresh=initialSceneState();
 try{
  const legacy=JSON.parse(legacyRaw??'null');if(legacy?.version!==2)return fresh;
  const valid=(cards:unknown):IceRewardPick[]=>Array.isArray(cards)?cards.filter(p=>p&&MAJOR_REWARDS.includes(p.id)&&Number.isInteger(p.tier)&&p.tier>=0&&p.tier<=3):[];
  fresh.profile.rewards=mergeRewards(valid(legacy.profile?.rewards),valid(legacy.run?.earned));
  if(Number.isFinite(legacy.profile?.xp))fresh.profile.xp=Math.max(0,Math.floor(legacy.profile.xp));
 }catch{/* The earlier save is never modified. */}
 return fresh;
}
