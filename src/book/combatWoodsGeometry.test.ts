import {describe,it,expect} from 'vitest';
import * as THREE from 'three';
import {buildCombatWoodsGeometry} from './combatWoodsGeometry';
import {createMeadowTerrain,createMeadowSurface} from './castleMeadowNavigation';
import {createCombatWoodsArrival,COMBAT_WOODS_ENTRY_SECONDS} from './combatWoodsArrival';

describe('Combat Woods authored collision roles',()=>{
 it('ignores large soil paint instead of creating an eight-metre obstacle at spawn',()=>{
  const scene=new THREE.Scene(),root=new THREE.Group(),cover=new THREE.Group(),anchor=new THREE.Group();scene.add(root);root.add(cover,anchor);
  const ground=new THREE.Mesh(new THREE.PlaneGeometry(70,70),new THREE.MeshBasicMaterial());ground.rotation.x=-Math.PI/2;ground.userData.worldTerrain=true;root.add(ground);
  const wash=new THREE.Mesh(new THREE.PlaneGeometry(1,1),new THREE.MeshBasicMaterial({map:new THREE.Texture()}));wash.scale.set(14,8.06000020980835,1);wash.rotation.x=-Math.PI/2;cover.add(wash);
  const tree=new THREE.Mesh(new THREE.PlaneGeometry(1,1),new THREE.MeshBasicMaterial({map:new THREE.Texture()}));tree.scale.set(7,10,1);tree.userData.worldTree=true;anchor.position.set(14,0,0);anchor.add(tree);
  // The wash deliberately matches the old hierarchy/scale heuristic.
  expect(wash.parent?.parent?.parent).toBe(scene);expect(wash.scale.y).toBeGreaterThan(5);
  const data=buildCombatWoodsGeometry(scene),terrain=createMeadowTerrain(data.cameraOccluders,{minX:-19,maxX:19,minZ:-22,maxZ:20,minY:-.1}),surface=createMeadowSurface(terrain);
  expect(data.floors).toEqual([ground]);expect(data.scenery).toEqual([tree]);expect(data.cameraSolids).toHaveLength(1);
  expect(surface.height(0,0)).toBeCloseTo(0);expect(terrain.dry(0,0)).toBe(true);expect(terrain.canWalk({x:11,y:0,z:0},{x:14,y:0,z:0})).toBe(false);
  const entry=new THREE.Matrix4().makeTranslation(100,3.36,80),exit=new THREE.Matrix4().makeRotationY(Math.PI).setPosition(0,0,6);
  const flight=createCombatWoodsArrival(entry,exit,{x:0,y:surface.height(0,0),z:0},{x:3.3,y:0,z:-7.3},1.5,()=>3.36,[],surface.height,data.cameraSolids);
  expect(flight.landed.position[1]).toBeCloseTo(1.6);
  const crossing=flight.sample(COMBAT_WOODS_ENTRY_SECONDS);expect(crossing.position[1]).toBeCloseTo(3.4);expect(crossing.position[2]).toBeCloseTo(6);
  expect(flight.sample(6).position).toEqual(flight.landed.position);
 });
});
