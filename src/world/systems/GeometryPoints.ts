import * as THREE from 'three';
import { GEO_POINT_VERT, GEO_POINT_FRAG } from '../shaders/geoPointShader';

type GrassBlade = { x: number; y: number; z: number; height: number };
type TreePos    = { x: number; y: number; z: number; sw: number; sh: number };

const CT_GRASS_BASE  = 0;
const CT_GRASS_TIP   = 1;
const CT_TRUNK       = 2;
const CT_FOLIAGE_LOW = 3;
const CT_FOLIAGE_HI  = 4;

// Grafting settings
const TRUNK_PTS_PER_RIB = 30;
const CANOPY_PTS_PER_RIB = 40;
const RIB_COUNT = 8; // Number of vertical ribs on each cone/trunk

const CONES = [
  { yBase: 1.4, height: 3.6, rBase: 2.3 },
  { yBase: 3.0, height: 2.9, rBase: 1.7 },
  { yBase: 4.6, height: 2.3, rBase: 1.0 },
];

function buildGraftedPoints(grass: GrassBlade[], trees: TreePos[]) {
  // Total points estimation: Ribs + Bottom rings
  const ptsPerTree = (RIB_COUNT * TRUNK_PTS_PER_RIB) + (CONES.length * RIB_COUNT * CANOPY_PTS_PER_RIB);
  const total = grass.length * 3 + trees.length * ptsPerTree;

  const positions  = new Float32Array(total * 3);
  const seeds      = new Float32Array(total);
  const phases     = new Float32Array(total);
  const colorTypes = new Float32Array(total);

  let idx = 0;
  const write = (x: number, y: number, z: number, seed: number, ct: number) => {
    positions[idx * 3]     = x;
    positions[idx * 3 + 1] = y;
    positions[idx * 3 + 2] = z;
    seeds[idx]      = seed;
    phases[idx]     = Math.random() * Math.PI * 2;
    colorTypes[idx] = ct;
    idx++;
  };

  // Grass remains on-surface
  for (const b of grass) {
    const seed = Math.random();
    write(b.x, b.y + 0.05,           b.z, seed, CT_GRASS_BASE);
    write(b.x, b.y + b.height * 0.5, b.z, seed, CT_GRASS_BASE);
    write(b.x, b.y + b.height * 0.9, b.z, seed, CT_GRASS_TIP);
  }

  // Graft points to Tree Scaffold
  for (const tree of trees) {
    const seed = Math.random();
    // 1. Trunk ribs
    for (let r = 0; r < RIB_COUNT; r++) {
      const angle = (r / RIB_COUNT) * Math.PI * 2;
      const cosA = Math.cos(angle) * 0.22 * tree.sw;
      const sinA = Math.sin(angle) * 0.22 * tree.sw;
      for (let i = 0; i < TRUNK_PTS_PER_RIB; i++) {
        const h = (i / (TRUNK_PTS_PER_RIB - 1)) * 2.5 * tree.sh;
        write(tree.x + cosA, tree.y + h, tree.z + sinA, seed, CT_TRUNK);
      }
    }
    // 2. Canopy cone ribs
    for (const cone of CONES) {
      for (let r = 0; r < RIB_COUNT; r++) {
        const angle = (r / RIB_COUNT) * Math.PI * 2;
        const cosA = Math.cos(angle);
        const sinA = Math.sin(angle);
        for (let i = 0; i < CANOPY_PTS_PER_RIB; i++) {
          const t = i / (CANOPY_PTS_PER_RIB - 1);
          const h = cone.yBase + t * cone.height;
          const radius = cone.rBase * (1.0 - t) * tree.sw;
          const ct = (h * tree.sh > 4.5) ? CT_FOLIAGE_HI : CT_FOLIAGE_LOW;
          write(tree.x + cosA * radius, tree.y + h * tree.sh, tree.z + sinA * radius, seed, ct);
        }
      }
    }
  }
  return { positions, seeds, phases, colorTypes };
}

export class GeometryPoints {
  public readonly points: THREE.Points;
  private material: THREE.ShaderMaterial;

  constructor(grass: GrassBlade[], trees: TreePos[]) {
    const { positions, seeds, phases, colorTypes } = buildGraftedPoints(grass, trees);
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position',   new THREE.Float32BufferAttribute(positions,  3));
    geo.setAttribute('aSeed',      new THREE.Float32BufferAttribute(seeds,      1));
    geo.setAttribute('aPhase',     new THREE.Float32BufferAttribute(phases,     1));
    geo.setAttribute('aColorType', new THREE.Float32BufferAttribute(colorTypes, 1));

    this.material = new THREE.ShaderMaterial({
      vertexShader:   GEO_POINT_VERT,
      fragmentShader: GEO_POINT_FRAG,
      uniforms: {
        uTime:          { value: 0 },
        uDriftAmp:      { value: 0.25 }, // Tight structural sway
        uDriftSpeed:    { value: 1.5 },
        uBasePointSize: { value: 4.5 },
        uGrassBase:   { value: new THREE.Color(0x70b850) },
        uGrassTip:    { value: new THREE.Color(0xa8e868) },
        uTrunkColor:  { value: new THREE.Color(0xd8c090) },
        uFoliageLow:  { value: new THREE.Color(0x508838) },
        uFoliageHigh: { value: new THREE.Color(0x88cc58) },
        uCameraPos:  { value: new THREE.Vector3() },
        uFogDensity: { value: 0.0008 },
      },
      transparent: true,
      depthWrite:  false,
      depthTest:   false,
      blending:    THREE.AdditiveBlending,
    });

    this.points = new THREE.Points(geo, this.material);
    this.points.name = 'geometryPoints';
    this.points.frustumCulled = false;
    this.points.renderOrder = 2;
  }

  update(dt: number, fogDensity: number, cameraPos: THREE.Vector3) {
    const u = this.material.uniforms;
    u.uTime.value       += dt;
    u.uFogDensity.value  = fogDensity;
    u.uCameraPos.value.copy(cameraPos);
  }
}
