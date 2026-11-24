import * as THREE from 'three';
import type { DirectionalSpriteInstance } from './directionalSpriteRig';

/** Alpha-dilated stroke shares the live joint's pose and atlas geometry.
 * Derivatives keep its width steady as the camera moves. Only the transparent
 * border draws, preserving actor lighting, colours and hit flashes.
 */
export function createSpriteTargetOutline(rig: DirectionalSpriteInstance) {
  const layers = [...rig.parts.map(({ mesh }) => mesh), ...(rig.bobtail ? [rig.bobtail] : [])].map(mesh => {
    const material = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, side: THREE.DoubleSide, toneMapped: false,
      uniforms: {
        atlas: { value: mesh.material.map }, strength: { value: 0 },
        strokeWidth: { value: 1.5 }, gold: { value: new THREE.Color('#ffd166') },
        bounds: { value: new THREE.Vector4(0, 0, 1, 1) },
      },
      vertexShader: `varying vec2 atlasUv;
        void main() { atlasUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
      fragmentShader: `uniform sampler2D atlas;
        uniform float strength;
        uniform float strokeWidth;
        uniform vec3 gold;
        uniform vec4 bounds;
        varying vec2 atlasUv;
        float coverage(vec2 p) {
          if (p.x < bounds.x || p.y < bounds.y || p.x > bounds.z || p.y > bounds.w) return 0.0;
          return smoothstep(0.08, 0.4, texture2D(atlas, p).a);
        }
        void main() {
          vec2 dx = dFdx(atlasUv) * strokeWidth;
          vec2 dy = dFdy(atlasUv) * strokeWidth;
          float edge = 0.0;
          for (int x = -1; x <= 1; x++) for (int y = -1; y <= 1; y++) {
            edge = max(edge, coverage(atlasUv + float(x)*dx + float(y)*dy));
          }
          float alpha = edge * (1.0 - coverage(atlasUv)) * strength;
          if (alpha < 0.01) discard;
          gl_FragColor = vec4(gold, alpha);
          #include <colorspace_fragment>
        }`,
    });
    const stroke = new THREE.Mesh(mesh.geometry, material);
    stroke.position.z = -.001;
    stroke.visible = false;
    mesh.add(stroke);
    let geometry: THREE.BufferGeometry | undefined;
    return { stroke, material, sync(targeting?: 'valid' | 'focused') {
      stroke.visible = Boolean(targeting);
      if (!targeting) return;
      material.uniforms.strength.value = targeting === 'focused' ? 1 : .35;
      material.uniforms.strokeWidth.value = targeting === 'focused' ? 1.5 : 1;
      material.uniforms.atlas.value = mesh.material.map;
      stroke.geometry = mesh.geometry;
      if (geometry !== mesh.geometry) {
        geometry = mesh.geometry;
        const uv = geometry.getAttribute('uv');
        let left = Infinity, bottom = Infinity, right = -Infinity, top = -Infinity;
        for (let i = 0; i < uv.count; i++) {
          left = Math.min(left, uv.getX(i)); bottom = Math.min(bottom, uv.getY(i));
          right = Math.max(right, uv.getX(i)); top = Math.max(top, uv.getY(i));
        }
        material.uniforms.bounds.value.set(left, bottom, right, top);
      }
    } };
  });
  return {
    update(targeting?: 'valid' | 'focused') { layers.forEach(layer => layer.sync(targeting)); },
    dispose() { layers.forEach(({ stroke, material }) => { stroke.removeFromParent(); material.dispose(); }); },
  };
}
