import * as THREE from 'three';
import {paintedPaperPanel} from './paperCutout';
import {rememberGroundRest} from './standGroundPaint';
import type {PopupVFold,PopupVFoldOptions} from './popupVFold';

/** Individual staging opens a forward flap; physical book closure stows it inward. */
export function foregroundFlapAngle(stage:number,bookOpen:number){
 const deploy=THREE.MathUtils.smoothstep(bookOpen,.12,.88);
 return THREE.MathUtils.lerp(-Math.PI/2,(1-THREE.MathUtils.clamp(stage,0,1))*Math.PI/2,deploy);
}
export function createForegroundFlap(art:HTMLCanvasElement,o:PopupVFoldOptions):PopupVFold{
 const root=new THREE.Group(),hinge=new THREE.Group();root.add(hinge);root.userData.popupRoot=true;
 const thickness=o.thickness??.008,width=o.height*art.width/art.height;
 const panel=paintedPaperPanel(art,o.height,thickness,o.backColor??'#e9dfc4',0,1,false,true);hinge.add(panel.group);
 const base=new THREE.Mesh(new THREE.BoxGeometry(Math.min(width,.75),thickness,.38),new THREE.MeshStandardMaterial({color:'#e9dfc4',roughness:1}));base.position.z=-.16;base.userData.paperStand=true;base.castShadow=base.receiveShadow=true;root.add(base);
 panel.group.updateWorldMatrix(true,true);const folded=new THREE.Box3().setFromObject(panel.group);folded.applyMatrix4(new THREE.Matrix4().makeRotationX(-Math.PI/2));
 const hit=new THREE.Mesh(new THREE.BoxGeometry(width,o.height,o.height+.4),new THREE.MeshBasicMaterial({visible:false,side:THREE.DoubleSide}));hit.position.set(0,o.height/2,o.height/2-.2);hit.userData.editorHelper=true;root.add(hit);
 const driver=new THREE.Group();root.add(driver);driver.userData.foregroundFlap=true;
 function pose(stage:number,_paint?:number,bookOpen=1){
  hinge.rotation.x=foregroundFlapAngle(stage,bookOpen);
  const blend=1-THREE.MathUtils.smoothstep(bookOpen,.12,.88),anchor=root.userData.stowAnchor as {x:number;z:number;rotation:number}|undefined;
  hinge.position.set(0,0,0);
  if(anchor&&blend>0){
   const yaw=THREE.MathUtils.degToRad(anchor.rotation),bounds=folded.clone().applyMatrix4(new THREE.Matrix4().makeRotationY(yaw));
   const left=anchor.x<0?-5.65:.25,right=anchor.x<0?-.25:5.65;
   const dx=THREE.MathUtils.clamp(anchor.x,left-bounds.min.x,right-bounds.max.x)-anchor.x,dz=THREE.MathUtils.clamp(anchor.z,-3.55-bounds.min.z,3.55-bounds.max.z)-anchor.z;
   hinge.position.set((Math.cos(yaw)*dx-Math.sin(yaw)*dz)*blend,0,(Math.sin(yaw)*dx+Math.cos(yaw)*dz)*blend);
  }
  root.userData.foregroundAngle=hinge.rotation.x;
 }
 driver.userData.kirigami={pose};pose(1);rememberGroundRest(root);
 return {root,driver,hit,width,pose,dispose(){root.removeFromParent();panel.dispose();base.geometry.dispose();(base.material as THREE.Material).dispose();hit.geometry.dispose();(hit.material as THREE.Material).dispose();}};
}
