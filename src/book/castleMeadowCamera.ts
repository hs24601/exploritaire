import * as THREE from 'three';

/** Approximate the camera's clearance with a center ray and parallel
 * probes. Prefer the requested height, then retract along the view boom. */
export function createMeadowCameraClearance(occluders: THREE.Object3D[]) {
  const ray = new THREE.Raycaster();
  const hits: THREE.Intersection[] = [];
  const direction = new THREE.Vector3(), side = new THREE.Vector3(), up = new THREE.Vector3();
  const origin = new THREE.Vector3(), anchor = new THREE.Vector3(), candidate = new THREE.Vector3();
  const offsets = [[0,0],[1,0],[-1,0],[0,1],[0,-1],[.71,.71],[.71,-.71],[-.71,.71],[-.71,-.71]];
  function clearDistance(from: THREE.Vector3,to: THREE.Vector3,radius: number) {
    direction.subVectors(to,from);
    const length = direction.length();
    if (length<.001) return length;
    direction.divideScalar(length);
    side.set(direction.z,0,-direction.x);
    if (side.lengthSq()<.0001) side.set(1,0,0);
    else side.normalize();
    up.crossVectors(direction,side).normalize();
    let clear = length;
    for (const [x,y] of offsets) {
      origin.copy(from).addScaledVector(side,x*radius).addScaledVector(up,y*radius);
      ray.set(origin,direction);
      ray.far = clear+radius;
      hits.length = 0;
      ray.intersectObjects(occluders,false,hits);
      if (hits.length) clear = Math.max(0,hits[0].distance-radius);
      if (!clear || radius===0) break;
    }
    return clear;
  }
  const clearPath = (a: THREE.Vector3,b: THREE.Vector3,r: number) =>
    clearDistance(a,b,r)>=a.distanceTo(b)-.001;

  return (head: THREE.Vector3,desired: THREE.Vector3,radius: number,focus = head) => {
    const length = head.distanceTo(desired);
    const boom = clearDistance(head,desired,radius);
    if (boom>=length-.001 && clearPath(focus,desired,0)) return desired;

    anchor.set(head.x,desired.y,head.z);
    if (clearPath(head,anchor,radius)) {
      const run = anchor.distanceTo(desired);
      if (run>.001) {
        const reach = clearDistance(anchor,desired,radius)/run;
        for (const fraction of [reach,reach*.5,0]) {
          candidate.copy(anchor).lerp(desired,fraction);
          if (clearPath(focus,candidate,0)) return desired.copy(candidate);
        }
      }
    }
    for (const fraction of [1,.75,.5,.25]) {
      candidate.copy(head).lerp(desired,length>.001 ? boom*fraction/length : 0);
      if (clearPath(focus,candidate,0)) return desired.copy(candidate);
    }
    return desired.copy(head);
  };
}

/** Keep the requested orbit and damped recovery independent of the rendered
 * pose. A collision correction must never become the next frame's input. */
export function createMeadowCameraMotion(clearance: ReturnType<typeof createMeadowCameraClearance>) {
  const intent = new THREE.Vector3(), eased = new THREE.Vector3(), resolved = new THREE.Vector3();
  const output = new THREE.Vector3(), previousIntent = new THREE.Vector3(), delta = new THREE.Vector3();
  let releaseHold = 0, initialized = false;
  function reset(position:THREE.Vector3){
    intent.copy(position);eased.copy(position);resolved.copy(position);
    output.copy(position);previousIntent.copy(position);delta.set(0,0,0);
    releaseHold=0;initialized=true;
  }
  return {
    // Ownership handoffs adopt the rendered pose, not a page-specific default
    // or a previous collision-corrected output fed through another update.
    reset,
    update(head: THREE.Vector3,desired: THREE.Vector3,focus: THREE.Vector3,radius: number,dt: number) {
      if(!initialized){reset(desired);dt=0;}
      previousIntent.copy(intent);
      if (dt===0) intent.copy(desired);
      else intent.lerp(desired,1-Math.exp(-dt*12));
      if (intent.distanceToSquared(desired)<1e-8) intent.copy(desired);
      clearance(head,resolved.copy(intent),radius,focus);
      const blocked = resolved.distanceToSquared(intent)>1e-6;
      if (dt===0) {
        eased.copy(resolved);
        releaseHold = blocked ? .18 : 0;
        return output.copy(resolved);
      }
      if (blocked) releaseHold = .18;
      else releaseHold = Math.max(0,releaseHold-dt);

      // Follow the player's requested motion even while the boom is retracted.
      eased.add(delta.subVectors(intent,previousIntent));
      if (blocked || releaseHold===0) {
        eased.lerp(resolved,1-Math.exp(-dt*(blocked?16:6)));
        if (eased.distanceToSquared(resolved)<1e-8) eased.copy(resolved);
      }
      if (eased.equals(resolved)) return output.copy(resolved);
      // An interpolation between clear positions can cross a cliff corner.
      // Keep that last safety correction out of both damped poses.
      return clearance(head,output.copy(eased),radius,focus);
    },
  };
}
