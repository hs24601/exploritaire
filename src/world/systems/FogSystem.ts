import * as THREE from 'three';
import type { LightingState } from './TimeOfDaySystem';

/**
 * Fog system — drives Three.js scene fog from TOD state.
 * Three.js FogExp2 approximates Elysium's gradient fog reasonably well for a first pass.
 * For the true 3-band near/mid/far gradient, inject per-material shader chunks later.
 */
export class FogSystem {
  private fog: THREE.FogExp2;

  // Slider-overrides from NatureManager
  public densityOverride: number | null = null;
  public heightOverride:  number | null = null;

  constructor(scene: THREE.Scene) {
    this.fog = new THREE.FogExp2(0xb0d4f0, 0.001);
    scene.fog = this.fog;
  }

  update(state: LightingState, _scene: THREE.Scene) {
    // Use fog near color as the scene fog color
    this.fog.color.copy(state.fogNear);
    this.fog.density = this.densityOverride ?? state.fogDensity;
  }

  setDensity(d: number) { this.densityOverride = d; this.fog.density = d; }
  setHeight(_h: number) { this.heightOverride = _h; /* used by terrain/grass shaders */ }
  getCurrentColor(): THREE.Color { return this.fog.color; }
  getCurrentDensity(): number { return this.fog.density; }
}
