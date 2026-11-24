import * as THREE from 'three';
import {createClearArrivalFlight} from './clearArrivalFlight';
import {worldGridStandPoint,WORLD_GRID_FIELD} from './worldCombatGridLayout';
const start=worldGridStandPoint(7*WORLD_GRID_FIELD.columns+10);
export const COMBAT_WOODS_START={x:start.x,z:start.z};
export const COMBAT_WOODS_ENTRY_SECONDS=2.6,COMBAT_WOODS_ARRIVAL_SECONDS=6;
type Point={x:number;y:number;z:number};
type Pose={position:[number,number,number];target:[number,number,number];fov:number};
const point=(p:Point)=>new THREE.Vector3(p.x,p.y,p.z);
/** Group framing, rather than the grove's single-Hero shoulder defaults. */
export function combatWoodsOpeningPose(hero:Point,enemy:Point,aspect:number):Pose{
 const forward=point(enemy).sub(point(hero));forward.y=0;forward.normalize();
 // Low rear view beside the return portal. The clearing overview is an O-key mode.
 const right=new THREE.Vector3(-forward.z,0,forward.x);
 const position=point(hero).addScaledVector(forward,-4.2).addScaledVector(right,2.5);position.y=hero.y+1.6;
 const target=position.clone().addScaledVector(forward,12);target.y-=.12;
 const camera=new THREE.PerspectiveCamera(60,aspect,.12,9000);
 const corners=[...[-.55,.55].flatMap(x=>[0,1.1].map(y=>point(hero).add(new THREE.Vector3(x,y,0)))),...[-1.8,1.8].flatMap(x=>[0,3].map(y=>point(enemy).add(new THREE.Vector3(x,y,0))))];
 for(let i=0;i<16;i++){
  camera.position.copy(position);camera.lookAt(target);camera.updateMatrixWorld();
  if(corners.every(p=>{const q=p.clone().project(camera);return Math.abs(q.x)<.86&&Math.abs(q.y)<.86&&q.z> -1&&q.z<1;}))break;
  position.sub(target).multiplyScalar(1.08).add(target);
 }
 return {position:position.toArray(),target:target.toArray(),fov:60};
}
/** The same rendered camera crosses the paired portal transform. Hero is
 * already in the woods; only camera space changes at the membrane. */
export function createCombatWoodsArrival(entry:THREE.Matrix4,exit:THREE.Matrix4,hero:Point,enemy:Point,aspect:number,groveHeight:(x:number,z:number)=>number,groveSolids:THREE.Box3[],woodsHeight:(x:number,z:number)=>number,woodsSolids:THREE.Box3[]){
 const transform=new THREE.Matrix4().copy(entry).invert().premultiply(new THREE.Matrix4().makeRotationY(Math.PI)).premultiply(exit);
 const at=(x:number,y:number,z:number)=>new THREE.Vector3(x,y,z).applyMatrix4(entry).toArray();
 const target=at(0,2.6,-4),threshold=at(0,3.4,0),fov=60;
 const outsideKeys=[{t:0,position:at(0,3.8,10),target,fov},{t:COMBAT_WOODS_ENTRY_SECONDS,position:threshold,target,fov}];
 // The grove camera's near plane follows height (.035 * y, capped at 2).
 // Bound the actual cleared route, including any over-crown detour, rather
 // than inflating this short eye-level entry for a hypothetical 2 m lens.
 let nearPlane=Math.min(2,Math.max(.08,...outsideKeys.map(k=>k.position[1]*.035)));
 let outside=createClearArrivalFlight(outsideKeys,groveHeight,groveSolids,{aspect,nearPlane});
 for(let pass=0;pass<8;pass++){
  const required=Math.min(2,Math.max(.08,...outside.route.map(p=>p.y*.035)));
  if(required<=nearPlane+1e-6)break;nearPlane=Math.min(2,required+.02);
  outside=createClearArrivalFlight(outsideKeys,groveHeight,groveSolids,{aspect,nearPlane});
 }
 const landed=combatWoodsOpeningPose(hero,enemy,aspect),mappedPosition=new THREE.Vector3(...threshold).applyMatrix4(transform).toArray(),mappedTarget=new THREE.Vector3(...target).applyMatrix4(transform).toArray();
 const inside=createClearArrivalFlight([{t:0,position:mappedPosition,target:mappedTarget,fov},{t:COMBAT_WOODS_ARRIVAL_SECONDS-COMBAT_WOODS_ENTRY_SECONDS,...landed}],woodsHeight,woodsSolids,{aspect,nearPlane:.12});
 return {landed,diagnostics:{outside:outside.diagnostics,inside:inside.diagnostics},sample(seconds:number){
  const inWoods=seconds>=COMBAT_WOODS_ENTRY_SECONDS;
  const shot=inWoods?inside.sample(seconds-COMBAT_WOODS_ENTRY_SECONDS):outside.sample(seconds);
  return {...shot,inWoods,done:seconds>=COMBAT_WOODS_ARRIVAL_SECONDS};
 }};
}
