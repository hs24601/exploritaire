import * as THREE from 'three';

export {flurryPlay} from '../sticker/flurryIdle';

const normal=new THREE.Vector3(),up=new THREE.Vector3(),wanted=new THREE.Vector3(),cross=new THREE.Vector3();
/** Facing correction can introduce a half roll. Recover world-up before the
 * explicit play roll, rather than letting camera elevation invert her face. */
export function uprightSticker(object:THREE.Object3D){
 object.updateWorldMatrix(true,false);normal.set(0,0,1).transformDirection(object.matrixWorld);up.set(0,1,0).transformDirection(object.matrixWorld);
 wanted.set(0,1,0).addScaledVector(normal,-normal.y);if(wanted.lengthSq()<1e-6)return;
 wanted.normalize();const angle=Math.atan2(normal.dot(cross.crossVectors(up,wanted)),up.dot(wanted));object.rotateZ(angle);object.updateWorldMatrix(false,true);
}
