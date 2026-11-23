import {describe,it,expect} from 'vitest';
import {basinMistAmount,BASIN_MIST,createBasinMist} from './basinMist';
import * as THREE from 'three';
describe('basin upper mist bank',()=>{
  it('covers the basin with terrain-following pockets whose buffers stay fixed while mist evolves',()=>{
    const root=new THREE.Group(),mist=createBasinMist(root,(x,z)=>x*.1+z*.05);
    const pockets=root.getObjectByName('basin-low-drifting-mist') as THREE.Mesh<THREE.InstancedBufferGeometry,THREE.ShaderMaterial>;
    const centers=pockets.geometry.attributes.mistCenter as THREE.InstancedBufferAttribute,version=centers.version;
    expect(pockets.geometry.instanceCount).toBe(144);
    let minX=Infinity,maxX=-Infinity,minZ=Infinity,maxZ=-Infinity;
    for(let i=0;i<centers.count;i++){const x=centers.getX(i),z=centers.getZ(i),lift=centers.getY(i)-x*.1-z*.05;expect(lift).toBeGreaterThan(1.6);expect(lift).toBeLessThan(3);minX=Math.min(minX,x);maxX=Math.max(maxX,x);minZ=Math.min(minZ,z);maxZ=Math.max(maxZ,z);}
    expect(minX).toBeLessThan(-85);expect(maxX).toBeGreaterThan(85);expect(minZ).toBeLessThan(-85);expect(maxZ).toBeGreaterThan(85);
    mist.update(20,{x:4,z:5});expect(pockets.material.uniforms.time.value).toBe(20);expect(centers.version).toBe(version);expect(mist.diagnostics.extraDraws).toBe(2);
  });
  it('leaves the lower floor clear while obscuring the entire upper waterfall fifth',()=>{
    expect(basinMistAmount(0)).toBe(0);expect(basinMistAmount(25)).toBe(0);
    expect(basinMistAmount(36)).toBeGreaterThan(basinMistAmount(32));
    expect(BASIN_MIST.dense).toBeCloseTo(BASIN_MIST.waterfallTop*.8);
    for(const y of [38.4,42,48,100,240])expect(basinMistAmount(y)).toBeGreaterThan(.99);
  });
});
