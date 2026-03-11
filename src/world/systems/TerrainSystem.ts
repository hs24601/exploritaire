import * as THREE from 'three';
import { TERRAIN_VERT, TERRAIN_FRAG } from '../shaders/terrainShader';

// World constants — change these to scale the terrain
export const WORLD_SIZE = 500;
export const WATER_LEVEL = 0;
export const MAX_HEIGHT = 25;

const GRID = 256; // segments per side — 257×257 vertices
const HALF = WORLD_SIZE / 2;

export class TerrainSystem {
  private heightData: Float32Array;
  private gridN: number; // number of height samples per side = GRID+1
  public readonly mesh: THREE.Mesh;
  public readonly material: THREE.ShaderMaterial;

  constructor() {
    this.gridN = GRID + 1;
    this.heightData = new Float32Array(this.gridN * this.gridN);
    this.generateHeightmap();

    this.material = new THREE.ShaderMaterial({
      vertexShader: TERRAIN_VERT,
      fragmentShader: TERRAIN_FRAG,
      uniforms: {
        uGrassColor:      { value: new THREE.Color(0x4a7c35) },
        uBeachColor:      { value: new THREE.Color(0xd4b87a) },
        uRockColor:       { value: new THREE.Color(0x7a6e5a) },
        uSunDir:          { value: new THREE.Vector3(0.5, 1, 0.3).normalize() },
        uAmbientColor:    { value: new THREE.Color(0.9, 0.9, 1.0) },
        uAmbientIntensity:{ value: 0.45 },
        uShadowDarkness:  { value: 0.6 },
        uMaxHeight:       { value: MAX_HEIGHT },
        uNoiseScale:      { value: 3.0 },
        uFogNearColor:    { value: new THREE.Color(0.7, 0.85, 1.0) },
        uFogFarColor:     { value: new THREE.Color(0.6, 0.75, 0.95) },
        uFogDensity:      { value: 0.0008 },
        uFogHeight:       { value: 0.05 },
        uCameraPos:       { value: new THREE.Vector3() },
      },
    });

    this.mesh = this.buildMesh();
  }

  // ── Heightmap generation ────────────────────────────────────────────────

  private generateHeightmap() {
    const N = this.gridN;
    for (let zi = 0; zi < N; zi++) {
      for (let xi = 0; xi < N; xi++) {
        const nx = xi / (N - 1) - 0.5; // -0.5..0.5
        const nz = zi / (N - 1) - 0.5;
        this.heightData[zi * N + xi] = this.computeHeight(nx, nz);
      }
    }
  }

  private computeHeight(nx: number, nz: number): number {
    // Island mask: falloff from center
    const dist = Math.sqrt(nx * nx + nz * nz) / 0.5;
    const mask = Math.max(0, 1.0 - dist * dist * 2.4);

    // Multi-frequency "FBM-lite" via summed trig — no external noise lib needed
    let h = 0;
    h += Math.sin(nx * 8.3  + nz * 6.1)  * 0.35;
    h += Math.sin(nx * 15.7 - nz * 11.3) * 0.18;
    h += Math.sin(nx * 31.1 + nz * 26.2) * 0.09;
    h += Math.cos(nx * 5.2  + nz * 7.4)  * 0.28;
    h += Math.cos(nx * 12.9 - nz * 8.6)  * 0.14;
    h += Math.sin(nx * 22.0 + nz * 19.0) * 0.06;
    // Ridge-like details
    h += (1.0 - Math.abs(Math.sin(nx * 18 + nz * 14))) * 0.1;
    h = (h + 1.0) * 0.5; // normalize roughly to 0-1

    return Math.max(0, h * mask) * MAX_HEIGHT;
  }

  // ── Mesh construction ───────────────────────────────────────────────────

  private buildMesh(): THREE.Mesh {
    const geo = new THREE.PlaneGeometry(WORLD_SIZE, WORLD_SIZE, GRID, GRID);
    // PlaneGeometry lies on XY, rotate to XZ
    geo.rotateX(-Math.PI / 2);

    const pos = geo.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < pos.count; i++) {
      const wx = pos.getX(i);
      const wz = pos.getZ(i);
      pos.setY(i, this.getHeight(wx, wz));
    }
    pos.needsUpdate = true;
    geo.computeVertexNormals();

    const mesh = new THREE.Mesh(geo, this.material);
    mesh.name = 'terrain';
    mesh.receiveShadow = true;
    return mesh;
  }

  // ── CPU height query (bilinear) ─────────────────────────────────────────

  getHeight(worldX: number, worldZ: number): number {
    const N = this.gridN;
    // Map world coords to heightmap indices
    const hx = (worldX + HALF) / WORLD_SIZE * (N - 1);
    const hz = (worldZ + HALF) / WORLD_SIZE * (N - 1);

    if (hx < 0 || hx >= N - 1 || hz < 0 || hz >= N - 1) return 0;

    const x0 = Math.floor(hx), x1 = x0 + 1;
    const z0 = Math.floor(hz), z1 = z0 + 1;
    const tx = hx - x0;
    const tz = hz - z0;

    const h00 = this.heightData[z0 * N + x0];
    const h10 = this.heightData[z0 * N + x1];
    const h01 = this.heightData[z1 * N + x0];
    const h11 = this.heightData[z1 * N + x1];

    // Bilinear interpolation (matches Elysium formula)
    return (1 - tz) * ((1 - tx) * h00 + tx * h10)
           + tz    * ((1 - tx) * h01 + tx * h11);
  }

  /** Approximate terrain normal at a world point (for grass tilt etc.) */
  getNormal(wx: number, wz: number, step = 1.5): THREE.Vector3 {
    const hL = this.getHeight(wx - step, wz);
    const hR = this.getHeight(wx + step, wz);
    const hD = this.getHeight(wx, wz - step);
    const hU = this.getHeight(wx, wz + step);
    return new THREE.Vector3(hL - hR, 2 * step, hD - hU).normalize();
  }

  /** Is this world position in a grass-friendly zone? */
  isGrassZone(wx: number, wz: number): boolean {
    const h = this.getHeight(wx, wz);
    if (h < 0.5 || h > MAX_HEIGHT * 0.75) return false;
    const n = this.getNormal(wx, wz);
    const slope = 1.0 - n.y;
    return slope < 0.45;
  }
}
