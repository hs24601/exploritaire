import {validPaintCue,type PaintCue} from './paintTimeline';
import {validBookFraming,type BookFraming} from './responsiveFraming';
import * as THREE from 'three';
import {validShotComposition,type ShotComposition} from './viewportPolicy';
export type BookCameraShot={position:[number,number,number];target:[number,number,number];fov:number;/** Bank in degrees. */roll?:number;framing?:BookFraming;composition?:ShotComposition};
export type BookCameraStep={name:string;shot:BookCameraShot;durationMs:number;holdMs:number;easing:'smooth'|'linear'|'cut';path?:'spline';kind?:'camera'|'paint';paint?:PaintCue;/** Physical cover opening, 0 shut to 1 flat; omitted values carry over. */bookOpen?:number;/** pop-up Open (0–1) per page control id, eased in over the shot's travel; ids left out carry over */stage?:BookStage};
export type BookStage=Record<string,number>;
export const validBookStage=(v:unknown):v is BookStage=>!!v&&typeof v==='object'&&!Array.isArray(v)&&Object.keys(v).length<=64&&Object.entries(v as object).every(([k,n])=>/^[\w:-]{1,140}$/.test(k)&&typeof n==='number'&&Number.isFinite(n)&&n>=0&&n<=1);
export const captureBookCamera=(camera:THREE.PerspectiveCamera,target:THREE.Vector3):BookCameraShot=>{
 const forward=target.clone().sub(camera.position).normalize(),reference=new THREE.Vector3(0,1,0).projectOnPlane(forward).normalize(),up=camera.up.clone().projectOnPlane(forward).normalize();
 const roll=THREE.MathUtils.radToDeg(Math.atan2(forward.dot(reference.clone().cross(up)),reference.dot(up)));
 return {position:camera.position.toArray(),target:target.toArray(),fov:camera.fov,...(Math.abs(roll)>.001?{roll}:{})};
};
export function validBookStep(value:unknown):value is BookCameraStep{
 const s=value as BookCameraStep;return !!s&&(s.path===undefined||s.path==='spline')&&(s.shot?.roll===undefined||Number.isFinite(s.shot.roll)&&Math.abs(s.shot.roll)<=20)&&(s.bookOpen===undefined||Number.isFinite(s.bookOpen)&&s.bookOpen>=0&&s.bookOpen<=1)&&(s.stage===undefined||validBookStage(s.stage))&&(s.kind===undefined||['camera','paint'].includes(s.kind))&&(s.kind==='paint'?validPaintCue(s.paint):s.paint===undefined||validPaintCue(s.paint))&&typeof s.name==='string'&&!!s.shot&&(s.shot.composition===undefined||validShotComposition(s.shot.composition))&&(s.shot.framing===undefined||validBookFraming(s.shot.framing))&&[s.shot.position,s.shot.target].every(a=>Array.isArray(a)&&a.length===3&&a.every(n=>Number.isFinite(n)&&Math.abs(n)<1000))&&s.shot.fov>=15&&s.shot.fov<=90&&Number.isFinite(s.durationMs)&&s.durationMs>=0&&s.durationMs<=60000&&Number.isFinite(s.holdMs)&&s.holdMs>=0&&s.holdMs<=60000&&['smooth','linear','cut'].includes(s.easing)&&new THREE.Vector3(...s.shot.position).distanceTo(new THREE.Vector3(...s.shot.target))>=.1;
}
/** Like Proto's map-shot interpolation, move the look-at point separately from
 * orbit angle and distance. Shortest yaw prevents long spins or crossing the aim. */
