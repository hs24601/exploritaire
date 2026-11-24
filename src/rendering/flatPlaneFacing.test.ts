import {it,expect} from 'vitest';
import * as THREE from 'three';
import {limitFlatPlaneFacing,readableFlatPlane,FLAT_PLANE_MAX_ANGLE} from './flatPlaneFacing';
it('retains readable facing across full spins, elevation and scaled parents',()=>{
 const parent=new THREE.Group();parent.rotation.set(.2,.4,-.1);parent.scale.set(2,.8,1.2);const plane=new THREE.Mesh(new THREE.PlaneGeometry(),new THREE.MeshBasicMaterial());parent.add(plane);plane.position.set(1,2,3);
 const camera=new THREE.PerspectiveCamera(),position=new THREE.Vector3(),normal=new THREE.Vector3(),view=new THREE.Vector3();
 for(const elevation of [-8,0,8,30])for(let angle=0;angle<Math.PI*2;angle+=.13){plane.rotation.set(.1,angle,.15);camera.position.set(12,elevation,15);limitFlatPlaneFacing(plane,camera);plane.getWorldPosition(position);normal.set(0,0,1).applyMatrix3(new THREE.Matrix3().getNormalMatrix(plane.matrixWorld)).normalize();view.copy(camera.position).sub(position).normalize();expect(normal.dot(view)).toBeGreaterThanOrEqual(Math.cos(FLAT_PLANE_MAX_ANGLE)-1e-6);}
});
it('preserves orientations inside the limit and supports baked horizontal card planes',()=>{
 const object=new THREE.Group(),camera=new THREE.PerspectiveCamera();object.rotation.z=.25;camera.position.set(0,0,10);const orientation=object.quaternion.clone();expect(limitFlatPlaneFacing(object,camera)).toBe(false);expect(object.quaternion.equals(orientation)).toBe(true);
 const card=readableFlatPlane(new THREE.Mesh(new THREE.PlaneGeometry().rotateX(-Math.PI/2),new THREE.MeshBasicMaterial()));card.onBeforeRender({} as THREE.WebGLRenderer,new THREE.Scene(),camera,card.geometry,card.material,null as unknown as THREE.Group);
 const normal=new THREE.Vector3(0,1,0).applyQuaternion(card.quaternion);expect(normal.z).toBeGreaterThanOrEqual(Math.cos(FLAT_PLANE_MAX_ANGLE)-1e-6);
});
