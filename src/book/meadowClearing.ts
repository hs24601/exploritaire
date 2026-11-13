import * as THREE from 'three';

// Authored regions in the existing scaled Sacred Forest Meadow, not a new
// collision-only shortcut. The source GLB remains intact in the asset archive.
export const MEADOW_CLEARING={minX:-12.670418,maxX:11.53875,minZ:-19.461743,maxZ:22.87424,rampCenterX:.32625,rampMinZ:-24.981743,rampMaxZ:-19.461742,rampWidth:1.725};
export function openMeadowClearing(model:THREE.Object3D){
 model.updateWorldMatrix(true,true);let removed=0,widened=0;const p=new THREE.Vector3(),inverse=new THREE.Matrix4();
 const masonry=new Set(['obj8_mat7_0','obj9_mat8_0','obj11_mat10_0']),structure=new Set([...masonry,'obj12_mat11_0','obj14_mat13_0']);
 let groundMaterial:THREE.Material|undefined;
 model.traverse(object=>{
  if(!(object instanceof THREE.Mesh))return;
  if(object.name==='obj11_mat10_0')groundMaterial=Array.isArray(object.material)?object.material[0]:object.material;
  if(!structure.has(object.name)&&object.name!=='obj13_mat12_0')return;
  const geometry=object.geometry.clone(),position=geometry.attributes.position,index=geometry.index,world:THREE.Vector3[]=[];
  for(let i=0;i<position.count;i++)world.push(new THREE.Vector3().fromBufferAttribute(position,i).applyMatrix4(object.matrixWorld));
  const kept:number[]=[];let changed=false;
  for(let i=0;i<(index?.count??position.count);i+=3){const ids=[0,1,2].map(k=>index?index.getX(i+k):i+k),points=ids.map(id=>world[id]);
   const inside=points.every(p=>p.x>=-8.7&&p.x<=8.2&&p.z>=-19.5&&p.z<=13.4);
   const low=Math.min(...points.map(p=>p.y)),high=Math.max(...points.map(p=>p.y));
   const wall=masonry.has(object.name)&&inside&&high>.15&&high<4.2;
   const wallIvy=object.name==='obj13_mat12_0'&&inside&&low>3.7&&high<6;
   if(wall||wallIvy){removed++;changed=true;}else kept.push(...ids);
  }
  if(structure.has(object.name)){
   inverse.copy(object.matrixWorld).invert();
   for(let i=0;i<world.length;i++){const v=world[i];if(v.z>=MEADOW_CLEARING.rampMinZ-.002&&v.z<=MEADOW_CLEARING.rampMaxZ+.002&&v.y>=-.01&&v.y<=5.53&&Math.abs(v.x-MEADOW_CLEARING.rampCenterX)<=.8635){
    p.copy(v);p.x=MEADOW_CLEARING.rampCenterX+(p.x-MEADOW_CLEARING.rampCenterX)*2;p.applyMatrix4(inverse);position.setXYZ(i,p.x,p.y,p.z);widened++;changed=true;
   }}
  }
  if(changed){geometry.setIndex(kept);position.needsUpdate=true;geometry.computeVertexNormals();geometry.computeBoundingBox();geometry.computeBoundingSphere();object.geometry=geometry;}else geometry.dispose();
 });
 // The original floor has holes under its masonry. Fill those with a rendered
 // painted surface so paws, clicks, camera rays and navigation agree.
 const c=MEADOW_CLEARING,width=c.maxX-c.minX,depth=c.maxZ-c.minZ;
 const floor=new THREE.Mesh(new THREE.PlaneGeometry(width,depth).rotateX(-Math.PI/2),groundMaterial?.clone()??new THREE.MeshStandardMaterial({color:'#7d9970'}));
 floor.name='meadow-open-clearing-floor';floor.position.set((c.minX+c.maxX)/2,.018,(c.minZ+c.maxZ)/2);
 // A sibling of the scaled GLB uses the authored world dimensions directly.
 const parent=model.parent;if(parent)parent.add(floor);else{model.add(floor);model.updateWorldMatrix(true,false);floor.applyMatrix4(new THREE.Matrix4().copy(model.matrixWorld).invert());}
 floor.updateWorldMatrix(true,false);
 return {floor,diagnostics:{removedTriangles:removed,widenedVertices:widened,rampWidth:c.rampWidth*2}};
}
