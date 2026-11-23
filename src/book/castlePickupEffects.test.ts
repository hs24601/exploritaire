import {describe,it,expect} from 'vitest';
import * as THREE from 'three';
import {CastlePickupFlights,pickupFlightPose,createCastlePickupEffects} from './castlePickupEffects';

describe('world card collection',()=>{
  it('shrinks linearly and uniformly while the position follows a rising arc',()=>{
    const start=new THREE.Vector3(0,2.3,0),target=new THREE.Vector3(2,.65,0),out=new THREE.Vector3();
    for(const t of [0,.25,.5,.75,1])expect(pickupFlightPose(start,target,t,out)).toBe(1-t);
    pickupFlightPose(start,target,.25,out);expect(out.y).toBeGreaterThan(start.y);
    pickupFlightPose(start,target,1,out);expect(out.distanceTo(target)).toBeLessThan(1e-10);
    pickupFlightPose(start,target,.5,out,true);expect(out.y).toBeCloseTo((start.y+target.y)/2);
  });
  it('tracks moving Hero, prevents duplicate flights and awards once on contact',()=>{
    const flights=new CastlePickupFlights(false),card=new THREE.Object3D();card.position.set(0,2.3,0);
    expect(flights.start(1,card)).toBe(true);expect(flights.start(1,card)).toBe(false);
    const arrivals:number[]=[],target=new THREE.Vector3(2,.65,0);
    flights.update(.425,target,id=>arrivals.push(id));expect(arrivals).toEqual([]);expect(card.scale.toArray()).toEqual([.5,.5,.5]);expect(card.rotation.y).toBeCloseTo(Math.PI*2.5);
    target.set(4,1.65,2);flights.update(.425,target,id=>arrivals.push(id));
    expect(card.position.distanceTo(target)).toBeLessThan(1e-10);expect(card.visible).toBe(false);expect(card.scale.x).toBe(0);expect(arrivals).toEqual([1]);
    flights.update(2,target,id=>arrivals.push(id));expect(arrivals).toEqual([1]);expect(flights.has(1)).toBe(false);
  });
  it('uses a short direct reduced-motion pickup without a spin',()=>{
    const flights=new CastlePickupFlights(true),card=new THREE.Object3D();card.position.y=2;flights.start(0,card);
    let contacts=0;flights.update(.18,new THREE.Vector3(1,.65,0),()=>contacts++);
    expect(contacts).toBe(1);expect(card.rotation.y).toBe(0);expect(card.scale.x).toBe(0);
  });
  it('caps overlapping portal-style bursts, leaves buffers static and resets Hero shimmer',()=>{
    const scene=new THREE.Scene(),material=new THREE.MeshBasicMaterial(),effects=createCastlePickupEffects(scene,material,false,false);
    const shader={vertexShader:THREE.ShaderLib.basic.vertexShader,fragmentShader:THREE.ShaderLib.basic.fragmentShader,uniforms:THREE.UniformsUtils.clone(THREE.ShaderLib.basic.uniforms)};
    material.onBeforeCompile(shader as Parameters<THREE.Material['onBeforeCompile']>[0],{} as THREE.WebGLRenderer);
    const points=scene.children as THREE.Points[],versions=points.map(p=>(p.geometry.attributes.position as THREE.BufferAttribute).version);
    for(let i=0;i<6;i++)effects.collect(new THREE.Vector3(1,0,2));
    expect(effects.diagnostics).toMatchObject({contacts:6,bursts:3,shimmer:0,particleCount:56});
    effects.update(.3,new THREE.Vector3(2,0,3),true);expect(shader.uniforms.pickupShimmerAge.value).toBe(.3);
    expect(points.map(p=>(p.geometry.attributes.position as THREE.BufferAttribute).version)).toEqual(versions);
    expect(points[0].position.toArray()).toEqual([2,0,3]);effects.setLow();expect(points[0].geometry.drawRange.count).toBe(24);
    effects.update(2,new THREE.Vector3(),true);expect(effects.diagnostics).toMatchObject({bursts:0,shimmer:-1});
  });
  it('keeps reduced-motion contact feedback free of particles and a moving shimmer',()=>{
    const material=new THREE.MeshBasicMaterial(),effects=createCastlePickupEffects(new THREE.Scene(),material,true,true);
    effects.collect(new THREE.Vector3());expect(effects.diagnostics).toMatchObject({bursts:0,particleCount:0,shimmer:0});
    effects.update(.3,new THREE.Vector3(),true);expect(effects.diagnostics.shimmer).toBe(-1);
  });
});
