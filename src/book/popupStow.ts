import * as THREE from 'three';
import type {PopupVFold} from './popupVFold';
/** Unfolded page coordinates remain stable while the cover carries a mechanism. */
export function popupPageMatrix(root:THREE.Object3D){
 const a=root.userData.stowAnchor as {x:number;z:number;rotation:number}|undefined;
 return new THREE.Matrix4().compose(new THREE.Vector3(a?.x??root.position.x,root.position.y,a?.z??root.position.z),new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,1,0),THREE.MathUtils.degToRad(a?.rotation??0)),root.scale);
}
/** Extra accordion creases tuck oversized, multi-sided mechanisms inside one page.
 * Geometry is cached once; no per-frame bounds readback or object scaling. */
export class PopupStow{
 private panels:{mesh:THREE.Mesh;rest:Float32Array;normals:Float32Array;matrix:THREE.Matrix4;auto:boolean}[]=[];private packed=false;private flatActive=false;private matrixOverrides=false;
 constructor(private root:THREE.Object3D,private frame=()=>popupPageMatrix(root)){
  root.traverse(o=>{if(!(o instanceof THREE.Mesh)||o.userData.editorHelper)return;if(root.userData.pageExtension){let parent=o.parent;while(parent&&parent!==root){if(parent.userData.popupRoot)return;parent=parent.parent;}}o.updateMatrix();o.geometry=o.geometry.clone();const p=o.geometry.getAttribute('position'),n=o.geometry.getAttribute('normal');if(p&&n)this.panels.push({mesh:o,rest:Float32Array.from(p.array),normals:Float32Array.from(n.array),matrix:o.matrix.clone(),auto:o.matrixAutoUpdate});o.frustumCulled=false;});
 }
 restore(next=1){if(!this.packed)return;for(const {mesh,rest,normals,matrix,auto}of this.panels){if(this.matrixOverrides){mesh.matrixAutoUpdate=auto;mesh.matrix.copy(matrix);mesh.matrixWorldNeedsUpdate=true;}if(!(next===0&&this.flatActive)){(mesh.geometry.getAttribute('position').array as Float32Array).set(rest);(mesh.geometry.getAttribute('normal').array as Float32Array).set(normals);mesh.geometry.getAttribute('position').needsUpdate=mesh.geometry.getAttribute('normal').needsUpdate=true;}}if(next!==0)this.flatActive=false;this.matrixOverrides=false;this.packed=false;}
 private placeFlat(frame:THREE.Matrix4,rootInverse:THREE.Matrix4){
  for(const {mesh}of this.panels){mesh.parent!.updateWorldMatrix(true,false);mesh.matrixAutoUpdate=false;mesh.matrix.copy(frame).multiply(rootInverse).multiply(mesh.parent!.matrixWorld).invert();mesh.matrixWorldNeedsUpdate=true;}this.matrixOverrides=true;this.packed=true;
 }
 apply(open:number){
  const amount=1-THREE.MathUtils.smoothstep(open,0,.4);if(!amount)return;
  this.root.updateWorldMatrix(true,true);const rootInverse=this.root.matrixWorld.clone().invert(),frame=this.frame(),anchor=new THREE.Vector3().setFromMatrixPosition(frame),side=anchor.x<0?-1:1;
  if(open===0&&this.flatActive){this.placeFlat(frame,rootInverse);return;}
  const lo=side<0?-5.65:.25,hi=side<0?-.25:5.65;
  const fold=(v:number,a:number,b:number)=>{const length=b-a,t=THREE.MathUtils.euclideanModulo(v-a,2*length);return a+(t<=length?t:2*length-t);};
  const v=new THREE.Vector3(),flat=new THREE.Vector3();
  for(const [layer,{mesh,rest}]of this.panels.entries()){
   const matrix=frame.clone().multiply(rootInverse).multiply(mesh.matrixWorld),inverse=matrix.clone().invert(),p=mesh.geometry.getAttribute('position');
   for(let i=0;i<p.count;i++){v.fromArray(rest,i*3).applyMatrix4(matrix);flat.set(fold(v.x,lo,hi),anchor.y+.002+Math.min(layer,100)*.00015,fold(v.z,-3.55,3.55));if(open===0)v.copy(flat);else v.lerp(flat,amount).applyMatrix4(inverse);p.setXYZ(i,v.x,v.y,v.z);}
   p.needsUpdate=true;if(open===0){const normal=mesh.geometry.getAttribute('normal');for(let i=0;i<normal.count;i++)normal.setXYZ(i,0,1,0);normal.needsUpdate=true;}else mesh.geometry.computeVertexNormals();
  }if(open===0){this.flatActive=true;this.placeFlat(frame,rootInverse);}this.packed=true;
 }
 dispose(){for(const p of this.panels)p.mesh.geometry.dispose();}
}
export function stowPopup(made:PopupVFold){
 const pack=new PopupStow(made.root),original=made.pose,dispose=made.dispose;let deployed=false,lastKey="";
 made.pose=(stage,paint,bookOpen=stage)=>{if(!deployed&&stage===0)bookOpen=0;const a=made.root.userData.stowAnchor,key=[stage,paint,bookOpen,a?.x,a?.z,a?.rotation,...made.root.scale.toArray()].join(":");if(!made.root.userData.pageExtension&&key===lastKey)return;lastKey=key;pack.restore(Math.min(stage,bookOpen));if(bookOpen<.01)deployed=false;if(stage>.5&&bookOpen>.9)deployed=true;original(stage,paint,bookOpen);const outward=made.driver.userData.foregroundFlap&&deployed&&bookOpen>.99;pack.apply(outward?bookOpen:Math.min(stage,bookOpen));};
 made.driver.userData.kirigami.pose=made.pose;made.dispose=()=>{pack.dispose();dispose();};return made;
}
