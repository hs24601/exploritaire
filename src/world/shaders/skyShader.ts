// Sky dome shader — receives pre-interpolated current colors from TimeOfDaySystem.
// No dynamic array indexing; all blending happens on the CPU and is passed as uniforms.

export const SKY_VERT = /* glsl */`
varying vec3 vWorldDir;

void main() {
  vWorldDir = normalize(position);
  vec4 mvPos = modelViewMatrix * vec4(position, 1.0);
  gl_Position = projectionMatrix * mvPos;
  gl_Position.z = gl_Position.w; // force to far plane
}
`;

export const SKY_FRAG = /* glsl */`
precision mediump float;

varying vec3 vWorldDir;

// Pre-interpolated current sky colors (CPU handles the 4-state blend)
uniform vec3 uSkyDown;
uniform vec3 uSkyMid;
uniform vec3 uSkyUp;

// Gradient band edges
uniform float uStep1;
uniform float uStep2;
uniform float uSharpness1;
uniform float uSharpness2;

void main() {
  // h: 0.0 = bottom of sky, 0.5 = horizon, 1.0 = zenith
  float h = normalize(vWorldDir).y * 0.5 + 0.5;

  float range1 = smoothstep(uStep1, uStep1 - uSharpness1, h);
  float range2 = smoothstep(uStep2, uStep2 - uSharpness2, h);

  vec3 color = uSkyDown * range1
             + uSkyMid  * (range2 - range1)
             + uSkyUp   * (1.0 - range2);

  gl_FragColor = vec4(color, 1.0);
}
`;
