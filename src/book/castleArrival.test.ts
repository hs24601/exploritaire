import {describe,it,expect} from 'vitest';
import * as THREE from 'three';
import {directGroundsArrival,groundedOrbitPose,orbitLookTarget,BRIDGE_HERO_START} from './castleArrival';
import {treeGround} from './worldTreeScene';
import {bridgeSketchProximity} from './castleBridgeSketch';
import {groundsWalkable} from './castleGroundsLayout';
import {sampleFlight,shoulderPose} from './castleLayout';
import {createMeadowCameraMotion} from './castleMeadowCamera';
describe('direct moat arrival',()=>{
  it('starts Hero on dry ground beyond every bridge preview line',()=>{
    expect(groundsWalkable(BRIDGE_HERO_START.x,BRIDGE_HERO_START.z)).toBe(true);
    expect(bridgeSketchProximity(BRIDGE_HERO_START.x,BRIDGE_HERO_START.z)).toBe(0);
  });
  it('travels monotonically along one segment to the exact follow pose',()=>{
    const rest=shoulderPose(0,59.45,.45,.62,20,.25),path=directGroundsArrival(rest);
    expect(path).toHaveLength(2);
    const start=new THREE.Vector3(...path[0].position),end=new THREE.Vector3(...rest.position),axis=end.clone().sub(start),length=axis.length();axis.normalize();
    let previous=0;
    for(let t=0;t<=8;t+=.05){const delta=new THREE.Vector3(...sampleFlight(t,path).position).sub(start),progress=delta.dot(axis);expect(progress).toBeGreaterThanOrEqual(previous-1e-8);expect(delta.clone().addScaledVector(axis,-progress).length()).toBeLessThan(1e-8);expect(progress).toBeLessThanOrEqual(length+1e-8);previous=progress;}
    expect(new THREE.Vector3(...sampleFlight(8,path).position).distanceTo(end)).toBeLessThan(1e-9);
  });
  it('keeps the first follow frames still when seeded from the finished flight',()=>{
    const camera=createMeadowCameraMotion((_head,desired)=>desired),head=new THREE.Vector3(0,1.55,59.45),desired=new THREE.Vector3(7.7,13.22,73.8),focus=new THREE.Vector3(0,.8,59.45);
    // Include stale state from a previous replay, not just a newly created rig.
    camera.update(head,new THREE.Vector3(-40,1,10),focus,.26,0);
    camera.reset(desired);
    for(let i=0;i<60;i++)expect(camera.update(head,desired,focus,.26,1/60).distanceTo(desired)).toBeLessThan(1e-8);
  });
  it('lands the World Tree flight on the same orbit aim and boom on initial entry and replay',()=>{
    const ground=treeGround(0,75),rest=groundedOrbitPose(shoulderPose(0,75,.45,.32,7.5,ground),.45,.32,treeGround);
    expect(rest.position[1]).toBeGreaterThanOrEqual(treeGround(rest.position[0],rest.position[2])+.45);
    const path=directGroundsArrival(rest,{x:0,y:ground,z:75},16/9,{constrainAim:false}),last=sampleFlight(8,path);
    expect(new THREE.Vector3(...last.target).distanceTo(new THREE.Vector3(...rest.target))).toBeLessThan(1e-9);
    const motion=createMeadowCameraMotion((_head,desired)=>desired),landing=new THREE.Vector3(...last.position),head=new THREE.Vector3(0,ground+1.3,75),focus=new THREE.Vector3(0,ground+.55,75);
    for(const stale of [new THREE.Vector3(),new THREE.Vector3(-90,45,-200)]){
      motion.update(head,stale,focus,.26,0);motion.reset(landing);
      for(let i=0;i<120;i++){
        const position=motion.update(head,new THREE.Vector3(...rest.position),focus,.26,1/60);
        expect(position.distanceTo(landing)).toBeLessThan(1e-9);
        expect(new THREE.Vector3(...orbitLookTarget(position.toArray(),.45,.32)).distanceTo(new THREE.Vector3(...last.target))).toBeLessThan(1e-9);
      }
    }
  });
});
