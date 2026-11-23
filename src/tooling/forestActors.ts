import * as THREE from 'three';
import { selectSpriteView, type SpriteView } from '../proto/directionalSprites';
import frames from './forestActorFrames.json';
import { hideNearCamera, reliefCameraDistance } from './forestCameraVisibility';

type ActorView = { view: SpriteView; index: number };
const same = (a: ActorView, b: ActorView) => a.index === b.index && a.view.flip === b.view.flip;

/** Combat camera view selection on static world actors, with tree-style local phasing. */
export async function createForestActors(scene: THREE.Scene, template: THREE.ShaderMaterial, base: string) {
  const loader = new THREE.TextureLoader();
  const actors = await Promise.all([
    { id: 'hero' as const, x: -3, z: 8, height: 1.7, heading: Math.PI / 2 },
    { id: 'slime' as const, x: 3, z: 8, height: 1.8, heading: -Math.PI / 2 },
  ].map(async recipe => {
    const views = await Promise.all(frames[recipe.id].map(async frame => {
      const [paint, depth] = await Promise.all([
        loader.loadAsync(base + `labs/forest-props/${frame.key}.png`),
        loader.loadAsync(base + `labs/forest-props/${frame.key}-depth.png`),
      ]);
      paint.colorSpace = THREE.SRGBColorSpace; depth.colorSpace = THREE.NoColorSpace;
      const geometry = new THREE.PlaneGeometry(1, 1, 48, 72);
      const phases = new THREE.InstancedBufferAttribute(new Float32Array(6), 3);
      geometry.setAttribute('poseBlend', phases);
      const material = template.clone();
      material.uniforms = { ...template.uniforms, paint: { value: paint }, depthMap: { value: depth } };
      material.vertexShader = template.vertexShader.replace('992.0 / 1586.0', frame.aspect.toFixed(8))
        .replace('0.5 - 0.0593', '0.5').replace('vec2(0.498, 0.067)', 'vec2(0.5, 0.02)');
      material.depthWrite = true;
      const mesh = new THREE.InstancedMesh(geometry, material, 2);
      mesh.name = recipe.id + '-' + frame.key; mesh.frustumCulled = false; mesh.visible = false;
      // Write actor depth before the translucent trees, allowing foreground occlusion.
      mesh.renderOrder = -1; scene.add(mesh);
      return { mesh, phases, paint, depth, aspect: frame.aspect };
    }));
    return { ...recipe, views, current: undefined as ActorView | undefined, outgoing: undefined as ActorView | undefined,
      started: -Infinity, hidden: false };
  }));
  const dummy = new THREE.Object3D();
  return {
    update(camera: THREE.PerspectiveCamera, now: number, duration: number, strength: number) {
      let transitioning = 0;
      for (const actor of actors) {
        const dx = camera.position.x - actor.x, dz = camera.position.z - actor.z;
        const yaw = Math.atan2(dx, dz), elevation = Math.atan2(camera.position.y, Math.hypot(dx, dz));
        const view = selectSpriteView(actor.heading, yaw, elevation, actor.current?.view);
        const next = { view, index: view.elevation === 'top' ? 10 : view.direction + (view.elevation === 'high' ? 5 : 0) };
        let progress = duration > 0 ? Math.min(1, Math.max(0, (now - actor.started) / duration)) : 1;
        if (!actor.current) actor.current = next;
        else if (!same(actor.current, next)) {
          // Rapid movement may replace the incoming view, but never restarts the
          // outgoing view or its clock, matching the trees' transition behavior.
          if (progress >= 1) { actor.outgoing = actor.current; actor.started = now; progress = duration > 0 ? 0 : 1; }
          actor.current = next;
        }
        if (progress >= 1) actor.outgoing = undefined;
        if (actor.outgoing) transitioning++;
        for (const frame of actor.views) { frame.mesh.visible = false; frame.mesh.count = 0; }
        const entries = [...(actor.outgoing ? [{ selection: actor.outgoing, old: true }] : []), { selection: actor.current, old: false }];
        let clearance = Infinity;
        for (const { selection } of entries) {
          const top = selection.view.elevation === 'top';
          const heading = top ? actor.heading + Math.PI : yaw;
          const pitch = top ? Math.PI / 2 : Math.max(0, elevation) * .75;
          clearance = Math.min(clearance, reliefCameraDistance(camera.position,
            { ...actor, yaw: heading, distance: 0, aspect: actor.views[selection.index].aspect, bottom: top ? -.5 : 0 }, heading, pitch, strength));
        }
        actor.hidden = hideNearCamera(clearance, actor.hidden);
        if (actor.hidden) continue;
        for (const { selection, old } of entries) {
          const frame = actor.views[selection.index], top = selection.view.elevation === 'top';
          dummy.position.set(actor.x, top ? .1 : .03, actor.z);
          dummy.rotation.set(top ? -Math.PI / 2 : -Math.max(0, elevation) * .75, top ? actor.heading + Math.PI : yaw, 0, 'YXZ');
          dummy.scale.set(actor.height * selection.view.flip, actor.height, actor.height);
          // Centre overhead footprints at the actor's ground anchor.
          dummy.updateMatrix();
          if (top) dummy.matrix.multiply(new THREE.Matrix4().makeTranslation(0, -.5, 0));
          const index = frame.mesh.count++;
          frame.mesh.setMatrixAt(index, dummy.matrix); frame.phases.setXYZ(index, old ? 0 : 1, progress, 0);
          frame.mesh.visible = true; frame.mesh.instanceMatrix.needsUpdate = true; frame.phases.needsUpdate = true;
        }
      }
      return transitioning;
    },
    dispose() {
      for (const actor of actors) for (const frame of actor.views) {
        scene.remove(frame.mesh); frame.mesh.geometry.dispose(); frame.mesh.material.dispose(); frame.mesh.dispose(); frame.paint.dispose(); frame.depth.dispose();
      }
    },
  };
}
