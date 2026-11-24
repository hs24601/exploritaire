import { describe,it,expect } from 'vitest';
import * as THREE from 'three';
import {createGroundReliefBatches} from './groundReliefBatch';
import {PageFoldPacking} from './foldPacking';
describe('grass rendering batches',()=>{
 it('keeps folded source positions in a single draw and rebuilds cloned page bakes',()=>{
 const root=new THREE.Group(),cover=new THREE.Group();cover.name='tableau-ground-cover';root.add(cover);const material=new THREE.MeshLambertMaterial();
 for(const x of [-2,2]){const hinge=new THREE.Group();hinge.userData.paperHinge=true;hinge.position.set(x,.15,0);cover.add(hinge);const mesh=new THREE.Mesh(new THREE.PlaneGeometry(1,1),material);mesh.position.y=.5;hinge.add(mesh);}
 const packing=new PageFoldPacking(root),batches=createGroundReliefBatches(root);expect(batches).toHaveLength(1);expect(cover.children.filter(c=>c.userData.foldRenderBatch)).toHaveLength(1);
 packing.apply(0);batches[0].refresh();const display=cover.children.find(c=>c.userData.foldRenderBatch) as THREE.Mesh;const positions=display.geometry.getAttribute('position');for(let i=0;i<positions.count;i++)expect(positions.getY(i)).toBeGreaterThanOrEqual(.159);
 const clone=root.clone(true);const bakedPacking=new PageFoldPacking(clone);bakedPacking.apply(0);expect(createGroundReliefBatches(clone)).toHaveLength(1);expect(clone.children[0].children.filter(c=>c.userData.foldRenderBatch)).toHaveLength(1);
 });
});
