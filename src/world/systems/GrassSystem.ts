import * as THREE from 'three';
import { GRASS_VERT, GRASS_FRAG } from '../shaders/grassShader';
import { TerrainSystem, WORLD_SIZE } from './TerrainSystem';

const GRASS_COUNT = 45_000;
const HALF = WORLD_SIZE / 2;

/** Simple X-cross grass blade: two quads at 90°, UV.y = 0 at base, 1 at tip */
function buildBlade(): THREE.BufferGeometry {
  const w = 0.12, h = 0.9;
  const positions: number[] = [];
  const uvs: number[] = [];
  const normals: number[] = [];

  const addQuad = (ax: number, az: number, bx: number, bz: number) => {
    // Two triangles: (base-left, base-right, tip-right) (base-left, tip-right, tip-left)
    const nx = bz - az, nz = -(bx - ax); // perpendicular
    const norm = [nx, 0, nz];

    positions.push(ax, 0, az,  bx, 0, bz,  bx, h, bz);
    positions.push(ax, 0, az,  bx, h, bz,  ax, h, az);
    uvs.push(0,0, 1,0, 1,1,  0,0, 1,1, 0,1);
    for (let i = 0; i < 6; i++) normals.push(...norm);
  };

  addQuad(-w/2, 0, w/2, 0);   // along X
  addQuad(0, -w/2, 0, w/2);   // along Z

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('uv',       new THREE.Float32BufferAttribute(uvs, 2));
  geo.setAttribute('normal',   new THREE.Float32BufferAttribute(normals, 3));
  return geo;
}

export class GrassSystem {
  public readonly mesh: THREE.InstancedMesh;
  private material: THREE.ShaderMaterial;

  constructor(terrain: TerrainSystem) {
    this.material = new THREE.ShaderMaterial({
      vertexShader: GRASS_VERT,
      fragmentShader: GRASS_FRAG,
      uniforms: {
        uTime:            { value: 0 },
        uWindFreq:        { value: 1.5 },
        uWindAmp:         { value: 0.2 },
        uWindSpeed:       { value: 0.8 },
        uNoiseFactor:     { value: 1.0 },
        uPlayerPos:       { value: new THREE.Vector3(0, 0, 0) },
        uBaseColor:       { value: new THREE.Color(0x2d5a1b) },
        uTipColor1:       { value: new THREE.Color(0x6aaa3a) },
        uTipColor2:       { value: new THREE.Color(0x88c856) },
        uSunDir:          { value: new THREE.Vector3(0.5, 1, 0.3).normalize() },
        uAmbientColor:    { value: new THREE.Color(0.9, 1.0, 0.85) },
        uAmbientIntensity:{ value: 0.5 },
        uShadowDarkness:  { value: 0.4 },
        uFogNearColor:    { value: new THREE.Color(0.7, 0.85, 1.0) },
        uFogDensity:      { value: 0.0008 },
        uCameraPos:       { value: new THREE.Vector3() },
      },
      side: THREE.DoubleSide,
    });

    const geo = buildBlade();
    this.mesh = new THREE.InstancedMesh(geo, this.material, GRASS_COUNT);
    this.mesh.name = 'grass';
    this.mesh.frustumCulled = false; // instanced bounds are tricky — disable for now

    this.placeBlades(terrain);
    this.mesh.instanceMatrix.needsUpdate = true;
  }

  private placeBlades(terrain: TerrainSystem) {
    const mat = new THREE.Matrix4();
    const pos = new THREE.Vector3();
    const rot = new THREE.Quaternion();
    const scl = new THREE.Vector3();
    let placed = 0;
    let attempts = 0;
    const maxAttempts = GRASS_COUNT * 5;

    while (placed < GRASS_COUNT && attempts < maxAttempts) {
      attempts++;
      const wx = (Math.random() - 0.5) * WORLD_SIZE;
      const wz = (Math.random() - 0.5) * WORLD_SIZE;

      if (!terrain.isGrassZone(wx, wz)) continue;

      const wy = terrain.getHeight(wx, wz);
      pos.set(wx, wy, wz);
      rot.setFromEuler(new THREE.Euler(0, Math.random() * Math.PI * 2, 0));
      const s = 0.7 + Math.random() * 0.6;
      scl.set(s, s * (0.8 + Math.random() * 0.5), s);

      mat.compose(pos, rot, scl);
      this.mesh.setMatrixAt(placed, mat);
      placed++;
    }
    // If not all placed (sparse terrain), zero out remaining
    const zero = new THREE.Matrix4().makeScale(0, 0, 0);
    for (let i = placed; i < GRASS_COUNT; i++) {
      this.mesh.setMatrixAt(i, zero);
    }
  }

  /** Returns base world positions + blade height for every Nth blade. */
  getBladePositions(stride = 4): Array<{ x: number; y: number; z: number; height: number }> {
    const result: Array<{ x: number; y: number; z: number; height: number }> = [];
    const m = new THREE.Matrix4();
    const p = new THREE.Vector3();
    const q = new THREE.Quaternion();
    const s = new THREE.Vector3();
    for (let i = 0; i < this.mesh.count; i += stride) {
      this.mesh.getMatrixAt(i, m);
      m.decompose(p, q, s);
      if (s.x < 0.001) continue; // skip zeroed instances
      result.push({ x: p.x, y: p.y, z: p.z, height: s.y * 0.9 });
    }
    return result;
  }

  update(playerPos: THREE.Vector3, dt: number, sunDir: THREE.Vector3, ambientColor: THREE.Color, ambientIntensity: number, fogColor: THREE.Color, fogDensity: number, cameraPos: THREE.Vector3) {
    const u = this.material.uniforms;
    u.uTime.value += dt;
    u.uPlayerPos.value.copy(playerPos);
    u.uSunDir.value.copy(sunDir);
    u.uAmbientColor.value.copy(ambientColor);
    u.uAmbientIntensity.value = ambientIntensity;
    u.uFogNearColor.value.copy(fogColor);
    u.uFogDensity.value = fogDensity;
    u.uCameraPos.value.copy(cameraPos);
  }

  // Wired to NatureManager sliders
  setWindParams(freq: number, amp: number, speed: number) {
    this.material.uniforms.uWindFreq.value  = freq;
    this.material.uniforms.uWindAmp.value   = amp;
    this.material.uniforms.uWindSpeed.value = speed;
  }
  setColors(base: THREE.Color, tip1: THREE.Color, tip2: THREE.Color) {
    this.material.uniforms.uBaseColor.value.copy(base);
    this.material.uniforms.uTipColor1.value.copy(tip1);
    this.material.uniforms.uTipColor2.value.copy(tip2);
  }
}
