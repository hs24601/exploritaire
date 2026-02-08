/**
 * GranulationShader - GLSL shader for paper texture granulation
 *
 * Creates natural paper grain effects:
 * - Perlin-style noise for fiber texture
 * - Directional grain following fiber angle
 * - Color variation for subtle imperfections
 */

import { Filter, GlProgram } from 'pixi.js';

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
  uniform float uTime;
  uniform float uGrainIntensity;
  uniform float uGrainScale;
  uniform float uFiberAngle;
  uniform vec4 uBaseColor;

  // Simplex-style 2D noise
  vec3 mod289(vec3 x) {
    return x - floor(x * (1.0 / 289.0)) * 289.0;
  }

  vec2 mod289(vec2 x) {
    return x - floor(x * (1.0 / 289.0)) * 289.0;
  }

  vec3 permute(vec3 x) {
    return mod289(((x * 34.0) + 1.0) * x);
  }

  float snoise(vec2 v) {
    const vec4 C = vec4(
      0.211324865405187,  // (3.0-sqrt(3.0))/6.0
      0.366025403784439,  // 0.5*(sqrt(3.0)-1.0)
      -0.577350269189626, // -1.0 + 2.0 * C.x
      0.024390243902439   // 1.0 / 41.0
    );

    vec2 i = floor(v + dot(v, C.yy));
    vec2 x0 = v - i + dot(i, C.xx);

    vec2 i1;
    i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);

    vec4 x12 = x0.xyxy + C.xxzz;
    x12.xy -= i1;

    i = mod289(i);
    vec3 p = permute(permute(i.y + vec3(0.0, i1.y, 1.0)) + i.x + vec3(0.0, i1.x, 1.0));

    vec3 m = max(0.5 - vec3(dot(x0, x0), dot(x12.xy, x12.xy), dot(x12.zw, x12.zw)), 0.0);
    m = m * m;
    m = m * m;

    vec3 x = 2.0 * fract(p * C.www) - 1.0;
    vec3 h = abs(x) - 0.5;
    vec3 ox = floor(x + 0.5);
    vec3 a0 = x - ox;

    m *= 1.79284291400159 - 0.85373472095314 * (a0 * a0 + h * h);

    vec3 g;
    g.x = a0.x * x0.x + h.x * x0.y;
    g.yz = a0.yz * x12.xz + h.yz * x12.yw;

    return 130.0 * dot(m, g);
  }

  // Fractal Brownian Motion
  float fbm(vec2 p, int octaves) {
    float value = 0.0;
    float amplitude = 0.5;
    float frequency = 1.0;

    for (int i = 0; i < 6; i++) {
      if (i >= octaves) break;
      value += amplitude * snoise(p * frequency);
      amplitude *= 0.5;
      frequency *= 2.0;
    }

    return value;
  }

  void main(void) {
    vec4 color = texture(uTexture, vTextureCoord);

    // Calculate fiber-aligned coordinates
    float angle = uFiberAngle;
    mat2 rotation = mat2(cos(angle), -sin(angle), sin(angle), cos(angle));
    vec2 rotatedCoord = rotation * vTextureCoord * uGrainScale * 100.0;

    // Multi-octave noise for paper grain
    float grain = fbm(rotatedCoord, 4);

    // Fiber direction influence (stretched noise along fiber direction)
    vec2 fiberCoord = vec2(rotatedCoord.x * 0.3, rotatedCoord.y);
    float fiberNoise = snoise(fiberCoord * 0.5) * 0.3;

    // Combine grain effects
    float combinedGrain = grain * 0.6 + fiberNoise * 0.4;

    // Apply grain to color
    float grainEffect = combinedGrain * uGrainIntensity;

    // Mix between darkening and lightening based on noise value
    vec3 grainColor;
    if (grainEffect > 0.0) {
      grainColor = mix(color.rgb, vec3(1.0), grainEffect * 0.5);
    } else {
      grainColor = mix(color.rgb, vec3(0.0), -grainEffect * 0.5);
    }

    finalColor = vec4(grainColor, color.a);
  }
`;

export interface GranulationFilterOptions {
  time?: number;
  grainIntensity?: number;
  grainScale?: number;
  fiberAngle?: number;
  baseColor?: [number, number, number, number];
}

export class GranulationFilter extends Filter {
  constructor(options: GranulationFilterOptions = {}) {
    const glProgram = GlProgram.from({
      vertex: VERTEX_SHADER,
      fragment: FRAGMENT_SHADER,
    });

    super({
      glProgram,
      resources: {
        granulationUniforms: {
          uTime: { value: options.time ?? 0, type: 'f32' },
          uGrainIntensity: { value: options.grainIntensity ?? 0.15, type: 'f32' },
          uGrainScale: { value: options.grainScale ?? 1.0, type: 'f32' },
          uFiberAngle: { value: options.fiberAngle ?? 0, type: 'f32' },
          uBaseColor: { value: options.baseColor ?? [0.96, 0.95, 0.92, 1.0], type: 'vec4<f32>' },
        },
      },
    });
  }

  get time(): number {
    return this.resources.granulationUniforms.uniforms.uTime;
  }
  set time(value: number) {
    this.resources.granulationUniforms.uniforms.uTime = value;
  }

  get grainIntensity(): number {
    return this.resources.granulationUniforms.uniforms.uGrainIntensity;
  }
  set grainIntensity(value: number) {
    this.resources.granulationUniforms.uniforms.uGrainIntensity = value;
  }

  get grainScale(): number {
    return this.resources.granulationUniforms.uniforms.uGrainScale;
  }
  set grainScale(value: number) {
    this.resources.granulationUniforms.uniforms.uGrainScale = value;
  }

  get fiberAngle(): number {
    return this.resources.granulationUniforms.uniforms.uFiberAngle;
  }
  set fiberAngle(value: number) {
    this.resources.granulationUniforms.uniforms.uFiberAngle = value;
  }
}

export default GranulationFilter;
