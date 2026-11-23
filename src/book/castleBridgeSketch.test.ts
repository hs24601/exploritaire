import {describe,it,expect} from 'vitest';
import * as THREE from 'three';
import {bridgeSketchProximity,createBridgeSketch} from './castleBridgeSketch';
describe('imagined bridge proximity',()=>{
  it('reveals from the outer bank and partially built edge, fading away from the moat',()=>{
    expect(bridgeSketchProximity(0,61)).toBe(1);expect(bridgeSketchProximity(0,44)).toBe(1);
    expect(bridgeSketchProximity(-12,61)).toBeGreaterThan(0);expect(bridgeSketchProximity(-12,61)).toBeLessThan(1);
    expect(bridgeSketchProximity(-40,90)).toBe(0);
  });
  it('increases detail nearby and fades without uploading line geometry',()=>{
    const sketch=createBridgeSketch(),lines=sketch.root.children as THREE.LineSegments<THREE.BufferGeometry,THREE.LineBasicMaterial>[];
    const versions=lines.map(line=>(line.geometry.attributes.position as THREE.BufferAttribute).version);
    sketch.update(.05,0,61,false,false,true);expect(lines[0].material.opacity).toBeGreaterThan(0);expect(lines[2].material.opacity).toBe(0);
    for(let i=0;i<40;i++)sketch.update(.05,0,44,false,false,true);
    expect(lines[2].material.opacity).toBeGreaterThan(.3);
    for(let i=0;i<40;i++)sketch.update(.05,-40,90,false,false,true);
    expect(sketch.reveal).toBe(0);expect(sketch.root.visible).toBe(false);expect(lines.map(line=>(line.geometry.attributes.position as THREE.BufferAttribute).version)).toEqual(versions);
    sketch.update(.1,0,44,true,true,true);expect(sketch.root.visible).toBe(false);
  });
});
