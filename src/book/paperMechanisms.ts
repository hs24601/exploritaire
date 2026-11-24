import * as THREE from 'three';

export type PaperFrame={origin:THREE.Vector3;x:THREE.Vector3;y:THREE.Vector3};
export type PaperHinge={origin:THREE.Vector3;axis:THREE.Vector3;a:THREE.Vector3;b:THREE.Vector3};
const v=(x=0,y=0,z=0)=>new THREE.Vector3(x,y,z);

/** Local planes share a z hinge. All lengths are in the paper document's units. */
export function pageHinge(theta:number):PaperHinge{
 return {origin:v(),axis:v(0,0,1),a:v(1),b:v(Math.cos(theta),Math.sin(theta))};
}

/** Intersection of two rigid panel lengths in the cross-section of any hinge.
 * Reject impossible linkages rather than hiding them with a clamped square root. */
export function solveParallelFold(h:PaperHinge,a:number,b:number,p:number,q:number){
 if([a,b,p,q].some(n=>!Number.isFinite(n)||n<=0))throw new Error('Positive finite paper lengths required');
 const A=h.origin.clone().addScaledVector(h.a,a),B=h.origin.clone().addScaledVector(h.b,b);
 const ex=B.clone().sub(A),d=ex.length();
 if(d<1e-8)throw new Error('Parallel fold is singular at coincident anchors');
 if(d>p+q+1e-7||d<Math.abs(p-q)-1e-7)throw new Error('Parallel fold cannot reach its anchors');
 ex.divideScalar(d);
 const x=(p*p-q*q+d*d)/(2*d),y=Math.sqrt(Math.max(0,p*p-x*x));
 const perpendicular=new THREE.Vector3().crossVectors(h.axis,ex);
 const inward=h.a.clone().add(h.b);
 // At a flat-open page the inward bisector vanishes; +y is its continuous limit.
 if(inward.lengthSq()<1e-12)inward.crossVectors(h.axis,h.a);
 if(perpendicular.dot(inward)<0)perpendicular.negate();
 const C=A.clone().addScaledVector(ex,x).addScaledVector(perpendicular,y);
 const panel=(origin:THREE.Vector3)=>({origin,x:h.axis.clone(),y:C.clone().sub(origin).normalize()});
 return {A,B,C,panelA:panel(A),panelB:panel(B),
  crease:{origin:C,axis:h.axis.clone(),a:A.clone().sub(C).normalize(),b:B.clone().sub(C).normalize()} satisfies PaperHinge};
}

/** A flap's tip is held by a rigid connecting strip to a moving driver point.
 * The two-circle intersection solves its angle; it is not a timed rotation.
 * branch chooses a fixed side, retaining continuity on reverse turns. */
export function solveLinkedFlap(hinge:PaperFrame,driver:THREE.Vector3,radius:number,rod:number,branch=1):PaperFrame{
 const normal=new THREE.Vector3().crossVectors(hinge.x,hinge.y).normalize();
 const delta=driver.clone().sub(hinge.origin),along=delta.dot(hinge.x);
 const local=delta.addScaledVector(hinge.x,-along),d=local.length();
 const r2=rod*rod-along*along;
 if(radius<=0||rod<=0||r2<0||d<1e-9)throw new Error('Invalid flap linkage');
 const x=(radius*radius-r2+d*d)/(2*d),height2=radius*radius-x*x;
 if(height2< -1e-7)throw new Error('Flap connecting strip cannot reach');
 const ex=local.divideScalar(d),perp=new THREE.Vector3().crossVectors(hinge.x,ex);
 const tip=ex.multiplyScalar(x).addScaledVector(perp,branch*Math.sqrt(Math.max(0,height2)));
 // normal is evaluated to ensure a well-defined parent frame, even at closure.
 if(normal.lengthSq()<.5)throw new Error('Degenerate parent frame');
 return {origin:hinge.origin.clone(),x:hinge.x.clone(),y:tip.normalize()};
}

export function placePaperFrame(object:THREE.Object3D,frame:PaperFrame){
 const normal=new THREE.Vector3().crossVectors(frame.x,frame.y).normalize();
 object.matrixAutoUpdate=false;
 object.matrix.makeBasis(frame.x,frame.y,normal).setPosition(frame.origin);
 object.matrixWorldNeedsUpdate=true;
}
