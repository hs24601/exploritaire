import * as THREE from 'three';
import {createPopupVFold,type PopupVFold,type PopupVFoldOptions} from './popupVFold';

/** Three fixed painted directions, each driven by a real V-fold. No camera-facing rotation. */
export function createRadialPopup(art:HTMLCanvasElement,o:PopupVFoldOptions):PopupVFold{
 const root=new THREE.Group();root.userData.popupRoot=true;root.userData.radialPopup=true;
 const folds=[0,1,2].map(i=>{
  const fold=createPopupVFold(art,{...o,mount:'card',paintedBack:true,apexZ:0,cardWidth:o.cardWidth*.72,cardDepth:o.cardDepth*.72});
  fold.root.rotation.y=i*Math.PI*2/3;fold.root.position.y=i*.004;root.add(fold.root);return fold;
 });
 const width=Math.max(...folds.map(f=>f.width),o.cardWidth),hit=new THREE.Mesh(new THREE.BoxGeometry(width,o.height,width),new THREE.MeshBasicMaterial({visible:false,side:THREE.DoubleSide}));hit.position.y=o.height/2;hit.userData.editorHelper=true;root.add(hit);
 const pose=(n:number)=>{for(const fold of folds)fold.pose(n);};
 const driver=new THREE.Group();driver.userData.kirigami={pose};driver.userData.connectedPaper=true;root.add(driver);
 return {root,driver,hit,width,pose,dispose(){root.removeFromParent();folds.forEach(f=>f.dispose());hit.geometry.dispose();(hit.material as THREE.Material).dispose();}};
}
