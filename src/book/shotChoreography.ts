import * as THREE from 'three';
import {interpolateBookShot,type BookCameraShot,type BookCameraStep,type BookStage} from './bookCamera';

/** "Connect the dots": given a start shot and an end shot (camera + pop-up
 * stage), write the in-between shots that carry the camera from one to the
 * other while the pop-ups that change rise (or fold) in a staged order.
 * The result is ordinary shots, so they can be tweaked or deleted by hand. */
export type ConnectIntent='reveal'|'settle'|'follow'|'sweep';
export const CONNECT_INTENTS:[ConnectIntent,string][]=[
 ['reveal','Reveal: glide in while pop-ups rise one after another'],
 ['settle','Settle: pop-ups rise first, then the camera moves'],
 ['follow','Follow: visit each pop-up as it rises, then land'],
 ['sweep','Sweep: arc around the scene as pop-ups rise'],
];
export type StageTarget={id:string;name:string;x:number;z:number;height:number};

const v3=(a:readonly number[])=>new THREE.Vector3(a[0],a[1],a[2]);
const smooth=(t:number)=>t*t*(3-2*t);
function node(a:BookCameraShot,b:BookCameraShot,f:number,intent:ConnectIntent):BookCameraShot{
 const s=interpolateBookShot(a,b,smooth(f));const shot:BookCameraShot={position:[...s.position],target:[...s.target],fov:s.fov};
 const target=v3(shot.target),offset=v3(shot.position).sub(target),arc=Math.sin(Math.PI*f),span=v3(a.position).distanceTo(v3(b.position));
 if(intent==='sweep'){const sp=new THREE.Spherical().setFromVector3(offset);sp.theta+=arc*.55;offset.setFromSpherical(sp);}
 offset.y+=arc*Math.min(1.2,.12*span+.15);
 shot.position=offset.add(target).toArray() as [number,number,number];return shot;
}
/** Resolved stage after a run of shots: explicit values carry forward; pop-ups never staged are open. */
export function stageAfter(steps:readonly BookCameraStep[],targets:readonly StageTarget[]):BookStage{
 const out:BookStage={};for(const t of targets)out[t.id]=1;for(const s of steps)Object.assign(out,s.stage);return out;
}
export function connectShots(a:BookCameraStep,b:BookCameraStep,start:BookStage,targets:readonly StageTarget[],intent:ConnectIntent,totalMs:number){
 const end={...start,...b.stage};
 let moving=targets.filter(t=>Math.abs((end[t.id]??1)-(start[t.id]??1))>.01);
 const from=a.shot,to=b.shot;
 if(intent==='follow'){ // nearest-neighbour tour starting from the start shot's aim
  const order:StageTarget[]=[];let at=v3(from.target);const left=[...moving];
  while(left.length){left.sort((p,q)=>Math.hypot(p.x-at.x,p.z-at.z)-Math.hypot(q.x-at.x,q.z-at.z));const next=left.shift()!;order.push(next);at=new THREE.Vector3(next.x,0,next.z);}moving=order;
 }else if(intent==='sweep'){const c=v3(to.target);moving=[...moving].sort((p,q)=>Math.atan2(p.x-c.x,p.z-c.z)-Math.atan2(q.x-c.x,q.z-c.z));}
 else moving=[...moving].sort((p,q)=>p.x-q.x||p.z-q.z);
 const n=moving.length,value=(t:StageTarget,k:number)=>THREE.MathUtils.lerp(start[t.id]??1,end[t.id]??1,k);
 // per segment j: the stage every moving pop-up reaches by its end
 const segments:{shot:BookCameraShot;stage:BookStage}[]=[];
 if(intent==='settle'){
  const K=Math.max(1,n)+1;for(let j=0;j<K-1;j++){const stage:BookStage={};moving.forEach((t,i)=>stage[t.id]=value(t,j<i?0:j===i?.5:1));segments.push({shot:{...from,framing:undefined,composition:undefined},stage});}
  segments.push({shot:to,stage:end});
 }else if(intent==='follow'){
  for(const [i,t] of moving.entries()){const f=(i+1)/(n+1),base=node(from,to,f,'reveal'),aim=new THREE.Vector3(t.x,.11+t.height*.45,t.z),dir=v3(base.position).sub(v3(base.target)),dist=Math.max(2.2,t.height*2.4);
   const stage:BookStage={};moving.forEach((u,k)=>stage[u.id]=value(u,k<=i?1:0));segments.push({shot:{position:aim.clone().addScaledVector(dir.normalize(),dist).toArray() as [number,number,number],target:aim.toArray() as [number,number,number],fov:base.fov},stage});}
  segments.push({shot:to,stage:end});
 }else{
  const K=Math.max(2,n+1);for(let j=0;j<K;j++){const stage:BookStage={};moving.forEach((t,i)=>stage[t.id]=value(t,j<i?0:j===i?.5:1));segments.push({shot:j===K-1?to:node(from,to,(j+1)/K,intent),stage:j===K-1?end:stage});}
 }
 const seg=Math.max(200,Math.round(totalMs/segments.length));
 const between:BookCameraStep[]=segments.slice(0,-1).map((s,j)=>({name:('⋯ '+a.name+' → '+b.name).slice(0,110)+' '+(j+1)+'/'+(segments.length-1),shot:s.shot,stage:s.stage,durationMs:seg,holdMs:0,easing:'linear'}));
 return {between,endDurationMs:seg};
}
