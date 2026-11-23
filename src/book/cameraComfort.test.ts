import {describe,it,expect} from 'vitest';
import * as THREE from 'three';
import {applyBookShot,limitBookAim} from './bookCamera';
describe('cinematic angular comfort',()=>{
 it('limits a sharp aim change without changing the flight position or focus distance',()=>{
  const camera=new THREE.PerspectiveCamera(),target=new THREE.Vector3();applyBookShot(camera,target,{position:[0,2,0],target:[0,2,-5],fov:60});const previous=camera.quaternion.clone();applyBookShot(camera,target,{position:[1,2,0],target:[6,2,0],fov:60});limitBookAim(camera,target,previous,.02);expect(previous.angleTo(camera.quaternion)).toBeCloseTo(.02);expect(camera.position.toArray()).toEqual([1,2,0]);expect(camera.position.distanceTo(target)).toBeCloseTo(5);
  const current=camera.quaternion.clone();applyBookShot(camera,target,{position:[1,2,0],target:[6,2,0],fov:60});limitBookAim(camera,target,current,0);expect(current.angleTo(camera.quaternion)).toBeCloseTo(0);
 });
});
