import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

/** Keep individual folding sources, but submit their grass as one draw per atlas. */
export function createGroundReliefBatches(root:THREE.Group){
  const batches:{refresh:()=>void;dispose:()=>void}[]=[];
  root.updateMatrixWorld(true);
  root.traverse(cover=>{
    if(cover.name!=='tableau-ground-cover')return;
    for(const child of [...cover.children])if(child.userData.foldRenderBatch)cover.remove(child);
    const groups=new Map<THREE.Material,THREE.Mesh[]>();
    cover.traverse(child=>{if(child instanceof THREE.Mesh&&child.parent?.userData.paperHinge&&!Array.isArray(child.material)){const list=groups.get(child.material)??[];list.push(child);groups.set(child.material,list);}});
    for(const [material,sources] of groups){
      if(sources.length<2)continue;
      const geometry=mergeGeometries(sources.map(mesh=>mesh.geometry));if(!geometry)continue;
      const display=new THREE.Mesh(geometry,material);display.userData.foldRenderBatch=true;display.frustumCulled=false;cover.add(display);sources.forEach(mesh=>mesh.visible=false);
      const matrix=new THREE.Matrix4(),inverse=new THREE.Matrix4(),normalMatrix=new THREE.Matrix3(),v=new THREE.Vector3();
      const refresh=()=>{
        cover.updateWorldMatrix(true,true);inverse.copy(cover.matrixWorld).invert();let offset=0;
        const position=geometry.getAttribute('position'),normal=geometry.getAttribute('normal');
        for(const source of sources){matrix.multiplyMatrices(inverse,source.matrixWorld);normalMatrix.getNormalMatrix(matrix);const p=source.geometry.getAttribute('position'),n=source.geometry.getAttribute('normal');for(let k=0;k<p.count;k++){v.fromBufferAttribute(p,k).applyMatrix4(matrix);position.setXYZ(offset+k,v.x,v.y,v.z);v.fromBufferAttribute(n,k).applyNormalMatrix(normalMatrix);normal.setXYZ(offset+k,v.x,v.y,v.z);}offset+=p.count;}
        position.needsUpdate=true;normal.needsUpdate=true;
      };
      refresh();batches.push({refresh,dispose:()=>geometry.dispose()});
    }
  });return batches;
}
