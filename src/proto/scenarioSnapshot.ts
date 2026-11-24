import type {BattleState} from './rules/battle';
import {DEFAULT_STICKER_MEMORY,isSnowflakeExpression,stickerMemory} from './rules/snowflakeReward';
export const SNAPSHOT_PARAM='battleSnapshot';
const MAX_BYTES=1_000_000,MAX_TOKEN=64_000;
export type ScenarioSnapshot={version:1;scene:'musicaltableaus';scenario:string;state:BattleState};
const object=(v:unknown):v is Record<string,unknown>=>!!v&&typeof v==='object'&&!Array.isArray(v);
const finite=(v:unknown)=>typeof v==='number'&&Number.isFinite(v);
/** Reject unsafe keys, non-finite numbers and pathological nesting before hydration. */
function checkTree(v:unknown,depth=0):void{
 if(depth>40)throw Error('Snapshot is too deeply nested.');
 if(typeof v==='number'&&!Number.isFinite(v))throw Error('Invalid snapshot number.');
 if(v&&typeof v==='object')for(const [key,value]of Object.entries(v)){if(['__proto__','constructor','prototype'].includes(key))throw Error('Invalid snapshot key.');checkTree(value,depth+1);}
}
export function validateSnapshot(value:unknown):ScenarioSnapshot{
 checkTree(value);if(!object(value)||value.version!==1)throw Error('Unsupported scenario link version.');
 if(value.scene!=='musicaltableaus'||typeof value.scenario!=='string'||!object(value.state))throw Error('Invalid scenario link.');
 const s=value.state;
 if(!object(s.rules)||typeof s.rules.hungry!=='boolean'||typeof s.rules.traps!=='boolean')throw Error('Invalid battle rules.');
 if(s.momentum!==undefined&&(!object(s.momentum)||!['value','earned','spent','sequence'].every(k=>finite((s.momentum as Record<string,unknown>)[k]))))throw Error('Invalid Momentum state.');
 const cards=(v:unknown)=>Array.isArray(v)&&v.length<=2000&&v.every(c=>object(c)&&typeof c.id==='string'&&finite(c.rank)&&Number(c.rank)>=1&&Number(c.rank)<=13&&(c.element===undefined||c.element==='ice')&&(c.fetched===undefined||c.fetched===true));
 if(s.digReserve!==undefined&&!cards(s.digReserve))throw Error('Invalid Dig reserve in scenario link.');
 if(!Array.isArray(s.party)||!s.party.length||s.party.length>20||!s.party.every(a=>object(a)&&['hero','mochi','banks','dem','cir','riv','aldan-seed','snow-golem'].includes(String(a.id))&&typeof a.name==='string'&&['hp','maxHp','rank','charge','inspiration','count'].every(k=>finite(a[k]))&&Array.isArray(a.spirits)&&(!a.foundationCards||cards(a.foundationCards))))throw Error('Invalid party in scenario link.');
 if(!Array.isArray(s.foes)||!s.foes.length||s.foes.length>30||!s.foes.every(a=>object(a)&&typeof a.id==='string'&&typeof a.name==='string'&&finite(a.hp)&&object(a.profile)&&finite(a.profile.maxHp)))throw Error('Invalid enemies in scenario link.');
 if(!Array.isArray(s.columns)||s.columns.length>100||!s.columns.every(cards)||!cards(s.stock)||!['seed','effectSeed','dealt','time','nextEventId'].every(k=>finite(s[k]))||!object(s.rules)||!object(s.traps)||!Array.isArray(s.events)||typeof s.started!=='boolean'||typeof s.maxAP!=='boolean'||!['party','enemy'].includes(String(s.turn))||![null,'won','lost'].includes(s.result as null|'won'|'lost')||s.sandboxScenario!==value.scenario)throw Error('Incomplete battle snapshot.');
 if(!s.foes.every(a=>object(a)&&['timer','stagger','staggered','rank'].every(k=>finite(a[k]))&&Array.isArray(a.effects)))throw Error('Invalid enemy timers or effects.');
 if(!s.party.every(a=>object(a)&&(!a.statuses||Array.isArray(a.statuses))&&(!a.fastSwipes||object(a.fastSwipes)&&finite(a.fastSwipes.moves))))throw Error('Invalid party abilities or statuses.');
 if(new Set(s.party.map(a=>(a as {id:string}).id)).size!==s.party.length)throw Error('Duplicate party member in snapshot.');
 const reward=s.snowflakeReward;
 if(reward!==undefined&&reward!=='available'){
  if(!object(reward)||!s.party.some(actor=>object(actor)&&actor.id===reward.kinId))throw Error('Invalid snowflake reward.');
  if(reward.memory===undefined&&isSnowflakeExpression(reward.expression)){
   return {...value,state:{...s,snowflakeReward:{kinId:reward.kinId,memory:DEFAULT_STICKER_MEMORY}}} as unknown as ScenarioSnapshot;
  }
  const memory=reward.memory;
  if(!object(memory)||typeof memory.x!=='number'||typeof memory.y!=='number'||(memory.depth!==undefined&&memory.depth!=='background'&&memory.depth!=='parallax'))throw Error('Invalid sticker memory.');
  if(memory.enhancement!==undefined&&!isSnowflakeExpression(memory.enhancement))throw Error('Invalid sticker enhancement.');
  const bounded=stickerMemory(memory.x,memory.y);
  if(bounded.x!==memory.x||bounded.y!==memory.y)throw Error('Invalid sticker memory.');
  if(memory.depth!==undefined){
   return {...value,state:{...s,snowflakeReward:{kinId:reward.kinId,memory:{...bounded,...(memory.enhancement?{enhancement:memory.enhancement}:{})}}}} as unknown as ScenarioSnapshot;
  }
 }
 return value as unknown as ScenarioSnapshot;
}
export function captureSnapshot(state:BattleState):ScenarioSnapshot{
 // Historical hit notifications are presentation, not simulation; do not replay them.
 return validateSnapshot(JSON.parse(JSON.stringify({version:1,scene:'musicaltableaus',scenario:state.sandboxScenario,state:{...state,events:[]}})));
}
async function bytes(stream:ReadableStream<Uint8Array>):Promise<Uint8Array>{
 const reader=stream.getReader(),chunks:Uint8Array[]=[];let size=0;
 try{while(true){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>MAX_BYTES)throw Error('Scenario snapshot is too large.');chunks.push(value);}}finally{await reader.cancel();}
 const result=new Uint8Array(size);let offset=0;for(const c of chunks){result.set(c,offset);offset+=c.length;}return result;
}
export async function encodeSnapshot(snapshot:ScenarioSnapshot):Promise<string>{
 const json=JSON.stringify(validateSnapshot(snapshot));if(new TextEncoder().encode(json).length>MAX_BYTES)throw Error('Scenario snapshot is too large.');
 const compressed=await bytes(new Blob([json]).stream().pipeThrough(new CompressionStream('gzip')));
 let binary='';for(const n of compressed)binary+=String.fromCharCode(n);const token='1g.'+btoa(binary).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');if(token.length>MAX_TOKEN)throw Error('Scenario is too large for a share link.');return token;
}
export async function decodeSnapshot(token:string):Promise<ScenarioSnapshot>{
 if(token.length>MAX_TOKEN||!/^1g\.[A-Za-z0-9_-]+$/.test(token))throw Error('Invalid or unsupported scenario link.');
 try{const encoded=token.slice(3).replace(/-/g,'+').replace(/_/g,'/'),raw=Uint8Array.from(atob(encoded),c=>c.charCodeAt(0));const data=await bytes(new Blob([raw]).stream().pipeThrough(new DecompressionStream('gzip')));return validateSnapshot(JSON.parse(new TextDecoder().decode(data)));}catch(error){throw Error('Cannot restore scenario link: '+(error instanceof Error?error.message:'invalid data'));}
}
export async function scenarioSnapshotUrl(state:BattleState,href:string):Promise<string>{const url=new URL(href);url.searchParams.set('scenario',String(state.sandboxScenario));url.searchParams.set(SNAPSHOT_PARAM,await encodeSnapshot(captureSnapshot(state)));return url.href;}

