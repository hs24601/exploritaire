import * as THREE from 'three';
import { PARTICLE_VERT, PARTICLE_FRAG } from '../shaders/particleShader';
import { TerrainSystem, WORLD_SIZE, WATER_LEVEL } from './TerrainSystem';

// Total particle budget
const PARTICLE_COUNT = 100_000; // Increased from 55k

// Adjust layer fractions
const FRAC_GROUND  = 0.35; // Still dense terrain coat
const FRAC_GRASS   = 0.15; // Grass band
const FRAC_CANOPY  = 0.40; // Increased volume particles in trees
const FRAC_AIR     = 0.10; // Floating motes

const N_GROUND  = Math.floor(PARTICLE_COUNT * FRAC_GROUND);
const N_GRASS   = Math.floor(PARTICLE_COUNT * FRAC_GRASS);
const N_CANOPY  = Math.floor(PARTICLE_COUNT * FRAC_CANOPY);
const N_AIR     = PARTICLE_COUNT - N_GROUND - N_GRASS - N_CANOPY;

const SPREAD_XZ = 300;

type TreePos = { x: number; y: number; z: number; sw: number; sh: number };

function buildAttributes(terrain: TerrainSystem, trees: TreePos[]) {
  const positions = new Float32Array(PARTICLE_COUNT * 3);
  const seeds     = new Float32Array(PARTICLE_COUNT);
  const phases    = new Float32Array(PARTICLE_COUNT);
  let idx = 0;
  const write = (wx: number, wy: number, wz: number, seed: number) => {
    positions[idx * 3]     = wx;
    positions[idx * 3 + 1] = wy;
    positions[idx * 3 + 2] = wz;
    seeds[idx]  = seed;
    phases[idx] = Math.random() * Math.PI * 2;
    idx++;
  };

  const half = SPREAD_XZ / 2;
  let groundPlaced = 0;
  let att = 0;
  while (groundPlaced < N_GROUND && att < N_GROUND * 6) {
    att++;
    const wx = (Math.random() - 0.5) * SPREAD_XZ;
    const wz = (Math.random() - 0.5) * SPREAD_XZ;
    const gh = terrain.getHeight(wx, wz);
    if (gh <= WATER_LEVEL + 0.2) continue;
    write(wx, gh + Math.random() * 0.5, wz, Math.random() * 0.30);
    groundPlaced++;
  }

  let grassPlaced = 0;
  att = 0;
  while (grassPlaced < N_GRASS && att < N_GRASS * 6) {
    att++;
    const wx = (Math.random() - 0.5) * SPREAD_XZ;
    const wz = (Math.random() - 0.5) * SPREAD_XZ;
    if (!terrain.isGrassZone(wx, wz)) continue;
    const gh = terrain.getHeight(wx, wz);
    write(wx, gh + 0.3 + Math.random() * 2.2, wz, 0.30 + Math.random() * 0.25);
    grassPlaced++;
  }

  if (trees.length > 0) {
    const cones = [
      { yBase: 1.4, height: 3.6, rBase: 2.3 },
      { yBase: 3.0, height: 2.9, rBase: 1.7 },
      { yBase: 4.6, height: 2.3, rBase: 1.0 },
    ];
    for (let i = 0; i < N_CANOPY; i++) {
      const tree = trees[Math.floor(Math.random() * trees.length)];
      const cone = cones[Math.floor(Math.random() * cones.length)];
      const t    = Math.random();
      const localY = cone.yBase + t * cone.height;
      const maxR   = cone.rBase * (1.0 - t * 0.92) * tree.sw;
      const r      = Math.sqrt(Math.random()) * maxR; 
      write(tree.x + Math.cos(Math.random() * 6.28) * r, tree.y + localY * tree.sh, tree.z + Math.sin(Math.random() * 6.28) * r, 0.55 + Math.random() * 0.30);
    }
  }

  let airPlaced = 0;
  att = 0;
  while (airPlaced < N_AIR && att < N_AIR * 6) {
    att++;
    const wx = (Math.random() - 0.5) * SPREAD_XZ;
    const wz = (Math.random() - 0.5) * SPREAD_XZ;
    const gh = terrain.getHeight(wx, wz);
    if (gh <= WATER_LEVEL + 0.2) continue;
    write(wx, gh + 1.0 + Math.random() * 8.0, wz, Math.random());
    airPlaced++;
  }
  return { positions, seeds, phases };
}

export class ForestParticleSystem {
  public readonly points: THREE.Points;
  private material: THREE.ShaderMaterial;
  constructor(terrain: TerrainSystem, trees: TreePos[] = []) {
    const { positions, seeds, phases } = buildAttributes(terrain, trees);
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geo.setAttribute('aSeed',    new THREE.Float32BufferAttribute(seeds,  1));
    geo.setAttribute('aPhase',   new THREE.Float32BufferAttribute(phases, 1));
    this.material = new THREE.ShaderMaterial({
      vertexShader:   PARTICLE_VERT,
      fragmentShader: PARTICLE_FRAG,
      uniforms: {
        uTime:          { value: 0 },
        uDriftSpeed:    { value: 0.85 },
        uDriftAmp:      { value: 0.55 },
        uBasePointSize: { value: 3.2 }, // Slightly larger points for fuller volume
        uColorA:    { value: new THREE.Color(0xf0eaf8) },
        uColorB:    { value: new THREE.Color(0xc8b0e0) },
        uColorC:    { value: new THREE.Color(0x7860a8) },
        uColorGold: { value: new THREE.Color(0xf8d040) },
        uCameraPos:  { value: new THREE.Vector3() },
        uFogDensity: { value: 0.0008 },
      },
      transparent: true,
      depthWrite:  false,
      depthTest:   false,
      blending:    THREE.AdditiveBlending,
    });
    this.points = new THREE.Points(geo, this.material);
    this.points.name = 'forestParticles';
    this.points.frustumCulled = false;
    this.points.renderOrder = 1;
  }
  update(dt: number, fogColor: THREE.Color, fogDensity: number, cameraPos: THREE.Vector3) {
    const u = this.material.uniforms;
    u.uTime.value       += dt;
    u.uFogDensity.value  = fogDensity;
    u.uCameraPos.value.copy(cameraPos);
  }
}
