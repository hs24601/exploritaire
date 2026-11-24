export const AURORA_VERT = /* glsl */`
varying vec3 vWorldDir;

void main() {
  vWorldDir = normalize(position);
  vec4 mvPos = modelViewMatrix * vec4(position, 1.0);
  gl_Position = projectionMatrix * mvPos;
  gl_Position.z = gl_Position.w; // force to far plane
}
`;

export const AURORA_FRAG = /* glsl */`
precision mediump float;

#define OCTAVES 2
#define RGB(r, g, b) vec3(float(r) / 255.0, float(g) / 255.0, float(b) / 255.0)

varying vec3 vWorldDir;

uniform vec2 uResolution;
uniform float uTime;

vec2 rand2(vec2 p) {
  p = vec2(dot(p, vec2(12.9898, 78.233)), dot(p, vec2(26.65125, 83.054543)));
  return fract(sin(p) * 43758.5453);
}

float rand(vec2 p) {
  return fract(sin(dot(p.xy, vec2(54.90898, 18.233))) * 4337.5453);
}

vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec2 mod289(vec2 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec3 permute(vec3 x) { return mod289(((x * 34.0) + 1.0) * x); }

float snoise(vec2 v) {
  const vec4 C = vec4(0.211324865405187, 0.366025403784439, -0.577350269189626, 0.024390243902439);
  vec2 i = floor(v + dot(v, C.yy));
  vec2 x0 = v - i + dot(i, C.xx);
  vec2 i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
  vec4 x12 = x0.xyxy + C.xxzz;
  x12.xy -= i1;
  i = mod289(i);
  vec3 p = permute(permute(i.y + vec3(0.0, i1.y, 1.0)) + i.x + vec3(0.0, i1.x, 1.0));
  vec3 m = max(0.5 - vec3(dot(x0, x0), dot(x12.xy, x12.xy), dot(x12.zw, x12.zw)), 0.0);
  m = m * m; m = m * m;
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

float stars(in vec2 x, float numCells, float size, float br) {
  vec2 n = x * numCells;
  vec2 f = floor(n);
  float d = 1.0e10;
  for (int i = -1; i <= 1; ++i) {
    for (int j = -1; j <= 1; ++j) {
      vec2 g = f + vec2(float(i), float(j));
      g = n - g - rand2(mod(g, numCells)) + rand(g);
      g *= 1.0 / (numCells * size);
      d = min(d, dot(g, g));
    }
  }
  return br * smoothstep(0.85, 1.0, (1.0 - sqrt(d)));
}

float fractalNoise(in vec2 coord, in float persistence, in float lacunarity) {
  float n = 0.0;
  float frequency = 3.0;
  float amplitude = 2.0;
  for (int o = 0; o < OCTAVES; ++o) {
    n += amplitude * snoise(coord * frequency);
    amplitude *= persistence;
    frequency *= lacunarity;
  }
  return n;
}

void main() {
  vec3 dir = normalize(vWorldDir);
  
  float phi = atan(dir.z, dir.x);
  float theta = asin(dir.y);
  
  vec2 coord = vec2(phi / 6.28318 + 0.5, theta / 3.14159 + 0.5);
  
  // Adjusted Star Projection to prevent zenith clustering
  // We use a longitudinal/latitudinal mapping but scale Y to reduce pinching
  float starRotation = uTime * 0.008; 
  vec2 starCoord = vec2((phi / 6.28318) + 0.5 + starRotation, dir.y * 0.4 + 0.5);
  
  vec3 color1 = RGB(10, 70, 50) * 1.5;
  vec3 color2 = RGB(50, 0, 40) * 1.1;
  float dist = distance(coord, vec2(0.5, 0.3)) * 1.5;
  float time = -uTime / 100.0;

  // Reduce numCells (cell count) to thin out the starfield significantly
  vec3 starField = stars(starCoord * 2.5, 12.0, 0.035, 0.8) * vec3(0.9, 0.9, 0.95);
  starField += stars(starCoord * 3.5, 20.0, 0.03, 1.0) * vec3(0.9, 0.9, 0.95) * max(0.0, fractalNoise(starCoord * 1.5, 0.5, 0.2));

  vec3 aurora = RGB(0, 255, 130) * max(
    snoise(vec2((coord.x + sin(time)) * 15.0, coord.x * 40.0)) * max((sin(10.0 * (coord.x + 2.0 * time)) * 0.15 + 1.35) - 1.8 * coord.y, 0.0),
    0.0
  );
  vec3 aurora2 = RGB(0, 235, 170) * max(
    snoise(vec2((0.09 * coord.x + sin(time * 0.5)) * 15.0, coord.x * 1.0)) * max((sin(5.0 * (coord.x + 1.5 * time)) * 0.15 + 1.38) - 1.8 * coord.y, 0.0),  
    0.0
  );

  vec3 result = starField + aurora * aurora2.g * 5.0 + aurora2 * 1.2;
  vec3 finalColor = mix(color1, color2, dist) + result;
  
  float horizonFade = smoothstep(0.48, 0.52, coord.y);
  gl_FragColor = vec4(finalColor * horizonFade, 1.0);
}
`;
