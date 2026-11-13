import {describe,it,expect} from 'vitest';
import * as THREE from 'three';
import {PerimeterWave,popupLightAt,type WaveTarget} from './perimeterWave';
describe('camera-led perimeter wave',()=>{
 it('queues only visible trees, staggers them, and carries completed rises forward',()=>{
  const camera=new THREE.PerspectiveCamera(60,1,.1,100);camera.position.set(0,2,0);camera.lookAt(0,1.5,-5);
  const values:Record<string,number>={},targets:WaveTarget[]=[-1,0,1].map((x,i)=>({id:'tree-'+i,point:new THREE.Vector3(x,0,-4),height:3,set:v=>values['tree-'+i]=v}));
  targets.push({id:'behind',point:new THREE.Vector3(0,0,4),height:3,set:v=>values.behind=v});
  const wave=new PerimeterWave();expect(wave.update(3.5,camera,targets).started).toBe(3);wave.update(3.9,camera,targets);expect(values['tree-1']).toBeGreaterThan(values['tree-0']);expect(values['tree-0']).toBeGreaterThan(values['tree-2']);expect(values.behind).toBe(0);
  wave.update(5.2,camera,targets);expect(values['tree-0']).toBe(1);camera.lookAt(0,1.5,5);expect(wave.update(5.3,camera,targets).started).toBe(4);expect(wave.update(6.7,camera,targets).complete).toBe(4);
  expect(wave.update(0,camera,targets).started).toBe(0);expect(values.behind).toBe(0);
 });
 it('leaves distant visible trees flat until activation proximity is reached',()=>{
  const camera=new THREE.PerspectiveCamera(70,1,.1,100);camera.position.set(0,1,0);camera.lookAt(0,1,-9);let value=0;
  const targets=[{id:'far',point:new THREE.Vector3(0,0,-9),height:3,set:(n:number)=>value=n}],wave=new PerimeterWave();
  expect(wave.update(4,camera,targets).started).toBe(0);camera.position.z=-5;camera.lookAt(0,1,-9);expect(wave.update(5,camera,targets).started).toBe(1);wave.update(6.5,camera,targets);expect(value).toBe(1);
 });
 it('keeps lights dark beside unopened groves and fades them in with their nearest popup',()=>{
  const sites=[{x:0,z:0,open:0},{x:3,z:0,open:1}];expect(popupLightAt(sites,.2,0)).toBe(0);expect(popupLightAt(sites,3,0)).toBe(1);sites[0].open=.5;expect(popupLightAt(sites,.2,0)).toBeCloseTo(.5);expect(popupLightAt(sites,20,0)).toBe(0);
 });
});
