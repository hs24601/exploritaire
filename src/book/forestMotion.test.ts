import {describe,it,expect} from 'vitest';
import * as THREE from 'three';
import {forestMote,createForestLights} from './forestFilm';
import {createForestAtmosphere} from './forestAtmosphere';
describe('decentralized continuous forest lights',()=>{
 it('spreads bodies through the woodland and crosses former loop boundaries continuously',()=>{
  const positions=Array.from({length:84},(_,i)=>forestMote(i,12));expect(Math.min(...positions.map(p=>p.x))).toBeLessThan(-4);expect(Math.max(...positions.map(p=>p.x))).toBeGreaterThan(4);expect(Math.min(...positions.map(p=>p.z))).toBeLessThan(-4);
  for(const t of [4,8,12,20,22,40])for(let i=0;i<3;i++){const a=forestMote(i,t-.001),b=forestMote(i,t+.001);expect(Math.hypot(a.x-b.x,a.y-b.y,a.z-b.z)).toBeLessThan(.01);}
 });
 it('starts every page 05 light in the tree line and only gradually releases some into the clearing',()=>{
  const inside=(p:{x:number;z:number})=>Math.abs(p.x)<4&&p.z> -3.4&&p.z<2.6;
  for(const t of [0,8,20,36,60,120])for(let i=0;i<234;i++)expect(inside(forestMote(i,t,0))).toBe(false);
  const released=Array.from({length:84},(_,i)=>forestMote(i,65,20));expect(released.filter(inside).length).toBeGreaterThan(10);expect(released.filter(p=>!inside(p)).length).toBeGreaterThan(45);
  for(let i=0;i<84;i++){const a=forestMote(i,36,0),b=forestMote(i,36.001,.001);expect(Math.hypot(a.x-b.x,a.y-b.y,a.z-b.z)).toBeLessThan(.02);}
 });
 it('uses the same unwrapped motion clock for actual lamps and illuminated mist after the film ends',()=>{
  const world=new THREE.Scene(),lights=createForestLights(world),weather=createForestAtmosphere(world),camera=new THREE.PerspectiveCamera();
  lights.update(12,1,true,720,1,24,undefined,15);weather.update(12,1,true,camera,720,1,24,undefined,15);
  const lamp=lights.root.children.find(o=>o instanceof THREE.PointLight) as THREE.PointLight;
  const mist=weather.root.children.find(o=>o instanceof THREE.InstancedMesh) as THREE.InstancedMesh;const uniforms=(mist.material as THREE.ShaderMaterial).uniforms;
  expect(uniforms.lamps.value[0].toArray()).toEqual(lamp.position.toArray());const before=lamp.position.clone();lights.update(12,1,true,720,1,25,undefined,16);expect(lamp.position.distanceTo(before)).toBeGreaterThan(.05);
  lights.dispose();weather.dispose();
 });
 it('suppresses bodies, actual lights and fog illumination together until their grove opens',()=>{
  const world=new THREE.Scene(),lights=createForestLights(world),weather=createForestAtmosphere(world),camera=new THREE.PerspectiveCamera();
  const hidden=()=>0;
  expect(lights.update(12,1,true,720,1,24,hidden).visible).toBe(0);weather.update(12,1,true,camera,720,1,24,hidden);
  expect(lights.root.children.filter(o=>o instanceof THREE.PointLight).every(o=>(o as THREE.PointLight).intensity===0)).toBe(true);
  const mist=weather.root.children.find(o=>o instanceof THREE.InstancedMesh) as THREE.InstancedMesh;
  expect((mist.material as THREE.ShaderMaterial).uniforms.lampPower.value.length()).toBe(0);
  const dust=weather.root.children.find(o=>o instanceof THREE.Points) as THREE.Points;
  expect([...dust.geometry.getAttribute('reveal').array].every(n=>n===0)).toBe(true);
  expect(lights.update(12,1,true,720,1,24,()=>1).visible).toBeGreaterThan(0);
  lights.dispose();weather.dispose();
 });
});
