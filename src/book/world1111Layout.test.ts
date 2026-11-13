import {it,expect} from 'vitest';
import * as THREE from 'three';
import {WORLD_1111_LAYOUT,canCollectFlurry} from './world1111Layout';
import {treeWalkable,treeGround} from './worldTreeScene';
import {groundedOrbitPose} from './castleArrival';
import {shoulderPose} from './castleLayout';
it('keeps the portal on supported dry ground and preserves proximity limits',()=>{
 const {hero,portal}=WORLD_1111_LAYOUT;
 expect(treeWalkable(hero.x,hero.z)).toBe(true);expect(treeWalkable(portal.x,portal.z)).toBe(true);
 expect(Number.isFinite(treeGround(portal.x,portal.z))).toBe(true);expect(canCollectFlurry(hero,portal)).toBe(true);
 expect(canCollectFlurry({x:portal.x+6,z:portal.z},portal)).toBe(true);expect(canCollectFlurry({x:portal.x+6.01,z:portal.z},portal)).toBe(false);
});
it('matches the supplied camera telemetry and projects Flurry onto the new crosshairs',()=>{
 const {hero,camera:orbit,flurry,portal}=WORLD_1111_LAYOUT;
 const pose=groundedOrbitPose(shoulderPose(hero.x,hero.z,orbit.yaw,orbit.pitch,orbit.distance,treeGround(hero.x,hero.z)),orbit.yaw,orbit.pitch,treeGround);
 const expected=[14.136102932819126,9.162338405286881,79.23710183546828];
 pose.position.forEach((value,index)=>expect(value).toBeCloseTo(expected[index],10));
 const camera=new THREE.PerspectiveCamera(60,2552/914,.1,9000);camera.position.set(...pose.position);camera.lookAt(new THREE.Vector3(...pose.target));camera.updateMatrixWorld();
 const screen=new THREE.Vector3(flurry.x,treeGround(flurry.x,flurry.z)+2.5,flurry.z).project(camera);
 expect((screen.x+1)/2).toBeCloseTo(393/908,6);expect((1-screen.y)/2).toBeCloseTo((524-294)/(622-294),6);
 expect(portal).toEqual({x:8,z:71,yaw:.4});expect(flurry).not.toEqual(portal);
 expect(canCollectFlurry(hero,flurry)).toBe(false);
});
