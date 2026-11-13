import * as THREE from 'three';
import {createPopupVFold,type PopupVFold,type PopupVFoldOptions} from './popupVFold';

export const WOODLAND_ART='environment/watercolor/v1/hero-den-sprite-v2.png';

/** Den-only successor to the woodland recipe. Keep the serialized 'woodland'
 * mechanism and original card scale so saved instances retain their placement.
 * Trees, berry panels, supports and the foliage flap are deliberately absent. */
export function createDenPopup(den:HTMLCanvasElement,o:PopupVFoldOptions):PopupVFold{
 const scale=o.height/2.4;
 const main=createPopupVFold(den,{...o,height:1.65,cardWidth:5.4,cardDepth:4.4,apexZ:.65,alpha:Math.PI/4,beta:Math.PI/2,split:.5,faces:'reader',mount:'card',doorway:true});
 const root=new THREE.Group();root.add(main.root);main.root.scale.setScalar(scale);
 const driver=new THREE.Group();driver.userData.kirigami={pose:main.pose};driver.userData.connectedPaper=true;root.add(driver);
 const hit=new THREE.Mesh(new THREE.BoxGeometry(5.6,1.85,4.5),new THREE.MeshBasicMaterial({visible:false,side:THREE.DoubleSide}));hit.geometry.translate(0,.925,-1.3);hit.scale.setScalar(scale);hit.userData.editorHelper=true;root.add(hit);
 root.userData.popupRoot=true;
 return {root,driver,hit,width:5.6*scale,pose:main.pose,dispose(){root.removeFromParent();main.dispose();hit.geometry.dispose();(hit.material as THREE.Material).dispose();}};
}
