// Falling leaf billboard shader — elongated ellipse sprites, amber/gold palette

export const LEAF_VERT = /* glsl */`
attribute float aSeed;   // 0-1 per leaf
attribute float aOffset; // 0-1 stagger in fall cycle

uniform float uTime;
uniform float uFallSpeed;
uniform float uWindAmp;
uniform float uWindSpeed;
uniform vec3  uCameraPos;
uniform float uFogDensity;

// World-space fall window
const float TOP_Y  =  24.0;
const float FALL_D =  30.0;

varying float vAlpha;
varying float vLeafAngle;
varying float vColorT;

void main() {
  vec3 pos = position; // XZ baked; Y computed here

  // Staggered looping fall
  float fallT = mod(uTime * uFallSpeed + aOffset * FALL_D, FALL_D);
  pos.y = TOP_Y - fallT;

  // Lateral sway — two frequencies for irregularity
  float t = uTime * uWindSpeed + aSeed * 6.28318;
  pos.x += sin(t * 0.68)             * uWindAmp
         + sin(t * 1.41 + 1.2)       * uWindAmp * 0.35;
  pos.z += cos(t * 0.54)             * uWindAmp * 0.7
         + cos(t * 1.27 + 2.1)       * uWindAmp * 0.25;

  // Rotation angle: slow tumble, each leaf at own rate
  vLeafAngle = mod(uTime * 0.9 * (0.4 + aSeed * 0.6) + aSeed * 3.14159, 6.28318);

  vColorT = aSeed;

  float dist    = length(pos - uCameraPos);
  float fogFade = clamp(exp(-uFogDensity * dist), 0.0, 1.0);
  float nearFade = smoothstep(0.0, 1.5, dist);
  vAlpha = fogFade * nearFade * 0.92;

  vec4 mvPos = modelViewMatrix * vec4(pos, 1.0);
  gl_Position = projectionMatrix * mvPos;

  // Leaves are large — they're the focal accent element
  gl_PointSize = clamp(22.0 * 90.0 / max(-mvPos.z, 1.0), 6.0, 48.0);
}
`;

export const LEAF_FRAG = /* glsl */`
precision highp float;

uniform vec3 uColorGold;
uniform vec3 uColorAmber;
uniform vec3 uColorOrange;

varying float vAlpha;
varying float vLeafAngle;
varying float vColorT;

void main() {
  vec2 uv = gl_PointCoord - vec2(0.5);

  // Rotate UVs for tumbling orientation
  float c = cos(vLeafAngle), s = sin(vLeafAngle);
  vec2 ruv = vec2(c * uv.x - s * uv.y, s * uv.x + c * uv.y);

  // Elongated leaf: wide on X-axis, narrow on Y-axis
  // The aspect 3:1 makes it clearly leaf-like vs round
  float leaf = (ruv.x * ruv.x) / 0.09 + (ruv.y * ruv.y) / 0.022;
  if (leaf > 1.0) discard;

  // Soft interior with slightly brighter central vein hint
  float core   = smoothstep(1.0, 0.15, leaf);
  float vein   = smoothstep(0.08, 0.0, abs(ruv.x)) * smoothstep(1.0, 0.0, leaf);

  vec3 color;
  if      (vColorT < 0.33) color = uColorGold;
  else if (vColorT < 0.67) color = uColorAmber;
  else                     color = uColorOrange;

  color += vec3(vein * 0.12); // faint midrib brightening

  float alpha = core * vAlpha;
  if (alpha < 0.008) discard;

  gl_FragColor = vec4(color, alpha);
}
`;
