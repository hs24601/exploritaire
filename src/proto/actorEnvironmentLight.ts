import * as THREE from 'three';

/** A diffuse light probe for painted sprites. Sample once per actor, never per
 * joint or pixel. World-space sampling avoids camera-facing normal artefacts.
 * Colors stay linear until Three's normal output conversion. */
export function createActorEnvironmentLight(hemisphere: THREE.HemisphereLight, moon: THREE.DirectionalLight, local: THREE.PointLight) {
  const position = new THREE.Vector3(), direction = new THREE.Vector3(), target = new THREE.Vector3();
  const bounce = new THREE.Color();
  return (point: THREE.Vector3, out: THREE.Color) => {
    // Broad upper-hemisphere response retains the artwork's authored form.
    out.copy(hemisphere.color).multiplyScalar(.75);
    bounce.copy(hemisphere.groundColor).multiplyScalar(.25);
    out.add(bounce).multiplyScalar(hemisphere.intensity * .22);
    moon.getWorldPosition(direction); moon.target.getWorldPosition(target);
    direction.sub(target).normalize();
    out.add(bounce.copy(moon.color).multiplyScalar(Math.max(0, direction.y) * moon.intensity * .12));
    local.getWorldPosition(position);
    const distance = point.distanceTo(position);
    const cutoff = local.distance > 0 ? Math.pow(Math.max(0, 1 - Math.pow(distance / local.distance, 4)), 2) : 1;
    out.add(bounce.copy(local.color).multiplyScalar(local.intensity * cutoff / Math.max(1, Math.pow(distance, local.decay)) / Math.PI));
    return out;
  };
}

