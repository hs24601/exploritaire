/**
 * GodRayShader - Screen-space crepuscular rays (Mittring 2007)
 *
 * Creates volumetric light shaft effects by performing radial blur
 * from the sun position through an occluder map (terrain silhouettes).
 *
 * Two-pass technique:
 * - Pass 1: Render terrain silhouettes to occluder texture (sky=white, objects=black)
 * - Pass 2: Radial blur filter samples toward sun position, accumulating light
 */

import { Filter, GlProgram, Texture } from 'pixi.js';

const VERTEX_SHADER = /* glsl */ `
  in vec2 aPosition;
  out vec2 vTextureCoord;

  uniform vec4 uInputSize;
  uniform vec4 uOutputFrame;
  uniform vec4 uOutputTexture;

  vec4 filterVertexPosition(void) {
    vec2 position = aPosition * uOutputFrame.zw + uOutputFrame.xy;
    position.x = position.x * (2.0 / uOutputTexture.x) - 1.0;
    position.y = position.y * (2.0 / uOutputTexture.y * uOutputTexture.z) - uOutputTexture.z;
    return vec4(position, 0.0, 1.0);
  }

  vec2 filterTextureCoord(void) {
    return aPosition * (uOutputFrame.zw * uInputSize.zw);
  }

  void main(void) {
    gl_Position = filterVertexPosition();
    vTextureCoord = filterTextureCoord();
  }
`;

const FRAGMENT_SHADER = /* glsl */ `
  in vec2 vTextureCoord;
  out vec4 finalColor;

  uniform sampler2D uTexture;
  uniform sampler2D uOccluderMap;
  uniform vec2 uLightPos;       // Sun position in normalised screen coords [0..1]
  uniform float uExposure;      // Ray intensity multiplier (0.08–0.18)
  uniform float uDecay;         // Attenuation per step (0.96–0.99)
  uniform float uWeight;        // Per-sample contribution (0.03–0.06)
  uniform float uDensity;       // Sample spread; 1.0 = full screen radius
  uniform vec3 uRayColor;       // Tint color for the rays (biome-specific)
  uniform float uNoiseAmount;   // Amount of noise to break up banding (0.0–0.1)

  // Simple hash for noise
  float hash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
  }

  void main() {
    // Sample the original scene
    vec4 sceneColor = texture(uTexture, vTextureCoord);

    // Ray marching parameters
    vec2 uv = vTextureCoord;
    vec2 delta = (uv - uLightPos) / 64.0 * uDensity;
    float decay = 1.0;
    float accum = 0.0;

    // Add slight noise offset to break up banding artifacts
    float noise = hash(vTextureCoord * 100.0) * uNoiseAmount;
    uv -= delta * noise;

    // March toward the light source, sampling the occluder map
    for (int i = 0; i < 64; i++) {
      uv -= delta;

      // Clamp UV to valid range
      vec2 sampleUV = clamp(uv, 0.0, 1.0);

      // Sample occluder map - white = light passes, black = occluded
      float occluded = texture(uOccluderMap, sampleUV).r;

      // Accumulate light contribution
      accum += occluded * decay * uWeight;

      // Attenuate for next sample
      decay *= uDecay;
    }

    // Apply exposure and create ray color
    float rayIntensity = accum * uExposure;
    vec3 rays = uRayColor * rayIntensity;

    // Additive blend with scene - rays are added on top
    finalColor = vec4(sceneColor.rgb + rays, sceneColor.a);
  }
`;

export interface GodRayFilterOptions {
  /** Sun position in normalised screen coords [0..1], default [0.5, 0.2] (top center) */
  lightPos?: [number, number];
  /** Ray intensity multiplier, default 0.10 */
  exposure?: number;
  /** Attenuation per step, default 0.97 */
  decay?: number;
  /** Per-sample contribution, default 0.04 */
  weight?: number;
  /** Sample spread (1.0 = full screen radius), default 0.95 */
  density?: number;
  /** Tint color for the rays [r, g, b] in 0-1 range, default [1, 0.95, 0.8] warm sunlight */
  rayColor?: [number, number, number];
  /** Amount of noise to break up banding, default 0.03 */
  noiseAmount?: number;
  /** Occluder map texture (terrain silhouettes) */
  occluderMap?: Texture;
}

export class GodRayFilter extends Filter {
  private _occluderMap: Texture;

