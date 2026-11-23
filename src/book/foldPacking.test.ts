import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { PageFoldPacking } from './foldPacking';
describe('folded page packing',()=>{
 it('seats oversized, nested and rotated geometry inside one inset leaf and restores it',()=>{
  const root=new THREE.Group();const wing=new THREE.Group();wing.userData.paperWing=true;wing.userData.side=-1;wing.position.set(-5.55,.15,0);wing.rotation.z=Math.PI;root.add(wing);
  const mesh=new THREE.Mesh(new THREE.PlaneGeometry(16,10,8,4),new THREE.MeshBasicMaterial());mesh.rotation.set(.7,.8,.2);wing.add(mesh);
  const packing=new PageFoldPacking(root),original=Float32Array.from(mesh.geometry.attributes.position.array);
  packing.apply(0);root.updateMatrixWorld(true);const p=mesh.geometry.getAttribute('position');
  for(let k=0;k<p.count;k++){const v=new THREE.Vector3().fromBufferAttribute(p,k).applyMatrix4(mesh.matrixWorld);expect(v.x).toBeGreaterThanOrEqual(-5.671);expect(v.x).toBeLessThanOrEqual(-.229);expect(Math.abs(v.z)).toBeLessThanOrEqual(3.571);expect(v.y).toBeCloseTo(.16,3);}
  packing.restore();expect(Array.from(mesh.geometry.attributes.position.array)).toEqual(Array.from(original));
 });
 it('retains the original geometry when packing a cloned already-folded spread for baking',()=>{
  const root=new THREE.Group(),h=new THREE.Group();h.userData.paperHinge=true;root.add(h);const m=new THREE.Mesh(new THREE.PlaneGeometry(20,8),new THREE.MeshBasicMaterial());h.add(m);const live=new PageFoldPacking(root);live.apply(0);const clone=root.clone(true);new PageFoldPacking(clone);const mesh=clone.children[0].children[0] as THREE.Mesh;expect(mesh.geometry.getAttribute('position').getX(0)).toBe(-10);
 });
});
