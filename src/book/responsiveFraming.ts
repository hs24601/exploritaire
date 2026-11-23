import * as THREE from 'three';
import type {BookCameraShot} from './bookCamera';
export type FrameRect={x:number;y:number;width:number;height:number};
export type BookFraming={subject:'book'|'control';controlId?:string;margin:number};
export function validBookFraming(value:unknown):value is BookFraming{const f=value as BookFraming;return !!f&&['book','control'].includes(f.subject)&&Number.isFinite(f.margin)&&f.margin>=0&&f.margin<=.4&&(f.subject==='book'||typeof f.controlId==='string'&&/^[\w:-]{1,140}$/.test(f.controlId));}
export function frameCorners(bounds:THREE.Box3){const points:THREE.Vector3[]=[];for(const x of [bounds.min.x,bounds.max.x])for(const y of [bounds.min.y,bounds.max.y])for(const z of [bounds.min.z,bounds.max.z])points.push(new THREE.Vector3(x,y,z));return points;}
/** Fit every corner within the unobstructed screen rectangle, preserving angle/FOV. */
export function fitBookBounds(bounds:THREE.Box3,shot:BookCameraShot,viewport:{width:number;height:number},safe:FrameRect,margin=.08):BookCameraShot{
 const center=bounds.getCenter(new THREE.Vector3()),direction=new THREE.Vector3(...shot.position).sub(new THREE.Vector3(...shot.target)).normalize();if(!direction.lengthSq())direction.set(0,1,.001);
 const orientation=new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().lookAt(direction,new THREE.Vector3(),new THREE.Vector3(0,1,0))).invert();
 const tangent=Math.tan(THREE.MathUtils.degToRad(shot.fov/2)),scale=Math.max(.1,1-2*margin),tx=tangent*Math.max(1,safe.width)*scale/Math.max(1,viewport.height),ty=tangent*Math.max(1,safe.height)*scale/Math.max(1,viewport.height);let distance=.3;
 for(const corner of frameCorners(bounds)){const p=corner.sub(center).applyQuaternion(orientation);distance=Math.max(distance,p.z+Math.abs(p.x)/tx,p.z+Math.abs(p.y)/ty,p.z+.3);}
 return {...shot,position:center.clone().addScaledVector(direction,distance).toArray(),target:center.toArray()};
}
/** Shift the principal point without changing the view direction or camera target. */
export function applySafeProjection(camera:THREE.PerspectiveCamera,viewport:{width:number;height:number},safe:FrameRect){camera.aspect=viewport.width/viewport.height;camera.setViewOffset(viewport.width,viewport.height,viewport.width/2-safe.x-safe.width/2,viewport.height/2-safe.y-safe.height/2,viewport.width,viewport.height);camera.updateProjectionMatrix();}
