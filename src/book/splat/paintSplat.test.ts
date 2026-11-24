import {describe,expect,it} from 'vitest';
import * as THREE from 'three';
import {sortSplats} from './paintSplatSort';
import {collectSplatSources,focusWeight,frameCovariance,sampleSplatSurfaces} from './paintSplatSampling';

describe('painterly splats',()=>{
  it('sorts visible splats far to near and culls behind the camera',()=>{
    const camera=new THREE.PerspectiveCamera(60,1,.1,100);camera.position.set(0,0,0);camera.lookAt(0,0,-1);camera.updateMatrixWorld();
    const centers=new Float32Array([0,0,-5, 0,0,-20, 0,0,5, 0,0,-10]);
    const vp=new THREE.Matrix4().multiplyMatrices(camera.projectionMatrix,camera.matrixWorldInverse);
    const out=new Float32Array(4),count=sortSplats(centers,camera.matrixWorldInverse.elements,vp.elements,4,out);
    expect(count).toBe(3);
    expect([...out.subarray(0,3)]).toEqual([1,3,0]);
    expect(sortSplats(centers,camera.matrixWorldInverse.elements,vp.elements,2,out)).toBe(2);
  });
  it('builds a flat, elongated covariance in the surface frame',()=>{
    const out=new Float32Array(6);
    frameCovariance(new THREE.Vector3(1,0,0),new THREE.Vector3(0,0,1),new THREE.Vector3(0,1,0),2,1,.1,out,0);
    expect(out[0]).toBeCloseTo(4);expect(out[5]).toBeCloseTo(1);expect(out[3]).toBeCloseTo(.01);expect(out[1]).toBeCloseTo(0);
  });
  it('samples opaque surfaces, skips shader effects and thins the horizon',()=>{
    const root=new THREE.Group();
    const ground=new THREE.Mesh(new THREE.PlaneGeometry(20,20).rotateX(-Math.PI/2),new THREE.MeshLambertMaterial());
    const veil=new THREE.Mesh(new THREE.PlaneGeometry(5,5),new THREE.ShaderMaterial());
    const glass=new THREE.Mesh(new THREE.PlaneGeometry(5,5),new THREE.MeshLambertMaterial({transparent:true}));
    root.add(ground,veil,glass);root.updateMatrixWorld(true);
    const sources=collectSplatSources([root]);
    expect(sources.map(s=>s.mesh)).toEqual([ground]);
    const samples=sampleSplatSurfaces(sources,500,{x:0,y:0,z:0,radius:10});
    expect(samples.count).toBe(500);
    for(let i=0;i<samples.count;i++){expect(Math.abs(samples.centers[i*3+1])).toBeLessThan(1e-4);expect(samples.kind[i]).toBe(0);}
    expect(focusWeight(30,0,{x:0,y:0,z:0,radius:10})).toBeLessThan(.1);
  });
});
