// Grass blade shader — instanced, wind + player interaction

export const GRASS_VERT = /* glsl */`
#include <common>

varying vec2 vUv;
varying vec3 vWorldPos;

uniform float uTime;
uniform float uWindFreq;
uniform float uWindAmp;
uniform float uWindSpeed;
uniform float uNoiseFactor;
uniform vec3 uPlayerPos;

void main() {
  vUv = uv;

  // Compute world-space position via instance transform
  #ifdef USE_INSTANCING
    mat4 worldMat = modelMatrix * instanceMatrix;
  #else
    mat4 worldMat = modelMatrix;
  #endif

  vec3 worldPos = (worldMat * vec4(position, 1.0)).xyz;
  vec3 bladeBase = (worldMat * vec4(0.0, 0.0, 0.0, 1.0)).xyz;

  // Wind: sin wave across global XZ, amplitude scaled by V (0=base, 1=tip)
  float windPhase = uWindFreq * (bladeBase.x * 0.01 + bladeBase.z * 0.01 * 0.7)
                    + uTime * uWindSpeed;
  float windDisp = sin(windPhase) * uWindAmp * uv.y;
  // A touch of secondary motion via a faster, weaker frequency
  windDisp += sin(windPhase * 2.3 + 1.1) * uWindAmp * 0.3 * uv.y;

  worldPos.x += windDisp;
  worldPos.y -= abs(windDisp) * 0.15; // slight height compression from lean

  // Player interaction: bend away within 15-unit radius
  vec2 toPlayer = bladeBase.xz - uPlayerPos.xz;
  float dist = length(toPlayer);
  float push = (1.0 - smoothstep(0.0, 15.0, dist)) * 10.0 * uv.y;
  worldPos.xz += normalize(toPlayer + vec2(0.001)) * push;

  vWorldPos = worldPos;

  gl_Position = projectionMatrix * viewMatrix * vec4(worldPos, 1.0);
}
`;

export const GRASS_FRAG = /* glsl */`
precision highp float;

varying vec2 vUv;
varying vec3 vWorldPos;

uniform vec3 uBaseColor;
uniform vec3 uTipColor1;
uniform vec3 uTipColor2;

// Lighting
uniform vec3 uSunDir;
uniform vec3 uAmbientColor;
uniform float uAmbientIntensity;
uniform float uShadowDarkness;

// Fog
uniform vec3 uFogNearColor;
uniform float uFogDensity;
uniform vec3 uCameraPos;

void main() {
  // Discard fully transparent edges (optional for soft blades — skip for quads)
  // Alpha-test for blade silhouette if using alpha textures
  // For the X-cross geometry we just render solid

  // Color gradient: base → tip blend with slight variation
  float tipBlend = smoothstep(0.2, 1.0, vUv.y);
  // Mix two tip colors based on world position for variation
  float var = fract(sin(dot(vWorldPos.xz, vec2(12.9, 78.2))) * 43758.5);
  vec3 tip = mix(uTipColor1, uTipColor2, var);
  vec3 color = mix(uBaseColor, tip, tipBlend);

  // Simple diffuse from sun
  vec3 normal = vec3(0.0, 1.0, 0.0);
  float diff = max(dot(normal, normalize(uSunDir)), 0.0) * 0.6 + 0.4;
  color *= (uAmbientColor * uAmbientIntensity + vec3(diff));
  color = clamp(color, 0.0, 1.0);

  // Fog
  float dist = length(vWorldPos - uCameraPos);
  float fogFactor = clamp(1.0 - exp(-uFogDensity * dist), 0.0, 0.95);
  color = mix(color, uFogNearColor, fogFactor);

  gl_FragColor = vec4(color, 1.0);
}
`;
