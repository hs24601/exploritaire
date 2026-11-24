import * as THREE from 'three';
/** The reference tilt retains at least ~42% of a flat print's facing area. */
export const FLAT_PLANE_MAX_ANGLE=65*Math.PI/180;
const z=new THREE.Vector3(0,0,1),position=new THREE.Vector3(),view=new THREE.Vector3(),normal=new THREE.Vector3(),safe=new THREE.Vector3(),local=new THREE.Vector3();
const worldNormals=new THREE.Matrix3(),localNormals=new THREE.Matrix3(),parentTranspose=new THREE.Matrix3(),turn=new THREE.Quaternion(),partial=new THREE.Quaternion();

/** Correct only the excess tilt; preserve in-plane roll and authored motion.
 * Parent-space normals keep the limit correct under scaled/rotated groups. */
export function limitFlatPlaneFacing(object:THREE.Object3D,camera:THREE.Camera,planeNormal:THREE.Vector3=z,maxAngle=FLAT_PLANE_MAX_ANGLE){
 camera.updateWorldMatrix(true,false);object.updateWorldMatrix(true,false);position.setFromMatrixPosition(object.matrixWorld);
 if((camera as THREE.OrthographicCamera).isOrthographicCamera)camera.getWorldDirection(view).negate();else view.setFromMatrixPosition(camera.matrixWorld).sub(position);
 if(view.lengthSq()<1e-10)return false;view.normalize();
 normal.copy(planeNormal).applyMatrix3(worldNormals.getNormalMatrix(object.matrixWorld)).normalize();
 const angle=Math.acos(THREE.MathUtils.clamp(normal.dot(view),-1,1));if(angle<=maxAngle+1e-7)return false;
 turn.setFromUnitVectors(normal,view);partial.identity().slerp(turn,(angle-maxAngle)/angle);safe.copy(normal).applyQuaternion(partial);
 if(object.parent)safe.applyMatrix3(parentTranspose.setFromMatrix4(object.parent.matrixWorld).transpose()).normalize();
 local.copy(planeNormal).applyMatrix3(localNormals.getNormalMatrix(object.matrix)).normalize();turn.setFromUnitVectors(local,safe);
 object.quaternion.premultiply(turn);object.updateMatrix();object.updateWorldMatrix(false,true);return true;
}

/** Common hook for loose world cards/flat props, including baked plane normals. */
export function readableFlatPlane<T extends THREE.Mesh>(mesh:T){
 const attribute=mesh.geometry.attributes.normal,normal=attribute?new THREE.Vector3().fromBufferAttribute(attribute,0).normalize():new THREE.Vector3(0,0,1),before=mesh.onBeforeRender;
 mesh.userData.readableFlatPlane=true;
 mesh.onBeforeRender=function(renderer,scene,camera,geometry,material,group){limitFlatPlaneFacing(mesh,camera,normal);before.call(mesh,renderer,scene,camera,geometry,material,group);};return mesh;
}
