import * as THREE from 'three';

/** Three low-opacity paint exposures trail the standee. Tapered cream
 * strokes follow her world velocity and turn toward the camera. */
export function castleSprintPaint(scene: THREE.Object3D, hero: THREE.Mesh<THREE.PlaneGeometry,THREE.MeshBasicMaterial>) {
  const ghosts = [.18,.105,.05].map(opacity => {
    const material = hero.material.clone();
    material.transparent = true; material.opacity = opacity; material.alphaTest = .04; material.depthWrite = false;
    const mesh = new THREE.Mesh(hero.geometry,material);
    mesh.visible = false; mesh.renderOrder = hero.renderOrder-1;
    scene.add(mesh);
    return mesh;
  });
  const count = 8;
  const positions = new THREE.Float32BufferAttribute(new Float32Array(count*9),3);
  positions.setUsage(THREE.DynamicDrawUsage);
  const geometry = new THREE.BufferGeometry().setAttribute('position',positions);
  const material = new THREE.MeshBasicMaterial({color:'#f8ebc9',side:THREE.DoubleSide,transparent:true,opacity:.52,depthWrite:false});
  const lines = new THREE.Mesh(geometry,material);
  lines.visible = false; lines.frustumCulled = false; lines.renderOrder = 4; scene.add(lines);
  const forward = new THREE.Vector3(), width = new THREE.Vector3(), across = new THREE.Vector3();
  const start = new THREE.Vector3(), tail = new THREE.Vector3(), eye = new THREE.Vector3();

  return (on: boolean,vx: number,vz: number,camera: THREE.Camera,seconds: number) => {
    lines.visible = on;
    ghosts.forEach((mesh,i) => {
      mesh.visible = on;
      if (!on) return;
      mesh.position.copy(hero.position);
      mesh.position.x -= vx*(i+1)*.023; mesh.position.z -= vz*(i+1)*.023;
      mesh.quaternion.copy(hero.quaternion); mesh.scale.copy(hero.scale);
      if (mesh.material.map!==hero.material.map) {
        mesh.material.map = hero.material.map; mesh.material.needsUpdate = true;
      }
      mesh.material.color.copy(hero.material.color);
    });
    if (!on) return;
    forward.set(vx,0,vz).normalize(); across.set(-forward.z,0,forward.x);
    eye.subVectors(camera.position,hero.position).normalize();
    width.crossVectors(forward,eye).normalize();
    for (let i=0;i<count;i++) {
      const age = (seconds*(4+i*.16)+i*.21)%1;
      const side = (i%2 ? 1 : -1)*(.54+i*.074);
      start.copy(hero.position).addScaledVector(across,side).addScaledVector(forward,-age*1.35);
      start.y += .17+(i%4)*.18;
      tail.copy(start).addScaledVector(forward,-.42-age*.73);
      const w = .012+(1-age)*.016;
      positions.setXYZ(i*3,start.x+width.x*w,start.y+width.y*w,start.z+width.z*w);
      positions.setXYZ(i*3+1,start.x-width.x*w,start.y-width.y*w,start.z-width.z*w);
      positions.setXYZ(i*3+2,tail.x,tail.y,tail.z);
    }
    positions.needsUpdate = true;
  };
}
