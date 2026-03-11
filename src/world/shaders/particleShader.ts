// Improved particle shader based on particles-playground
// Reduced noise sensitivity by 75%

export const PARTICLE_VERT = /* glsl */`
attribute float aSeed;
attribute float aPhase;

uniform float uTime;
uniform float uDriftSpeed;
uniform float uDriftAmp;
uniform float uBasePointSize;
uniform vec3  uCameraPos;
uniform float uFogDensity;

varying float vAlpha;
varying float vColorT;   
varying float vGlowType; 

vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec2 mod289(vec2 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec3 permute(vec3 x) { return mod289(((x*34.0)+1.0)*x); }

float snoise(vec2 v) {
  const vec4 C = vec4(0.211324865405187, 0.366025403784439, -0.577350269189626, 0.024390243902439);
  vec2 i  = floor(v + dot(v, C.yy) );
  vec2 x0 = v -   i + dot(i, C.xx);
  vec2 i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
  vec4 x12 = x0.xyxy + C.xxzz;
  x12.xy -= i1;
  i = mod289(i); 
  vec3 p = permute( permute( i.y + vec3(0.0, i1.y, 1.0 )) + i.x + vec3(0.0, i1.x, 1.0 ));
  vec3 m = max(0.5 - vec3(dot(x0,x0), dot(x12.xy,x12.xy), dot(x12.zw,x12.zw)), 0.0);
  m = m*m; m = m*m;
  vec3 x = 2.0 * fract(p * C.www) - 1.0;
  vec3 h = abs(x) - 0.5;
  vec3 ox = floor(x + 0.5);
  vec3 a0 = x - ox;
  m *= 1.79284291400159 - 0.85373472095314 * ( a0*a0 + h*h );
  vec3 g;
  g.x  = a0.x  * x0.x  + h.x  * x0.y;
  g.yz = a0.yz * x12.xz + h.yz * x12.yw;
  return 130.0 * dot(m, g);
}

void main() {
  float t = uTime * uDriftSpeed;
  vec3 pos = position;

  // 1. Noise-based displacement (Ported from particles-playground)
  // Scaled by 0.25 to reduce sensitivity by 75%
  float noise = snoise(vec2(aSeed * 10.0, t * 0.5)) * 0.25;
  float noise2 = snoise(vec2(t * 0.3, aPhase)) * 0.25;
  
  pos.x += noise * uDriftAmp * 2.0;
  pos.y += noise2 * uDriftAmp * 2.0;
  pos.z += snoise(vec2(aSeed, aPhase)) * uDriftAmp * 0.25;

  // 2. Large scale "centrifuge" flow around the graft point
  float flowAngle = t * (0.2 + aSeed * 0.2) + aPhase;
  float r = 0.1 + aSeed * 0.4;
  pos.x += cos(flowAngle) * r;
  pos.z += sin(flowAngle) * r;

  vColorT   = aSeed;
  vGlowType = step(0.88, aSeed);

  float dist = length(pos - uCameraPos);
  float fogFade = clamp(exp(-uFogDensity * 1.5 * dist), 0.0, 1.0);
  
  float pulse = 0.7 + 0.3 * sin(t * 2.0 + aPhase * 5.0);
  vAlpha = fogFade * pulse * smoothstep(0.0, 1.5, dist);

  vec4 mvPos = modelViewMatrix * vec4(pos, 1.0);
  gl_Position = projectionMatrix * mvPos;

  float psize = (snoise(vec2(t, aSeed) * 0.5) * 0.25 + 2.0) * uBasePointSize;
  gl_PointSize = clamp(psize * 150.0 / max(-mvPos.z, 1.0), 1.0, 48.0);
}
`;

export const PARTICLE_FRAG = /* glsl */`
precision highp float;

uniform vec3 uColorA;  
uniform vec3 uColorB;  
uniform vec3 uColorC;  
uniform vec3 uColorGold; 

varying float vAlpha;
varying float vColorT;
varying float vGlowType;

void main() {
  vec2 uv = gl_PointCoord - vec2(0.5);
  float r = length(uv);
  if (r > 0.5) discard;

  float core = smoothstep(0.5, 0.2, r);
  core = pow(core, 1.5);

  vec3 color;
  if (vGlowType > 0.5) {
    color = uColorGold;
  } else {
    float t = vColorT / 0.88;
    color = t < 0.5
      ? mix(uColorA, uColorB, t * 2.0)
      : mix(uColorB, uColorC, (t - 0.5) * 2.0);
  }

  gl_FragColor = vec4(color, core * vAlpha);
}
`;
