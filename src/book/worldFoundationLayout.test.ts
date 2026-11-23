import {describe,it,expect} from 'vitest';
import * as THREE from 'three';
import {foundationWorldPose,foundationBillboardQuaternion,fitFoundationFloor,limitFoundationSkew,nearestFoundationTeam,FOUNDATION_MAX_SKEW} from './worldFoundationLayout';
import {worldFoundationFaces} from './worldFoundationState';
import {createPlayableSandboxScenario} from '../proto/rules/battle';

describe('world foundation staging',()=>{
 const party=new THREE.Vector3(0,0,0),enemy=new THREE.Vector3(0,0,-8);
 it('keeps the closest team grounded and changes ownership when orbiting behind enemies',()=>{
  expect(nearestFoundationTeam({x:0,y:2,z:5},party,enemy)).toBe('party');
  expect(nearestFoundationTeam({x:0,y:2,z:-13},party,enemy)).toBe('enemy');
  expect(nearestFoundationTeam({x:10,y:2,z:-4.1},party,enemy,'party')).toBe('party');
  expect(nearestFoundationTeam({x:10,y:2,z:-3.9},party,enemy,'enemy')).toBe('enemy');
 });
 it('places floor art behind the close actor and billboard art behind the far actor',()=>{
  const camera=new THREE.PerspectiveCamera();camera.position.set(0,2,5);
  const floor=foundationWorldPose(camera,party,true),board=foundationWorldPose(camera,enemy,false);
  expect(floor.center.z).toBeGreaterThan(party.z);expect(floor.center.z).toBeLessThan(camera.position.z);
  expect(board.center.z).toBeLessThan(enemy.z);expect(board.center.x).toBeGreaterThan(enemy.x);
  expect(board.center.y).toBeGreaterThan(1);
 });
 it('fits every floor vertex to actual sloping terrain without reversing the text',()=>{
  const camera=new THREE.PerspectiveCamera();camera.position.set(0,2,5);
  const geometry=new THREE.PlaneGeometry(1,1,12,8),pose=foundationWorldPose(camera,party,true);
  const height=(x:number,z:number)=>.2*x+.1*z;
  fitFoundationFloor(geometry,pose,height);
  const p=geometry.attributes.position,uv=geometry.attributes.uv;
  for(let i=0;i<p.count;i++)expect(p.getY(i)).toBeCloseTo(height(p.getX(i),p.getZ(i))+.035,6);
  const top=Array.from({length:p.count},(_,i)=>i).find(i=>uv.getX(i)===0&&uv.getY(i)===1)!;
  const bottom=Array.from({length:p.count},(_,i)=>i).find(i=>uv.getX(i)===0&&uv.getY(i)===0)!;
  expect(p.getZ(top)).toBeLessThan(p.getZ(bottom));geometry.dispose();
 });
 it('shows a waiting roster without starting a battle, then follows the real encounter state',()=>{
  const waiting=worldFoundationFaces();expect(waiting.enemy.status).toBe('Dormant');expect(waiting.party.detail).toBe('AP 0/6');
  const state=createPlayableSandboxScenario('001');state.party[0]={...state.party[0],hp:19,charge:3,rank:12};
  state.foes[0]={...state.foes[0],hp:4,stagger:2.5};
  const shown=worldFoundationFaces(state);expect(shown.party.hp).toBe(19);expect(shown.party.rank).toBe('Q');expect(shown.party.detail).toBe('AP 3/6');
  expect(shown.enemy.hp).toBe(4);expect(shown.enemy.detail).toBe('Stagger 2.5/6');
  expect(worldFoundationFaces({...state,result:'won'}).won).toBe(true);
 });
 it('props shallow-view foundations up to the reference facing angle while keeping ground clearance',()=>{
  for(const elevation of [.15,.5,1,3]){
   const camera=new THREE.PerspectiveCamera();camera.position.set(0,elevation,5);
   const pose=foundationWorldPose(camera,party,true),geometry=new THREE.PlaneGeometry(1,1,12,8);
   fitFoundationFloor(geometry,pose,()=>0);limitFoundationSkew(geometry,pose,camera,()=>0);
   const p=geometry.attributes.position,a=new THREE.Vector3().fromBufferAttribute(p,0),b=new THREE.Vector3().fromBufferAttribute(p,1),c=new THREE.Vector3().fromBufferAttribute(p,13);
   const center=new THREE.Vector3().fromBufferAttribute(p,0).add(new THREE.Vector3().fromBufferAttribute(p,p.count-1)).multiplyScalar(.5);
   const normal=b.sub(a).cross(c.sub(a)).normalize().negate(),eye=camera.position.clone().sub(center).normalize();
   expect(normal.dot(eye)).toBeGreaterThanOrEqual(Math.cos(FOUNDATION_MAX_SKEW)-.0001);
   for(let i=0;i<p.count;i++)expect(p.getY(i)).toBeGreaterThanOrEqual(.0349);
   geometry.dispose();
  }
 });
 it('moves the far panel offsets twenty percent up and right',()=>{
  const camera=new THREE.PerspectiveCamera();camera.position.set(0,2,5);
  const pose=foundationWorldPose(camera,enemy,false);
  expect(pose.center.x).toBeCloseTo(3*1.2);expect(pose.center.y).toBeCloseTo(1.65*1.2);
 });
 it('enforces the same facing cap for far off-axis billboards',()=>{
  const camera=new THREE.PerspectiveCamera();camera.position.set(0,1,1);
  const position=new THREE.Vector3(6,1,0),q=foundationBillboardQuaternion(camera,position);
  const normal=new THREE.Vector3(0,0,1).applyQuaternion(q),eye=camera.position.clone().sub(position).normalize();
  expect(normal.dot(eye)).toBeCloseTo(Math.cos(FOUNDATION_MAX_SKEW),6);
 });
});
