// Shared by the Three.js sticker and the Electron desktop overlay.
const lerp=(a:number,b:number,t:number)=>(1-t)*a+t*b;
function smoothstep(value:number,min:number,max:number){
 const u=Math.max(0,Math.min(1,(value-min)/(max-min)));
 return u*u*(3-2*u);
}

/** A bounded, varied play interlude; absolute time also handles paused tabs. */
export function flurryPlay(seconds:number,reduced=false){
 const cycle=Math.floor(Math.max(0,seconds)/40),hash=Math.sin(cycle*127.1+91.7)*43758.5453;
 const start=12+(hash-Math.floor(hash))*15,t=seconds-cycle*40-start;
 if(reduced||t<0||t>=4.2)return {active:false,roll:0,bounce:0,shake:0,face:undefined};
 const ease=(x:number)=>smoothstep(x,0,1);
 const roll=t<.65?Math.PI*ease(t/.65):t<2.7?Math.PI:t<3.3?Math.PI*(1-ease((t-2.7)/.6)):0;
 const bounce=t>.65&&t<2.7?Math.sin((t-.65)/2.05*Math.PI*4)**2*.32:0;
 const settling=Math.max(0,t-3.3),shake=t>=3.3?Math.sin(settling*34)*.13*(1-settling/.9):0;
 return {active:true,roll,bounce,shake,face:t<3.3?'delighted' as const:'surprised' as const};
}

const hash=(n:number)=>{const value=Math.sin(n*127.1+31.7)*43758.5453;return value-Math.floor(value);};
/** Random held glances with eased transitions, rather than a repetitive nod. */
export function flurryCuriosity(seconds:number,reduced=false){
 if(reduced)return {x:0,y:0,pitch:0,yaw:0,roll:0};
 const clock=seconds/3.8,index=Math.floor(clock),mix=smoothstep(clock-index,0,.6);
 const x=lerp(hash(index*2)*2-1,hash((index+1)*2)*2-1,mix);
 const y=lerp(hash(index*2+1)*1.5-.5,hash((index+1)*2+1)*1.5-.5,mix);
 return {x,y,pitch:y*.075,yaw:x*.14,roll:x*.055+Math.sin(seconds*.65)*.025};
}

export const FLURRY_FACE_IDS=['neutral','curious','happy','sad','surprised','delighted','worried','determined','sleepy','content','wink-left','wink-right','blink-half','blink-closed','look-left','look-right','look-up','look-down','look-up-left','look-up-right'] as const;
export type FlurryFaceId=typeof FLURRY_FACE_IDS[number];
export const flurryFaceIndex=(id:FlurryFaceId)=>FLURRY_FACE_IDS.indexOf(id);
export function flurryFaceCell(id:FlurryFaceId){const index=flurryFaceIndex(id);return {column:index%4,row:Math.floor(index/4)};}
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
