import {describe,it,expect} from 'vitest';
import * as THREE from 'three';
import {PopupStow,popupPageMatrix} from './popupStow';
describe('universal popup accordion stowing',()=>{
 it('contains oversized rotated panels inside an inset leaf, even under a turned cover',()=>{
  for(const side of [-1,1]){const cover=new THREE.Group(),root=new THREE.Group();cover.rotation.z=2.5;cover.add(root);root.position.set(side*5.4,.11,3.4);root.rotation.y=.8;root.userData.stowAnchor={x:side*5.4,z:3.4,rotation:THREE.MathUtils.radToDeg(.8)};
   const mesh=new THREE.Mesh(new THREE.BoxGeometry(8,5,10),new THREE.MeshBasicMaterial());root.add(mesh);const pack=new PopupStow(root),original=Float32Array.from(mesh.geometry.getAttribute('position').array);pack.apply(0);root.updateWorldMatrix(true,true);
   const matrix=popupPageMatrix(root).multiply(root.matrixWorld.clone().invert()).multiply(mesh.matrixWorld),v=new THREE.Vector3(),p=mesh.geometry.getAttribute('position');for(let i=0;i<p.count;i++){v.fromBufferAttribute(p,i).applyMatrix4(matrix);expect(v.x).toBeGreaterThanOrEqual((side<0?-5.65:.25)-.00001);expect(v.x).toBeLessThanOrEqual((side<0?-.25:5.65)+.00001);expect(Math.abs(v.z)).toBeLessThanOrEqual(3.55001);expect(v.y).toBeLessThan(.13);}
   pack.restore();expect([...p.array]).toEqual([...original]);pack.dispose();}
 });
});
