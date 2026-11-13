import * as THREE from 'three';
import {seeded} from './castlePaint';
import {GROUNDS_INLET, GROUNDS_WATER_LEVEL} from './castleGroundsLayout';

/** Two bounded point batches, with fixed buffers and motion entirely on the GPU.
 * No render targets, extra shadow passes, textures or per-frame particle uploads. */
export function createGroundsAmbiance(scene: THREE.Scene, count: number, reduced: boolean) {
  const time = {value: 0}, ratio = {value: 1};
  const batches: THREE.Points[] = [];
  const random = seeded(118);
  function points(amount: number, mist: boolean) {
    const positions = new Float32Array(amount * 3), seeds = new Float32Array(amount);
    for (let i = 0; i < amount; i++) {
      if (mist) {
        // The fall fans inward from the two authored inlet lip points.
        const [west,mouthWest,mouthEast,east] = GROUNDS_INLET;
        const u = .1 + random() * .8, inward = .26 + random() * .16;
        const lipX = THREE.MathUtils.lerp(west[0], east[0], u);
        const lipZ = THREE.MathUtils.lerp(west[1], east[1], u);
        const mouthX = THREE.MathUtils.lerp(mouthWest[0], mouthEast[0], u);
        const mouthZ = THREE.MathUtils.lerp(mouthWest[1], mouthEast[1], u);
        positions.set([THREE.MathUtils.lerp(lipX, mouthX, inward), GROUNDS_WATER_LEVEL + .7 + random() * 2.4, THREE.MathUtils.lerp(lipZ, mouthZ, inward)], i * 3);
      } else positions.set([(random() - .5) * 230, 1 + random() * 12, (random() - .5) * 230], i * 3);
      seeds[i] = random() * 100;
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('seed', new THREE.BufferAttribute(seeds, 1));
    const material = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, depthTest: true,
      uniforms: {time, ratio, mist: {value: mist ? 1 : 0}},
      vertexShader: `
        attribute float seed;
        uniform float time, ratio, mist;
        varying float alpha;
        void main() {
          vec3 p = position;
          p.x += sin(time * .13 + seed) * mix(2.5, 1.4, mist);
          p.z += cos(time * .11 + seed * 1.3) * 1.7;
          p.y += sin(time * .19 + seed * 2.) * mix(.7, 1.1, mist);
          vec4 mv = modelViewMatrix * vec4(p, 1.);
          float distance = max(1., -mv.z);
          alpha = (1. - smoothstep(65., 180., distance)) * smoothstep(1.5, 5., distance);
          alpha *= mix(.13 + .12 * sin(seed + time * .4), .075, mist);
          gl_Position = projectionMatrix * mv;
          gl_PointSize = ratio * clamp(mix(22., 1700., mist) / distance, 1., mix(3., 82., mist));
        }`,
      fragmentShader: `
        uniform float mist;
        varying float alpha;
        void main() {
          float d = length(gl_PointCoord - .5);
          float edge = 1. - smoothstep(.08, .5, d);
          gl_FragColor = vec4(mix(vec3(1., .87, .57), vec3(.76, .87, .90), mist), alpha * edge * edge);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
        }`,
    });
    const batch = new THREE.Points(geometry, material);
    // GPU displacement stays within this conservative static bound.
    geometry.computeBoundingSphere(); geometry.boundingSphere!.radius += 5;
    batch.renderOrder = 2; scene.add(batch); batches.push(batch);
  }
  if (count && !reduced) { points(Math.min(count, 220), false); points(Math.min(48, Math.ceil(count / 5)), true); }

  return {
    update(seconds: number, pixelRatio: number) { time.value = reduced ? 0 : seconds; ratio.value = pixelRatio; },
    setLow() { for (const batch of batches) batch.visible = false; },
    get particleCount() { return batches.reduce((sum, batch) => sum + (batch.visible ? batch.geometry.attributes.position.count : 0), 0); },
  };
}
