import {describe, expect, it} from 'vitest';
import * as THREE from 'three';
import {createCastleLanterns, GROUNDS_LANTERNS} from './castleLanterns';

describe('grounds candle lanterns', () => {
  it('keeps widened-bridge frames, candles and flames aligned with their actual light positions',()=>{
    const lamps=createCastleLanterns(false,9.6),group=lamps.build(new THREE.Texture()),matrix=new THREE.Matrix4(),position=new THREE.Vector3();
    for(const child of group.children)if(child instanceof THREE.InstancedMesh){
      for(const i of [2,3]){child.getMatrixAt(i,matrix);position.setFromMatrixPosition(matrix);expect(position.x).toBeCloseTo(lamps.lights.positions[i].x,5);expect(position.z).toBeCloseTo(lamps.lights.positions[i].z,5);}
    }
  });
  it('batches six lanterns into five draws without shadow-casting or particle uploads', () => {
    const lamps=createCastleLanterns(false), group=lamps.build(new THREE.Texture());
    expect(GROUNDS_LANTERNS).toHaveLength(6);
    expect(group.children).toHaveLength(5);
    expect(group.children.every(child=>!child.castShadow)).toBe(true);
    const instanced=group.children.filter(child=>child instanceof THREE.InstancedMesh) as THREE.InstancedMesh[];
    const versions=instanced.map(mesh=>mesh.instanceMatrix.version);
    for(let i=0;i<120;i++) lamps.update(i/60);
    expect(instanced.map(mesh=>mesh.instanceMatrix.version)).toEqual(versions);
    expect(lamps.diagnostics.power.every(power=>power>=.945&&power<=1.055)).toBe(true);
  });
  it('confines sconce light to its side of masonry and keeps light on in Low', () => {
    const lamps=createCastleLanterns(false);
    expect(lamps.sample(7.6,4.2,39)).toBeGreaterThan(.5);
    expect(lamps.sample(7.6,4.2,32)).toBe(0);
    expect(lamps.sample(400,0,400)).toBe(0);
    lamps.setLow(); lamps.update(100);
    expect(lamps.diagnostics.animated).toBe(false);
    expect(lamps.diagnostics.power).toEqual([1,1,1,1,1,1]);
    expect(lamps.sample(7.6,4.2,39)).toBeGreaterThan(.5);
  });
  it('holds flames, fog and emitted light steady for reduced motion', () => {
    const lamps=createCastleLanterns(true);
    lamps.update(5); const before=lamps.diagnostics;
    lamps.update(50); expect(lamps.diagnostics).toEqual(before);
    expect(before.animated).toBe(false);
  });
});