  constructor(options: GodRayFilterOptions = {}) {
    const glProgram = GlProgram.from({
      vertex: VERTEX_SHADER,
      fragment: FRAGMENT_SHADER,
    });

    const occluderMap = options.occluderMap ?? Texture.WHITE;

    super({
      glProgram,
      resources: {
        godRayUniforms: {
          uLightPos: { value: options.lightPos ?? [0.5, 0.2], type: 'vec2<f32>' },
          uExposure: { value: options.exposure ?? 0.10, type: 'f32' },
          uDecay: { value: options.decay ?? 0.97, type: 'f32' },
          uWeight: { value: options.weight ?? 0.04, type: 'f32' },
          uDensity: { value: options.density ?? 0.95, type: 'f32' },
          uRayColor: { value: options.rayColor ?? [1.0, 0.95, 0.8], type: 'vec3<f32>' },
          uNoiseAmount: { value: options.noiseAmount ?? 0.03, type: 'f32' },
        },
        uOccluderMap: occluderMap.source,
      },
    });

    this._occluderMap = occluderMap;
  }

  /** Sun position in normalised screen coords [0..1] */
  get lightPos(): [number, number] {
    const val = this.resources.godRayUniforms.uniforms.uLightPos;
    return [val[0], val[1]];
  }
  set lightPos(value: [number, number]) {
    this.resources.godRayUniforms.uniforms.uLightPos[0] = value[0];
    this.resources.godRayUniforms.uniforms.uLightPos[1] = value[1];
  }

  /** Ray intensity multiplier */
  get exposure(): number {
    return this.resources.godRayUniforms.uniforms.uExposure;
  }
  set exposure(value: number) {
    this.resources.godRayUniforms.uniforms.uExposure = value;
  }

  /** Attenuation per step */
  get decay(): number {
    return this.resources.godRayUniforms.uniforms.uDecay;
  }
  set decay(value: number) {
    this.resources.godRayUniforms.uniforms.uDecay = value;
  }

  /** Per-sample contribution */
  get weight(): number {
    return this.resources.godRayUniforms.uniforms.uWeight;
  }
  set weight(value: number) {
    this.resources.godRayUniforms.uniforms.uWeight = value;
  }

  /** Sample spread */
  get density(): number {
    return this.resources.godRayUniforms.uniforms.uDensity;
  }
  set density(value: number) {
    this.resources.godRayUniforms.uniforms.uDensity = value;
  }

  /** Ray tint color [r, g, b] in 0-1 range */
  get rayColor(): [number, number, number] {
    const val = this.resources.godRayUniforms.uniforms.uRayColor;
    return [val[0], val[1], val[2]];
  }
  set rayColor(value: [number, number, number]) {
    this.resources.godRayUniforms.uniforms.uRayColor[0] = value[0];
    this.resources.godRayUniforms.uniforms.uRayColor[1] = value[1];
    this.resources.godRayUniforms.uniforms.uRayColor[2] = value[2];
  }

  /** Amount of noise to break up banding */
  get noiseAmount(): number {
    return this.resources.godRayUniforms.uniforms.uNoiseAmount;
  }
  set noiseAmount(value: number) {
    this.resources.godRayUniforms.uniforms.uNoiseAmount = value;
  }

  /** The occluder map texture (terrain silhouettes) */
  get occluderMap(): Texture {
    return this._occluderMap;
  }
  set occluderMap(value: Texture) {
    this._occluderMap = value;
    this.resources.uOccluderMap = value.source;
  }
}

/**
 * Biome-specific god ray parameters
 * exposure: how intense the rays are
 * color: RGB tint for the rays (0-1 range)
 */
export const BIOME_RAY_PARAMS: Record<string, { exposure: number; color: [number, number, number] }> = {
  forest:   { exposure: 0.10, color: [0.78, 0.95, 0.55] },  // green-gold dapple
  mountain: { exposure: 0.08, color: [0.75, 0.88, 1.00] },  // ice-blue alpine
  desert:   { exposure: 0.18, color: [1.00, 0.88, 0.45] },  // harsh amber
  dungeon:  { exposure: 0.00, color: [0.00, 0.00, 0.00] },  // no rays — darkness
  plains:   { exposure: 0.09, color: [0.88, 0.98, 0.65] },  // soft daylight
};

export default GodRayFilter;
