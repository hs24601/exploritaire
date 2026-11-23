import {describe,it,expect} from 'vitest';
import * as THREE from 'three';
import {bridgeJourneyDestination,createBridgeJourneyCamera} from './castleBridgeJourneyCamera';
describe('authored bridge crossing camera',()=>{
  it('accepts the end width and partial edge without capturing unrelated journeys',()=>{
    for(const x of [-7,0,7])expect(bridgeJourneyDestination({x,z:36},3)).toBe(true);
    expect(bridgeJourneyDestination({x:0,z:44.5},2)).toBe(true);expect(bridgeJourneyDestination({x:0,z:36},0)).toBe(false);
    expect(bridgeJourneyDestination({x:25,z:36},3)).toBe(false);expect(bridgeJourneyDestination({x:0,z:70},3)).toBe(false);
  });
  it('starts from the rendered view and pans toward the telemetry shot while preserving manual takeover',()=>{
    const rig=createBridgeJourneyCamera(false),camera=new THREE.PerspectiveCamera(60,2.7921225383),hero=new THREE.Vector3(0,.25,60);camera.position.set(7,13,74);camera.lookAt(0,1,55);camera.updateMatrixWorld();
    rig.start(hero,{x:0,z:33},camera);expect(rig.update(0,{hero,aspect:camera.aspect})!.position.toArray()).toEqual(camera.position.toArray());
    const yaws:number[]=[];for(let i=0;i<240;i++){hero.z=60-27*i/239;yaws.push(rig.update(1/60,{hero,aspect:camera.aspect})!.yaw);}
    expect(yaws[yaws.length-1]-yaws[0]).toBeGreaterThan(.2);expect(rig.diagnostics.position[0]).toBeGreaterThan(18);expect(rig.diagnostics.position[1]).toBeCloseTo(26.4358779333,5);expect(rig.diagnostics.phase).toBe('hold');
    rig.release();expect(rig.update(.1,{hero,aspect:camera.aspect})).toBeUndefined();
  });
  it('widens for narrower screens and omits automatic movement for reduced motion',()=>{
    const camera=new THREE.PerspectiveCamera(60,16/9),hero=new THREE.Vector3(0,0,60);camera.position.set(0,12,75);camera.lookAt(hero);camera.updateMatrixWorld();
    const wide=createBridgeJourneyCamera(false),narrow=createBridgeJourneyCamera(false),still=createBridgeJourneyCamera(true);for(const rig of [wide,narrow,still])rig.start(hero,{x:0,z:33},camera);
    const a=wide.update(3,{hero,aspect:2.792})!,b=narrow.update(3,{hero,aspect:16/9})!;expect(b.position.y).toBeGreaterThan(a.position.y);expect(still.update(3,{hero,aspect:16/9})).toBeUndefined();
  });
});
