import {describe,it,expect} from 'vitest';
import * as THREE from 'three';
import {approachCandidates,pointApproachTarget,visiblePointHit} from './pointApproach';
import {CastleGroundsNavigation} from './castleGroundsNavigation';
import {CastlePlatformMotion} from './castlePlatformMotion';
describe('universal point-and-click approaches',()=>{
  it('refines a distant dry shoreline rather than sending Hero farther away',()=>{
    const candidates=approachCandidates({x:0,y:0,z:59.45},{x:0,z:35},(x,z)=>z>=58.45?[{x,y:0,z}]:[],32);
    expect(candidates[0].z).toBeGreaterThanOrEqual(58.45);expect(candidates[0].z).toBeLessThan(58.7);
  });
  it('resolves instanced trees/posts individually and supports a merged post mesh',()=>{
    const object=new THREE.Mesh();object.userData.pointApproachInstances=[{x:-4,z:59,radius:.5},{x:4,z:59,radius:.5}];
    expect(pointApproachTarget({object,distance:1,instanceId:1,point:new THREE.Vector3(-4,3,59)})!.x).toBe(4);
    expect(pointApproachTarget({object,distance:1,point:new THREE.Vector3(-3.9,1,59)})!.x).toBe(-4);
  });
  it('routes close to a floating pack without needing its elevated face as a landing',()=>{
    const navigation=new CastleGroundsNavigation(),hero=new CastlePlatformMotion(0,59.45);
    expect(navigation.setAdjacentDestination(hero,{x:-12,z:60.5,radius:.15})).toBe(true);
    const goal=navigation.destination!;expect(Math.hypot(goal.x+12,goal.z-60.5)).toBeCloseTo(.66,3);
    for(let i=0;i<1800&&navigation.destination;i++){const input=navigation.steer(hero,1/60);hero.update(1/60,{x:input?.x??0,z:input?.z??0,run:!!input?.run,crouch:false,jumpPressed:!!input?.jump,jumpHeld:!!input,divePressed:false});}
    expect(navigation.destination).toBeUndefined();expect(Math.hypot(hero.x+12,hero.z-60.5)).toBeLessThan(1);
  });
  it('lets picks pass through hidden or locally clipped geometry',()=>{
    const material=new THREE.MeshBasicMaterial(),mesh=new THREE.Mesh(new THREE.PlaneGeometry(),material),parent=new THREE.Group();parent.add(mesh);
    const hit={object:mesh,distance:1,point:new THREE.Vector3(0,0,0)};
    expect(visiblePointHit(hit)).toBe(true);parent.visible=false;expect(visiblePointHit(hit)).toBe(false);parent.visible=true;
    material.clippingPlanes=[new THREE.Plane(new THREE.Vector3(0,0,1),-1)];expect(visiblePointHit(hit)).toBe(false);hit.point.z=2;expect(visiblePointHit(hit)).toBe(true);
  });
});
