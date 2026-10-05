import * as THREE from 'three';
import { TREE_VERT, TREE_FRAG } from '../shaders/treeShader';
import { TerrainSystem } from './TerrainSystem';

const TREE_COUNT = 1; // Only one tree now

function addCylinder(pos: number[], nor: number[], uv: number[], idx: number[], rBottom: number, rTop: number, height: number, yOffset: number, segs: number) {
  const base = pos.length / 3;
  for (let i = 0; i <= segs; i++) {
    const theta = (i / segs) * Math.PI * 2;
    const c = Math.cos(theta), s = Math.sin(theta);
    pos.push(rBottom * c, yOffset, rBottom * s); nor.push(c, 0, s); uv.push(i / segs, 0);
    pos.push(rTop * c, yOffset + height, rTop * s); nor.push(c, 0, s); uv.push(i / segs, 1);
  }
  for (let i = 0; i < segs; i++) {
    const b = base + i * 2;
    idx.push(b, b + 2, b + 1, b + 1, b + 2, b + 3);
  }
}

function addCone(pos: number[], nor: number[], uv: number[], idx: number[], radius: number, height: number, yOffset: number, segs: number) {
  const base = pos.length / 3;
  const len = Math.sqrt(radius * radius + height * height);
  const ny = radius / len; const nl = height / len;
  for (let i = 0; i <= segs; i++) {
    const theta = (i / segs) * Math.PI * 2;
    const c = Math.cos(theta), s = Math.sin(theta);
    pos.push(radius * c, yOffset, radius * s); nor.push(nl * c, ny, nl * s); uv.push(i / segs, 0);
  }
  const tip = pos.length / 3;
  pos.push(0, yOffset + height, 0); nor.push(0, 1, 0); uv.push(0.5, 1);
  for (let i = 0; i < segs; i++) { idx.push(base + i, tip, base + i + 1); }
}

function buildTreeGeometry(): THREE.BufferGeometry {
  const pos: number[] = [], nor: number[] = [], uv: number[] = [], idx: number[] = [];
  addCylinder(pos, nor, uv, idx, 0.22, 0.15, 2.5, 0.0, 6);
  addCone(pos, nor, uv, idx, 2.3, 3.6, 1.4, 8);
  addCone(pos, nor, uv, idx, 1.7, 2.9, 3.0, 8);
  addCone(pos, nor, uv, idx, 1.0, 2.3, 4.6, 8);
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  geo.setIndex(idx);
  return geo;
}

export class TreeSystem {
  public readonly mesh: THREE.InstancedMesh;
  public readonly wireMesh: THREE.InstancedMesh;
  private material: THREE.ShaderMaterial;
  private wireMaterial: THREE.ShaderMaterial;

  constructor(terrain: TerrainSystem) {
    const uniforms = {
      uTime: { value: 0 }, uWindFreq: { value: 0.8 }, uWindAmp: { value: 0.12 }, uWindSpeed: { value: 0.4 },
      uTrunkColor: { value: new THREE.Color(0x4a2c0e) }, uFoliageColorA: { value: new THREE.Color(0x1e4d12) },
      uFoliageColorB: { value: new THREE.Color(0x3a7a22) }, uSunDir: { value: new THREE.Vector3(0.5, 1, 0.3).normalize() },
      uAmbientColor: { value: new THREE.Color(0.9, 1.0, 0.85) }, uAmbientIntensity: { value: 0.5 },
      uFogNearColor: { value: new THREE.Color(0.7, 0.85, 1.0) }, uFogDensity: { value: 0.0008 }, uCameraPos: { value: new THREE.Vector3() },
    };
    this.material = new THREE.ShaderMaterial({ vertexShader: TREE_VERT, fragmentShader: TREE_FRAG, uniforms: THREE.UniformsUtils.clone(uniforms), side: THREE.FrontSide });
    this.wireMaterial = new THREE.ShaderMaterial({
      vertexShader: TREE_VERT,
      fragmentShader: 'precision highp float; uniform vec3 uWireColor; uniform vec3 uFogNearColor; uniform float uFogDensity; uniform vec3 uCameraPos; varying vec3 vWorldPos; void main() { float dist = length(vWorldPos - uCameraPos); float fogFactor = clamp(1.0 - exp(-uFogDensity * dist), 0.0, 0.95); vec3 color = mix(uWireColor, uFogNearColor, fogFactor); gl_FragColor = vec4(color, 0.6); }',
      uniforms: { ...THREE.UniformsUtils.clone(uniforms), uWireColor: { value: new THREE.Color(0x1a0d06) } },
      wireframe: true, transparent: true, depthWrite: false
    });
    const geo = buildTreeGeometry();
    this.mesh = new THREE.InstancedMesh(geo, this.material, TREE_COUNT);
    this.wireMesh = new THREE.InstancedMesh(geo, this.wireMaterial, TREE_COUNT);
    
    // Place one tree at a fixed central location
    const mat = new THREE.Matrix4().compose(
      new THREE.Vector3(0, terrain.getHeight(0, 15), 15), 
      new THREE.Quaternion(), 
      new THREE.Vector3(1.2, 1.2, 1.2)
    );
    this.mesh.setMatrixAt(0, mat);
    this.wireMesh.setMatrixAt(0, mat);
  }

  getTreePositions() {
    const m = new THREE.Matrix4(); const p = new THREE.Vector3(); const q = new THREE.Quaternion(); const s = new THREE.Vector3();
    this.mesh.getMatrixAt(0, m); m.decompose(p, q, s);
    return [{ x: p.x, y: p.y, z: p.z, sw: s.x, sh: s.y }];
  }

  update(dt: number, sunDir: THREE.Vector3, ambientColor: THREE.Color, ambientIntensity: number, fogColor: THREE.Color, fogDensity: number, cameraPos: THREE.Vector3) {
    [this.material, this.wireMaterial].forEach(m => {
      const u = m.uniforms; u.uTime.value += dt; u.uSunDir.value.copy(sunDir); u.uAmbientColor.value.copy(ambientColor);
      u.uAmbientIntensity.value = ambientIntensity; u.uFogNearColor.value.copy(fogColor); u.uFogDensity.value = fogDensity; u.uCameraPos.value.copy(cameraPos);
    });
  }
}
