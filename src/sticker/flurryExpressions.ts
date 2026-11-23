export const FLURRY_FACE_IDS=['neutral','curious','happy','sad','surprised','delighted','worried','determined','sleepy','content','wink-left','wink-right','blink-half','blink-closed','look-left','look-right','look-up','look-down','look-up-left','look-up-right'] as const;
export type FlurryFaceId=typeof FLURRY_FACE_IDS[number];
export const FLURRY_FACE_ATLAS={url:`${import.meta.env.BASE_URL}assets/runtime/ui/stickers/snowflake-expressions-v2/faces.png`,columns:4,rows:5,tile:384};
export const flurryFaceIndex=(id:FlurryFaceId)=>FLURRY_FACE_IDS.indexOf(id);
export function flurryFaceCell(id:FlurryFaceId){const index=flurryFaceIndex(id);return {column:index%4,row:Math.floor(index/4)};}
export function flurryFaceUV(id:FlurryFaceId){const {column,row}=flurryFaceCell(id);return {x:column/4,y:1-(row+1)/5};}
const weights:readonly (readonly [FlurryFaceId,number])[]=[['neutral',6],['curious',6],['happy',4],['look-left',3],['look-right',3],['look-up',2],['look-down',1],['look-up-left',2],['look-up-right',2],['content',1],['delighted',.8],['wink-left',.7],['wink-right',.7],['worried',.35],['determined',.6],['sleepy',.45],['sad',.2],['surprised',.6]];
export type FlurryFacePose={face:FlurryFaceId;blink:'blink-half'|'blink-closed'|null};
/** One source of expression timing for DOM stickers and the Three.js rig.
 * Absolute-time updates remain cheap; seeded random input makes it testable. */
export function createFlurryFaceRig(random:()=>number=Math.random){
 let face:FlurryFaceId='neutral',holdUntil=-Infinity,nextBlink=Infinity,blinkStart=-Infinity,last=-Infinity,doubleBlink=false;
 function pick(){const total=weights.reduce((sum,[,weight])=>sum+weight,0);let value=random()*total;for(const [id,weight]of weights){value-=weight;if(value<=0)return id;}return 'neutral' as const;}
 return {update(seconds:number,reduced=false):FlurryFacePose{
  if(reduced){last=-Infinity;return {face:'neutral',blink:null};}
  if(!Number.isFinite(last)||seconds<last){face='neutral';holdUntil=seconds+1.5+random()*2;nextBlink=seconds+1.8+random()*3;blinkStart=-Infinity;doubleBlink=false;}
  last=seconds;
  if(seconds>=holdUntil){let next=pick();if(next===face)next=pick();face=next;holdUntil=seconds+(face.startsWith('wink-')?.3+random()*.35:face.startsWith('look-')?1.2+random()*2:2.5+random()*4);}
  if(seconds>=nextBlink){blinkStart=seconds;doubleBlink=random()<.15;nextBlink=seconds+.19+(doubleBlink?.25:2.4+random()*4.2);}
  const closedExpression=face==='content'||face==='delighted'||face.startsWith('wink-');
  const age=seconds-blinkStart,blink=closedExpression||age<0||age>=.18?null:age<.045||age>=.125?'blink-half':'blink-closed';
  return {face,blink};
 }};
}
