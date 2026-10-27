import * as THREE from 'three';

/** Actor peek-through for scene props. Shared uniforms cut only fragments in
 * front of the live actor; overlapping openings naturally form a union. */
export function createActorPeekThree() {
  const holes = Array.from({ length: 5 }, () => new THREE.Vector4());
  const depths = new Float32Array(5);
  const bounds = new THREE.Box3(), point = new THREE.Vector3();
  return {
    attach(material: THREE.MeshBasicMaterial | THREE.MeshLambertMaterial) {
      material.onBeforeCompile = shader => {
        shader.uniforms.actorPeekHoles = { value: holes };
        shader.uniforms.actorPeekDepths = { value: depths };
        shader.vertexShader = 'varying vec4 peekClip; varying float peekDepth;\n' + shader.vertexShader;
        shader.vertexShader = shader.vertexShader.replace('#include <project_vertex>', '#include <project_vertex>\npeekClip = gl_Position; peekDepth = -mvPosition.z;');
        shader.fragmentShader = 'uniform vec4 actorPeekHoles[5]; uniform float actorPeekDepths[5]; varying vec4 peekClip; varying float peekDepth;\n' + shader.fragmentShader;
        shader.fragmentShader = shader.fragmentShader.replace('#include <alphatest_fragment>', `#include <alphatest_fragment>
          for (int i = 0; i < 5; i++) {
            vec4 hole = actorPeekHoles[i];
            if (hole.z > 0.0 && peekDepth < actorPeekDepths[i] - .01) {
              vec2 p = (peekClip.xy / peekClip.w - hole.xy) / hole.zw;
              float a = atan(p.y, p.x);
              float edge = .91 + .045*sin(a*17.) + .025*sin(a*31.+1.7) + .02*sin(a*53.);
              if (length(p) < edge) discard;
            }
          }`);
      };
      material.customProgramCacheKey = () => 'actor-peek-through-v1';
      material.needsUpdate = true;
    },
    update(camera: THREE.Camera, actors: readonly THREE.Object3D[]) {
      camera.updateMatrixWorld();
      actors.forEach(actor => actor.updateWorldMatrix(true, true));
      holes.forEach((hole, i) => {
        const actor = actors[i];
        hole.set(0, 0, 0, 0); depths[i] = 0;
        if (!actor?.visible) return;
        bounds.setFromObject(actor);
        if (bounds.isEmpty()) return;
        bounds.getCenter(point).applyMatrix4(camera.matrixWorldInverse);
        depths[i] = -point.z;
        if (depths[i] <= 0) return;
        let left = Infinity, right = -Infinity, top = -Infinity, bottom = Infinity;
        for (const x of [bounds.min.x, bounds.max.x]) for (const y of [bounds.min.y, bounds.max.y]) for (const z of [bounds.min.z, bounds.max.z]) {
          point.set(x, y, z).project(camera);
          left = Math.min(left, point.x); right = Math.max(right, point.x);
          bottom = Math.min(bottom, point.y); top = Math.max(top, point.y);
        }
        hole.set((left + right) / 2, (top + bottom) / 2, Math.max(.015, (right-left)*.9), Math.max(.02, (top-bottom)*.95));
      });
    },
  };
}
