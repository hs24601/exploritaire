import {describe,it,expect} from 'vitest';
import {woodsOverheadPose,woodsCameraFlightPose,woodsFoundationCinematicPose,WOODS_OVERHEAD_HEIGHT} from './combatWoodsCamera';
import {createWorldGridJump} from './worldGridJump';
import {COMBAT_WOODS_START,combatWoodsOpeningPose} from './combatWoodsArrival';
import * as THREE from 'three';
describe('Combat Woods camera presets',()=>{
 it('centers Hero behind the enemy axis and frames both parties at different foundations',()=>{
  const enemy={x:3.3,y:0,z:-7.3};for(const hero of [{x:0,y:0,z:0},{x:-7,y:.2,z:7},{x:5,y:0,z:-4}])for(const aspect of [1432/734,4/3]){
   const pose=woodsFoundationCinematicPose(hero,enemy,aspect),camera=new THREE.PerspectiveCamera(pose.fov,aspect,.12,9000);camera.position.fromArray(pose.position);camera.lookAt(new THREE.Vector3(...pose.target));camera.updateMatrixWorld();
   const h=new THREE.Vector3(hero.x,hero.y+.55,hero.z).project(camera),e=new THREE.Vector3(enemy.x,enemy.y+1.5,enemy.z).project(camera);expect(h.x).toBeCloseTo(0);expect(e.x).toBeCloseTo(0);expect(Math.abs(h.y)).toBeLessThan(.84);expect(Math.abs(e.y)).toBeLessThan(.84);
   expect((pose.position[0]-hero.x)*(enemy.x-hero.x)+(pose.position[2]-hero.z)*(enemy.z-hero.z)).toBeLessThan(0);
  }
 });
 it('finishes the cinematic on the actual landing clock for short and long jumps',()=>{
  for(const x of [1,16]){const to={x,y:0,z:3},jump=createWorldGridJump({x:0,y:0,z:0},to,()=>true)!,from=woodsOverheadPose({x:0,y:0,z:0}),pose=woodsFoundationCinematicPose(to,{x:3.3,y:0,z:-7.3},16/9);
   jump.update(jump.duration*.5);expect(woodsCameraFlightPose(from,pose,jump.elapsed,jump.duration).position).not.toEqual(pose.position);
   const landed=jump.update(jump.duration);expect(landed.done).toBe(true);woodsCameraFlightPose(from,pose,jump.elapsed,jump.duration).position.forEach((v,i)=>expect(v).toBeCloseTo(pose.position[i]));
  }
 });
 it('flies continuously from the rear frame to OTT without a vertical up-vector flip',()=>{
  const from={position:[0,2,6],target:[0,1,0],up:[0,1,0],fov:60},to=woodsOverheadPose({x:0,y:0,z:0});
  expect(woodsCameraFlightPose(from,to,0).position).toEqual(from.position);
  const middle=woodsCameraFlightPose(from,to,.675);expect(middle.position[1]).toBeGreaterThan(2);expect(middle.position[1]).toBeLessThan(to.position[1]);
  expect(new THREE.Vector3(...middle.up).length()).toBeCloseTo(1);
  const end=woodsCameraFlightPose(from,to,1.35);expect(end.position).toEqual(to.position);end.target.forEach((v,i)=>expect(v).toBeCloseTo(to.target[i]));
 });
 it('looks straight down over the current Hero at the supplied height',()=>{
  const hero={x:-2.4,y:.2,z:3.8},pose=woodsOverheadPose(hero);expect(pose.position).toEqual([hero.x,hero.y+WOODS_OVERHEAD_HEIGHT,hero.z]);expect(pose.target[0]).toBe(hero.x);expect(pose.target[2]).toBe(hero.z);expect(pose.up[1]).toBe(0);expect(Math.hypot(...pose.up)).toBeCloseTo(1);expect(pose.fov).toBe(60);
 });
 it('starts outside the portal with a low rear camera that clears its aperture',()=>{
  const hero={...COMBAT_WOODS_START,y:0},pose=combatWoodsOpeningPose(hero,{x:3.3,y:0,z:-7.3},16/9);expect(hero.z).toBeLessThan(6);expect(Math.hypot(hero.x,hero.z-6)).toBeLessThan(5.5);expect(pose.position[1]).toBeLessThan(3);
  const t=(6-hero.z)/(pose.position[2]-hero.z);if(t>0&&t<1)expect(Math.abs(hero.x+(pose.position[0]-hero.x)*t)).toBeGreaterThan(2.3);
 });
 it('keeps the return portal outside the default rear-view frame',()=>{
  const pose=combatWoodsOpeningPose({...COMBAT_WOODS_START,y:0},{x:3.3,y:0,z:-7.3},1432/734),camera=new THREE.PerspectiveCamera(pose.fov,1432/734,.12,9000);camera.position.fromArray(pose.position);camera.lookAt(new THREE.Vector3(...pose.target));camera.updateMatrixWorld();
  const frustum=new THREE.Frustum().setFromProjectionMatrix(new THREE.Matrix4().multiplyMatrices(camera.projectionMatrix,camera.matrixWorldInverse));expect(frustum.intersectsBox(new THREE.Box3(new THREE.Vector3(-2.3,0,6),new THREE.Vector3(2.3,7.2,6)))).toBe(false);
 });
});
