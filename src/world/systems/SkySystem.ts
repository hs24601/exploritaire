import * as THREE from 'three';
import { AURORA_VERT, AURORA_FRAG } from '../shaders/auroraShader';
import type { LightingState } from './TimeOfDaySystem';

export class SkySystem {
  public readonly mesh: THREE.Mesh;
  private material: THREE.ShaderMaterial;

  constructor() {
    this.material = new THREE.ShaderMaterial({
      vertexShader: AURORA_VERT,
      fragmentShader: AURORA_FRAG,
      uniforms: {
        uTime:       { value: 0 },
        uResolution: { value: new THREE.Vector2(window.innerWidth, window.innerHeight) },
      },
      side: THREE.BackSide,
      depthWrite: false,
    });

    const geo = new THREE.SphereGeometry(950, 32, 16);
    this.mesh = new THREE.Mesh(geo, this.material);
    this.mesh.name = 'sky';
    this.mesh.renderOrder = -1;
  }

  update(state: LightingState, dt: number) {
    const u = this.material.uniforms;
    u.uTime.value += dt;
  }

  onResize(w: number, h: number) {
    this.material.uniforms.uResolution.value.set(w, h);
  }

  followCamera(pos: THREE.Vector3) {
    this.mesh.position.copy(pos);
  }
}
