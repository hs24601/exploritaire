// Low-poly instanced tree shader — trunk + layered cones, wind sway on canopy

const TRUNK_H = 2.5; // local-space Y where trunk ends and foliage begins

export const TREE_VERT = /* glsl */`
varying vec3 vWorldPos;
varying float vLocalY;

uniform float uTime;
uniform float uWindFreq;
uniform float uWindAmp;
uniform float uWindSpeed;

void main() {
  vLocalY = position.y;

  mat4 worldMat = modelMatrix * instanceMatrix;
  vec3 worldPos = (worldMat * vec4(position, 1.0)).xyz;

  // Wind sway — only above trunk, stronger at tip
  float windWeight = smoothstep(${TRUNK_H.toFixed(1)}, ${(TRUNK_H + 5.0).toFixed(1)}, position.y);
  if (windWeight > 0.0) {
    vec3 bladeBase = (worldMat * vec4(0.0, 0.0, 0.0, 1.0)).xyz;
    float phase = uWindFreq * (bladeBase.x * 0.007 + bladeBase.z * 0.005) + uTime * uWindSpeed;
    worldPos.x += sin(phase) * uWindAmp * windWeight;
    worldPos.z += cos(phase * 0.73 + 1.17) * uWindAmp * 0.4 * windWeight;
  }

  vWorldPos = worldPos;
  gl_Position = projectionMatrix * viewMatrix * vec4(worldPos, 1.0);
}
`;

export const TREE_FRAG = /* glsl */`
precision highp float;

varying vec3 vWorldPos;
varying float vLocalY;

uniform vec3 uTrunkColor;
uniform vec3 uFoliageColorA;
uniform vec3 uFoliageColorB;

uniform vec3 uSunDir;
uniform vec3 uAmbientColor;
uniform float uAmbientIntensity;

uniform vec3 uFogNearColor;
uniform float uFogDensity;
uniform vec3 uCameraPos;

void main() {
  vec3 color;

  if (vLocalY < ${TRUNK_H.toFixed(1)}) {
    // Trunk — slight vertical darkening at base
    float t = vLocalY / ${TRUNK_H.toFixed(1)};
    color = uTrunkColor * (0.7 + 0.3 * t);
  } else {
    // Foliage — gradient dark→light up the canopy, per-tree variation
    float t = clamp((vLocalY - ${TRUNK_H.toFixed(1)}) / 6.0, 0.0, 1.0);
    float var = fract(sin(dot(vWorldPos.xz, vec2(127.1, 311.7))) * 43758.5);
    color = mix(uFoliageColorA, uFoliageColorB, t * 0.5 + var * 0.35);
  }

  // Diffuse shading
  float diff = max(dot(vec3(0.0, 1.0, 0.0), normalize(uSunDir)), 0.0) * 0.55 + 0.45;
  color *= uAmbientColor * uAmbientIntensity + vec3(diff * 0.55);
  color = clamp(color, 0.0, 1.0);

  // Fog
  float dist = length(vWorldPos - uCameraPos);
  float fogFactor = clamp(1.0 - exp(-uFogDensity * dist), 0.0, 0.95);
  color = mix(color, uFogNearColor, fogFactor);

  gl_FragColor = vec4(color, 1.0);
}
`;
