import * as THREE from 'three';
import { WATER_VERT, WATER_FRAG } from '../shaders/waterShader';
import { WORLD_SIZE, WATER_LEVEL } from './TerrainSystem';

export class WaterSystem {
  public readonly mesh: THREE.Mesh;
  private material: THREE.ShaderMaterial;

  constructor() {
    this.material = new THREE.ShaderMaterial({
      vertexShader: WATER_VERT,
      fragmentShader: WATER_FRAG,
      uniforms: {
        uTime:          { value: 0 },
        uWaveFreq:      { value: 0.5 },
        uWaveAmp:       { value: 0.15 },
        uWaveSpeed:     { value: 0.8 },
        uDepthTexture:  { value: null },
        uCameraNear:    { value: 0.1 },
        uCameraFar:     { value: 1000 },
        uFoamColor:     { value: new THREE.Color(0.95, 0.98, 1.0) },
        uShallowColor:  { value: new THREE.Color(0x5dc8a8) },
        uDeepColor:     { value: new THREE.Color(0x1a5c7a) },
        uDepthSoftness: { value: 15.0 },
        uFoamSoftness:  { value: 5.0 },
        uFoamScale:     { value: 3.0 },
        uFoamSpeed:     { value: 0.02 },
        uFogNearColor:  { value: new THREE.Color(0.7, 0.85, 1.0) },
        uFogDensity:    { value: 0.0008 },
        uCameraPos:     { value: new THREE.Vector3() },
      },
      transparent: true,
      depthWrite: false,  // don't write depth — water is transparent
    });

    // Large plane sitting at water level
    const geo = new THREE.PlaneGeometry(WORLD_SIZE, WORLD_SIZE, 128, 128);
    geo.rotateX(-Math.PI / 2);
    this.mesh = new THREE.Mesh(geo, this.material);
    this.mesh.position.y = WATER_LEVEL;
    this.mesh.name = 'water';
  }

  update(dt: number, camera: THREE.PerspectiveCamera, fogColor: THREE.Color, fogDensity: number) {
    const u = this.material.uniforms;
    u.uTime.value += dt;
    u.uCameraNear.value = camera.near;
    u.uCameraFar.value  = camera.far;
    u.uCameraPos.value.copy(camera.position);
    u.uFogNearColor.value.copy(fogColor);
    u.uFogDensity.value = fogDensity;
  }

  setDepthTexture(tex: THREE.DepthTexture) {
    this.material.uniforms.uDepthTexture.value = tex;
  }

  setColors(foam: THREE.Color, shallow: THREE.Color, deep: THREE.Color) {
    this.material.uniforms.uFoamColor.value.copy(foam);
    this.material.uniforms.uShallowColor.value.copy(shallow);
    this.material.uniforms.uDeepColor.value.copy(deep);
  }

  setWaveParams(freq: number, amp: number, speed: number) {
    this.material.uniforms.uWaveFreq.value  = freq;
    this.material.uniforms.uWaveAmp.value   = amp;
    this.material.uniforms.uWaveSpeed.value = speed;
  }

  setFoamParams(softness: number, scale: number, speed: number) {
    this.material.uniforms.uFoamSoftness.value = softness;
    this.material.uniforms.uFoamScale.value    = scale;
    this.material.uniforms.uFoamSpeed.value    = speed;
  }

  setDepthSoftness(v: number) {
    this.material.uniforms.uDepthSoftness.value = v;
  }
}
