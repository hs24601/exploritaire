import {describe,it,expect} from 'vitest';
import * as THREE from 'three';
import {combatWoodsOpeningPose,createCombatWoodsArrival,COMBAT_WOODS_START,COMBAT_WOODS_ENTRY_SECONDS,COMBAT_WOODS_ARRIVAL_SECONDS} from './combatWoodsArrival';
import {COMBAT_WOODS} from './worldCombatWoods';
const hero={...COMBAT_WOODS_START,y:0},enemy={...COMBAT_WOODS.enemy,y:0};
describe('Combat Woods portal opening',()=>{
 it('frames Hero and Khadroot from the close shoulder view at different aspects',()=>{
  for(const aspect of [.56,.75,1,16/9,2.8]){const p=combatWoodsOpeningPose(hero,enemy,aspect),c=new THREE.PerspectiveCamera(p.fov,aspect,.12,9000);c.position.set(...p.position);c.lookAt(new THREE.Vector3(...p.target));c.updateMatrixWorld();
   expect(c.position.y).toBeGreaterThan(hero.y+1.2);expect(c.position.y).toBeLessThan(hero.y+3);expect(c.position.clone().sub(new THREE.Vector3(hero.x,hero.y,hero.z)).dot(new THREE.Vector3(enemy.x,0,enemy.z))).toBeLessThan(0);
   for(const body of [{...hero,r:.55,h:1.1},{...enemy,r:1.8,h:3}])for(const dx of [-body.r,body.r])for(const dy of [0,body.h]){const q=new THREE.Vector3(body.x+dx,body.y+dy,body.z).project(c);expect(Math.abs(q.x)).toBeLessThan(.87);expect(Math.abs(q.y)).toBeLessThan(.87);}
  }
 });
 it('crosses the actual paired transform continuously and stops at the held shot',()=>{
  const entry=new THREE.Matrix4().makeRotationY(.5).setPosition(100,2,80),exit=new THREE.Matrix4().makeRotationY(Math.PI).setPosition(0,0,6);
  const a=createCombatWoodsArrival(entry,exit,hero,enemy,16/9,()=>2,[],()=>0,[]),before=a.sample(COMBAT_WOODS_ENTRY_SECONDS-1e-5),after=a.sample(COMBAT_WOODS_ENTRY_SECONDS);
  const map=entry.clone().invert().premultiply(new THREE.Matrix4().makeRotationY(Math.PI)).premultiply(exit);
  expect(new THREE.Vector3(...before.position).applyMatrix4(map).distanceTo(new THREE.Vector3(...after.position))).toBeLessThan(.001);
  expect(new THREE.Vector3(...before.target).applyMatrix4(map).distanceTo(new THREE.Vector3(...after.target))).toBeLessThan(.001);
  expect(before.inWoods).toBe(false);expect(after.inWoods).toBe(true);
  expect(a.sample(COMBAT_WOODS_ARRIVAL_SECONDS).position).toEqual(a.landed.position);expect(a.sample(30).position).toEqual(a.landed.position);expect(a.sample(30).done).toBe(true);
  expect(Math.hypot(hero.x-enemy.x,hero.z-enemy.z)).toBeGreaterThan(COMBAT_WOODS.reach+3);
 });
});
