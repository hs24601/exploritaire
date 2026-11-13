import * as THREE from 'three';

/** Live paper mechanisms survive the cached-page handoff. Only their mount moves. */
export class TurnPopups{
 private mounts:{root:THREE.Object3D;parent:THREE.Object3D;mount:THREE.Group;position:THREE.Vector3;quaternion:THREE.Quaternion;scale:THREE.Vector3;left:boolean}[]=[];
 constructor(private world:THREE.Object3D){}
 begin(roots:THREE.Object3D[]){
  this.restore();
  for(const root of roots){
   if(!root.parent||!root.visible)continue;
   root.updateWorldMatrix(true,true);
   const parent=root.parent,position=root.position.clone(),quaternion=root.quaternion.clone(),scale=root.scale.clone(),left=root.getWorldPosition(new THREE.Vector3()).x<-.01;
   const mount=new THREE.Group();mount.name='turn-popup-mount';mount.userData.turnPopup=true;this.world.add(mount);mount.attach(root);
   this.mounts.push({root,parent,mount,position,quaternion,scale,left});
  }
 }
 update(open:number,cover=false){
  for(const item of this.mounts){
   item.mount.visible=open>0;
   // A point on the left page follows the inside face of the moving cover.
   const angle=cover&&item.left?Math.PI*(open-1):0;
   item.mount.rotation.z=angle;
   item.mount.position.set(Math.sin(angle)*.145,.145*(1-Math.cos(angle)),0);
  }
 }
 restore(){
  for(const item of this.mounts){item.parent.add(item.root);item.root.position.copy(item.position);item.root.quaternion.copy(item.quaternion);item.root.scale.copy(item.scale);item.mount.removeFromParent();}
  this.mounts=[];
 }
 get count(){return this.mounts.length;}
}