export function interpolateBookShot(from:BookCameraShot,to:BookCameraShot,t:number):BookCameraShot{
 if(t<=0)return from;if(t>=1)return to;
 const a=new THREE.Spherical().setFromVector3(new THREE.Vector3(...from.position).sub(new THREE.Vector3(...from.target)));
 const b=new THREE.Spherical().setFromVector3(new THREE.Vector3(...to.position).sub(new THREE.Vector3(...to.target)));
 const delta=THREE.MathUtils.euclideanModulo(b.theta-a.theta+Math.PI,Math.PI*2)-Math.PI;
 const target=new THREE.Vector3(...from.target).lerp(new THREE.Vector3(...to.target),t);
 const offset=new THREE.Vector3().setFromSpherical(new THREE.Spherical(THREE.MathUtils.lerp(a.radius,b.radius,t),THREE.MathUtils.lerp(a.phi,b.phi,t),a.theta+delta*t));
 return {position:offset.add(target).toArray(),target:target.toArray(),fov:THREE.MathUtils.lerp(from.fov,to.fov,t),...((from.roll!==undefined||to.roll!==undefined)?{roll:THREE.MathUtils.lerp(from.roll??0,to.roll??0,t)}:{})};
}
export function sampleBookCamera(steps:readonly BookCameraStep[],initial:BookCameraShot,elapsed:number,reduced=false){
 let cursor=0,from=initial;
 for(let i=0;i<steps.length;i++){const step=steps[i],duration=reduced||step.easing==='cut'?0:step.durationMs;
  if(elapsed<cursor+duration){const u=Math.max(0,(elapsed-cursor)/duration),t=step.easing==='smooth'?u*u*(3-2*u):u;return {shot:step.path==='spline'?splineBookShot(steps,initial,i,u):interpolateBookShot(from,step.shot,t),index:i,done:false,moving:true};}
  cursor+=duration;if(elapsed<cursor+step.holdMs)return {shot:step.shot,index:i,done:false,moving:false};cursor+=step.holdMs;from=step.shot;
 }return {shot:from,index:Math.max(0,steps.length-1),done:true,moving:false};
}
/** Pop-up stage at a moment of playback, timed exactly like sampleBookCamera. */
export function sampleBookStage(steps:readonly BookCameraStep[],initial:BookStage,elapsed:number,reduced=false):BookStage{
 let cursor=0,from:BookStage={...initial};
 for(const step of steps){const duration=reduced||step.easing==='cut'?0:step.durationMs,to={...from,...step.stage};
  if(elapsed<cursor+duration){const u=Math.max(0,(elapsed-cursor)/duration),t=step.easing==='smooth'?u*u*(3-2*u):u,out:BookStage={};for(const k of Object.keys(to))out[k]=THREE.MathUtils.lerp(from[k]??to[k],to[k],t);return out;}
  cursor+=duration+step.holdMs;from=to;
 }return from;
}
export function applyBookShot(camera:THREE.PerspectiveCamera,target:THREE.Vector3,shot:BookCameraShot){camera.position.fromArray(shot.position);target.fromArray(shot.target);if(camera.fov!==shot.fov){camera.fov=shot.fov;camera.updateProjectionMatrix();}const direction=target.clone().sub(camera.position).normalize();camera.up.set(0,1,0).applyAxisAngle(direction,THREE.MathUtils.degToRad(shot.roll??0));camera.lookAt(target);}

/** Shares camera travel, hold and easing exactly; carries omitted cover values. */
export function sampleBookOpening(steps:readonly BookCameraStep[],initial:number,elapsed:number,reduced=false){
 let cursor=0,from=initial;for(const step of steps){const duration=reduced||step.easing==='cut'?0:step.durationMs,to=step.bookOpen??from;if(elapsed<cursor+duration){const u=Math.max(0,(elapsed-cursor)/duration),t=step.easing==='smooth'?u*u*(3-2*u):u;return THREE.MathUtils.lerp(from,to,t);}cursor+=duration;if(elapsed<cursor+step.holdMs)return to;cursor+=step.holdMs;from=to;}return from;
}

/** Time-weighted Hermite path through authored camera/aim points. Consecutive
 * flight shots share tangents; holds and ordinary shots bring velocity to zero. */
export function splineBookShot(steps:readonly BookCameraStep[],initial:BookCameraShot,index:number,u:number):BookCameraShot {
 const step=steps[index],a=index?steps[index-1].shot:initial,b=step.shot;
 if(u<=0)return a;if(u>=1)return b;
 const previous=index>0&&steps[index-1].path==='spline'&&steps[index-1].holdMs===0?steps[index-1]:undefined;
 const next=step.holdMs===0&&steps[index+1]?.path==='spline'?steps[index+1]:undefined;
 const p0=index>1?steps[index-2].shot:initial,p3=next?.shot??b,d=Math.max(1,step.durationMs);
 const h00=2*u*u*u-3*u*u+1,h10=u*u*u-2*u*u+u,h01=-2*u*u*u+3*u*u,h11=u*u*u-u*u;
 const sample=(key:'position'|'target')=>a[key].map((v,k)=>h00*v+h01*b[key][k]+h10*(previous?(b[key][k]-p0[key][k])*d/(d+previous.durationMs):0)+h11*(next?(p3[key][k]-v)*d/(d+next.durationMs):0)) as [number,number,number];
 const ease=u*u*(3-2*u);return {position:sample('position'),target:sample('target'),fov:THREE.MathUtils.lerp(a.fov,b.fov,ease),roll:THREE.MathUtils.lerp(a.roll??0,b.roll??0,ease)};
}

/** Bound angular velocity independently from positional flight and shot timing. */
export function limitBookAim(camera:THREE.PerspectiveCamera,target:THREE.Vector3,previous:THREE.Quaternion,maxRadians:number){
 const distance=camera.position.distanceTo(target),desired=camera.quaternion.clone();camera.quaternion.copy(previous).rotateTowards(desired,Math.max(0,maxRadians));target.copy(camera.position).addScaledVector(new THREE.Vector3(0,0,-1).applyQuaternion(camera.quaternion),distance);camera.updateMatrixWorld();
}
