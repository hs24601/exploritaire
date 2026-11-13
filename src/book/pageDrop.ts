import * as THREE from 'three';

/** A drop anchors the object on the paper, regardless of camera posture. */
export function pageDropPoint(camera:THREE.PerspectiveCamera,rect:{left:number;top:number;width:number;height:number},clientX:number,clientY:number,page:number){
 if(rect.width<=0||rect.height<=0||clientX<rect.left||clientX>rect.left+rect.width||clientY<rect.top||clientY>rect.top+rect.height)return;
 camera.updateMatrixWorld();
 const ray=new THREE.Raycaster();ray.setFromCamera(new THREE.Vector2((clientX-rect.left)/rect.width*2-1,1-(clientY-rect.top)/rect.height*2),camera);
 const point=ray.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0,1,0),-(page===0?.215:.15)),new THREE.Vector3());
 if(!point||point.x<(page===0?.18:-5.67)||point.x>5.67||Math.abs(point.z)>3.57)return;
 return {x:point.x,z:point.z};
}
