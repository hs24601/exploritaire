import * as THREE from 'three';
import { LEAF_VERT, LEAF_FRAG } from '../shaders/leafShader';

const LEAF_COUNT = 80;
const SPREAD_XZ  = 160;

export class FallingLeavesSystem {
  public readonly points: THREE.Points;
  private material: THREE.ShaderMaterial;

  constructor() {
    // Bake XZ positions; Y is fully driven by the falling shader
    const positions = new Float32Array(LEAF_COUNT * 3);
    const seeds     = new Float32Array(LEAF_COUNT);
    const offsets   = new Float32Array(LEAF_COUNT);
    const half = SPREAD_XZ / 2;

    for (let i = 0; i < LEAF_COUNT; i++) {
      positions[i * 3]     = (Math.random() - 0.5) * SPREAD_XZ;
      positions[i * 3 + 1] = 0; // ignored by shader
      positions[i * 3 + 2] = (Math.random() - 0.5) * SPREAD_XZ;
      seeds[i]   = Math.random();
      offsets[i] = Math.random(); // stagger fall cycle
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geo.setAttribute('aSeed',    new THREE.Float32BufferAttribute(seeds,    1));
    geo.setAttribute('aOffset',  new THREE.Float32BufferAttribute(offsets,  1));

    this.material = new THREE.ShaderMaterial({
      vertexShader:   LEAF_VERT,
      fragmentShader: LEAF_FRAG,
      uniforms: {
        uTime:       { value: 0 },
        uFallSpeed:  { value: 1.4 },  // m/s fall rate
        uWindAmp:    { value: 3.5 },  // metres of horizontal sway
        uWindSpeed:  { value: 0.35 },
        uCameraPos:  { value: new THREE.Vector3() },
        uFogDensity: { value: 0.0008 },

        // Autumn leaf palette
        uColorGold:   { value: new THREE.Color(0xf8c820) }, // bright gold
        uColorAmber:  { value: new THREE.Color(0xe87820) }, // warm amber
        uColorOrange: { value: new THREE.Color(0xd04010) }, // deep orange-red
      },
      transparent: true,
      depthWrite:  false,
      depthTest:   false,
      blending:    THREE.NormalBlending,
    });

    this.points = new THREE.Points(geo, this.material);
    this.points.name = 'fallingLeaves';
    this.points.frustumCulled = false;
    this.points.renderOrder = 3;
  }

  update(dt: number, fogDensity: number, cameraPos: THREE.Vector3) {
    const u = this.material.uniforms;
    u.uTime.value       += dt;
    u.uFogDensity.value  = fogDensity;
    u.uCameraPos.value.copy(cameraPos);
  }
}
