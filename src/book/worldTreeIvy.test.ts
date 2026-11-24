import {describe,it,expect} from 'vitest';
import * as THREE from 'three';
import {createWorldTreeIvy} from './worldTreeIvy';
import {createFruitSpectra} from './worldTreeLight';

describe('world tree climbers and spectral fruit',()=>{
  it('attaches ivy to the actual tapered trunk instead of floating in the canopy',()=>{
    const parent=new THREE.Group(),texture=new THREE.Texture();
    const curve=new THREE.CatmullRomCurve3([new THREE.Vector3(),new THREE.Vector3(0,5,0),new THREE.Vector3(0,10,0)]);
    const ivy=createWorldTreeIvy(parent,[{curve,radius:2}],texture,texture,m=>m,true);
    const matrix=new THREE.Matrix4(),p=new THREE.Vector3();
    for(let i=0;i<ivy.leaves.count;i++){
      ivy.leaves.getMatrixAt(i,matrix);p.setFromMatrixPosition(matrix);
      expect(Math.abs(Math.hypot(p.x,p.z)-2*(1-.7*p.y/10))).toBeLessThan(.25);
    }
    expect(ivy.stems.material.emissiveIntensity).toBeGreaterThan(0);
    expect(ivy.leaves.material.map).toBe(texture);
    expect(parent.children.length).toBe(2);
  });
  it('anchors every spectral emitter to its fruit and preserves a shared freezeable clock',()=>{
    const centers=new Float32Array([3,4,5,20,30,40]),colors=new Float32Array([1,0,0,0,1,0]),radii=new Float32Array([1,2]),time={value:0};
    for(const low of [true,false]){
      const points=createFruitSpectra(centers,colors,radii,time,low),positions=points.geometry.attributes.position,seeds=points.geometry.attributes.spectralSeed;
      const perFruit=positions.count/2;
      for(let i=0;i<positions.count;i++){
        const fruit=Math.floor(i/perFruit);
        expect(positions.getX(i)).toBe(centers[fruit*3]);expect(positions.getY(i)).toBe(centers[fruit*3+1]);
        expect(seeds.getX(i)).toBe(radii[fruit]);
      }
      expect(points.material.uniforms.time).toBe(time);
      expect(points.material.depthWrite).toBe(false);
    }
  });
});
