import * as THREE from 'three';

/** Actor peek-through for scene props. Shared uniforms cut only fragments in
 * front of the live actor; overlapping openings naturally form a union. */
export function createActorPeekThree(options: { depthBias?: number } = {}) {
  const holes = Array.from({ length: 5 }, () => new THREE.Vector4());
  const depths = new Float32Array(5);
  const bounds = new THREE.Box3(), point = new THREE.Vector3();
  const tableauBounds = new THREE.Vector4(0, 0, 0, 0);
  return {
    attach(material: THREE.MeshBasicMaterial | THREE.MeshLambertMaterial | THREE.MeshStandardMaterial) {
      material.onBeforeCompile = shader => {
        shader.uniforms.actorPeekHoles = { value: holes };
        shader.uniforms.actorPeekDepths = { value: depths };
        shader.uniforms.tableauPeekBounds = { value: tableauBounds };
        shader.vertexShader = 'varying vec4 peekClip; varying float peekDepth; varying vec3 peekWorld;\n' + shader.vertexShader;
        shader.vertexShader = shader.vertexShader.replace('#include <project_vertex>', '#include <project_vertex>\npeekClip = gl_Position; peekDepth = -mvPosition.z; peekWorld = (modelMatrix * vec4(transformed, 1.0)).xyz;');
        shader.fragmentShader = 'uniform vec4 actorPeekHoles[5]; uniform float actorPeekDepths[5]; uniform vec4 tableauPeekBounds; varying vec4 peekClip; varying float peekDepth; varying vec3 peekWorld;\n' + shader.fragmentShader;
        shader.fragmentShader = shader.fragmentShader.replace('#include <alphatest_fragment>', `#include <alphatest_fragment>
          if (tableauPeekBounds.y > tableauPeekBounds.x) {
            float dy = peekWorld.y - cameraPosition.y;
            if (abs(dy) > .00001) {
              float rayT = (.035 - cameraPosition.y) / dy;
              vec3 ground = cameraPosition + (peekWorld - cameraPosition) * rayT;
              if (rayT > 1.001 && ground.x >= tableauPeekBounds.x && ground.x <= tableauPeekBounds.y && ground.z >= tableauPeekBounds.z && ground.z <= tableauPeekBounds.w) discard;
            }
          }
          for (int i = 0; i < 5; i++) {
            vec4 hole = actorPeekHoles[i];
            if (hole.z > 0.0 && peekDepth < actorPeekDepths[i] - ${(options.depthBias ?? .01).toFixed(4)}) {
              vec2 p = (peekClip.xy / peekClip.w - hole.xy) / hole.zw;
              float a = atan(p.y, p.x);
              float edge = .91 + .045*sin(a*17.) + .025*sin(a*31.+1.7) + .02*sin(a*53.);
              if (length(p) < edge) discard;
            }
          }`);
      };
      material.customProgramCacheKey = () => 'actor-peek-through-v2:'+String(options.depthBias ?? .01);
      material.needsUpdate = true;
    },
    setTableauBounds(box?: THREE.Box3) {
      if (!box || box.isEmpty()) tableauBounds.set(0, 0, 0, 0);
      else tableauBounds.set(box.min.x - .2, box.max.x + .2, box.min.z - .2, box.max.z + .2);
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

/** Perspective-correct clearance around a rectangular world-space surface.
 * Unlike actor ellipses, this follows the actual panel plane at any orbit angle. */
export function createSurfacePeekThree() {
  const inverse=Array.from({length:5},()=>new THREE.Matrix4());
  const sizes=Array.from({length:5},()=>new THREE.Vector2());
  return {
    attach(material:THREE.MeshBasicMaterial|THREE.MeshLambertMaterial|THREE.MeshStandardMaterial){
      material.onBeforeCompile=shader=>{
        shader.uniforms.surfacePeekInverse={value:inverse};shader.uniforms.surfacePeekSize={value:sizes};
        shader.vertexShader='varying vec3 surfacePeekWorld;\n'+shader.vertexShader;
        shader.vertexShader=shader.vertexShader.replace('#include <project_vertex>','#include <project_vertex>\nsurfacePeekWorld=(modelMatrix*vec4(transformed,1.)).xyz;');
        shader.fragmentShader='uniform mat4 surfacePeekInverse[5]; uniform vec2 surfacePeekSize[5]; varying vec3 surfacePeekWorld;\n'+shader.fragmentShader;
        shader.fragmentShader=shader.fragmentShader.replace('#include <alphatest_fragment>',`#include <alphatest_fragment>
          for(int i=0;i<5;i++){
            if(surfacePeekSize[i].x<=0.)continue;
            vec3 origin=(surfacePeekInverse[i]*vec4(cameraPosition,1.)).xyz;
            vec3 fragment=(surfacePeekInverse[i]*vec4(surfacePeekWorld,1.)).xyz;
            vec3 direction=fragment-origin;
            if(abs(direction.z)<.000001)continue;
            float t=-origin.z/direction.z;
            vec2 hit=origin.xy+t*direction.xy;
            if(t>=.995 && all(lessThanEqual(abs(hit),surfacePeekSize[i])))discard;
          }`);
      };
      material.customProgramCacheKey=()=> 'surface-peek-v1';material.needsUpdate=true;
    },
    update(panels:readonly THREE.Mesh[],margin=.12){
      sizes.forEach((size,i)=>{const panel=panels[i];size.set(0,0);if(!panel?.visible)return;panel.updateWorldMatrix(true,false);inverse[i].copy(panel.matrixWorld).invert();const geometry=panel.geometry as THREE.PlaneGeometry;size.set(geometry.parameters.width/2+margin,geometry.parameters.height/2+margin);});
    }
  };
}
