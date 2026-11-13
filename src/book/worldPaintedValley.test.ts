import {expect,it} from 'vitest';
import * as THREE from 'three';
import {createMeadowTerrain,createMeadowNavigation,createMeadowSurface} from './castleMeadowNavigation';
import {WORLD_1111_LAYOUT} from './world1111Layout';
import {CastlePlatformMotion} from './castlePlatformMotion';

it('routes around a tree solid on the valley coarse grid while preserving supported movement',()=>{
 const floor=new THREE.Mesh(new THREE.PlaneGeometry(48,48,12,12).rotateX(-Math.PI/2));
 const tree=new THREE.Mesh(new THREE.BoxGeometry(3,12,12));tree.position.y=6;tree.updateMatrixWorld();
 const terrain=createMeadowTerrain([floor,tree],{minX:-23,maxX:23,minZ:-23,maxZ:23,minY:-.1,cellSize:8});
 const navigation=createMeadowNavigation(terrain,{spacing:4,triangleCenters:false});
 const hero=new CastlePlatformMotion(-12,0,0,createMeadowSurface(terrain));
 expect(navigation.setDestination(hero,{x:12,y:0,z:0})).toBe(true);
 expect(navigation.cameraRoute.length).toBeGreaterThan(1);
 for(let i=0;i<2400&&navigation.destination;i++){
  const move=navigation.steer(hero,1/60);
  hero.update(1/60,{x:move?.x??0,z:move?.z??0,run:!!move?.run,crouch:false,jumpPressed:!!move?.jump,jumpHeld:false,divePressed:false});
  expect(terrain.bodyClear(hero.x,hero.y,hero.z)).toBe(true);
 }
 expect(navigation.diagnostics.result).toBe('arrived');
 expect(hero.x).toBeCloseTo(12,0);
});

it('places separate non-overlapping holocards near each other',()=>{
 const {portal,paintedValleyPortal}=WORLD_1111_LAYOUT;
 const distance=Math.hypot(portal.x-paintedValleyPortal.x,portal.z-paintedValleyPortal.z);
 expect(distance).toBeGreaterThan(5);expect(distance).toBeLessThan(10);
});
