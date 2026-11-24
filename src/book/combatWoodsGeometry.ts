import * as THREE from 'three';
/** Authored roles, never hierarchy depth or sprite scale: broad soil washes
 * share the trees' nesting and can be taller in local Y than a tree sprite. */
export function buildCombatWoodsGeometry(scene:THREE.Scene){
 const floors:THREE.Mesh[]=[],scenery:THREE.Mesh[]=[],cameraOccluders:THREE.Mesh[]=[],cameraSolids:THREE.Box3[]=[];
 scene.updateMatrixWorld(true);scene.traverse(object=>{
  if(!(object instanceof THREE.Mesh))return;
  if(object.userData.worldTerrain){floors.push(object);cameraOccluders.push(object);}
  else if(object.userData.worldTree){
   const center=object.parent!.getWorldPosition(new THREE.Vector3()),radius=.7+object.scale.y*.04;
   const proxy=new THREE.Mesh(new THREE.BoxGeometry(radius*2,object.scale.y,radius*2),new THREE.MeshBasicMaterial());proxy.position.copy(center);proxy.position.y+=object.scale.y/2;proxy.updateMatrixWorld();cameraOccluders.push(proxy);cameraSolids.push(new THREE.Box3().setFromObject(proxy));
   object.userData.pointApproach={x:center.x,z:center.z,radius,label:'tree'};scenery.push(object);
  }
 });
 // Floor triangles constrain height/rays. Their giant planar bounding boxes
 // must not become inflated solid slabs in the flight planner.
 return {floors,scenery,cameraOccluders,cameraSolids};
}
