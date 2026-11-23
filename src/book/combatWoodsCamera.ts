import * as THREE from 'three';
export const WOODS_OVERHEAD_HEIGHT=17.594658803912374;
export const WOODS_OVERHEAD_UP=new THREE.Vector3(.4829376144677662,0,-.8678298520848472).normalize();
export type WoodsCameraPose={position:number[];target:number[];up:number[];fov:number};
/** Center the landed Hero on the enemy axis, with room for both parties. */
export function woodsFoundationCinematicPose(hero:{x:number;y:number;z:number},enemy:{x:number;y:number;z:number},aspect:number):WoodsCameraPose{
 const base=new THREE.Vector3(hero.x,hero.y,hero.z),forward=new THREE.Vector3(enemy.x-hero.x,0,enemy.z-hero.z);if(forward.lengthSq()<.001)forward.set(0,0,-1);forward.normalize();
 const separation=Math.hypot(enemy.x-hero.x,enemy.z-hero.z),target=base.clone().addScaledVector(forward,Math.min(6,separation*.45));target.y=hero.y+.9;
 const position=base.clone().addScaledVector(forward,-4.8);position.y=hero.y+1.8;
 const camera=new THREE.PerspectiveCamera(60,aspect,.12,9000),right=new THREE.Vector3(-forward.z,0,forward.x);
 const bounds=[...[-.55,.55].flatMap(x=>[0,1.15].map(y=>base.clone().addScaledVector(right,x).add(new THREE.Vector3(0,y,0)))),...[-1.8,1.8].flatMap(x=>[0,3].map(y=>new THREE.Vector3(enemy.x,enemy.y+y,enemy.z).addScaledVector(right,x)))];
 for(let i=0;i<20;i++){camera.position.copy(position);camera.lookAt(target);camera.updateMatrixWorld();if(bounds.every(point=>{const p=point.clone().project(camera);return Math.abs(p.x)<.84&&Math.abs(p.y)<.84&&p.z> -1&&p.z<1;}))break;position.sub(target).multiplyScalar(1.1).add(target);}
 return {position:position.toArray(),target:target.toArray(),up:[0,1,0],fov:60};
}
/** Blend the full camera frame so passing through vertical never flips its up vector. */
export function woodsCameraFlightPose(from:WoodsCameraPose,to:WoodsCameraPose,elapsed:number,duration=1.35){
 const t=THREE.MathUtils.clamp(elapsed/duration,0,1),p=t*t*t*(t*(t*6-15)+10);
 const frame=(pose:WoodsCameraPose)=>new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().lookAt(new THREE.Vector3(...pose.position),new THREE.Vector3(...pose.target),new THREE.Vector3(...pose.up)));
 const q=frame(from).slerp(frame(to),p),position=new THREE.Vector3(...from.position).lerp(new THREE.Vector3(...to.position),p);
 const distance=THREE.MathUtils.lerp(new THREE.Vector3(...from.position).distanceTo(new THREE.Vector3(...from.target)),new THREE.Vector3(...to.position).distanceTo(new THREE.Vector3(...to.target)),p);
 return {position:position.toArray(),target:position.clone().add(new THREE.Vector3(0,0,-distance).applyQuaternion(q)).toArray(),up:new THREE.Vector3(0,1,0).applyQuaternion(q).toArray(),fov:THREE.MathUtils.lerp(from.fov,to.fov,p)};
}
/** Keep the reference's height and map orientation, centered vertically over the live Hero. */
export function woodsOverheadPose(hero:{x:number;y:number;z:number},height=WOODS_OVERHEAD_HEIGHT){
 return {position:[hero.x,hero.y+height,hero.z] as [number,number,number],target:[hero.x,hero.y+.55,hero.z] as [number,number,number],up:WOODS_OVERHEAD_UP.toArray(),fov:60};
}
