import * as THREE from 'three';
/** Move the control origin so the opposite corner survives a nonuniform resize. */
export function resizedAnchorOrigin(origin:THREE.Vector3,anchor:THREE.Vector3,u:THREE.Vector3,v:THREE.Vector3,widthScale:number,heightScale:number,depthScale=1){const n=new THREE.Vector3().crossVectors(u,v).normalize(),offset=anchor.clone().sub(origin),scaled=u.clone().multiplyScalar(offset.dot(u)*widthScale).addScaledVector(v,offset.dot(v)*heightScale).addScaledVector(n,offset.dot(n)*depthScale);return anchor.clone().sub(scaled);}
