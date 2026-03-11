import * as THREE from 'three';
import { FOX_KIT } from '../assets/FoxKit';
import { PARTICLE_VERT, PARTICLE_FRAG } from '../shaders/particleShader';
import { TerrainSystem } from './TerrainSystem';

const PTS_PER_EDGE = 40;

function buildGraftedPoints(x: number, z: number, terrain: TerrainSystem) {
  // A box has 12 edges.
  const edgesPerBox = 12;
  const totalPts = FOX_KIT.length * edgesPerBox * PTS_PER_EDGE;
  
  const positions = new Float32Array(totalPts * 3);
  const seeds     = new Float32Array(totalPts);
  const phases    = new Float32Array(totalPts);

  const y = terrain.getHeight(x, z);
  const foxOrigin = new THREE.Vector3(x, y, z);
  
  let idx = 0;

  for (const part of FOX_KIT) {
    const half = part.scale.clone().multiplyScalar(0.5);
    
    // Define the 12 edges of a box in local space
    const corners = [
      new THREE.Vector3(-half.x, -half.y, -half.z),
      new THREE.Vector3( half.x, -half.y, -half.z),
      new THREE.Vector3( half.x,  half.y, -half.z),
      new THREE.Vector3(-half.x,  half.y, -half.z),
      new THREE.Vector3(-half.x, -half.y,  half.z),
      new THREE.Vector3( half.x, -half.y,  half.z),
      new THREE.Vector3( half.x,  half.y,  half.z),
      new THREE.Vector3(-half.x,  half.y,  half.z),
    ];

    const edgeIndices = [
      [0,1], [1,2], [2,3], [3,0], // back
      [4,5], [5,6], [6,7], [7,4], // front
      [0,4], [1,5], [2,6], [3,7]  // connectors
    ];

    for (const [startIdx, endIdx] of edgeIndices) {
      const start = corners[startIdx];
      const end = corners[endIdx];
      
      for (let i = 0; i < PTS_PER_EDGE; i++) {
        const t = i / (PTS_PER_EDGE - 1);
        const p = new THREE.Vector3().lerpVectors(start, end, t);
        
        p.applyEuler(part.rot);
        p.add(part.pos);
        p.add(foxOrigin);
        
        positions[idx * 3]     = p.x;
        positions[idx * 3 + 1] = p.y;
        positions[idx * 3 + 2] = p.z;
        
        seeds[idx]  = Math.random();
        phases[idx] = Math.random() * Math.PI * 2;
        idx++;
      }
    }
  }
  
  return { positions, seeds, phases };
}

export class FoxSystem {
  public readonly points: THREE.Points;
  private material: THREE.ShaderMaterial;

  constructor(x: number, z: number, terrain: TerrainSystem) {
    const { positions, seeds, phases } = buildGraftedPoints(x, z, terrain);

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geo.setAttribute('aSeed',    new THREE.Float32BufferAttribute(seeds,  1));
    geo.setAttribute('aPhase',   new THREE.Float32BufferAttribute(phases, 1));

    this.material = new THREE.ShaderMaterial({
      vertexShader:   PARTICLE_VERT,
      fragmentShader: PARTICLE_FRAG,
      uniforms: {
        uTime:          { value: 0 },
        uDriftSpeed:    { value: 1.2 },
        uDriftAmp:      { value: 0.15 }, // Tight vibration around the scaffold
        uBasePointSize: { value: 3.5 },
        uColorA:    { value: new THREE.Color(0x1a0d06) },
        uColorB:    { value: new THREE.Color(0x3d1400) },
        uColorC:    { value: new THREE.Color(0x050302) },
        uColorGold: { value: new THREE.Color(0xffffff) },
        uCameraPos:  { value: new THREE.Vector3() },
        uFogDensity: { value: 0.0008 },
      },
      transparent: true,
      depthWrite:  false,
      depthTest:   true, 
      blending:    THREE.AdditiveBlending,
    });

    this.points = new THREE.Points(geo, this.material);
    this.points.name = 'foxParticles';
    this.points.frustumCulled = false;
    this.points.renderOrder = 10;
  }

  update(dt: number, fogDensity: number, cameraPos: THREE.Vector3) {
    const u = this.material.uniforms;
    u.uTime.value       += dt;
    u.uFogDensity.value  = fogDensity;
    u.uCameraPos.value.copy(cameraPos);
  }
}
