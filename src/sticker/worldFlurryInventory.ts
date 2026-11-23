import {isSnowflakeExpression,stickerMemory,type SnowflakeReward} from '../proto/rules/snowflakeReward';
const key='exploritaire.world1111.flurry';
// Compatibility only: keep the original storage name so existing collections migrate.
const legacyKey='exploritaire.world1111.snowflee';
let session:SnowflakeReward|undefined;
/** Pickup/progression is deliberately separate from World Studio authoring. */
export function readWorldFlurry():SnowflakeReward|undefined{
 function decode(raw:string|null):SnowflakeReward|undefined{
 try{const value=JSON.parse(raw??'null');if(value?.version!==1)return;const reward=value.reward;if(reward==='available')return reward;
  const memory=reward?.memory;if(reward?.kinId!=='hero'||!memory||!Number.isFinite(memory.x)||!Number.isFinite(memory.y)||!isSnowflakeExpression(memory.enhancement))return;
  const bounded=stickerMemory(memory.x,memory.y);if(bounded.x!==memory.x||bounded.y!==memory.y)return;return {kinId:'hero',memory:{...bounded,enhancement:memory.enhancement}};
 }catch{return;}
 }
 try{
  const current=decode(localStorage.getItem(key));if(current!==undefined)return current;
  const legacy=decode(localStorage.getItem(legacyKey));if(legacy===undefined)return session;
  session=legacy;
  // A blocked write must not hide a valid old collection or destroy its backup.
  try{localStorage.setItem(key,JSON.stringify({version:1,reward:legacy}));}catch{/* Use the migrated session until storage is writable. */}
  return legacy;
 }catch{return session;}
}
export function saveWorldFlurry(reward:SnowflakeReward){session=reward;let saved=true;try{localStorage.setItem(key,JSON.stringify({version:1,reward}));}catch{saved=false;}if(typeof window!=='undefined')window.dispatchEvent(new Event('world-flurry-change'));return saved;}
/** Free the collected sticker without deleting it or refunding past combat effects. */
export function unstickWorldFlurry(){const reward=readWorldFlurry();if(!reward||reward==='available')return false;saveWorldFlurry('available');return true;}
