import * as THREE from 'three';
export type FoundationTeam='party'|'enemy';
/** Reference screenshot: retain at least 82% of face-on area (35° obliquity). */
export const FOUNDATION_MAX_SKEW=35*Math.PI/180;
/** Camera-parallel billboards can still be edge-on to an off-axis eye ray. */
export function foundationBillboardQuaternion(camera:THREE.Camera,position:THREE.Vector3){
 const orientation=camera.quaternion.clone(),normal=new THREE.Vector3(0,0,1).applyQuaternion(orientation),eye=camera.position.clone().sub(position).normalize();
 const angle=Math.acos(THREE.MathUtils.clamp(normal.dot(eye),-1,1));
 if(angle>FOUNDATION_MAX_SKEW){const correction=new THREE.Quaternion().slerp(new THREE.Quaternion().setFromUnitVectors(normal,eye),(angle-FOUNDATION_MAX_SKEW)/angle);orientation.premultiply(correction);}
 return orientation;
}
type Point={x:number;y:number;z:number};
/** Switch only after a meaningful depth change, rather than flickering at a side view. */
export function nearestFoundationTeam(camera:Point,party:Point,enemy:Point,previous:FoundationTeam='party'):FoundationTeam{
 const distance=(p:Point)=>Math.hypot(camera.x-p.x,camera.z-p.z);
 const a=distance(party),b=distance(enemy);
 return previous==='party'?(b+1<a?'enemy':'party'):(a+1<b?'party':'enemy');
}
export function foundationWorldPose(camera:THREE.Camera,anchor:Point,ground:boolean){
 const toward=new THREE.Vector3(camera.position.x-anchor.x,0,camera.position.z-anchor.z);
 const distance=toward.length();if(distance<.001)toward.set(0,0,1);else toward.divideScalar(distance);
 const right=new THREE.Vector3(toward.z,0,-toward.x);
 const center=new THREE.Vector3(anchor.x,anchor.y,anchor.z);
 if(ground){
  center.addScaledVector(toward,Math.min(.55,distance*.15));
  return {center,right,toward,width:2,height:1.1,ground:true};
 }
 // Behind the far team in actual depth, offset sideways so the actor remains legible.
 center.addScaledVector(toward,-1.1).addScaledVector(right,3*1.2);center.y+=1.65*1.2;
 return {center,right,toward,width:4.8,height:2.4,ground:false};
}
/** Prop the floor print toward the viewer only as much as readability requires.
 * Rotate around its near ground edge; preserve real depth rather than drawing
 * over actors with a HUD/depth override. Fully facing billboards already pass. */
export function limitFoundationSkew(geometry:THREE.PlaneGeometry,pose:ReturnType<typeof foundationWorldPose>,camera:THREE.Camera,height:(x:number,z:number)=>number){
 const p=geometry.attributes.position,normal=new THREE.Vector3(0,1,0),eye=camera.position.clone().sub(pose.center).normalize();
 // Sample the actual sloped patch's normal, with the upright orientation.
 const a=new THREE.Vector3().fromBufferAttribute(p,0),b=new THREE.Vector3().fromBufferAttribute(p,1),c=new THREE.Vector3().fromBufferAttribute(p,geometry.parameters.widthSegments+1);
 normal.copy(b).sub(a).cross(c.sub(a)).normalize();if(normal.y<0)normal.negate();
 const angle=Math.acos(THREE.MathUtils.clamp(normal.dot(eye),-1,1));
 const tilt=Math.max(0,angle-FOUNDATION_MAX_SKEW);if(tilt<.0001)return 0;
 const pivot=pose.center.clone().addScaledVector(pose.toward,pose.height/2);pivot.y=height(pivot.x,pivot.z)+.035;
 const rotation=new THREE.Quaternion().slerp(new THREE.Quaternion().setFromUnitVectors(normal,eye),tilt/angle),point=new THREE.Vector3();let lift=0;
 // A propped card occupies more vertical screen area. Compact it about the
 // planted edge instead of covering the nearby actor or clipping the viewport.
 const compression=THREE.MathUtils.smoothstep(tilt,0,15*Math.PI/180),scale=1-.35*compression;
 for(let i=0;i<p.count;i++){
  point.fromBufferAttribute(p,i).sub(pivot).applyQuaternion(rotation).multiplyScalar(scale).add(pivot).addScaledVector(pose.toward,.1*compression);
  lift=Math.max(lift,height(point.x,point.z)+.035-point.y);p.setXYZ(i,point.x,point.y,point.z);
 }
 if(lift>0)for(let i=0;i<p.count;i++)p.setY(i,p.getY(i)+lift);
 normal.applyQuaternion(rotation);
 // Raising the face changes the actual eye ray. Refine against its new center,
 // not the former floor center, so low camera angles cannot evade the cap.
 for(let pass=0;pass<4;pass++){
  const center=new THREE.Vector3().fromBufferAttribute(p,0).add(new THREE.Vector3().fromBufferAttribute(p,p.count-1)).multiplyScalar(.5);
  eye.copy(camera.position).sub(center).normalize();const remaining=Math.acos(THREE.MathUtils.clamp(normal.dot(eye),-1,1));
  if(remaining<=FOUNDATION_MAX_SKEW+.00001)break;
  rotation.identity().slerp(new THREE.Quaternion().setFromUnitVectors(normal,eye),(remaining-FOUNDATION_MAX_SKEW)/remaining);
  lift=0;
  for(let i=0;i<p.count;i++){
   point.fromBufferAttribute(p,i).sub(pivot).applyQuaternion(rotation).add(pivot);p.setXYZ(i,point.x,point.y,point.z);
   lift=Math.max(lift,height(point.x,point.z)+.035-point.y);
  }
  if(lift>0)for(let i=0;i<p.count;i++)p.setY(i,p.getY(i)+lift);
  normal.applyQuaternion(rotation);
 }
 p.needsUpdate=true;geometry.computeBoundingSphere();return tilt;
}
/** A sampled floor patch, not a screen-space trapezoid: every vertex gets terrain support. */
export function fitFoundationFloor(geometry:THREE.PlaneGeometry,pose:ReturnType<typeof foundationWorldPose>,height:(x:number,z:number)=>number){
 const positions=geometry.attributes.position,uv=geometry.attributes.uv;
 for(let i=0;i<positions.count;i++){
  const across=(uv.getX(i)-.5)*pose.width,along=(.5-uv.getY(i))*pose.height;
  const x=pose.center.x+pose.right.x*across+pose.toward.x*along;
  const z=pose.center.z+pose.right.z*across+pose.toward.z*along;
  positions.setXYZ(i,x,height(x,z)+.035,z);
 }
 positions.needsUpdate=true;geometry.computeBoundingSphere();
}
