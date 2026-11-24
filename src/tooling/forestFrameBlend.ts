import * as THREE from 'three';

export const historyWeight = (elapsedSeconds: number, milliseconds: number) => milliseconds > 0
  ? Math.exp(-Math.max(0, elapsedSeconds) / (milliseconds / 1000)) : 0;

/** Crossfade consecutive composited views, preserving opaque paint at rest.
 * Unlike stacking two translucent trees, this does not thin the paint's alpha. */
export function forestFrameBlend(renderer: THREE.WebGLRenderer) {
  const current = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType });
  let previous = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, depthBuffer: false });
  let next = previous.clone();
  let valid = false;
  const uniforms = { current: { value: current.texture }, history: { value: previous.texture }, weight: { value: 0 } };
  const geometry = new THREE.PlaneGeometry(2, 2), camera = new THREE.Camera();
  const vertexShader = 'varying vec2 vUv; void main(){vUv=uv;gl_Position=vec4(position.xy,0.0,1.0);}';
  const blendMaterial = new THREE.ShaderMaterial({
    uniforms, vertexShader, depthTest: false, depthWrite: false,
    fragmentShader: 'uniform sampler2D current,history; uniform float weight; varying vec2 vUv; void main(){gl_FragColor=mix(texture2D(current,vUv),texture2D(history,vUv),weight);}',
  });
  const displayMaterial = new THREE.ShaderMaterial({
    uniforms: { image: { value: next.texture } }, vertexShader, depthTest: false, depthWrite: false,
    fragmentShader: 'uniform sampler2D image; varying vec2 vUv; void main(){gl_FragColor=texture2D(image,vUv);\n#include <colorspace_fragment>\n}',
  });
  const quad = new THREE.Mesh(geometry, blendMaterial), screen = new THREE.Scene(); screen.add(quad);
  return {
    reset() { valid = false; },
    resize(width: number, height: number) { current.setSize(width, height); previous.setSize(width, height); next.setSize(width, height); valid = false; },
    render(scene: THREE.Scene, view: THREE.Camera, elapsed: number, milliseconds: number) {
      renderer.setRenderTarget(current); renderer.render(scene, view);
      uniforms.history.value = previous.texture; uniforms.weight.value = valid ? historyWeight(elapsed, milliseconds) : 0;
      quad.material = blendMaterial;
      renderer.setRenderTarget(next); renderer.render(screen, camera);
      quad.material = displayMaterial; displayMaterial.uniforms.image.value = next.texture;
      renderer.setRenderTarget(null); renderer.render(screen, camera);
      [previous, next] = [next, previous]; valid = true;
    },
    dispose() { current.dispose(); previous.dispose(); next.dispose(); geometry.dispose(); blendMaterial.dispose(); displayMaterial.dispose(); },
  };
}
