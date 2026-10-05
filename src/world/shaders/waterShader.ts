// Stylized water shader — wave displacement + depth-buffer foam + shallow/deep color

export const WATER_VERT = /* glsl */`
varying vec4 vClipPos;  // for screen-space depth sampling
varying vec2 vUv;
varying vec3 vWorldPos;

uniform float uTime;
uniform float uWaveFreq;
uniform float uWaveAmp;
uniform float uWaveSpeed;

void main() {
  vUv = uv;
  vec3 pos = position;

  // Gerstner-style wave: product of two perpendicular sines → Elysium formula
  float freq = uWaveFreq * 0.1;
  float elevation = sin(pos.x * freq + uTime * uWaveSpeed)
                  * sin(pos.z * freq + uTime * uWaveSpeed)
                  * uWaveAmp;

  // Fade waves at extreme distances to avoid popping at horizon
  float horizonFade = 1.0 - smoothstep(200.0, 500.0, length(pos.xz));
  pos.y += elevation * horizonFade;

  vec4 worldPos4 = modelMatrix * vec4(pos, 1.0);
  vWorldPos = worldPos4.xyz;

  gl_Position = projectionMatrix * viewMatrix * worldPos4;
  vClipPos = gl_Position; // capture before hardware divide
}
`;

export const WATER_FRAG = /* glsl */`
precision highp float;

varying vec4 vClipPos;
varying vec2 vUv;
varying vec3 vWorldPos;

uniform sampler2D uDepthTexture;
uniform float uCameraNear;
uniform float uCameraFar;

uniform vec3 uFoamColor;
uniform vec3 uShallowColor;
uniform vec3 uDeepColor;

uniform float uDepthSoftness;  // controls how quickly water transitions shallow→deep
uniform float uFoamSoftness;   // width of foam band at shore

uniform float uTime;
uniform float uFoamScale;
uniform float uFoamSpeed;

// Fog
uniform vec3 uFogNearColor;
uniform float uFogDensity;
uniform vec3 uCameraPos;

// Convert [0,1] depth buffer value to linear view depth
float toLinearDepth(float depth) {
  return uCameraNear * uCameraFar / (uCameraFar - depth * (uCameraFar - uCameraNear));
}

// Simple fbm for foam pattern
float hash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
}
float noiseF(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(
    mix(hash(i), hash(i + vec2(1,0)), f.x),
    mix(hash(i + vec2(0,1)), hash(i + vec2(1,1)), f.x),
    f.y
  );
}

void main() {
  // Screen-space UV for depth sample
  vec2 screenUV = (vClipPos.xy / vClipPos.w) * 0.5 + 0.5;

  // Sample floor depth
  float rawFloorDepth = texture2D(uDepthTexture, screenUV).r;
  float linearFloor = toLinearDepth(rawFloorDepth);
  float linearWater = toLinearDepth(gl_FragCoord.z);
  float waterDepth = max(linearFloor - linearWater, 0.0);

  // Depth-based color: shallow → deep
  float depthFactor = clamp(waterDepth / uDepthSoftness, 0.0, 1.0);
  vec3 waterColor = mix(uShallowColor, uDeepColor, depthFactor);

  // Foam: edges + animated noise
  float foamDepth = 1.0 - clamp(waterDepth / uFoamSoftness, 0.0, 1.0);
  vec2 foamUV = vWorldPos.xz * uFoamScale * 0.1 + uTime * uFoamSpeed;
  float foamNoise = noiseF(foamUV) * 0.6 + noiseF(foamUV * 2.1 + 5.3) * 0.4;
  float foam = clamp(foamDepth * foamNoise * 1.5, 0.0, 1.0);

  // Specular highlight (fake — just brighten based on view angle)
  float fresnel = pow(1.0 - clamp(dot(normalize(uCameraPos - vWorldPos), vec3(0,1,0)), 0.0, 1.0), 3.0);
  vec3 color = mix(waterColor, uFoamColor, foam);
  color += fresnel * 0.15;
  color = clamp(color, 0.0, 1.0);

  // Fog
  float dist = length(vWorldPos - uCameraPos);
  float fogFactor = clamp(1.0 - exp(-uFogDensity * dist), 0.0, 0.9);
  color = mix(color, uFogNearColor, fogFactor);

  // Water alpha: deeper = more opaque, shore = transparent
  float alpha = mix(0.55, 0.92, depthFactor);

  gl_FragColor = vec4(color, alpha);
}
`;
