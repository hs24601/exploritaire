// Terrain surface shader — height + slope based triplanar coloring
// Designed as a swap-out point for custom stylized techniques

export const TERRAIN_VERT = /* glsl */`
varying vec3 vWorldPos;
varying vec3 vNormal;
varying vec2 vUv;
varying float vHeight;

void main() {
  vUv = uv;
  vNormal = normalize(normalMatrix * normal);
  vec4 worldPos4 = modelMatrix * vec4(position, 1.0);
  vWorldPos = worldPos4.xyz;
  vHeight = position.y; // local Y = height
  gl_Position = projectionMatrix * viewMatrix * worldPos4;
}
`;

export const TERRAIN_FRAG = /* glsl */`
precision highp float;

varying vec3 vWorldPos;
varying vec3 vNormal;
varying vec2 vUv;
varying float vHeight;

// Terrain zone colors — driven by NatureManager
uniform vec3 uGrassColor;
uniform vec3 uBeachColor;
uniform vec3 uRockColor;

// Lighting
uniform vec3 uSunDir;       // normalized sun direction (world space)
uniform vec3 uAmbientColor;
uniform float uAmbientIntensity;
uniform float uShadowDarkness;

// Noise scale for color variation
uniform float uNoiseScale;

// Fog
uniform vec3 uFogNearColor;
uniform vec3 uFogFarColor;
uniform float uFogDensity;
uniform float uFogHeight;
uniform vec3 uCameraPos;

// Max terrain height (used to normalize vHeight for zone blending)
uniform float uMaxHeight;

// Simple hash noise for color variation
float hash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
}
float noise(vec2 p) {
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
  float heightNorm = clamp(vHeight / uMaxHeight, 0.0, 1.0);
  // Slope: 0 = flat, 1 = vertical wall
  float slope = 1.0 - abs(dot(vNormal, vec3(0.0, 1.0, 0.0)));

  // Color variation via noise
  float n = noise(vWorldPos.xz * uNoiseScale * 0.1) * 0.12 - 0.06;

  // Zone blending
  vec3 color = uGrassColor;
  // Beach zone: near water level
  color = mix(color, uBeachColor, smoothstep(0.08, 0.0, heightNorm));
  // Rock: steep slopes or high peaks
  color = mix(color, uRockColor, smoothstep(0.35, 0.7, slope));
  color = mix(color, uRockColor * 0.7, smoothstep(0.85, 1.0, heightNorm));
  color = clamp(color + n, 0.0, 1.0);

  // Diffuse lighting
  float diff = max(dot(vNormal, normalize(uSunDir)), 0.0);
  vec3 ambient = uAmbientColor * uAmbientIntensity;
  vec3 lit = ambient + vec3(diff);
  color *= lit;

  // Height-based exponential fog
  float dist = length(vWorldPos - uCameraPos);
  float fogFactor = 1.0 - exp(-uFogDensity * dist);
  float heightFog = clamp((vWorldPos.y - uCameraPos.y) * uFogHeight, 0.0, 1.0);
  fogFactor = clamp(fogFactor + heightFog * 0.3, 0.0, 0.95);
  vec3 fogColor = mix(uFogNearColor, uFogFarColor, clamp(dist / 300.0, 0.0, 1.0));
  color = mix(color, fogColor, fogFactor);

  gl_FragColor = vec4(color, 1.0);
}
`;
