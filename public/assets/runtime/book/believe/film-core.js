
import * as THREE from 'three';
import { createBelieveEnvelope } from './believe-envelope.js';
let believeFilmTarget=null, believeCameraOverride=null;
import { FullScreenQuad } from 'three/addons/postprocessing/Pass.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
// (the page shows its still first; the world is built after that)
await new Promise((r) => { requestAnimationFrame(() => setTimeout(r, 0)); setTimeout(r, 150); });

// =====================================================================
// Pop-Up: inside a giant pop-up book.
// Under a desk lamp lies an old book. We shrink and slip in between its
// pages, and every turn of a page folds a world up out of the paper: a
// castle whose towers rise and open, a stormy sea of paper strips with a
// ship rocking on it, a dragon whose wings beat by a hidden lever, a
// city at night with light coming through its windows. The paper folds
// the way real pop-ups fold: V-folds and parallel folds, hinged card
// moved by nothing but the opening page. At the end the book shuts,
// every world folds flat, and we get out between the pages just in time.
// Everything is made here in code, the sound too.
// Sound: the speaker button in the corner, or M.
// =====================================================================

const PARAMS = new URLSearchParams(location.search);
const TEST = PARAMS.has('test');
const COARSE = matchMedia('(pointer: coarse)').matches;
const LOW = PARAMS.has('low') || (!PARAMS.has('high') && (COARSE || Math.min(screen.width, screen.height) < 700));
// (dpr: at most this many pixels to each of the screen's; budget: pixels drawn at most; bloom, dof: levels in those
// pyramids; shadow: the lamp's shadow map; cube: an unused second kind; atlas: the printed sheet's size; motes: dust)
const Q = LOW
  ? { dpr: 1.25, budget: 0.9e6, bloom: 6, dof: 6, shadow: 1024, cube: 64, msaa: 0, atlas: 2048, motes: 500 }
  : { dpr: 2.0, budget: 2.6e6, bloom: 7, dof: 7, shadow: 2048, cube: 64, msaa: 4, atlas: 4096, motes: 1400 };

// ---- small helpers ----
const TAU = Math.PI * 2, D2R = Math.PI / 180, R2D = 180 / Math.PI;
const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
const lerp = (a, b, t) => a + (b - a) * t;
const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
const ease = (t) => { t = clamp(t, 0, 1); return t * t * t * (t * (t * 6 - 15) + 10); };
const V3 = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);
function mulberry32(a) {
  return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
// keyframes [t, v...]: a smooth curve through them that never overshoots (monotone cubic), held at the ends
function keys(K, t, out = []) {
  const n = K.length, m = K[0].length - 1;
  if (t <= K[0][0]) { for (let c = 0; c < m; c++) out[c] = K[0][c + 1]; return out; }
  if (t >= K[n - 1][0]) { for (let c = 0; c < m; c++) out[c] = K[n - 1][c + 1]; return out; }
  let i = 0; while (K[i + 1][0] <= t) i++;
  const p0 = K[Math.max(0, i - 1)], p1 = K[i], p2 = K[i + 1], p3 = K[Math.min(n - 1, i + 2)];
  const d1 = p2[0] - p1[0], u = (t - p1[0]) / d1;
  const h00 = 2 * u * u * u - 3 * u * u + 1, h10 = u * u * u - 2 * u * u + u, h01 = -2 * u * u * u + 3 * u * u, h11 = u * u * u - u * u;
  const tan = (sa, sb) => (sa * sb <= 0 ? 0 : 2 / (1 / sa + 1 / sb));
  for (let c = 1; c <= m; c++) {
    const s1 = (p2[c] - p1[c]) / d1;
    const s0 = i > 0 ? (p1[c] - p0[c]) / (p1[0] - p0[0]) : s1, s2 = i + 2 < n ? (p3[c] - p2[c]) / (p3[0] - p2[0]) : s1;
    out[c - 1] = h00 * p1[c] + h10 * tan(s0, s1) * d1 + h01 * p2[c] + h11 * tan(s1, s2) * d1;
  }
  return out;
}
const key1 = (K, t) => keys(K, t, [0])[0];

// ---- the renderer ----
const renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'high-performance', stencil: false });
renderer.outputColorSpace = THREE.LinearSRGBColorSpace;   // the last pass writes sRGB itself
renderer.autoClear = false;
renderer.setClearColor(0x000000, 0);
document.body.appendChild(renderer.domElement);
const GL = renderer.getContext();
// a software renderer means a thumbnail bot or a machine without a GPU: keep the still
let SOFT = !TEST && (() => { try { const x = GL.getExtension('WEBGL_debug_renderer_info'); return /swiftshader|llvmpipe|softpipe|software|basic render/i.test(x ? GL.getParameter(x.UNMASKED_RENDERER_WEBGL) : GL.getParameter(GL.RENDERER)); } catch (e) { return false; } })();
GL.getExtension('EXT_color_buffer_float'); GL.getExtension('EXT_color_buffer_half_float');
const camera = new THREE.PerspectiveCamera(40, 1, 0.05, 4000);
const PV = 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0., 1.); }';
const pass = (fs, uniforms, extra = {}) => new FullScreenQuad(new THREE.ShaderMaterial(Object.assign({ uniforms, vertexShader: PV, fragmentShader: fs, depthTest: false, depthWrite: false }, extra)));
const M4 = () => new THREE.Matrix4();
const _q = new THREE.Quaternion(), _e = new THREE.Euler();
// a matrix placing a thing at p, turned so that its +y is along up and its +z along fwd, scaled
function place(p, fwd, up = V3(0, 1, 0), sx = 1, sy = 1, sz = 1) {
  const z = fwd.clone().normalize(), x = V3().crossVectors(up, z).normalize(), y = V3().crossVectors(z, x);
  return M4().makeBasis(x.multiplyScalar(sx), y.multiplyScalar(sy), z.multiplyScalar(sz)).setPosition(p);
}

// =====================================================================
// How things are lit, painter's fashion: one key light that casts
// shadows (the moon, the sun, a lantern), a soft fill from above and below, a light behind that
// rims the edges, and the little flames nearest the camera (candles,
// lamps, torches). Then the haze, glowing toward the key light.
// =====================================================================
const NL = 10;   // little lights lighting things at once (the ones nearest the camera)
const GLSL_NOISE = /* glsl */`
float h1(float n) { return fract(sin(n * 127.1) * 43758.5453); }
float h2(vec2 p) { vec3 q = fract(vec3(p.xyx) * 0.1031); q += dot(q, q.yzx + 33.33); return fract((q.x + q.y) * q.z); }
float hh3(vec3 p) { p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
float n3(vec3 x) { vec3 i = floor(x), f = fract(x); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(hh3(i), hh3(i + vec3(1, 0, 0)), f.x), mix(hh3(i + vec3(0, 1, 0)), hh3(i + vec3(1, 1, 0)), f.x), f.y),
             mix(mix(hh3(i + vec3(0, 0, 1)), hh3(i + vec3(1, 0, 1)), f.x), mix(hh3(i + vec3(0, 1, 1)), hh3(i + vec3(1, 1, 1)), f.x), f.y), f.z); }
float fbm3(vec3 p) { float s = 0.0, a = 0.5; for (int k = 0; k < 4; k++) { s += a * n3(p); p = p * 2.03 + 7.1; a *= 0.5; } return s; }
float n2(vec2 x) { vec2 i = floor(x), f = fract(x); f = f * f * (3.0 - 2.0 * f); return mix(mix(h2(i), h2(i + vec2(1, 0)), f.x), mix(h2(i + vec2(0, 1)), h2(i + vec2(1, 1)), f.x), f.y); }
float fbm2(vec2 p) { float s = 0.0, a = 0.5; for (int k = 0; k < 5; k++) { s += a * n2(p); p = p * 2.07 + 3.1; a *= 0.5; } return s; }
`;
// a bumped normal from a height pattern on the surface (by its screen-space change)
const GLSL_BUMP = /* glsl */`
vec3 bumpN(vec3 n, vec3 p, float h, float k) {
  vec3 dpx = dFdx(p), dpy = dFdy(p); float dhx = dFdx(h), dhy = dFdy(h);
  vec3 r1 = cross(dpy, n), r2 = cross(n, dpx); float det = dot(dpx, r1);
  vec3 g = sign(det) * (dhx * r1 + dhy * r2);
  return normalize(abs(det) * n - k * g);
}
`;
const WORLDU = {
  // the key light: position (w 1) or the direction it comes from (w 0); colour; a spot's axis and the cosine of its edge
  uKeyP: { value: new THREE.Vector4(0, 1, 0, 0) }, uKeyC: { value: V3() }, uKeySpot: { value: new THREE.Vector4(0, -1, 0, -2) }, uKeyR: { value: 0.3 },
  // the fill: from above, from below; the rim: its direction (where it comes from) and colour
  uAmbUp: { value: V3() }, uAmbDn: { value: V3() }, uRimD: { value: V3(0, 0, -1) }, uRimC: { value: V3() },
  uFogCol: { value: V3() }, uGlow: { value: V3() }, uFogD: { value: 0.02 }, uFogH: { value: 6 }, uFogY: { value: 0 }, uTime: { value: 0 }, uT: { value: 0 },
  uLP: { value: Array.from({ length: NL }, () => new THREE.Vector4(0, -1e4, 0, 0.1)) }, uLC: { value: Array.from({ length: NL }, () => V3()) },
  uShadowM: { value: new THREE.Matrix4() }, tShadow: { value: null }, uShadowOn: { value: 0 }, uShadowSoft: { value: 1.5 }, uShadowBias: { value: 0.0006 },
  // a light in the middle of things (a fire): its shadow map is four views round it, side by side in one texture
  uShadowCube: { value: 0 }, uCubeM: { value: Array.from({ length: 4 }, () => new THREE.Matrix4()) },
  uWind: { value: 0 }, uFlash: { value: 0 },
  // under water: how much the key light is broken into the moving net of light the waves cast (caustics)
  uCaus: { value: 0 }, uW: { value: 0 },
  // what a polished thing sees round it (chrome, paint, glass): the sky above, the ground below, the sun, a few bright lights
  uEnvTop: { value: V3() }, uEnvHor: { value: V3() }, uEnvBot: { value: V3() }, uEnvSunD: { value: V3(0, 1, 0) }, uEnvSunC: { value: V3() },
  uEnvL: { value: Array.from({ length: 4 }, () => new THREE.Vector4(0, -1, 0, 100)) }, uEnvLC: { value: Array.from({ length: 4 }, () => V3()) },
};
const GLSL_LIGHT = /* glsl */`
precision highp sampler2DShadow;
uniform vec4 uKeyP, uKeySpot; uniform vec3 uKeyC, uAmbUp, uAmbDn, uRimD, uRimC, uFogCol, uGlow;
uniform float uKeyR, uFogD, uFogH, uFogY, uTime, uT, uShadowOn, uShadowSoft, uShadowBias, uWind, uFlash, uCaus, uW;
uniform vec4 uLP[${NL}]; uniform vec3 uLC[${NL}];
uniform mat4 uShadowM; uniform sampler2DShadow tShadow; uniform float uShadowCube; uniform mat4 uCubeM[4];
// a material may darken the key light itself (a carving's own shadows), and say which way the surface really faces
// (for the shadow map: a carving's bent normals must not move where it is looked up)
float gKeyMul = 1.0; vec3 gShN = vec3(0.0);
uniform vec3 uEnvTop, uEnvHor, uEnvBot, uEnvSunD, uEnvSunC; uniform vec4 uEnvL[4]; uniform vec3 uEnvLC[4];
// the world as a mirror sees it: sky above, a darker band at the horizon, the ground below, the sun, a few bright lights
vec3 envAt(vec3 r, float rough) {
  float y = r.y;
  vec3 c = y > 0.0 ? mix(uEnvHor, uEnvTop, pow(min(y, 1.0), 0.45)) : mix(uEnvHor * 0.4, uEnvBot, pow(min(-y, 1.0), 0.3));
  c *= 1.0 - 0.35 * (1.0 - rough) * smoothstep(0.0, -0.04, y) * smoothstep(-0.3, -0.04, y);
  float s = max(dot(r, uEnvSunD), 0.0);
  c += uEnvSunC * (pow(s, mix(3000.0, 12.0, rough)) * mix(60.0, 0.6, rough) + pow(s, 6.0) * 0.2);
  for (int i = 0; i < 4; i++) { float g = max(dot(r, uEnvL[i].xyz), 0.0); c += uEnvLC[i] * pow(g, mix(uEnvL[i].w, 6.0, rough)) * mix(1.0, 0.2, rough); }
  return c;
}
// the shadow of a light with things all round it: which of the four views sees p, and is p behind something there
float cubeShadow(vec3 p, vec3 n) {
  vec3 d = p - uKeyP.xyz; float dl = length(d);
  int f = abs(d.x) > abs(d.z) ? (d.x > 0.0 ? 0 : 1) : (d.z > 0.0 ? 2 : 3);
  vec3 tl = -d / max(dl, 1e-3); float gr = 1.0 - max(dot(n, tl), 0.0);
  vec4 s = uCubeM[f] * vec4(p + n * (0.012 + 0.004 * dl) * (1.0 + 5.0 * gr * gr) + tl * (0.006 * dl) * gr, 1.0);
  vec3 c = s.xyz / s.w * 0.5 + 0.5;
  if (s.w < 0.0 || c.y < 0.0 || c.y > 1.0 || c.z > 1.0) return 1.0;
  vec2 o = vec2(float(f - (f / 2) * 2), float(f / 2)) * 0.5;
  vec2 tx = uShadowSoft / vec2(textureSize(tShadow, 0)) * 2.0; float sum = 0.0;
  float a0 = h2(gl_FragCoord.xy) * 6.2832;
  for (int i = 0; i < 8; i++) {
    float a = a0 + float(i) * 2.39996, r = sqrt((float(i) + 0.5) / 8.0);
    vec2 uv = clamp(c.xy + vec2(cos(a), sin(a)) * r * tx * 1.6, vec2(0.001), vec2(0.999));
    sum += texture(tShadow, vec3(o + uv * 0.5, c.z - uShadowBias));
  }
  return sum / 8.0;
}
float keyShadow(vec3 p, vec3 n) {
  if (uShadowOn < 0.5) return 1.0;
  if (uShadowCube > 0.5) return cubeShadow(p, n);
  // (pushed off the surface along its normal and toward the light, more the more the light grazes it)
  vec3 Lk = uKeyP.w < 0.5 ? normalize(uKeyP.xyz) : normalize(uKeyP.xyz - p); float gr = 1.0 - max(dot(n, Lk), 0.0);
  vec4 s = uShadowM * vec4(p + n * (0.012 + 0.07 * gr * gr) + Lk * 0.03 * gr, 1.0);
  vec3 c = s.xyz / s.w * 0.5 + 0.5;
  if (any(lessThan(c.xy, vec2(0.0))) || any(greaterThan(c.xy, vec2(1.0))) || c.z > 1.0 || s.w < 0.0) return 1.0;
  vec2 tx = uShadowSoft / vec2(textureSize(tShadow, 0)); float sum = 0.0;
  // a rotated disc of taps, turned a little at every pixel so the soft edge has no steps
  float a0 = h2(gl_FragCoord.xy) * 6.2832;
  for (int i = 0; i < 8; i++) {
    float a = a0 + float(i) * 2.39996, r = sqrt((float(i) + 0.5) / 8.0);
    sum += texture(tShadow, vec3(c.xy + vec2(cos(a), sin(a)) * r * tx * 1.6, c.z - uShadowBias));
  }
  return sum / 8.0;
}
// the key light's direction and strength at p
// the light under the waves: bright threads that wander over everything below
float causticAt(vec3 p) {
  vec2 q = p.xz * 8.5 + p.y * 2.0; float a = uW * 6.2832 / 40.0, c = 0.0;
  for (int i = 0; i < 2; i++) { float fi = float(i); vec2 w = q * (1.0 + fi * 0.73) + vec2(cos(a + fi), sin(a * (1.0 + fi) + fi)) * (3.0 + fi * 2.0); float k = abs(n3(vec3(w, sin(a * 2.0 + fi) * 2.0 + fi * 3.0)) * 2.0 - 1.0); c += pow(1.0 - k, 7.0); }
  return 0.6 + c * 0.85;
}
vec3 keyAt(vec3 p, out vec3 L) {
  if (uKeyP.w < 0.5) { L = normalize(uKeyP.xyz); return uKeyC * (uCaus > 0.001 ? mix(1.0, causticAt(p), uCaus) : 1.0); }
  vec3 d = uKeyP.xyz - p; float d2 = dot(d, d); L = d * inversesqrt(d2);
  float spot = uKeySpot.w > -1.5 ? smoothstep(uKeySpot.w, uKeySpot.w + 0.12, dot(-L, uKeySpot.xyz)) : 1.0;
  return uKeyC * spot / (d2 + uKeyR * uKeyR);
}
// alb: colour; rough; F0: how shiny head-on; ao: how open; wrap: light round the edge (cloth, leaves);
// sheen: the soft bright edge of cloth; sss: light under skin
vec3 light(vec3 p, vec3 n, vec3 V, vec3 alb, float rough, vec3 F0, float ao, float wrap, float sheen, float sss) {
  vec3 c = vec3(0.0), L;
  float nv = max(dot(n, V), 0.0);
  float a = max(rough * rough, 0.004), sp = 2.0 / a - 2.0;
  vec3 F = F0 + (1.0 - F0) * pow(1.0 - nv, 5.0) * (1.0 - rough) * 0.6;
  vec3 kc = keyAt(p, L);
  float ndl = dot(n, L);
  if (dot(kc, vec3(1.0)) > 1e-5) {
    float dif = max((ndl + wrap) / (1.0 + wrap), 0.0);
    float scat = sss * max(0.0, (ndl + 0.45) / 1.45 - max(ndl, 0.0));
    if (dif > 0.0 || scat > 0.0) {
      float sh = keyShadow(p, dot(gShN, gShN) > 0.5 ? gShN : n) * gKeyMul;
      vec3 h = normalize(L + V);
      c += kc * sh * (alb * dif + alb * vec3(1.0, 0.35, 0.2) * scat * 1.6 + F * pow(max(dot(n, h), 0.0), sp) * (sp + 2.0) / 8.0 * max(ndl, 0.0)
                      + sheen * alb * 1.3 * pow(1.0 - nv, 3.0) * max(ndl + 0.3, 0.0));
    }
  }
  // the fill, from above and below
  c += alb * ao * mix(uAmbDn, uAmbUp, n.y * 0.5 + 0.5);
  c += F * ao * (1.0 - rough * 0.85) * mix(uAmbDn, uAmbUp, reflect(-V, n).y * 0.5 + 0.5) * 0.7;
  // the light behind, on the edges
  float rim = pow(1.0 - nv, 2.6) * max(dot(n, uRimD) + 0.25, 0.0);
  c += uRimC * rim * (alb * 1.5 + 0.06 + sheen * alb) * ao;
  // the little flames
  for (int i = 0; i < ${NL}; i++) {
    vec3 Lp = uLP[i].xyz - p; float d2 = dot(Lp, Lp); Lp *= inversesqrt(d2);
    float nl = dot(n, Lp);
    vec3 hp = normalize(Lp + V);
    c += uLC[i] * (alb * max((nl + wrap * 0.6) / (1.0 + wrap * 0.6), 0.0) + alb * vec3(1.0, 0.35, 0.2) * sss * max(0.0, (nl + 0.45) / 1.45 - max(nl, 0.0)) * 1.6
                   + F * pow(max(dot(n, hp), 0.0), sp) * (sp + 2.0) / 8.0 * max(nl, 0.0)) * (0.35 + 0.65 * ao) / (d2 + uLP[i].w * uLP[i].w);
  }
  // a flash of lightning, from above
  c += alb * uFlash * vec3(0.75, 0.82, 1.0) * max(n.y * 0.6 + 0.4, 0.0) * ao;
  return c;
}
// the haze: thicker low down, summed along the ray; glowing toward the key light
vec3 fogCol(vec3 rd) {
  vec3 L = uKeyP.w < 0.5 ? normalize(uKeyP.xyz) : normalize(uKeyP.xyz - cameraPosition);
  float sd = max(dot(rd, L), 0.0);
  return uFogCol + uGlow * (pow(sd, 4.0) * 0.4 + pow(sd, 24.0) * 1.2);
}
float fogF(vec3 p) {
  vec3 e = p - cameraPosition; float d = length(e);
  float y0 = cameraPosition.y - uFogY, y1 = p.y - uFogY, dy = y1 - y0, H = uFogH;
  float m = abs(dy) > 0.05 ? H * (exp(-max(y0, 0.0) / H) - exp(-max(y1, 0.0) / H)) / dy : exp(-max(y0, 0.0) / H);
  return 1.0 - exp(-d * uFogD * (0.25 + 1.5 * clamp(m, 0.0, 1.0)));
}
vec3 fog(vec3 c, vec3 p) { return mix(c, fogCol(normalize(p - cameraPosition)), fogF(p)); }
`;
// the vertex shader most things use: instanced or not; clay (sculpted, moved by bones) or not.
// It passes on the world position, the normal, the model's own position (in metres, even when an instance is
// stretched), its texture coordinate and the instance's numbers; clay adds how hidden, colours and the rest position
const STD_VS = /* glsl */`
  out vec3 vW, vN, vL, vSc; out vec2 vU; out vec4 vI; out float vAO; out vec4 vW0, vW1, vTint;
  #ifdef USE_INSTANCING
    in vec4 aI;
  #endif
  #ifdef CLAY
    in float aAO; in vec4 aW0, aW1, aTint; in vec3 aBone;
    uniform mat4 uBones[16];
  #endif
  uniform float uTime, uWind, uT;
  void main() {
    vec3 pos = position, nor = normal;
    vAO = 1.0; vW0 = vec4(1.0, 0.0, 0.0, 0.0); vW1 = vec4(0.0); vTint = vec4(0.0);
    #ifdef CLAY
      mat4 Ba = uBones[int(aBone.x + 0.5)], Bb = uBones[int(aBone.y + 0.5)];
      pos = mix((Ba * vec4(position, 1.0)).xyz, (Bb * vec4(position, 1.0)).xyz, aBone.z);
      nor = normalize(mix(mat3(Ba) * normal, mat3(Bb) * normal, aBone.z));
      vAO = aAO; vW0 = aW0; vW1 = aW1; vTint = aTint;
    #endif
    #ifdef USE_INSTANCING
      mat4 M = modelMatrix * instanceMatrix; vI = aI;
      vec3 sc = vec3(length(instanceMatrix[0].xyz), length(instanceMatrix[1].xyz), length(instanceMatrix[2].xyz));
    #else
      mat4 M = modelMatrix; vI = vec4(0.0); vec3 sc = vec3(1.0);
    #endif
    vL = position * sc; vU = uv; vSc = sc;
    MOVE
    vec4 w = M * vec4(pos, 1.0); vW = w.xyz;
    vN = normalize(transpose(inverse(mat3(M))) * nor);
    gl_Position = projectionMatrix * viewMatrix * w;
  }`;
// a material: its fragment body sets alb, rough, F0, ao, wrap, sheen, sss, emit (and may discard); light and haze come after
const MATS = [];
function worldMat(body, opts = {}) {
  const vs = (opts.vs || STD_VS).replace('MOVE', opts.move || '');
  const m = new THREE.ShaderMaterial(Object.assign({
    glslVersion: THREE.GLSL3, uniforms: Object.assign({}, WORLDU, opts.uniforms || {}), vertexShader: vs, defines: opts.defines || {},
    fragmentShader: /* glsl */`
      precision highp float; precision highp int;
      ${GLSL_NOISE}
      ${GLSL_LIGHT}
      ${opts.head || ''}
      in vec3 vW, vN, vL, vSc; in vec2 vU; in vec4 vI; in float vAO; in vec4 vW0, vW1, vTint; out vec4 oColor;
      void main() {
        vec3 n = normalize(vN); ${opts.noFlip ? '' : 'if (!gl_FrontFacing) n = -n;'}
        vec3 V = normalize(cameraPosition - vW);
        vec3 alb = vec3(0.5), emit = vec3(0.0), F0 = vec3(0.04); float rough = 0.85, ao = vAO, wrap = 0.0, sheen = 0.0, sss = 0.0, alpha = 1.0;
        ${body}
        vec3 col = light(vW, n, V, alb, rough, F0, ao, wrap, sheen, sss) + emit;
        oColor = vec4(${opts.noFog ? 'col' : 'fog(col, vW)'}, alpha);
      }`,
  }, opts.extra || {}));
  // what it looks like to the key light's shadow map: the same shape (and the same holes)
  m.userData.shadow = new THREE.ShaderMaterial({
    glslVersion: THREE.GLSL3, uniforms: m.uniforms, vertexShader: vs, defines: opts.defines || {}, side: THREE.DoubleSide,
    fragmentShader: /* glsl */`precision highp float; ${GLSL_NOISE} ${opts.head || ''} in vec3 vW, vN, vL, vSc; in vec2 vU; in vec4 vI; in float vAO; in vec4 vW0, vW1, vTint; out vec4 oColor;
      void main() { ${opts.cut || ''} oColor = vec4(1.0); }`,
  });
  MATS.push(m);
  return m;
}
const worldScene = new THREE.Scene();
const FRAME_HOOKS = [];
const casters = new Set();   // what casts the key light's shadow
// the little lights: position, colour, how soft (the radius under which it stops getting brighter), which scene
const LAMPS = { p: [], c: [], r: [], set: [], flick: [] };
function lamp(set, p, c, r = 0.06, flick = 1) { LAMPS.p.push(p.clone()); LAMPS.c.push(c.clone()); LAMPS.r.push(r); LAMPS.set.push(set); LAMPS.flick.push(flick); return LAMPS.p.length - 1; }
const add = (parent, o, cast = true) => { parent.add(o); if (cast) casters.add(o); return o; };
// an instanced mesh from a geometry and lists of matrices and per-instance numbers ({ aI: [[4 numbers] per instance] })
function instanced(parent, geo, mat, mats, attrs = {}, cast = true) {
  const n = mats.length; geo = geo.clone();
  const m = new THREE.InstancedMesh(geo, mat, Math.max(1, n));
  for (let i = 0; i < n; i++) m.setMatrixAt(i, mats[i]);
  m.count = n;
  if (!attrs.aI) attrs.aI = [];
  for (const k in attrs) { const a = new Float32Array(Math.max(1, n) * 4); attrs[k].forEach((d, i) => a.set(d, i * 4)); geo.setAttribute(k, new THREE.InstancedBufferAttribute(a, 4)); }
  m.computeBoundingSphere();
  return add(parent, m, cast);
}
// =====================================================================
// One world, in centimetres: a desk, a lamp, a book. The book's spine
// runs along z at the height of its pages; we read it from +z, so its
// left pages lie toward -x and its right pages toward +x.
// =====================================================================
const LEVELS = [];
function level(name, o = {}) {
  const L = Object.assign({ name, scene: new THREE.Scene(), bg: new THREE.Color(0, 0, 0), after: [], hooks: [] }, o);
  LEVELS.push(L); return L;
}
// (the scale of the moment, and one it may give way to: here there is only the one)
const LV = { a: null, b: null, mix: 0, camB: new THREE.PerspectiveCamera(40, 1, 0.1, 1e5) };
function drawLevel(r, L, cam) { r.render(L.scene, cam); for (const f of L.after) f(r, cam); }
const ENV = { exposure: 1 };
const hexc = (hex, k = 1) => { const c = new THREE.Color(hex); c.convertSRGBToLinear(); return V3(c.r * k, c.g * k, c.b * k); };
const ROOM = level('room', { scene: worldScene, bg: new THREE.Color(0.004, 0.005, 0.009) });

// ---- the film's parts: its shots ----
const LEN = 120;
const CAMS = { lv: null, pos: V3(), tgt: V3(), fov: 40, focus: 50, ap: 0, near: 0.5, far: 1e5, roll: 0, b: null, mix: 0, shot: null };
const SHOTS = [];
// a shot from t0 to t1: f(T) gives { pos, tgt, fov, near, far, focus, ap, roll }
function shot(t0, t1, f) { SHOTS.push({ t0, t1, f }); }
function shotAt(T) {
  let sh = SHOTS[0];
  for (const s of SHOTS) if (T >= s.t0 && T < s.t1) { sh = s; break; }
  const r = sh.f(T);
  Object.assign(CAMS, { lv: r.lv || ROOM, fov: r.fov ?? 40, ap: r.ap ?? 0, near: r.near ?? 0.5, far: r.far ?? 1e5, roll: r.roll ?? 0, b: r.b || null, mix: r.mix ?? 0, shot: sh });
  CAMS.pos.copy(r.pos); CAMS.tgt.copy(r.tgt); CAMS.focus = r.focus ?? r.pos.distanceTo(r.tgt);
  return CAMS;
}
// a camera put where a shot says
function placeCam(cam, o) {
  cam.aspect = VW / VH;
  cam.fov = cam.aspect < 1 ? 2 * Math.atan(Math.tan((o.fov ?? 40) / 2 * D2R) / Math.pow(cam.aspect, 0.7)) / D2R : (o.fov ?? 40);
  cam.near = o.near ?? 0.5; cam.far = o.far ?? 1e5; cam.updateProjectionMatrix();
  cam.position.copy(o.pos); cam.up.set(0, 1, 0); cam.lookAt(o.tgt);
  if (o.roll) cam.rotateZ(o.roll);
  cam.updateMatrixWorld();
}

// =====================================================================
// The lens and the film. The key light's shadow map, the world; the
// lens focuses where the story says. Soft things in the air (dust in
// the beams, flames, petals) are drawn after the blur, faded where they
// meet solid things. Then bloom, rays of light streaming from the key
// light, the AgX curve, a warm and cool split, vignette, grain. Last of
// all, a fade (the same pass can turn the picture to glass; not used
// here).
// =====================================================================
const FU = {
  uFocus: { value: 10 }, uAperture: { value: 0.3 }, uPxScale: { value: 500 }, uRes: { value: new THREE.Vector2(1, 1) },
  tDepth: { value: null }, uNearFar: { value: new THREE.Vector2(0.01, 400) }, uMaxCoC: { value: 200 },
};
const GLSL_LENS = /* glsl */`
uniform float uFocus, uAperture, uPxScale, uMaxCoC;
uniform vec2 uNearFar;
float cocAt(float z) { return clamp(uAperture * (1.0 / uFocus - 1.0 / z) * uPxScale, -uMaxCoC, uMaxCoC); }
float linZ(float d) { float n = uNearFar.x, f = uNearFar.y; return n * f / (f - d * (f - n)); }
`;
const RT = {};
let VW = 1, VH = 1, PR = 1;
const PERF = { win: [], cool: 0, scale: 1, hold: 0, ceil: 1, vs: 0, k: 0 };
// (what the scene swaps in for the shadow pass, and back: coarser shapes where detail cannot be seen)
const SHADOW_SWAP = [];
function makeTargets() {
  const W = Math.max(2, Math.floor(VW * PR)), H = Math.max(2, Math.floor(VH * PR));
  for (const k in RT) { const v = RT[k]; if (Array.isArray(v)) v.forEach((t) => t.dispose()); else if (v && v.dispose) v.dispose(); }
  const lin = { type: THREE.HalfFloatType, depthBuffer: false, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter };
  RT.depth = new THREE.DepthTexture(W, H, THREE.FloatType);
  RT.scene = new THREE.WebGLRenderTarget(W, H, { type: THREE.HalfFloatType, samples: Q.msaa, depthTexture: RT.depth, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter });
  RT.comp = new THREE.WebGLRenderTarget(W, H, lin);
  RT.dof = [];
  for (let i = 0, w = W >> 1, h = H >> 1; i < Q.dof; i++, w = Math.max(1, w >> 1), h = Math.max(1, h >> 1)) RT.dof.push(new THREE.WebGLRenderTarget(w, h, Object.assign({ count: 3 }, lin)));
  RT.bloom = [];
  for (let i = 0, w = W >> 1, h = H >> 1; i < Q.bloom; i++, w = Math.max(1, w >> 1), h = Math.max(1, h >> 1)) RT.bloom.push(new THREE.WebGLRenderTarget(w, h, lin));
  RT.up = RT.bloom.map((t) => new THREE.WebGLRenderTarget(t.width, t.height, lin));
  RT.rays = new THREE.WebGLRenderTarget(Math.max(1, W >> 2), Math.max(1, H >> 2), lin);
  RT.vol = new THREE.WebGLRenderTarget(Math.max(1, W >> 2), Math.max(1, H >> 2), lin);
  RT.vol2 = new THREE.WebGLRenderTarget(Math.max(1, W >> 2), Math.max(1, H >> 2), lin);
  // the second scale, while one gives way to the next; and the two laid together
  RT.depth2 = new THREE.DepthTexture(W, H, THREE.FloatType);
  RT.scene2 = new THREE.WebGLRenderTarget(W, H, { type: THREE.HalfFloatType, samples: Q.msaa, depthTexture: RT.depth2, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter });
  RT.mixed = new THREE.WebGLRenderTarget(W, H, lin);
  const mip = { type: THREE.UnsignedByteType, depthBuffer: false, minFilter: THREE.LinearMipmapLinearFilter, magFilter: THREE.LinearFilter, generateMipmaps: true };
  RT.ldr = new THREE.WebGLRenderTarget(W, H, mip);
  RT.snap = new THREE.WebGLRenderTarget(W, H, mip);
  RT.W = W; RT.H = H;
}
const LENS = { exposure: 1, maxCoC: 90 };
const CAM = { focus: 8, ap: 0.03 };
const lensU = () => ({ uFocus: FU.uFocus, uAperture: FU.uAperture, uPxScale: FU.uPxScale, uMaxCoC: FU.uMaxCoC, uNearFar: FU.uNearFar });

// what is behind the focus, what is in front of it, and how big the blur in front is: three pictures at half size
const dofPrep = new FullScreenQuad(new THREE.ShaderMaterial({
  glslVersion: THREE.GLSL3,
  uniforms: Object.assign({ tSrc: { value: null }, tDepth: { value: null }, uTexel: { value: new THREE.Vector2() } }, lensU()),
  vertexShader: 'out vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0., 1.); }',
  fragmentShader: /* glsl */`
    precision highp float;
    in vec2 vUv;
    uniform sampler2D tSrc, tDepth; uniform vec2 uTexel;
    ${GLSL_LENS.replace(/texture2D/g, 'texture')}
    layout(location = 0) out vec4 oFar; layout(location = 1) out vec4 oNear; layout(location = 2) out vec4 oCoc;
    void main() {
      vec4 F = vec4(0.0), N = vec4(0.0), C = vec4(0.0);
      for (int k = 0; k < 4; k++) {
        vec2 uv = vUv + uTexel * (vec2(float(k & 1), float(k >> 1)) - 0.5);
        vec3 c = texture(tSrc, uv).rgb; if (any(isnan(c)) || any(isinf(c))) c = vec3(0.0);
        float coc = cocAt(linZ(texture(tDepth, uv).r));
        float wf = smoothstep(0.5, 2.5, coc), wn = smoothstep(1.0, 3.0, -coc);
        c = min(c, vec3(64.0));
        F += vec4(c * wf, wf); N += vec4(c * wn, wn); C += vec4(-coc * wn, wn, 0.0, 0.0);
      }
      oFar = F * 0.25; oNear = N * 0.25; oCoc = C * 0.25;
    }`,
  depthTest: false, depthWrite: false,
}));
// each level of the pyramid a smoothed half of the one above
const dofDown = new FullScreenQuad(new THREE.ShaderMaterial({
  glslVersion: THREE.GLSL3,
  uniforms: { t0: { value: null }, t1: { value: null }, t2: { value: null }, uTexel: { value: new THREE.Vector2() } },
  vertexShader: 'out vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0., 1.); }',
  fragmentShader: /* glsl */`
    precision highp float;
    in vec2 vUv; uniform sampler2D t0, t1, t2; uniform vec2 uTexel;
    layout(location = 0) out vec4 o0; layout(location = 1) out vec4 o1; layout(location = 2) out vec4 o2;
    vec4 down(sampler2D t) {
      vec2 o = uTexel;
      vec4 s = texture(t, vUv) * 0.25;
      s += (texture(t, vUv + vec2(o.x, o.y)) + texture(t, vUv + vec2(-o.x, o.y)) + texture(t, vUv + vec2(o.x, -o.y)) + texture(t, vUv - o)) * 0.125;
      s += (texture(t, vUv + vec2(2.0 * o.x, 0.0)) + texture(t, vUv - vec2(2.0 * o.x, 0.0)) + texture(t, vUv + vec2(0.0, 2.0 * o.y)) + texture(t, vUv - vec2(0.0, 2.0 * o.y))) * 0.0625;
      return s;
    }
    void main() { o0 = down(t0); o1 = down(t1); o2 = down(t2); }`,
  depthTest: false, depthWrite: false,
}));
const GLSL_PYR = /* glsl */`
  // a smooth (cubic B-spline) look-up at one level of a pyramid, from four bilinear taps
  vec4 bspline(sampler2D t, vec2 uv) {
    vec2 ts = vec2(textureSize(t, 0)), p = uv * ts - 0.5, f = fract(p), i = floor(p);
    vec2 w0 = (1.0 - f) * (1.0 - f) * (1.0 - f) / 6.0, w1 = (4.0 - 6.0 * f * f + 3.0 * f * f * f) / 6.0;
    vec2 w2 = (1.0 + 3.0 * f + 3.0 * f * f - 3.0 * f * f * f) / 6.0, w3 = f * f * f / 6.0;
    vec2 g0 = w0 + w1, g1 = w2 + w3, h0 = (i - 0.5 + w1 / g0) / ts, h1 = (i + 1.5 + w3 / g1) / ts;
    return (texture(t, vec2(h0.x, h0.y)) * g0.x + texture(t, vec2(h1.x, h0.y)) * g1.x) * g0.y
         + (texture(t, vec2(h0.x, h1.y)) * g0.x + texture(t, vec2(h1.x, h1.y)) * g1.x) * g1.y;
  }
`;
const pyrUniforms = (name) => Object.fromEntries(Array.from({ length: 7 }, (_, i) => [name + i, { value: null }]));
const pyrFetch = (name, n) => /* glsl */`
  vec4 ${name}At(int k, vec2 uv) {
    ${Array.from({ length: n }, (_, i) => `if (k == ${i}) return bspline(${name}${i}, uv);`).join('\n    ')}
    return bspline(${name}${n - 1}, uv);
  }
  vec4 ${name}Lod(float l, vec2 uv) {
    l = clamp(l, 0.0, float(${n - 1}) - 0.001); int k = int(floor(l));
    return mix(${name}At(k, uv), ${name}At(k + 1, uv), fract(l));
  }`;
// the picture behind the focus, blurred
const dofBase = new FullScreenQuad(new THREE.ShaderMaterial({
  glslVersion: THREE.GLSL3,
  uniforms: Object.assign({ tSrc: { value: null }, tDepth: { value: null } }, pyrUniforms('tF'), lensU()),
  vertexShader: 'out vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0., 1.); }',
  fragmentShader: /* glsl */`
    precision highp float;
    in vec2 vUv; uniform sampler2D tSrc, tDepth;
    uniform sampler2D ${Array.from({ length: Q.dof }, (_, i) => 'tF' + i).join(', ')};
    out vec4 oColor;
    ${GLSL_LENS.replace(/texture2D/g, 'texture')}
    ${GLSL_PYR}
    ${pyrFetch('tF', Q.dof)}
    void main() {
      vec3 sharp = texture(tSrc, vUv).rgb; if (any(isnan(sharp)) || any(isinf(sharp))) sharp = vec3(${TEST && PARAMS.has('nan') ? '50.0, 0.0, 50.0' : '0.0'});
      float coc = cocAt(linZ(texture(tDepth, vUv).r));
      vec3 c = sharp;
      if (coc > 0.6) {
        float l = log2(max(coc * 0.5, 1.0)) - 0.6;
        vec4 b = tFLod(l, vUv);
        if (b.a > 1e-4) c = mix(sharp, b.rgb / b.a, smoothstep(0.6, 2.5, coc));
      }
      if (any(isnan(c))) c = vec3(0.0);
      oColor = vec4(c, 1.0);
    }`,
  depthTest: false, depthWrite: false,
}));
// the picture in front of the focus, spread at its own size, laid over everything with its own soft edge
const dofNear = new FullScreenQuad(new THREE.ShaderMaterial({
  glslVersion: THREE.GLSL3,
  uniforms: Object.assign({}, pyrUniforms('tN'), pyrUniforms('tC')),
  vertexShader: 'out vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0., 1.); }',
  fragmentShader: /* glsl */`
    precision highp float;
    in vec2 vUv;
    uniform sampler2D ${Array.from({ length: Q.dof }, (_, i) => 'tN' + i).join(', ')};
    uniform sampler2D ${Array.from({ length: Q.dof }, (_, i) => 'tC' + i).join(', ')};
    out vec4 oColor;
    ${GLSL_PYR}
    ${pyrFetch('tN', Q.dof)}
    ${pyrFetch('tC', Q.dof)}
    void main() {
      // how big the blur in front is around here (read from a coarse level, so it reaches past the edges)
      vec4 cc = tCLod(3.0, vUv);
      if (cc.g < 1e-4) { oColor = vec4(0.0); return; }
      float coc = cc.r / cc.g;
      float l = log2(max(coc * 0.5, 1.0)) - 0.4;
      vec4 n = tNLod(l, vUv);
      float a = clamp(n.a * 1.6, 0.0, 1.0);
      vec3 c = n.a > 1e-4 ? n.rgb / n.a : vec3(0.0);
      oColor = vec4(c * a, a);
    }`,
  depthTest: false, depthWrite: false,
  transparent: true, blending: THREE.CustomBlending, blendSrc: THREE.OneFactor, blendDst: THREE.OneMinusSrcAlphaFactor,
  blendSrcAlpha: THREE.ZeroFactor, blendDstAlpha: THREE.OneFactor,
}));

// ---- bloom ----
const bloomDown = pass(/* glsl */`
  uniform sampler2D tSrc; uniform vec2 uTexel; uniform float uFirst; varying vec2 vUv;
  uniform float uThr;
  vec3 tap(vec2 o) { vec3 c = texture2D(tSrc, vUv + o * uTexel).rgb; if (any(isnan(c)) || any(isinf(c))) c = vec3(0.0); float m = max(c.r, max(c.g, c.b));
    // only what is brighter than the sky blooms (on the first step down)
    c *= mix(1.0, smoothstep(uThr, uThr * 2.0, m), uFirst);
    return c / (1.0 + uFirst * m * 0.02); }
  void main() {
    vec3 a = tap(vec2(-2.0, -2.0)), b = tap(vec2(0.0, -2.0)), c = tap(vec2(2.0, -2.0));
    vec3 d = tap(vec2(-1.0, -1.0)), e = tap(vec2(1.0, -1.0)), f = tap(vec2(-2.0, 0.0)), g = tap(vec2(0.0, 0.0)), h = tap(vec2(2.0, 0.0));
    vec3 i = tap(vec2(-1.0, 1.0)), j = tap(vec2(1.0, 1.0)), k = tap(vec2(-2.0, 2.0)), l = tap(vec2(0.0, 2.0)), m = tap(vec2(2.0, 2.0));
    vec3 s = (d + e + i + j) * 0.125 + (a + b + f + g) * 0.03125 + (b + c + g + h) * 0.03125 + (f + g + k + l) * 0.03125 + (g + h + l + m) * 0.03125;
    gl_FragColor = vec4(s, 1.0);
  }`, { tSrc: { value: null }, uTexel: { value: new THREE.Vector2() }, uFirst: { value: 0 }, uThr: { value: 1 } });
const bloomUp = pass(/* glsl */`
  uniform sampler2D tSrc, tLow; uniform vec2 uTexel; uniform float uMix; varying vec2 vUv;
  void main() {
    vec2 o = uTexel;
    vec3 s = texture2D(tLow, vUv).rgb * 4.0;
    s += (texture2D(tLow, vUv + vec2(o.x, 0.0)) + texture2D(tLow, vUv - vec2(o.x, 0.0)) + texture2D(tLow, vUv + vec2(0.0, o.y)) + texture2D(tLow, vUv - vec2(0.0, o.y))).rgb * 2.0;
    s += (texture2D(tLow, vUv + o) + texture2D(tLow, vUv - o) + texture2D(tLow, vUv + vec2(o.x, -o.y)) + texture2D(tLow, vUv + vec2(-o.x, o.y))).rgb;
    gl_FragColor = vec4(texture2D(tSrc, vUv).rgb + s / 16.0 * uMix, 1.0);
  }`, { tSrc: { value: null }, tLow: { value: null }, uTexel: { value: new THREE.Vector2() }, uMix: { value: 1 } });



// ---- light in the air: the key light's beams, with their shadows, through the haze (marched at a quarter size) ----
// the fire's shadow map: four views (90 degrees across, 120 up and down) in a square of four
const CSHADOW = (() => {
  const n = Q.cube || 1024;
  const dt = new THREE.DepthTexture(n * 2, n * 2); dt.compareFunction = THREE.LessEqualCompare; dt.minFilter = dt.magFilter = THREE.LinearFilter;
  const rt = new THREE.WebGLRenderTarget(n * 2, n * 2, { depthTexture: dt, depthBuffer: true, type: THREE.UnsignedByteType });
  const cams = Array.from({ length: 4 }, () => new THREE.PerspectiveCamera(120, Math.tan(Math.PI / 4) / Math.tan(Math.PI / 3), 0.1, 40));
  return { size: n, dt, rt, cams };
})();
const VOL = { d: 0, g: 0.6, max: 12, col: V3(1, 1, 1), noise: 0 };
const volPass = new FullScreenQuad(new THREE.ShaderMaterial({
  glslVersion: THREE.GLSL3,
  uniforms: Object.assign({ tDepth: { value: null }, uInvP: { value: new THREE.Matrix4() }, uInvV: { value: new THREE.Matrix4() }, uCam: { value: V3() }, uD: { value: 0 }, uG: { value: 0.6 }, uMax: { value: 12 }, uVCol: { value: V3(1, 1, 1) }, uNoise: { value: 0 } }, WORLDU),
  vertexShader: 'out vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0., 1.); }',
  fragmentShader: /* glsl */`
    precision highp float; precision highp sampler2DShadow;
    ${GLSL_NOISE}
    in vec2 vUv; out vec4 oColor;
    uniform sampler2D tDepth; uniform mat4 uInvP, uInvV; uniform vec3 uCam, uVCol; uniform float uD, uG, uMax, uNoise, uTime;
    uniform vec4 uKeyP, uKeySpot; uniform vec3 uKeyC; uniform float uKeyR; uniform mat4 uShadowM; uniform sampler2DShadow tShadow; uniform float uShadowOn;
    float lit(vec3 p) {
      if (uShadowOn < 0.5) return 1.0;
      vec4 s = uShadowM * vec4(p, 1.0); vec3 c = s.xyz / s.w * 0.5 + 0.5;
      if (any(lessThan(c.xy, vec2(0.0))) || any(greaterThan(c.xy, vec2(1.0))) || c.z > 1.0 || s.w < 0.0) return 0.0;
      return texture(tShadow, vec3(c.xy, c.z - 0.0015));
    }
    void main() {
      float z = texture(tDepth, vUv).r;
      vec4 ndc = vec4(vUv * 2.0 - 1.0, z * 2.0 - 1.0, 1.0), vp = uInvP * ndc; vp /= vp.w;
      vec3 wp = (uInvV * vp).xyz, rd = wp - uCam; float dist = min(length(rd), uMax); rd = normalize(rd);
      const int N = 40;
      float st = dist / float(N), j = fract(52.9829189 * fract(dot(gl_FragCoord.xy, vec2(0.06711056, 0.00583715))) + uTime * 0.37);
      vec3 acc = vec3(0.0);
      vec3 Ld = normalize(uKeyP.xyz);
      for (int i = 0; i < N; i++) {
        vec3 p = uCam + rd * (st * (float(i) + j));
        vec3 L; vec3 kc;
        if (uKeyP.w < 0.5) { L = Ld; kc = uKeyC; }
        else { vec3 d = uKeyP.xyz - p; float d2 = dot(d, d); L = d * inversesqrt(d2); kc = uKeyC / (d2 + uKeyR * uKeyR);
          if (uKeySpot.w > -1.5) kc *= smoothstep(uKeySpot.w, uKeySpot.w + 0.12, dot(-L, uKeySpot.xyz)); }
        float mu = dot(rd, L), ph = (1.0 - uG * uG) / pow(1.0 + uG * uG - 2.0 * uG * mu, 1.5) * 0.08;
        float den = uD * (uNoise > 0.0 ? 0.4 + 1.2 * n3(p * 1.7 + vec3(uTime * 0.05, 0.0, uTime * 0.03)) * uNoise + (1.0 - uNoise) * 0.6 : 1.0);
        acc += kc * lit(p) * ph * den * st;
      }
      oColor = vec4(acc * uVCol, 1.0);
    }`,
  depthTest: false, depthWrite: false,
}));
// spread it softly, keeping it off things in front (a few taps weighted by depth)
const volBlur = pass(/* glsl */`
  uniform sampler2D tSrc, tDepth; uniform vec2 uTexel, uDir; uniform vec2 uNF; varying vec2 vUv;
  float lz(float d) { return uNF.x * uNF.y / (uNF.y - d * (uNF.y - uNF.x)); }
  void main() {
    float z0 = lz(texture2D(tDepth, vUv).r); vec3 s = vec3(0.0); float w = 0.0;
    for (int i = -4; i <= 4; i++) {
      vec2 uv = vUv + uDir * uTexel * float(i) * 1.5;
      float z = lz(texture2D(tDepth, uv).r), k = exp(-float(i * i) / 10.0) * exp(-abs(z - z0) / max(z0 * 0.15, 0.05));
      s += texture2D(tSrc, uv).rgb * k; w += k;
    }
    gl_FragColor = vec4(s / max(w, 1e-4), 1.0);
  }`, { tSrc: { value: null }, tDepth: { value: null }, uTexel: { value: new THREE.Vector2() }, uDir: { value: new THREE.Vector2(1, 0) }, uNF: { value: new THREE.Vector2(0.05, 100) } });
const volAdd = pass(/* glsl */`uniform sampler2D tSrc; varying vec2 vUv; void main() { gl_FragColor = vec4(texture2D(tSrc, vUv).rgb, 1.0); }`, { tSrc: { value: null } },
  { transparent: true, blending: THREE.AdditiveBlending, premultipliedAlpha: true });
// ---- rays of light, streaming from the key light across the bright parts of the picture ----
const raysPass = pass(/* glsl */`
  uniform sampler2D tSrc; uniform vec2 uLight; uniform float uDecay, uDensity; varying vec2 vUv;
  void main() {
    vec2 d = (vUv - uLight) * uDensity / 48.0, uv = vUv; vec3 s = vec3(0.0); float w = 1.0;
    float j = fract(sin(dot(gl_FragCoord.xy, vec2(12.9898, 78.233))) * 43758.5453);
    uv -= d * j;
    for (int i = 0; i < 48; i++) { uv -= d; vec3 c = texture2D(tSrc, clamp(uv, 0.0, 1.0)).rgb; s += c * w; w *= uDecay; }
    gl_FragColor = vec4(s / 48.0, 1.0);
  }`, { tSrc: { value: null }, uLight: { value: new THREE.Vector2(0.5, 0.5) }, uDecay: { value: 0.975 }, uDensity: { value: 0.9 } });
// ---- the developed picture: bloom and rays added, the curve, the grade ----
const finalPass = pass(/* glsl */`
  uniform sampler2D tSrc, tBloom, tRays; uniform float uExposure, uBloom, uRays, uTime, uWarm; uniform vec3 uRayCol;
  varying vec2 vUv;
  float h12(vec2 p) { vec3 q = fract(vec3(p.xyx) * .1031); q += dot(q, q.yzx + 33.33); return fract((q.x + q.y) * q.z); }
  vec3 agxContrast(vec3 x) { vec3 x2 = x * x, x4 = x2 * x2; return 15.5 * x4 * x2 - 40.14 * x4 * x + 31.96 * x4 - 6.868 * x2 * x + 0.4298 * x2 + 0.1191 * x - 0.00232; }
  vec3 agx(vec3 c) {
    const mat3 toRec2020 = mat3(0.6274, 0.0691, 0.0164, 0.3293, 0.9195, 0.0880, 0.0433, 0.0113, 0.8956);
    const mat3 fromRec2020 = mat3(1.6605, -0.1246, -0.0182, -0.5876, 1.1329, -0.1006, -0.0728, -0.0083, 1.1187);
    const mat3 inset = mat3(0.856627153315983, 0.137318972929847, 0.11189821299995, 0.0951212405381588, 0.761241990602591, 0.0767994186031903, 0.0482516061458583, 0.101439036467562, 0.811302368396859);
    const mat3 outset = mat3(1.1271005818144368, -0.1413297634984383, -0.14132976349843826, -0.11060664309660323, 1.157823702216272, -0.11060664309660294, -0.016493938717834573, -0.016493938717834257, 1.2519364065950405);
    c = inset * (toRec2020 * c);
    c = clamp((log2(max(c, 1e-10)) + 12.47393) / 16.5, 0.0, 1.0);
    c = outset * agxContrast(c);
    return clamp(fromRec2020 * pow(max(c, 0.0), vec3(2.2)), 0.0, 1.0);
  }
  void main() {
    vec2 q = vUv - 0.5;
    float r2 = dot(q, q);
    vec2 ca = q * r2 * 0.006;
    vec3 c = vec3(texture2D(tSrc, vUv + ca).r, texture2D(tSrc, vUv).g, texture2D(tSrc, vUv - ca).b);
    vec3 b = texture2D(tBloom, vUv).rgb;
    c += b * uBloom * vec3(1.0, 0.92, 0.82) + b * uBloom * 0.3 * vec3(0.9, 0.45, 0.18);
    c += texture2D(tRays, vUv).rgb * uRays * uRayCol;
    c *= uExposure;
    c = agx(c);
    float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
    // shadows a little cool, lights a little warm (how much: uWarm)
    c *= mix(vec3(0.9, 0.97, 1.1), vec3(1.0), smoothstep(0.0, 0.3, l));
    c *= mix(vec3(1.0), vec3(1.06, 1.0, 0.9), smoothstep(0.3, 0.95, l) * uWarm);
    c = max(mix(vec3(l), c, 1.12), 0.0);
    c = mix(c, c * c * (3.0 - 2.0 * c), 0.25);
    c *= 1.0 - 0.55 * smoothstep(0.05, 0.6, r2 * 1.8);
    vec3 enc = mix(c * 12.92, 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055, step(0.0031308, c));
    // (a whisper of grain, finest in the dark: a night film shows it most, so it is kept small)
    float g = h12(gl_FragCoord.xy + fract(uTime * 7.13) * 619.0) - 0.5;
    enc += g * (0.009 * (1.0 - l) + 0.003);
    enc += (h12(gl_FragCoord.xy * 1.37 + 3.1) - 0.5) / 255.0;
    gl_FragColor = vec4(enc, 1.0);
  }`, { tSrc: { value: null }, tBloom: { value: null }, tRays: { value: null }, uExposure: { value: 1 }, uBloom: { value: 0.12 }, uRays: { value: 0 }, uRayCol: { value: V3(1, 0.85, 0.6) }, uTime: { value: 0 }, uWarm: { value: 1 } });
// ---- the glass: the picture turned to glass in a window (here only its fade is used) ----
// uGlass: how much of it is glass; uFlip: how far the pieces have turned from the old picture (tSnap) to the new;
// uWin: how big the window is (1: standing in the wall, large: we have gone through it); uWall: how much wall and
// candle light shows round it; uFade: to black
const GLASS = { glass: 0, flip: 1, win: 60, wall: 0, fade: 1, seed: 0, light: 1, y: 0 };
const glassPass = pass(/* glsl */`
  uniform sampler2D tSrc, tSnap; uniform float uGlass, uFlip, uWin, uWall, uFade, uTime, uAsp, uSeed, uLight, uWinY; uniform vec2 uRes;
  varying vec2 vUv;
  float h12(vec2 p) { vec3 q = fract(vec3(p.xyx) * .1031); q += dot(q, q.yzx + 33.33); return fract((q.x + q.y) * q.z); }
  vec2 h22(vec2 p) { vec3 q = fract(vec3(p.xyx) * vec3(.1031, .1030, .0973)); q += dot(q, q.yzx + 33.33); return fract((q.xx + q.yz) * q.zy); }
  float vn(vec2 x) { vec2 i = floor(x), f = fract(x); f = f * f * (3.0 - 2.0 * f); return mix(mix(h12(i), h12(i + vec2(1, 0)), f.x), mix(h12(i + vec2(0, 1)), h12(i + vec2(1, 1)), f.x), f.y); }
  float fbm(vec2 p) { float s = 0.0, a = 0.5; for (int k = 0; k < 5; k++) { s += a * vn(p); p = p * 2.03 + 7.7; a *= 0.5; } return s; }
  // the window: a pointed arch (two arcs of radius twice its half-width), its sill at y0; distance, negative inside
  float lancet(vec2 p, float a, float y0, float ys) {
    float box = max(abs(p.x) - a, y0 - p.y);
    float arch = max(length(p - vec2(-a, ys)) - 2.0 * a, length(p - vec2(a, ys)) - 2.0 * a);
    return p.y < ys ? box : max(arch, y0 - p.y);
  }
  // the pieces of glass: cells round jittered points; the nearest point, and how far to the lead between two cells
  vec3 cells(vec2 p, out vec2 site) {
    vec2 i = floor(p), f = fract(p); float d1 = 9.0, d2 = 9.0; vec2 best = vec2(0.0), bi = vec2(0.0);
    for (int y = -1; y <= 1; y++) for (int x = -1; x <= 1; x++) {
      vec2 g = vec2(float(x), float(y)), o = h22(i + g + uSeed) * 0.8 + 0.1, r = g + o - f;
      float d = dot(r, r);
      if (d < d1) { d2 = d1; d1 = d; best = r; bi = i + g; } else if (d < d2) d2 = d;
    }
    // the distance to the edge between the two nearest
    float e = 9.0;
    for (int y = -2; y <= 2; y++) for (int x = -2; x <= 2; x++) {
      vec2 g = bi - i + vec2(float(x), float(y)), o = h22(i + g + uSeed) * 0.8 + 0.1, r = g + o - f;
      if (dot(r - best, r - best) > 1e-5) e = min(e, dot(0.5 * (best + r), normalize(r - best)));
    }
    site = (bi + h22(bi + uSeed) * 0.8 + 0.1);
    return vec3(e, h12(bi + 17.0 + uSeed), h12(bi * 1.7 + 3.0 + uSeed));
  }
  // a colour as glass: richer, darker in its depths, a little like the old palettes (ruby, cobalt, gold, green)
  vec3 asGlass(vec3 c, float v) {
    float l = dot(c, vec3(0.299, 0.587, 0.114));
    vec3 sat = clamp(mix(vec3(l), c, 1.9), 0.0, 1.0);
    vec3 g = pow(sat, vec3(1.25)) * (0.8 + 0.45 * v);
    // lean a little toward the deep blues and ruby reds of old glass
    g = mix(g, g * vec3(0.95, 0.85, 1.25), smoothstep(0.35, 0.0, l) * 0.6);
    return g * 1.25 + vec3(0.02, 0.012, 0.03);
  }
  void main() {
    vec2 p = (vUv - 0.5) * vec2(uAsp, 1.0);
    // the window, scaled about the middle of the picture (we go through it as it grows)
    float a = 0.185, y0 = -0.355, ys = 0.43 - a * 1.732;
    vec2 wp = (p - vec2(0.0, uWinY)) / uWin + vec2(0.0, 0.012);
    float dw = lancet(wp, a, y0, ys) * uWin;
    float frame = lancet(wp, a + 0.028, y0 - 0.03, ys) * uWin;
    vec3 live = texture2D(tSrc, vUv).rgb, old = texture2D(tSnap, vUv).rgb;
    vec3 col = live;
    if (uGlass > 0.001) {
      // pieces about 1/26 of the window across, smaller near the middle where the picture is
      float sc = 26.0 / (2.0 * a * uWin);
      vec2 site; vec3 cl = cells(p * sc, site);
      vec2 suv = site / sc / vec2(uAsp, 1.0) + 0.5;
      // each piece turns from the old picture to the new at its own moment, and melts into the live picture at its own
      float tf = smoothstep(cl.y * 0.75, cl.y * 0.75 + 0.25, uFlip);
      // each piece melts into the live picture at its own moment: from the middle of the window outward
      float rad = length(site / sc * vec2(1.0, 0.8)) / max(0.45 * uWin, 0.2);
      float th = clamp(0.12 + 0.62 * (1.0 - rad) * 0.7 + 0.3 * cl.z, 0.0, 0.95);
      float melt = smoothstep(th - 0.08, th + 0.08, uGlass);
      vec3 cn = textureLod(tSrc, suv, 3.0).rgb, co = textureLod(tSnap, suv, 3.0).rgb;
      vec3 detN = texture2D(tSrc, vUv).rgb, detO = old;
      vec3 base = mix(co, cn, tf), det = mix(detO, detN, tf);
      // the painted lines on the glass: the picture's own darks, in brown, over the piece's colour
      float lb = dot(base, vec3(0.333)), ld = dot(det, vec3(0.333));
      float paint = clamp(1.0 - (lb - ld) * 2.2, 0.35, 1.15);
      vec3 gl = asGlass(base, cl.z) * paint;
      // the glass itself: never even, with streaks and seeds of air
      float tex = fbm(p * 90.0 + cl.y * 9.0) * 0.5 + fbm(vec2(p.x * 30.0, p.y * 300.0) + cl.z * 5.0) * 0.5;
      gl *= 0.78 + 0.45 * tex;
      gl *= 1.0 - 0.35 * smoothstep(0.12, 0.0, cl.x);   // darker where it is thick, by the lead
      // the lead between the pieces
      float lw = 0.055 + 0.02 * uWin;
      float lead = 1.0 - smoothstep(lw * 0.6, lw, cl.x);
      vec3 leadC = vec3(0.025, 0.022, 0.02) + vec3(0.06, 0.05, 0.04) * smoothstep(lw, lw * 0.3, abs(cl.x - lw * 0.45));
      gl = mix(gl, leadC, lead);
      // light through it
      gl *= uLight;
      // the flip glints as each piece turns
      gl += vec3(1.0, 0.85, 0.6) * smoothstep(0.0, 0.5, tf) * smoothstep(1.0, 0.5, tf) * 0.6 * step(0.5, 1.0 - lead);
      // a glint of light where a piece is going
      float going = smoothstep(0.0, 0.5, melt) * smoothstep(1.0, 0.5, melt) * step(uGlass, 0.98);
      col = mix(mix(old, live, tf), gl, melt) + vec3(1.0, 0.85, 0.6) * going * 0.35 * (1.0 - lead);
    }
    // round the window: the wall, its stone frame, the candles below
    float inside = smoothstep(0.0015, -0.0015, dw);
    if (uWall > 0.001 && inside < 0.999) {
      float y = p.y;
      // candle light from below, warm on the stone; their flames, a row of them in front
      vec3 wall = vec3(0.03, 0.022, 0.016) * (0.55 + 0.8 * fbm(p * 7.0 + 3.0)) * (0.6 + 0.5 * fbm(vec2(p.x * 2.0, p.y * 14.0)));
      // courses of stone
      float course = abs(fract(y * 9.0 + 0.5 * step(0.5, fract(p.x * 4.5 + floor(y * 9.0) * 0.5))) - 0.5);
      float joint = abs(fract(p.x * 4.5 + floor(y * 9.0) * 0.5) - 0.5);
      wall *= 1.0 - 0.45 * (smoothstep(0.46, 0.5, course) + smoothstep(0.46, 0.5, joint));
      float candle = 0.0; vec3 flames = vec3(0.0);
      for (int i = 0; i < 9; i++) {
        float fi = float(i), cx = (fi - 4.0) * 0.11 * max(uAsp, 1.0) / 1.0 + (h12(vec2(fi, 3.0)) - 0.5) * 0.05;
        float hgt = 0.05 + 0.07 * h12(vec2(fi, 7.0)), base = -0.5 + 0.02 * h12(vec2(fi, 9.0));
        float fl = 0.85 + 0.15 * sin(uTime * (7.0 + fi) + fi * 4.0) * sin(uTime * 3.3 + fi);
        vec2 fp = vec2(cx + 0.004 * sin(uTime * 5.0 + fi * 2.0), base + hgt + 0.022);
        // the wax, lit from its own flame
        vec2 bp = p - vec2(cx, base + hgt * 0.5);
        float body = smoothstep(0.004, 0.0, max(abs(bp.x) - 0.016, abs(bp.y) - hgt * 0.5));
        flames += body * vec3(0.55, 0.42, 0.3) * (0.4 + 0.6 * smoothstep(-hgt * 0.5, hgt * 0.5, bp.y)) * fl * 0.6;
        // the flame and its glow
        vec2 q = (p - fp) * vec2(1.0, 0.55);
        float f = exp(-dot(q, q) * 9000.0), glow = exp(-length(p - fp) * 22.0);
        flames += vec3(1.0, 0.75, 0.4) * f * 3.0 * fl + vec3(1.0, 0.55, 0.22) * glow * 0.22 * fl;
        candle += exp(-length((p - fp) * vec2(1.0, 0.8)) * 3.2) * fl;
      }
      wall += vec3(1.0, 0.55, 0.22) * candle * 0.05 * (0.6 + 0.6 * fbm(p * 6.0));
      // the window's stone frame: a moulding, catching the candle light from below
      float fr = smoothstep(0.002, -0.002, frame) * (1.0 - inside);
      vec3 stone = vec3(0.09, 0.075, 0.06) * (0.6 + 0.6 * fbm(p * 30.0)) * (0.4 + candle * 0.5);
      stone *= 0.7 + 0.5 * smoothstep(0.0, -0.028 * uWin, frame);
      // light from the glass spilling on the frame
      vec3 spill = textureLod(tSrc, vec2(0.5, 0.55), 6.0).rgb * 0.25 * uGlass * uLight;
      wall = mix(wall, stone + spill * 0.4, fr);
      wall += spill * 0.15 * exp(-max(dw, 0.0) * 9.0);
      vec3 outside = (wall + flames) * uWall;
      col = mix(outside, col, inside);
    }
    col *= uFade;
    gl_FragColor = vec4(col, 1.0);
  }`, { tSrc: { value: null }, tSnap: { value: null }, uGlass: { value: 0 }, uFlip: { value: 1 }, uWin: { value: 60 }, uWall: { value: 0 }, uFade: { value: 1 }, uTime: { value: 0 }, uAsp: { value: 1 }, uSeed: { value: 0 }, uLight: { value: 1 }, uWinY: { value: 0 }, uRes: { value: new THREE.Vector2() } });
const mixPass = pass(/* glsl */`uniform sampler2D tA, tB; uniform float uMix; varying vec2 vUv;
  void main() { vec3 a = texture2D(tA, vUv).rgb, b = texture2D(tB, vUv).rgb; gl_FragColor = vec4(mix(a, b, uMix), 1.0); }`, { tA: { value: null }, tB: { value: null }, uMix: { value: 0 } });
const copyPass = pass(/* glsl */`uniform sampler2D tSrc; varying vec2 vUv; void main() { gl_FragColor = texture2D(tSrc, vUv); }`, { tSrc: { value: null } });

function lensUpdate() {
  FU.uFocus.value = Math.max(1e-4, CAM.focus);
  FU.uAperture.value = CAM.ap;
  FU.uPxScale.value = RT.H / (2 * Math.tan(camera.fov * D2R / 2));
  FU.uMaxCoC.value = Math.min(LENS.maxCoC, RT.H * 0.2);
  FU.uNearFar.value.set(camera.near, camera.far);
  FU.uRes.value.set(RT.W, RT.H);
}
// ---- soft things in the air, drawn after the blur: they read the depth themselves ----
const airScene = new THREE.Scene();
const AIRU = { tDepth: { value: null }, uRes: { value: new THREE.Vector2(1, 1) } };
// ---- where the key light's shadow map looks: a box round a point (a sun, the moon) or a cone from the light ----
const SHADOWS = { on: true, focus: V3(), size: 6, fov: 70, near: 0.1, far: 30, soft: 1.5, bias: 0.0006, cube: false };
const LENSX = { rays: 0, rayCol: V3(1, 0.85, 0.6), decay: 0.975, density: 0.9, warm: 1, snapNow: false };
const _lp = new THREE.Vector4();
function developFrame() {
  const r = renderer;
  lensUpdate();
  // the key light's shadows
  WORLDU.uShadowOn.value = 0;
  // (the shadow map must exist before anything that reads it is drawn, even when it is not used)
  if (!SSHADOW.ready) { r.setRenderTarget(SSHADOW.rt); r.setClearColor(0x000000, 0); r.clear(); SSHADOW.ready = true; }
  const K = WORLDU.uKeyP.value;
  WORLDU.uShadowCube.value = 0; WORLDU.tShadow.value = SSHADOW.dt;
  if (SHADOWS.on && SHADOWS.cube && K.w > 0.5 && WORLDU.uKeyC.value.lengthSq() > 1e-6) {
    // a fire: four views from it (east, west, south, north), each a quarter of one map
    const C = CSHADOW, n = C.size;
    const vis = [];
    worldScene.traverse((o) => { if (o.isMesh) { vis.push([o, o.visible]); o.visible = o.visible && casters.has(o); } });
    for (const f of SHADOW_SWAP) f(true);
    shadowMode(true);
    r.setRenderTarget(C.rt); r.setClearColor(0x000000, 0); C.rt.scissorTest = false; C.rt.viewport.set(0, 0, n * 2, n * 2); r.setRenderTarget(C.rt); r.clear();
    const dirs = [V3(1, 0, 0), V3(-1, 0, 0), V3(0, 0, 1), V3(0, 0, -1)];
    for (let f = 0; f < 4; f++) {
      const cam = C.cams[f]; cam.near = SHADOWS.near; cam.far = SHADOWS.far; cam.updateProjectionMatrix();
      cam.position.set(K.x, K.y, K.z); cam.up.set(0, 1, 0); cam.lookAt(K.x + dirs[f].x, K.y, K.z + dirs[f].z); cam.updateMatrixWorld();
      WORLDU.uCubeM.value[f].multiplyMatrices(cam.projectionMatrix, cam.matrixWorldInverse);
      const x = (f % 2) * n, y = Math.floor(f / 2) * n;
      C.rt.viewport.set(x, y, n, n); C.rt.scissor.set(x, y, n, n); C.rt.scissorTest = true; r.setRenderTarget(C.rt);
      r.render(worldScene, cam);
    }
    C.rt.scissorTest = false; C.rt.viewport.set(0, 0, n * 2, n * 2);
    shadowMode(false);
    for (const f of SHADOW_SWAP) f(false);
    for (const [o, v] of vis) o.visible = v;
    WORLDU.tShadow.value = C.dt; WORLDU.uShadowCube.value = 1; WORLDU.uShadowOn.value = 1;
    WORLDU.uShadowSoft.value = SHADOWS.soft; WORLDU.uShadowBias.value = SHADOWS.bias;
  } else
  if (SHADOWS.on && WORLDU.uKeyC.value.lengthSq() > 1e-6) {
    const S = SSHADOW, c = SHADOWS.focus;
    let cam;
    if (K.w < 0.5) {
      cam = S.ortho; const h = SHADOWS.size;
      cam.left = cam.bottom = -h; cam.right = cam.top = h; cam.near = 0.1; cam.far = h * 8 + 60; cam.updateProjectionMatrix();
      cam.position.copy(c).addScaledVector(V3(K.x, K.y, K.z).normalize(), h * 4 + 30);
    } else {
      cam = S.persp; cam.fov = SHADOWS.fov; cam.near = SHADOWS.near; cam.far = SHADOWS.far; cam.aspect = 1; cam.updateProjectionMatrix();
      cam.position.set(K.x, K.y, K.z);
    }
    cam.up.set(0, 1, 0); if (Math.abs(V3().subVectors(c, cam.position).normalize().y) > 0.98) cam.up.set(0, 0, 1);
    cam.lookAt(c); cam.updateMatrixWorld();
    WORLDU.uShadowM.value.multiplyMatrices(cam.projectionMatrix, cam.matrixWorldInverse);
    WORLDU.uShadowSoft.value = SHADOWS.soft; WORLDU.uShadowBias.value = SHADOWS.bias;
    const vis = [];
    worldScene.traverse((o) => { if (o.isMesh) { vis.push([o, o.visible]); o.visible = o.visible && casters.has(o); } });
    r.setRenderTarget(S.rt); r.setClearColor(0x000000, 0); r.clear();
    for (const f of SHADOW_SWAP) f(true);
    shadowMode(true); r.render(worldScene, cam); shadowMode(false);
    for (const f of SHADOW_SWAP) f(false);
    for (const [o, v] of vis) o.visible = v;
    WORLDU.uShadowOn.value = 1;
  }
  // the scale we are at; across a change of scale, the next one too, the two laid together
  const LA = LV.a, LB = LV.b;
  r.setRenderTarget(RT.scene); r.setClearColor(LA.bg, 1); r.clear();
  drawLevel(r, LA, camera);
  let lit = RT.scene.texture;
  if (LB && LV.mix > 0.001) {
    r.setRenderTarget(RT.scene2); r.setClearColor(LB.bg, 1); r.clear();
    drawLevel(r, LB, LV.camB);
    const M = mixPass.material.uniforms; M.tA.value = RT.scene.texture; M.tB.value = RT.scene2.texture; M.uMix.value = LV.mix;
    r.setRenderTarget(RT.mixed); mixPass.render(r); lit = RT.mixed.texture;
  }
  const P = dofPrep.material.uniforms;
  P.tSrc.value = lit; P.tDepth.value = RT.depth; P.uTexel.value.set(1 / RT.W, 1 / RT.H);
  r.setRenderTarget(RT.dof[0]); dofPrep.render(r);
  const D = dofDown.material.uniforms;
  for (let i = 1; i < RT.dof.length; i++) {
    const s = RT.dof[i - 1];
    D.t0.value = s.textures[0]; D.t1.value = s.textures[1]; D.t2.value = s.textures[2]; D.uTexel.value.set(1 / s.width, 1 / s.height);
    r.setRenderTarget(RT.dof[i]); dofDown.render(r);
  }
  const B = dofBase.material.uniforms, N2 = dofNear.material.uniforms;
  for (let i = 0; i < Q.dof; i++) { B['tF' + i].value = RT.dof[i].textures[0]; N2['tN' + i].value = RT.dof[i].textures[1]; N2['tC' + i].value = RT.dof[i].textures[2]; }
  B.tSrc.value = lit; B.tDepth.value = RT.depth;
  r.setRenderTarget(RT.comp); dofBase.render(r);
  dofNear.render(r);
  // the key light's beams in the haze
  if (VOL.d > 0.0001 && WORLDU.uShadowOn.value > 0.5) {
    const V = volPass.material.uniforms;
    V.tDepth.value = RT.depth; V.uInvP.value.copy(camera.projectionMatrixInverse); V.uInvV.value.copy(camera.matrixWorld); V.uCam.value.copy(camera.position);
    V.uD.value = VOL.d; V.uG.value = VOL.g; V.uMax.value = VOL.max; V.uVCol.value.copy(VOL.col); V.uNoise.value = VOL.noise;
    r.setRenderTarget(RT.vol); volPass.render(r);
    const VB = volBlur.material.uniforms; VB.tDepth.value = RT.depth; VB.uNF.value.set(camera.near, camera.far); VB.uTexel.value.set(1 / RT.vol.width, 1 / RT.vol.height);
    VB.tSrc.value = RT.vol.texture; VB.uDir.value.set(1, 0); r.setRenderTarget(RT.vol2); volBlur.render(r);
    VB.tSrc.value = RT.vol2.texture; VB.uDir.value.set(0, 1); r.setRenderTarget(RT.vol); volBlur.render(r);
    volAdd.material.uniforms.tSrc.value = RT.vol.texture; r.setRenderTarget(RT.comp); volAdd.render(r);
  }
  AIRU.tDepth.value = RT.depth; AIRU.uRes.value.set(RT.W, RT.H);
  r.render(airScene, camera);
  const BD = bloomDown.material.uniforms, BU = bloomUp.material.uniforms;
  let s = RT.comp;
  for (let i = 0; i < RT.bloom.length; i++) {
    BD.tSrc.value = s.texture; BD.uTexel.value.set(1 / s.width, 1 / s.height); BD.uFirst.value = i === 0 ? 1 : 0; BD.uThr.value = 1.0 / LENS.exposure;
    r.setRenderTarget(RT.bloom[i]); bloomDown.render(r); s = RT.bloom[i];
  }
  let low = RT.bloom[RT.bloom.length - 1];
  for (let i = RT.bloom.length - 2; i >= 0; i--) {
    BU.tSrc.value = RT.bloom[i].texture; BU.tLow.value = low.texture; BU.uTexel.value.set(1 / low.width, 1 / low.height); BU.uMix.value = 1;
    r.setRenderTarget(RT.up[i]); bloomUp.render(r); low = RT.up[i];
  }
  // rays from the key light (when it is in front of us)
  const FP = finalPass.material.uniforms;
  FP.uRays.value = 0;
  if (LENSX.rays > 0.001) {
    if (K.w < 0.5) _lp.set(camera.position.x + K.x * 1000, camera.position.y + K.y * 1000, camera.position.z + K.z * 1000, 1); else _lp.set(K.x, K.y, K.z, 1);
    if (LENSX.rayAt) _lp.set(LENSX.rayAt.x, LENSX.rayAt.y, LENSX.rayAt.z, 1);
    _lp.applyMatrix4(camera.matrixWorldInverse);
    if (_lp.z < 0) {
      _lp.applyMatrix4(camera.projectionMatrix);
      const RP = raysPass.material.uniforms;
      RP.tSrc.value = RT.bloom[0].texture; RP.uLight.value.set(_lp.x / _lp.w * 0.5 + 0.5, _lp.y / _lp.w * 0.5 + 0.5); RP.uDecay.value = LENSX.decay; RP.uDensity.value = LENSX.density;
      r.setRenderTarget(RT.rays); raysPass.render(r);
      FP.uRays.value = LENSX.rays; FP.uRayCol.value.copy(LENSX.rayCol);
    }
  }
  FP.tSrc.value = RT.comp.texture; FP.tBloom.value = low.texture; FP.tRays.value = RT.rays.texture; FP.uExposure.value = LENS.exposure; FP.uWarm.value = LENSX.warm;
  const G = glassPass.material.uniforms;
  const glassy = GLASS.glass > 0.001 || GLASS.wall > 0.001;
  r.setRenderTarget(RT.ldr); finalPass.render(r);
  if (LENSX.snapNow) { copyPass.material.uniforms.tSrc.value = RT.ldr.texture; r.setRenderTarget(RT.snap); copyPass.render(r); LENSX.snapNow = false; }
  G.tSrc.value = RT.ldr.texture; G.tSnap.value = RT.snap.texture;
  G.uGlass.value = GLASS.glass; G.uFlip.value = GLASS.flip; G.uWin.value = GLASS.win; G.uWall.value = GLASS.wall; G.uFade.value = GLASS.fade; G.uWinY.value = GLASS.y;
  G.uAsp.value = RT.W / RT.H; G.uSeed.value = GLASS.seed; G.uLight.value = GLASS.light; G.uRes.value.set(RT.W, RT.H);
  r.setRenderTarget(believeFilmTarget); glassPass.render(r);
  void glassy;
}
// for the shadow map, everything is drawn with its twin material that does not read the shadow map
function shadowMode(on) {
  for (const m of casters) {
    if (!m.material) continue;
    if (!m.material.userData.shadow && !m.userData.lit) continue;
    if (on) { m.userData.lit = m.material; m.material = m.material.userData.shadow; }
    else if (m.userData.lit) { m.material = m.userData.lit; m.userData.lit = null; }
  }
}
// the key light's shadow map
const SSHADOW = (() => {
  const dt = new THREE.DepthTexture(Q.shadow, Q.shadow); dt.compareFunction = THREE.LessEqualCompare; dt.minFilter = dt.magFilter = THREE.LinearFilter;
  const rt = new THREE.WebGLRenderTarget(Q.shadow, Q.shadow, { depthTexture: dt, depthBuffer: true, type: THREE.UnsignedByteType });
  WORLDU.tShadow.value = dt;
  return { rt, dt, ortho: new THREE.OrthographicCamera(-10, 10, 10, -10, 0.1, 100), persp: new THREE.PerspectiveCamera(70, 1, 0.1, 30), ready: false };
})();
// =====================================================================
// Paper. Every piece of the book (its pages and covers, and every piece
// that folds up out of them) is a flat cut shape of card a fraction of
// a millimetre thick: its outline and any holes cut in it, laid out
// flat in centimetres, printed on one side or both. Each frame the
// folding says where each piece is (a corner and two directions along
// it), and one drawing of all of them puts every piece in its place.
// The print is watercolour and ink, drawn once into one large sheet;
// the card itself has fibres, pale cut edges, and lets a little light
// through when the lamp is behind it. Gold leaf shines.
// =====================================================================
const CARD = 0.045;       // a pop-up piece's thickness (cm)
const PAPER_COL = [0.94, 0.9, 0.81];
const PAPER = { faces: [], tex: null, data: null, atlas: null, D: 20 };
// a piece: { poly: outline [[x, y], ...] in cm, as seen from its printed side; holes; t: thickness;
//   print(g): the printed side, drawn in those same centimetres; back(g): the other side (as seen from behind), or
//   backCol: its plain colour; trans: how much light shows through; glow: the colour it gives off (a lit window);
//   dens: how finely it is printed (pages less finely than small pieces); base: the paper's colour under the print }
function piece(o) {
  const f = Object.assign({ holes: [], t: CARD, backCol: PAPER_COL, trans: 0.32, glow: [0, 0, 0], rough: 0.88, dens: 1, base: PAPER_COL, edgeCol: [0.84, 0.8, 0.7] }, o);
  f.i = PAPER.faces.length; f.o = V3(); f.ex = V3(1, 0, 0); f.ey = V3(0, 1, 0); f.vis = 1; f.lit = 1;
  // (outlines go counterclockwise, holes clockwise)
  const area = (p) => { let s = 0; for (let k = 0; k < p.length; k++) { const a = p[k], b = p[(k + 1) % p.length]; s += a[0] * b[1] - b[0] * a[1]; } return s / 2; };
  if (area(f.poly) < 0) f.poly = f.poly.slice().reverse();
  f.holes = f.holes.map((h) => (area(h) > 0 ? h.slice().reverse() : h));
  let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
  for (const [x, y] of f.poly) { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); }
  f.box = [x0, y0, x1, y1];
  PAPER.faces.push(f);
  return f;
}
// put a piece somewhere: its corner, and the directions of its x and y (unit, at right angles)
function setFrame(f, o, ex, ey) { f.o.copy(o); f.ex.copy(ex); f.ey.copy(ey); }

// ---- the print: drawing tools, in centimetres on the piece (x to the right, y up, as seen from the printed side) ----
const INK = '#2b1d14';
const RNG = mulberry32(777);
const rgb = (c, a = 1) => `rgba(${Math.round(c[0] * 255)},${Math.round(c[1] * 255)},${Math.round(c[2] * 255)},${a})`;
const hex3 = (h) => { const n = parseInt(h.slice(1), 16); return [(n >> 16 & 255) / 255, (n >> 8 & 255) / 255, (n & 255) / 255]; };
const mixc = (a, b, t) => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
const G = {
  // a path through points (closed or not)
  path(ctx, pts, close = true) { ctx.beginPath(); ctx.moveTo(pts[0][0], pts[0][1]); for (let k = 1; k < pts.length; k++) ctx.lineTo(pts[k][0], pts[k][1]); if (close) ctx.closePath(); },
  // a watercolour wash over a box: the colour, then darker and lighter blooms, then grains of pigment
  wash(ctx, x0, y0, x1, y1, col, o = {}) {
    const r = o.rng || RNG, w = x1 - x0, h = y1 - y0, n = Math.min(90, 6 + Math.floor(w * h * (o.k ?? 0.6)));
    ctx.fillStyle = typeof col === 'string' ? col : rgb(col); ctx.fillRect(x0, y0, w, h);
    const c = typeof col === 'string' ? hex3(col) : col;
    for (let k = 0; k < n; k++) {
      const x = x0 + r() * w, y = y0 + r() * h, rad = (0.4 + r() * 2.2) * (o.blob ?? 1), dk = r() < 0.55;
      const cc = dk ? mixc(c, [0.12, 0.08, 0.06], 0.18 + r() * 0.2) : mixc(c, [1, 0.98, 0.92], 0.15 + r() * 0.2);
      const gr = ctx.createRadialGradient(x, y, 0, x, y, rad);
      gr.addColorStop(0, rgb(cc, 0.28 * (o.var ?? 1))); gr.addColorStop(1, rgb(cc, 0));
      ctx.fillStyle = gr; ctx.fillRect(x - rad, y - rad, rad * 2, rad * 2);
    }
    const ng = Math.min(2500, Math.floor(w * h * (o.grain ?? 6)));
    for (let k = 0; k < ng; k++) { ctx.fillStyle = rgb(mixc(c, [0.1, 0.07, 0.05], 0.3 + r() * 0.3), 0.12 + r() * 0.15); const s = 0.02 + r() * 0.035; ctx.fillRect(x0 + r() * w, y0 + r() * h, s, s); }
  },
  // the wash pools darker at its edges
  rim(ctx, pts, col, wd = 0.25, a = 0.22) {
    for (let k = 0; k < 3; k++) { G.path(ctx, pts); ctx.strokeStyle = rgb(col, a / (k + 1)); ctx.lineWidth = wd * (1 + k * 1.2); ctx.lineJoin = 'round'; ctx.stroke(); }
  },
  // an ink line, drawn by hand: wobbling a little, thicker and thinner
  ink(ctx, pts, w = 0.04, col = INK, o = {}) {
    const r = o.rng || RNG, j = o.jit ?? 0.018;
    ctx.strokeStyle = col; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    for (let k = 0; k < pts.length - 1; k++) {
      const a = pts[k], b = pts[k + 1], L = Math.hypot(b[0] - a[0], b[1] - a[1]), n = Math.max(1, Math.ceil(L / 0.6));
      ctx.beginPath(); ctx.moveTo(a[0], a[1]);
      for (let s = 1; s <= n; s++) { const t = s / n; ctx.lineTo(lerp(a[0], b[0], t) + (s < n ? (r() - 0.5) * j * 2 : 0), lerp(a[1], b[1], t) + (s < n ? (r() - 0.5) * j * 2 : 0)); }
      ctx.lineWidth = w * (0.75 + r() * 0.5); ctx.stroke();
    }
  },
  inkShape(ctx, pts, w = 0.04, col = INK, o = {}) { G.ink(ctx, pts.concat([pts[0]]), w, col, o); },
  // hatching across a box (clip to the shape first)
  hatch(ctx, x0, y0, x1, y1, ang, gap, w = 0.022, col = INK, a = 0.55) {
    const c = Math.cos(ang), s = Math.sin(ang), cx = (x0 + x1) / 2, cy = (y0 + y1) / 2, R = Math.hypot(x1 - x0, y1 - y0) / 2;
    ctx.strokeStyle = col; ctx.globalAlpha = a; ctx.lineWidth = w; ctx.beginPath();
    for (let d = -R; d <= R; d += gap) { const px = cx - s * d, py = cy + c * d; ctx.moveTo(px - c * R, py - s * R); ctx.lineTo(px + c * R, py + s * R); }
    ctx.stroke(); ctx.globalAlpha = 1;
  },
  // shade a box from one side to the other (a round tower, the turn of a wall)
  shade(ctx, x0, y0, x1, y1, a0, a1, col = [0.1, 0.07, 0.06], vertical = false) {
    const gr = vertical ? ctx.createLinearGradient(0, y0, 0, y1) : ctx.createLinearGradient(x0, 0, x1, 0);
    gr.addColorStop(0, rgb(col, a0)); gr.addColorStop(1, rgb(col, a1)); ctx.fillStyle = gr; ctx.fillRect(x0, y0, x1 - x0, y1 - y0);
  },
  // courses of stone: rows of blocks, each a slightly different colour, inked
  stones(ctx, x0, y0, x1, y1, bh, col, o = {}) {
    const r = o.rng || RNG, c = typeof col === 'string' ? hex3(col) : col;
    let row = 0;
    for (let y = y0; y < y1; y += bh, row++) {
      let x = x0 - (row % 2) * bh * 0.9;
      while (x < x1) {
        const bw = bh * (1.3 + r() * 1.2), cc = mixc(c, r() < 0.5 ? [0.2, 0.16, 0.13] : [1, 0.97, 0.9], r() * 0.22);
        ctx.fillStyle = rgb(cc, 0.55); ctx.fillRect(x + 0.03, y + 0.03, bw - 0.06, bh - 0.06);
        if (o.ink !== false) { ctx.strokeStyle = rgb([0.17, 0.12, 0.09], 0.55 + r() * 0.3); ctx.lineWidth = 0.022 + r() * 0.014; ctx.strokeRect(x + 0.03, y + 0.03, bw - 0.06, bh - 0.06); }
        x += bw;
      }
    }
  },
  // rows of shingles or tiles: scallops
  scallops(ctx, x0, y0, x1, y1, s, col, o = {}) {
    const r = o.rng || RNG, c = typeof col === 'string' ? hex3(col) : col;
    let row = 0;
    for (let y = y1; y > y0 - s; y -= s * 0.62, row++) {
      for (let x = x0 - (row % 2) * s * 0.5; x < x1 + s; x += s) {
        ctx.beginPath(); ctx.arc(x, y, s * 0.5, Math.PI, 2 * Math.PI, true);
        ctx.fillStyle = rgb(mixc(c, r() < 0.5 ? [0.1, 0.08, 0.1] : [1, 1, 1], r() * 0.18), 0.9); ctx.fill();
        ctx.strokeStyle = rgb([0.15, 0.1, 0.1], 0.6); ctx.lineWidth = 0.022; ctx.stroke();
      }
    }
  },
  // a window or door: an arch (or a box), filled
  arch(ctx, x, y, w, h, fill, o = {}) {
    const rr = Math.min(w / 2, h);
    ctx.beginPath(); ctx.moveTo(x - w / 2, y); ctx.lineTo(x - w / 2, y + h - rr);
    if (o.square) { ctx.lineTo(x - w / 2, y + h); ctx.lineTo(x + w / 2, y + h); } else ctx.arc(x, y + h - rr, w / 2, Math.PI, 0, true);
    ctx.lineTo(x + w / 2, y); ctx.closePath();
    if (fill) { ctx.fillStyle = fill; ctx.fill(); }
    if (o.ink !== false) { ctx.strokeStyle = INK; ctx.lineWidth = o.lw ?? 0.035; ctx.stroke(); }
  },
  // gold leaf: what is drawn in fn is laid in gold (the sheet's alpha marks it; the light makes it shine)
  gold(ctx, fn) {
    ctx.save(); fn('#d9a440'); ctx.globalCompositeOperation = 'destination-out'; ctx.globalAlpha = 0.5; fn('#000'); ctx.restore();
  },
  text(ctx, s, x, y, size, col = INK, o = {}) {
    ctx.save(); ctx.translate(x, y); ctx.scale(1, -1); ctx.font = `${o.italic ? 'italic ' : ''}${o.weight || 600} ${size}px ${o.font || 'Georgia, "Times New Roman", serif'}`;
    ctx.textAlign = o.align || 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = col; ctx.fillText(s, 0, 0); ctx.restore();
  },
};

// ---- laying out the printed sheet: every printed side its own patch; the finest scale that fits ----
function buildAtlas() {
  const S = Q.atlas, M = 0.3, regs = [];
  for (const f of PAPER.faces) {
    for (const sd of ['print', 'back']) {
      if (!f[sd]) continue;
      const [x0, y0, x1, y1] = f.box;
      regs.push({ f, sd, w: x1 - x0 + 2 * M, h: y1 - y0 + 2 * M });
    }
  }
  let A = 0; for (const g of regs) A += g.w * g.h * g.f.dens * g.f.dens;
  let D = Math.min(56, Math.sqrt(S * S * 0.8 / Math.max(A, 1)));
  // shelves, tallest first
  for (let tries = 0; tries < 30; tries++) {
    regs.sort((a, b) => b.h * b.f.dens - a.h * a.f.dens);
    let x = 0, y = 0, rowH = 0, ok = true;
    for (const g of regs) {
      const w = Math.ceil(g.w * D * g.f.dens) + 2, h = Math.ceil(g.h * D * g.f.dens) + 2;
      if (x + w > S) { x = 0; y += rowH; rowH = 0; }
      if (y + h > S) { ok = false; break; }
      g.px = x; g.py = y; g.pw = w; g.ph = h; x += w; rowH = Math.max(rowH, h);
    }
    if (ok) break;
    D *= 0.95;
  }
  PAPER.D = D;
  const cv = document.createElement('canvas'); cv.width = cv.height = S;
  const ctx = cv.getContext('2d', { willReadFrequently: true });
  ctx.fillStyle = rgb(PAPER_COL); ctx.fillRect(0, 0, S, S);
  for (const g of regs) {
    const f = g.f, d = D * f.dens, [x0, y0, x1, y1] = f.box, back = g.sd === 'back';
    // (the back is seen from behind: mirrored)
    const sx = back ? -d : d, ox = back ? g.px + 1 + (x1 + M) * d : g.px + 1 - (x0 - M) * d, oy = g.py + 1 + (y1 + M) * d;
    g.map = [sx / S, ox / S, -d / S, oy / S];   // u = x * a + b, v = y * c + e (x, y on the piece as laid out)
    ctx.save();
    ctx.beginPath(); ctx.rect(g.px, g.py, g.pw, g.ph); ctx.clip();
    // (the back is drawn as seen from behind: its x runs the other way)
    ctx.setTransform(d, 0, 0, -d, ox, oy);
    const mir = (p) => p.map(([x, y]) => [-x, y]);
    const poly = back ? mir(f.poly) : f.poly, holes = back ? f.holes.map(mir) : f.holes, box = back ? [-x1, y0, -x0, y1] : f.box;
    ctx.fillStyle = rgb(f.base); ctx.fillRect(box[0] - M * 2, box[1] - M * 2, box[2] - box[0] + M * 4, box[3] - box[1] + M * 4);
    G.path(ctx, poly); for (const h of holes) { ctx.moveTo(h[0][0], h[0][1]); for (let k = 1; k < h.length; k++) ctx.lineTo(h[k][0], h[k][1]); ctx.closePath(); }
    ctx.clip('evenodd');
    try { f[g.sd]({ ctx, f, poly, holes, box, back }); } catch (e) { console.error(e); }
    ctx.restore();
    if (back) f.mapB = g.map; else f.mapF = g.map;
  }
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace; tex.flipY = false; tex.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
  tex.minFilter = THREE.LinearMipmapLinearFilter; tex.magFilter = THREE.LinearFilter; tex.generateMipmaps = true;
  PAPER.atlas = tex;
  return tex;
}

// ---- the card, cut out: its two faces and its edges, every piece in one geometry ----
function buildPaperGeometry() {
  const P = [], FA = [], SD = [], N2 = [], UV = [], BK = [], GL = [], EC = [], idx = [];
  const lin = (c) => c.map((v) => Math.pow(v, 2.2));
  for (const f of PAPER.faces) {
    const h = f.t / 2, cont = f.poly.map(([x, y]) => new THREE.Vector2(x, y)), holes = f.holes.map((hh) => hh.map(([x, y]) => new THREE.Vector2(x, y)));
    const tris = THREE.ShapeUtils.triangulateShape(cont, holes), pts = cont.concat(...holes);
    const bk = lin(f.backCol).concat([f.trans]), gl = f.glow.concat([f.rough]), ec = lin(f.edgeCol);
    const uvOf = (m, x, y) => (m ? [x * m[0] + m[1], y * m[2] + m[3]] : [-1, -1]);
    for (const [side, w, m] of [[0, h, f.mapF], [1, -h, f.mapB]]) {
      const base = P.length / 3;
      for (const p of pts) { P.push(p.x, p.y, w); FA.push(f.i); SD.push(side); N2.push(0, 0); UV.push(...uvOf(m, p.x, p.y)); BK.push(...bk); GL.push(...gl); EC.push(...ec); }
      for (const t of tris) side === 0 ? idx.push(base + t[0], base + t[1], base + t[2]) : idx.push(base + t[0], base + t[2], base + t[1]);
    }
    // the cut edges, all round the outline and every hole
    for (const loop of [f.poly, ...f.holes]) {
      for (let k = 0; k < loop.length; k++) {
        const a = loop[k], b = loop[(k + 1) % loop.length], dx = b[0] - a[0], dy = b[1] - a[1], L = Math.hypot(dx, dy);
        if (L < 1e-5) continue;
        const nx = dy / L, ny = -dx / L, base = P.length / 3;
        for (const [q, w] of [[a, h], [b, h], [b, -h], [a, -h]]) { P.push(q[0], q[1], w); FA.push(f.i); SD.push(2); N2.push(nx, ny); UV.push(-1, -1); BK.push(...bk); GL.push(...gl); EC.push(...ec); }
        idx.push(base, base + 1, base + 2, base, base + 2, base + 3);
      }
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3));
  g.setAttribute('aFace', new THREE.Float32BufferAttribute(FA, 1)); g.setAttribute('aSide', new THREE.Float32BufferAttribute(SD, 1));
  g.setAttribute('aN2', new THREE.Float32BufferAttribute(N2, 2)); g.setAttribute('aUV', new THREE.Float32BufferAttribute(UV, 2));
  g.setAttribute('aBack', new THREE.Float32BufferAttribute(BK, 4)); g.setAttribute('aGlow', new THREE.Float32BufferAttribute(GL, 4)); g.setAttribute('aEdge', new THREE.Float32BufferAttribute(EC, 3));
  g.setIndex(idx);
  g.boundingSphere = new THREE.Sphere(V3(), 1e4);
  return g;
}
// where every piece is this frame: four texels each (corner and shown; x direction and glow; y direction)
const FRAMES_W = 1024;
function framesTexture() {
  const rows = Math.max(1, Math.ceil(PAPER.faces.length * 4 / FRAMES_W));
  PAPER.data = new Float32Array(FRAMES_W * rows * 4);
  PAPER.tex = new THREE.DataTexture(PAPER.data, FRAMES_W, rows, THREE.RGBAFormat, THREE.FloatType);
  PAPER.tex.minFilter = PAPER.tex.magFilter = THREE.NearestFilter; PAPER.tex.needsUpdate = true;
  return PAPER.tex;
}
function uploadFrames() {
  const d = PAPER.data;
  for (const f of PAPER.faces) {
    const k = f.i * 16;
    d[k] = f.o.x; d[k + 1] = f.o.y; d[k + 2] = f.o.z; d[k + 3] = f.vis;
    d[k + 4] = f.ex.x; d[k + 5] = f.ex.y; d[k + 6] = f.ex.z; d[k + 7] = f.lit;
    d[k + 8] = f.ey.x; d[k + 9] = f.ey.y; d[k + 10] = f.ey.z; d[k + 11] = 0;
  }
  PAPER.tex.needsUpdate = true;
}
const PAPER_VS = /* glsl */`
  in float aFace, aSide; in vec2 aN2, aUV; in vec4 aBack, aGlow; in vec3 aEdge;
  uniform sampler2D tFrames;
  out vec3 vW, vN, vL, vSc; out vec2 vU; out vec4 vI; out float vAO; out vec4 vW0, vW1, vTint;
  uniform float uTime, uWind, uT;
  vec4 fr(int k) { int i = int(aFace + 0.5) * 4 + k; return texelFetch(tFrames, ivec2(i % ${FRAMES_W}, i / ${FRAMES_W}), 0); }
  void main() {
    vec4 f0 = fr(0), f1 = fr(1), f2 = fr(2);
    vAO = 1.0; vW0 = aGlow; vW1 = vec4(0.0); vTint = vec4(f1.w, 0.0, 0.0, 0.0); vI = aBack; vSc = aEdge;
    vL = vec3(position.xy, aSide); vU = aUV;
    if (f0.w < 0.5) { gl_Position = vec4(2.0, 2.0, 2.0, 1.0); vW = vec3(0.0); vN = vec3(0.0, 1.0, 0.0); return; }
    vec3 ex = f1.xyz, ey = f2.xyz, n = normalize(cross(ex, ey));
    vec3 p = f0.xyz + position.x * ex + position.y * ey + position.z * n;
    vW = p;
    vN = aSide < 0.5 ? n : aSide < 1.5 ? -n : normalize(aN2.x * ex + aN2.y * ey);
    gl_Position = projectionMatrix * viewMatrix * vec4(p, 1.0);
  }`;
// the card: print, fibres, a pale core at the cut edges, gold leaf, the lamp's light showing through from behind
const PAPER_BODY = /* glsl */`
  float side = vL.z; vec2 xy = vL.xy;
  vec4 pr = vU.x > -0.5 ? texture(tAtlas, vU) : vec4(vI.rgb, 1.0);
  vec3 base = side > 1.5 ? vSc * (0.95 + 0.05 * h2(floor(xy * 40.0))) : pr.rgb;
  // the fibres: fine streaks every way, specks; faded out where a pixel is wider than they are
  float fpx = max(length(fwidth(xy)), 1e-5), fade = smoothstep(0.05, 0.008, fpx);
  vec2 q = xy * 1.0;
  float fib = n2(q * vec2(90.0, 11.0)) * 0.5 + n2(mat2(0.6, -0.8, 0.8, 0.6) * q * vec2(70.0, 9.0)) * 0.5;
  fib = mix(0.5, fib, fade);
  float speck = step(0.985, h2(floor(xy * 38.0))) * fade;
  alb = base * (0.94 + 0.12 * fib) * (1.0 - 0.25 * speck);
  if (side < 1.5) n = bumpN(n, vW, fib * 0.02 + speck * 0.01, fade * 1.0);
  rough = vW0.a; F0 = vec3(0.035); wrap = 0.35;
  // gold leaf
  float gold = side < 1.5 ? smoothstep(0.8, 0.6, pr.a) : 0.0;
  if (gold > 0.0) { F0 = mix(F0, vec3(1.0, 0.74, 0.33), gold); alb = mix(alb, alb * 0.25, gold); rough = mix(rough, 0.32, gold); wrap = mix(wrap, 0.0, gold); }
  // light through the card, from behind
  { vec3 Lt; vec3 kc = keyAt(vW, Lt); float bk = max(-dot(n, Lt), 0.0);
    if (bk > 0.0 && dot(kc, vec3(1.0)) > 1e-5) emit += kc * keyShadow(vW - n * 0.05, -n) * bk * vI.a * alb * (0.75 + 0.5 * fib); }
  // what glows by itself (a lit window behind its pane), as bright as the scene asks
  emit += vW0.rgb * vTint.x * (side < 1.5 ? pr.rgb : vec3(0.0));
  ao = 1.0;
`;
let paperMat = null, paperMesh = null;
function buildPaper() {
  buildAtlas();
  framesTexture();
  paperMat = worldMat(PAPER_BODY, {
    vs: PAPER_VS, noFlip: true, head: GLSL_BUMP + 'uniform sampler2D tAtlas; uniform sampler2D tFrames;',
    uniforms: { tAtlas: { value: PAPER.atlas }, tFrames: { value: PAPER.tex } }, extra: { side: THREE.DoubleSide },
  });
  paperMesh = new THREE.Mesh(buildPaperGeometry(), paperMat);
  paperMesh.frustumCulled = false;
  add(worldScene, paperMesh);
}
// =====================================================================
// How pop-ups move. Nothing in a pop-up book has a motor: every piece
// is moved by the page opening. A hinge is a line where two planes
// meet: the spine between two pages, the crease of a fold, the line
// where a piece is glued down. A fold set across a hinge is carried
// along as the hinge opens and closes, and makes hinges of its own for
// the next fold to stand on.
//  The V-fold: a piece folded down its middle and glued to both planes
// along lines that meet the hinge at one point. Its crease rises out of
// the hinge as it opens: a spherical linkage, solved exactly here.
//  The parallel fold: a strip creased parallel to the hinge and glued
// to both planes, a four-bar linkage.
//  Flaps turn on a hinge of their own, worked by a hidden lever (the
// pull-tab of a real book), and a few pieces are mounted on a rocker.
// =====================================================================
// a hinge: a line (point P, direction s); plane A leaves it along uA and faces the open space between the planes along
// nA; plane B likewise
const hinge = (P, s, uA, nA, uB, nB) => ({ P, s, uA, nA, uB, nB });
// two planes meeting on a line, given the directions they leave it along: the open space is the narrower wedge
function wedge(P, s, uA, uB, fallN) {
  const nA = uB.clone().addScaledVector(uA, -uB.dot(uA)), nB = uA.clone().addScaledVector(uB, -uA.dot(uB));
  if (nA.lengthSq() < 1e-8) { nA.copy(fallN); nB.copy(fallN); } else { nA.normalize(); nB.normalize(); }
  return hinge(P.clone(), s.clone(), uA.clone(), nA, uB.clone(), nB);
}
const _ta = V3(), _tb = V3(), _tw = V3(), _ts = V3();
// a V-fold across the hinge H(): its apex z along the hinge; its glue lines lean toward +s (dir 1) or -s (dir -1),
// at angles aA, aB from it; in the flat piece the crease makes angles bA, bB with the glue lines. Its two halves are
// laid out flat as one piece would be: half A at x < 0, half B at x > 0, y up the crease. The printed side faces the
// way the glue lines do not lean: a fold leaning away from the reader stands with its point toward them (a prow);
// one leaning toward them opens to them like a book (a valley).
function vfold(H, o) {
  const V = { o, P0: V3(), c: V3(), gA: V3(), gB: V3(), eA: V3(), eB: V3(), h: null };
  V.solve = () => {
    const h = V.h = H(), sd = _ts.copy(h.s).multiplyScalar(o.dir);
    V.P0.copy(h.P).addScaledVector(h.s, o.z);
    V.gA.copy(sd).multiplyScalar(Math.cos(o.aA)).addScaledVector(h.uA, Math.sin(o.aA));
    V.gB.copy(sd).multiplyScalar(Math.cos(o.aB)).addScaledVector(h.uB, Math.sin(o.aB));
    const Gd = V.gA.dot(V.gB), den = Math.max(1 - Gd * Gd, 1e-7), ca = Math.cos(o.bA), cb = Math.cos(o.bB);
    const a = (ca - Gd * cb) / den, b = (cb - Gd * ca) / den;
    _tw.crossVectors(V.gA, V.gB); const wl = _tw.length();
    if (wl < 1e-7) _tw.copy(h.nA).add(h.nB).normalize(); else _tw.multiplyScalar(1 / wl);
    const d = Math.sqrt(Math.max(1 - (a * a + b * b + 2 * a * b * Gd), 0));
    // (two answers: the crease rises into the open space between the planes)
    _ta.copy(V.gA).multiplyScalar(a).addScaledVector(V.gB, b); _tb.copy(_ta);
    _ta.addScaledVector(_tw, d); _tb.addScaledVector(_tw, -d);
    const s1 = Math.min(_ta.dot(h.nA), _ta.dot(h.nB)), s2 = Math.min(_tb.dot(h.nA), _tb.dot(h.nB));
    V.c.copy(s1 >= s2 ? _ta : _tb).normalize();
    V.eA.copy(V.gA).addScaledVector(V.c, -V.gA.dot(V.c)).normalize();
    V.eB.copy(V.gB).addScaledVector(V.c, -V.gB.dot(V.c)).normalize();
    return V;
  };
  // put the two halves in place (their pieces' outlines drawn in the flat piece's coordinates); flip: printed on the
  // other side (then half A is laid out at x > 0 and half B at x < 0)
  V.place = (fA, fB, flip = false) => {
    if (fA) setFrame(fA, V.P0, _ta.copy(V.eA).multiplyScalar(flip ? 1 : -1), V.c);
    if (fB) setFrame(fB, V.P0, _tb.copy(V.eB).multiplyScalar(flip ? -1 : 1), V.c);
    return V;
  };
  // the hinge inside the V, between its halves (the side away from the print)
  V.crease = () => wedge(V.P0, V.c, V.eA, V.eB, V.h.nA);
  // where a half is glued down: the hinge between it and the plane beyond it (side 'out', away from the V) or under
  // it (side 'in'); along it, z runs from the apex outward
  V.glue = (half, side = 'out') => {
    const h = V.h, g = half === 'A' ? V.gA : V.gB, gOther = half === 'A' ? V.gB : V.gA, nP = half === 'A' ? h.nA : h.nB;
    const p = V3().crossVectors(nP, g).normalize();
    if ((p.dot(gOther) > 0) === (side === 'out')) p.negate();
    const q = V.c.clone().addScaledVector(g, -V.c.dot(g)).normalize();
    return wedge(V.P0, g, p, q, nP);
  };
  return V;
}
// a parallel fold across the hinge H(): glued to plane A at distance a from the hinge and to plane B at b; its two
// panels (p long from A's glue line, q long from B's) meet at a crease parallel to the hinge; it runs from z0 to z1
// along it. Each panel is laid out flat with x along the hinge (0 to z1 - z0) and y from its glue line to the crease;
// its print faces away from the other panel.
function pfold(H, o) {
  const T = { o, A: V3(), B: V3(), C: V3(), h: null };
  const ex = V3(), pp = V3();
  T.solve = () => {
    const h = T.h = H();
    T.A.copy(h.P).addScaledVector(h.uA, o.a); T.B.copy(h.P).addScaledVector(h.uB, o.b);
    ex.subVectors(T.B, T.A); const d = Math.max(ex.length(), 1e-6); ex.multiplyScalar(1 / d);
    const x = (o.p * o.p - o.q * o.q + d * d) / (2 * d), y = Math.sqrt(Math.max(o.p * o.p - x * x, 0));
    pp.crossVectors(h.s, ex); if (pp.dot(_ta.copy(h.nA).add(h.nB)) < 0) pp.negate();
    T.C.copy(T.A).addScaledVector(ex, x).addScaledVector(pp, y);
    return T;
  };
  const panel = (f, from, other) => {
    const ey = V3().subVectors(T.C, from).normalize(), s = T.h.s;
    let exv = s.clone(), org = from.clone().addScaledVector(s, o.z0);
    if (V3().crossVectors(exv, ey).dot(V3().subVectors(other, from)) > 0) { exv.negate(); org = from.clone().addScaledVector(s, o.z1); }
    setFrame(f, org, exv, ey);
  };
  T.place = (f1, f2) => { if (f1) panel(f1, T.A, T.B); if (f2) panel(f2, T.B, T.A); };
  return T;
}
// a flap on a piece: it turns on a line lying on the piece's printed side (through the piece's own point (hx, hy),
// along its direction (dx, dy)); at angle 0 it lies flat along the piece to the left of that line, printed side up;
// it turns up out of the piece as the angle grows. Laid out with x along the line, y away from it.
const _fq = V3(), _fa = V3(), _fn = V3(), _fr = V3();
function flapOn(f, par, hx, hy, dx, dy, ang, lift = 0) {
  _fn.crossVectors(par.ex, par.ey).normalize();
  _fq.copy(par.o).addScaledVector(par.ex, hx).addScaledVector(par.ey, hy).addScaledVector(_fn, par.t / 2 + f.t / 2 + lift);
  _fa.copy(par.ex).multiplyScalar(dx).addScaledVector(par.ey, dy).normalize();
  _fr.crossVectors(_fn, _fa);
  const ey = V3().copy(_fr).multiplyScalar(Math.cos(ang)).addScaledVector(_fn, Math.sin(ang));
  setFrame(f, _fq, _fa, ey);
}
// a piece glued flat onto another (a layer standing off it by dz, moved by (dx, dy) along it)
function glued(f, par, dx = 0, dy = 0, dz = 0) {
  _fn.crossVectors(par.ex, par.ey).normalize();
  _fq.copy(par.o).addScaledVector(par.ex, dx).addScaledVector(par.ey, dy).addScaledVector(_fn, dz);
  setFrame(f, _fq, par.ex, par.ey);
}
// turn pieces about a pivot (a point and an axis) by an angle: a rocker under the page
const _rq = new THREE.Quaternion();
function rock(faces, pivot, axis, ang) {
  _rq.setFromAxisAngle(axis, ang);
  for (const f of faces) { f.o.sub(pivot).applyQuaternion(_rq).add(pivot); f.ex.applyQuaternion(_rq); f.ey.applyQuaternion(_rq); }
}
// =====================================================================
// The book: two halves bound at the spine (front cover and back cover,
// each with half the pages behind it), and between them three stiff
// leaves. Four spreads, a world folded into each. The first opens with
// the cover; each leaf turned shuts one world (it folds flat under the
// leaf as it comes over) while the next rises; at the end the whole
// left half swings back over and the book is shut.
// Pages are laid out flat as seen from the reader: x from the spine
// to the outer edge, y from the near edge to the far one. A spread's
// ground is drawn once, from its left page's outer edge (x -W) to its
// right page's (x W); the near edge is at z = H/2.
// =====================================================================
const BW = 22, BH = 30, LEAF_T = 0.08, BLOCK = 1.4, BOARD = 0.3, OVER = 0.45, YS = BLOCK + BOARD + LEAF_T / 2;
const SPREADS = [null, {}, {}, {}, {}];   // each world fills in ground(g) and frame(T, hinge, angle)
const PHI = [0, 0, 0, 0, 0];              // the leaves' angles: 0 lying on the right, PI on the left (4: the back half)
const THETA = [0, 0, 0, 0, 0];            // how far each spread is open (PI: flat)
// a page turning over: lifted, carried over, laid down with a last small settle
function turn(t, t0, dur) {
  const u = clamp((t - t0) / dur, 0, 1);
  let p = Math.PI * (u < 0.5 ? 2 * u * u : 1 - Math.pow(-2 * u + 2, 2) / 2);
  const s = t - t0 - dur; if (s > 0 && s < 0.5) p -= 0.035 * Math.sin(s / 0.5 * Math.PI) * (1 - s / 0.5);
  return p;
}
const T_OPEN = 7, T_TURN = [0, 33.5, 57.5, 81.5], T_CLOSE = 104.5, D_CLOSE = 6.1;
function bookAngles(T) {
  PHI[0] = turn(T, T_OPEN, 5.2);
  for (let k = 1; k <= 3; k++) PHI[k] = turn(T, T_TURN[k], 4.4);
  // shutting: the left half (the cover and every leaf on it) swings back over, slowly at first, falling the last way
  if (T >= T_CLOSE) {
    const u = clamp((T - T_CLOSE) / D_CLOSE, 0, 1), c = Math.PI * Math.cos(u * Math.PI / 2);
    for (let k = 0; k <= 3; k++) PHI[k] = Math.min(PHI[k], c);
  }
  PHI[4] = 0;
  for (let k = 1; k <= 4; k++) THETA[k] = PHI[k - 1] - PHI[k];
}
const uDir = (phi) => V3(Math.cos(phi), Math.sin(phi), 0);
const nFront = (phi) => V3(-Math.sin(phi), Math.cos(phi), 0);   // a leaf's front (right page) faces this way
// the hinge of spread k: the spine; its left page (the back of leaf k-1) and right page (the front of leaf k)
function spreadHinge(k) {
  const a = PHI[k - 1], b = PHI[k];
  return hinge(V3(0, YS, 0), V3(0, 0, 1), uDir(a), nFront(a).negate(), uDir(b), nFront(b));
}

// ---- the print of the book itself ----
const LEATHER = '#5a2418', LEATHER_D = '#3b150e';
function leather(g, x0, y0, x1, y1) {
  const { ctx } = g, r = mulberry32(31);
  G.wash(ctx, x0, y0, x1, y1, LEATHER, { k: 0.5, blob: 2.5, var: 1.4, grain: 3, rng: r });
  // the grain of the hide: small creases
  ctx.strokeStyle = 'rgba(30,10,6,0.35)'; ctx.lineWidth = 0.02;
  for (let k = 0; k < (x1 - x0) * (y1 - y0) * 1.5; k++) { const x = x0 + r() * (x1 - x0), y = y0 + r() * (y1 - y0), a = r() * 6.28, l = 0.1 + r() * 0.3; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l); ctx.stroke(); }
  // rubbed paler at the corners and edges
  G.rim(ctx, [[x0, y0], [x1, y0], [x1, y1], [x0, y1]], [0.55, 0.32, 0.22], 0.5, 0.25);
}
// the front cover: gold tooling, a border of fillets and corner flourishes, a medallion with a tower and a dragon's wing
function coverPrint(g) {
  const { ctx } = g, X0 = 0, Y0 = 0, X1 = BW + OVER, Y1 = BH + 2 * OVER, cx = X1 / 2 + 0.2, cy = Y1 / 2;
  leather(g, X0, Y0, X1, Y1);
  G.gold(ctx, (c) => {
    ctx.strokeStyle = c; ctx.fillStyle = c;
    for (const [m, w] of [[1.1, 0.08], [1.45, 0.035], [2.6, 0.035]]) { ctx.lineWidth = w; ctx.strokeRect(X0 + m, Y0 + m, X1 - X0 - 2 * m, Y1 - Y0 - 2 * m); }
    // corner flourishes
    for (const [sx, sy] of [[1, 1], [-1, 1], [1, -1], [-1, -1]]) {
      const x = sx > 0 ? X0 + 2.6 : X1 - 2.6, y = sy > 0 ? Y0 + 2.6 : Y1 - 2.6;
      ctx.lineWidth = 0.05;
      for (let k = 0; k < 3; k++) { ctx.beginPath(); ctx.arc(x + sx * (0.9 + k * 0.55), y + sy * (0.9 + k * 0.55), 0.5 + k * 0.25, 0, TAU); ctx.stroke(); }
      ctx.beginPath(); ctx.arc(x + sx * 0.6, y + sy * 0.6, 0.22, 0, TAU); ctx.fill();
    }
    // the medallion
    ctx.lineWidth = 0.07; ctx.beginPath(); ctx.ellipse(cx, cy, 5.2, 6.6, 0, 0, TAU); ctx.stroke();
    ctx.lineWidth = 0.035; ctx.beginPath(); ctx.ellipse(cx, cy, 4.8, 6.2, 0, 0, TAU); ctx.stroke();
    for (let k = 0; k < 24; k++) { const a = k / 24 * TAU; ctx.beginPath(); ctx.arc(cx + Math.cos(a) * 5.65, cy + Math.sin(a) * 7.05, 0.13, 0, TAU); ctx.fill(); }
    // a castle tower within it, a crescent moon and stars
    ctx.lineWidth = 0.06;
    const tw = [[cx - 1.4, cy - 3.2], [cx - 1.4, cy + 1.2], [cx - 1.9, cy + 1.2], [cx - 1.9, cy + 2.2], [cx - 1.2, cy + 2.2], [cx - 1.2, cy + 1.7], [cx - 0.5, cy + 1.7], [cx - 0.5, cy + 2.2], [cx + 0.5, cy + 2.2], [cx + 0.5, cy + 1.7], [cx + 1.2, cy + 1.7], [cx + 1.2, cy + 2.2], [cx + 1.9, cy + 2.2], [cx + 1.9, cy + 1.2], [cx + 1.4, cy + 1.2], [cx + 1.4, cy - 3.2]];
    G.path(ctx, tw, false); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(cx - 0.55, cy - 3.2); ctx.lineTo(cx - 0.55, cy - 1.8); ctx.arc(cx, cy - 1.8, 0.55, Math.PI, 0, true); ctx.lineTo(cx + 0.55, cy - 3.2); ctx.stroke();
    ctx.beginPath(); ctx.arc(cx + 2.4, cy + 4.0, 0.9, -2.2, 2.2); ctx.arc(cx + 2.7, cy + 4.0, 0.72, 1.9, -1.9, true); ctx.fill();
    for (const [x, y] of [[cx - 2.6, cy + 4.3], [cx - 1.6, cy + 5.1], [cx + 0.9, cy + 5.2], [cx - 3.2, cy - 1.0], [cx + 3.3, cy - 0.6]]) { ctx.beginPath(); for (let k = 0; k < 10; k++) { const a = k / 10 * TAU, rr = k % 2 ? 0.1 : 0.26; ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); } ctx.fill(); }
    ctx.lineWidth = 0.05; ctx.beginPath(); ctx.moveTo(cx - 4, cy - 4.4); ctx.quadraticCurveTo(cx, cy - 3.4, cx + 4, cy - 4.4); ctx.stroke();
  });
}
function pageEdges(g, x0, y0, x1, y1, gilt) {
  const { ctx } = g, r = mulberry32(5);
  ctx.fillStyle = gilt ? '#c9a24f' : '#e9dfc8'; ctx.fillRect(x0, y0, x1 - x0, y1 - y0);
  if (gilt) G.gold(ctx, (c) => { ctx.fillStyle = c; ctx.fillRect(x0, y0, x1 - x0, y1 - y0); });
  // the leaves, one line each
  ctx.lineWidth = 0.012;
  for (let y = y0; y < y1; y += 0.035 + r() * 0.02) { ctx.strokeStyle = `rgba(60,40,20,${0.12 + r() * 0.2})`; ctx.beginPath(); ctx.moveTo(x0, y); ctx.lineTo(x1, y + (r() - 0.5) * 0.02); ctx.stroke(); }
}
const rect = (x0, y0, x1, y1) => [[x0, y0], [x1, y0], [x1, y1], [x0, y1]];
// ---- the pieces of the book ----
const BOOK = { leaves: [], edgesL: [], edgesR: [], spine: [] };
{
  const pageOf = (k, side) => (g) => { const sp = SPREADS[k]; if (sp && sp.ground) sp.ground(g); };
  // the leaves: front the right page of spread k, back the left page of spread k + 1
  for (let k = 1; k <= 3; k++) BOOK.leaves[k] = piece({ poly: rect(0, 0, BW, BH), t: LEAF_T, print: pageOf(k), back: pageOf(k + 1), dens: 0.72, trans: 0.08 });
  // the inside of the front half (the first spread's left page) and of the back half (the last spread's right page)
  BOOK.leaves[0] = piece({ poly: rect(0, 0, BW, BH), t: LEAF_T, back: pageOf(1), backCol: [0.6, 0.5, 0.4], dens: 0.72, trans: 0 });
  BOOK.leaves[4] = piece({ poly: rect(0, 0, BW, BH), t: LEAF_T, print: pageOf(4), dens: 0.72, trans: 0 });
  // the boards: the front cover's outside is tooled; the back's faces the desk
  BOOK.coverF = piece({ poly: rect(0, 0, BW + OVER, BH + 2 * OVER), t: BOARD, print: coverPrint, backCol: [0.75, 0.62, 0.45], dens: 0.6, trans: 0, rough: 0.6, base: hex3(LEATHER), edgeCol: hex3(LEATHER) });
  BOOK.coverB = piece({ poly: rect(0, 0, BW + OVER, BH + 2 * OVER), t: BOARD, backCol: hex3(LEATHER_D), trans: 0, rough: 0.6, base: hex3(LEATHER), edgeCol: hex3(LEATHER) });
  // the edges of the pages behind each half: gilt at the top, plain along the others
  for (const E of [BOOK.edgesL, BOOK.edgesR]) {
    E.push(piece({ poly: rect(0, 0, BH, BLOCK), t: 0.02, print: (g) => pageEdges(g, 0, 0, BH, BLOCK, false), dens: 0.5, trans: 0 }));   // the fore-edge
    E.push(piece({ poly: rect(0, 0, BW, BLOCK), t: 0.02, print: (g) => pageEdges(g, 0, 0, BW, BLOCK, false), dens: 0.5, trans: 0 }));   // the near edge
    E.push(piece({ poly: rect(0, 0, BW, BLOCK), t: 0.02, print: (g) => pageEdges(g, 0, 0, BW, BLOCK, true), dens: 0.5, trans: 0 }));    // the far edge
  }
  // the spine: strips of leather round from the back board to the front
  for (let k = 0; k < 10; k++) BOOK.spine.push(piece({ poly: rect(0, 0, BH + 2 * OVER, 0.6), t: 0.12, print: (g) => { leather(g, -1, -1, BH + 2, 1.6); if (k === 3 || k === 6) G.gold(g.ctx, (c) => { g.ctx.fillStyle = c; g.ctx.fillRect(0, 0.18, BH + 2 * OVER, 0.08); }); }, dens: 0.5, trans: 0, rough: 0.6, base: hex3(LEATHER), edgeCol: hex3(LEATHER) }));
}
// a half of the book (0 the front, 1 the back): where its pieces are when it lies at angle phi
const _o = V3(), _u = V3(), _n = V3(), _ez = V3(0, 0, -1);
function placeHalf(back, phi) {
  _o.set(0, YS, BH / 2); _u.copy(uDir(phi)); _n.copy(nFront(phi));
  // (the front half's pages lie behind its inner page, away from the spread; the back half's below)
  const dn = back ? _n.clone().negate() : _n.clone();
  const L = BOOK.leaves[back ? 4 : 0], E = back ? BOOK.edgesR : BOOK.edgesL, C = back ? BOOK.coverB : BOOK.coverF;
  setFrame(L, _o, _u, _ez);
  // the board: its outside faces away from the pages
  const bo = _o.clone().addScaledVector(dn, BLOCK + BOARD / 2 + LEAF_T / 2).addScaledVector(_ez, -OVER);
  if (back) setFrame(C, bo.clone().addScaledVector(_ez, BH + 2 * OVER), _u, _ez.clone().negate());
  else setFrame(C, bo, _u, _ez);
  // the page edges: outer, near, far
  const e0 = _o.clone().addScaledVector(dn, LEAF_T / 2);
  if (!back) {
    setFrame(E[0], e0.clone().addScaledVector(_u, BW), _ez, dn);
    setFrame(E[1], e0, _u, dn);
    setFrame(E[2], e0.clone().addScaledVector(_ez, BH).addScaledVector(_u, BW), _u.clone().negate(), dn);
  } else {
    setFrame(E[0], e0.clone().addScaledVector(_u, BW).addScaledVector(_ez, BH), _ez.clone().negate(), dn);
    setFrame(E[1], e0.clone().addScaledVector(_u, BW), _u.clone().negate(), dn);
    setFrame(E[2], e0.clone().addScaledVector(_ez, BH), _u, dn);
  }
}
function bookFrame(T) {
  bookAngles(T);
  placeHalf(false, PHI[0]); placeHalf(true, 0);
  for (let k = 1; k <= 3; k++) setFrame(BOOK.leaves[k], V3(0, YS, BH / 2), uDir(PHI[k]), _ez);
  // which leaves show: of those lying together, only the one on top
  const L = BOOK.leaves;
  for (let k = 0; k <= 4; k++) {
    let top = true;
    for (let j = 0; j <= 4; j++) {
      if (j === k || Math.abs(PHI[j] - PHI[k]) > 1e-4) continue;
      // lying on the right, the lowest number is on top; anywhere else (on the left, or carried over together), the highest
      if (PHI[k] < 1e-4 ? j < k : j > k) top = false;
    }
    L[k].vis = top ? 1 : 0;
  }
  // the spine: leather round the back of the pages, from the back board to the front one
  const a0 = Math.PI / 2 + PHI[0], a1 = 1.5 * Math.PI, R = YS;
  for (let k = 0; k < 10; k++) {
    const a = lerp(a0, a1, (k + 0.5) / 10), da = Math.max((a1 - a0) / 10, 1e-3);
    const p = V3(Math.cos(a) * R, YS + Math.sin(a) * R, BH / 2 + OVER), tg = V3(-Math.sin(a), Math.cos(a), 0);
    const f = BOOK.spine[k];
    setFrame(f, p.clone().addScaledVector(tg, -0.3), V3(0, 0, -1), tg);
    f.vis = a1 - a0 > 0.05 ? 1 : 0; void da;
  }
}
// =====================================================================
// The room: a walnut desk at night, a banker's lamp with a green glass
// shade (the only light, warm), an inkwell with a quill, a pocket watch
// ticking, old books stacked at the back, a dark papered wall. Dust
// turns slowly in the lamp's light; out of focus, each mote is a soft
// disc of light.
// =====================================================================
const LAMP = { bulb: V3(21, 31.2, 3), at: V3(-1, 0, -1.5), on: 1 };
{
  const S = worldScene;
  // ---- the desk ----
  const wood = worldMat(/* glsl */`
    vec3 p = vW;
    float w = fbm2(vec2(p.x * 0.012, p.z * 0.35)), fine = fbm2(vec2(p.x * 0.3, p.z * 9.0));
    float rings = sin((p.z * 1.6 + w * 9.0 + fbm2(p.xz * 0.015) * 14.0));
    alb = mix(vec3(0.05, 0.022, 0.011), vec3(0.13, 0.062, 0.03), 0.5 + 0.5 * rings) * (0.8 + 0.4 * fine);
    alb *= 0.85 + 0.3 * smoothstep(0.6, 0.0, abs(n.y) - 0.4);
    rough = 0.3 + 0.18 * fbm2(p.xz * 0.08); F0 = vec3(0.045);
  `);
  const desk = new THREE.Mesh(new THREE.BoxGeometry(220, 5, 130), wood); desk.position.set(0, -2.5, -10); add(S, desk);
  // ---- the wall behind, papered dark green, a damask pattern ----
  const wall = worldMat(/* glsl */`
    vec2 q = vW.xy * vec2(0.09, 0.07); vec2 c = fract(q) - 0.5; c.x = abs(c.x);
    float d = smoothstep(0.03, 0.0, abs(length(c * vec2(1.0, 0.7) - vec2(0.12, 0.1)) - 0.18)) + smoothstep(0.02, 0.0, abs(c.x - 0.02 - 0.08 * sin(c.y * 9.0)));
    alb = mix(vec3(0.012, 0.03, 0.022), vec3(0.03, 0.05, 0.03), d * 0.6) * (0.8 + 0.4 * fbm2(vW.xy * 0.05)); rough = 0.8;
  `);
  const wl = new THREE.Mesh(new THREE.PlaneGeometry(400, 220), wall); wl.position.set(0, 80, -78); add(S, wl, false);
  // ---- the lamp: a brass base and stem, a curved arm, the shade (green glass outside, white opal glass within), the bulb ----
  const brass = worldMat(/* glsl */`
    alb = vec3(0.1, 0.065, 0.025); F0 = vec3(0.92, 0.68, 0.36); rough = 0.26 + 0.18 * fbm3(vW * 0.6);
  `);
  const B = V3(38, 0, 4);
  const lathe = (pts, seg = 48) => new THREE.LatheGeometry(pts.map(([x, y]) => new THREE.Vector2(x, y)), seg);
  const base = new THREE.Mesh(lathe([[0, 0], [7.6, 0], [7.6, 0.5], [7.0, 0.9], [4.6, 1.4], [2.6, 2.1], [1.3, 2.7], [0.9, 3.4], [0, 3.4]]), brass); base.position.copy(B); add(S, base);
  const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.6, 28, 20), brass); stem.position.set(B.x, 17, B.z); add(S, stem);
  for (const y of [8, 22]) { const k = new THREE.Mesh(new THREE.TorusGeometry(0.75, 0.25, 10, 24), brass); k.rotation.x = Math.PI / 2; k.position.set(B.x, y, B.z); add(S, k); }
  // the arm: up and over toward the book
  const armC = new THREE.CatmullRomCurve3([V3(B.x, 30.5, B.z), V3(B.x, 34.5, B.z), V3(B.x - 4, 37.8, B.z), V3(B.x - 10, 38.6, B.z), V3(LAMP.bulb.x + 1, 38.2, B.z)]);
  add(S, new THREE.Mesh(new THREE.TubeGeometry(armC, 40, 0.45, 12), brass));
  // the shade: half a cylinder along z, tipped so its mouth looks down toward the book
  const glassOut = worldMat(/* glsl */`
    alb = vec3(0.004, 0.03, 0.012); F0 = vec3(0.06); rough = 0.07;
    // the light inside comes through the green glass, brightest near the bulb
    float k = exp(-length(vW - uBulb) * 0.07);
    emit = vec3(0.02, 0.32, 0.1) * uLampOn * (0.25 + 1.4 * k); gKeyMul = 0.0;
  `, { head: 'uniform vec3 uBulb; uniform float uLampOn;', uniforms: { uBulb: { value: LAMP.bulb }, uLampOn: { value: 1 } } });
  const glassIn = worldMat(/* glsl */`
    alb = vec3(0.6, 0.58, 0.52); rough = 0.4;
    float k = exp(-length(vW - uBulb) * 0.12);
    emit = vec3(1.0, 0.78, 0.5) * uLampOn * (0.08 + 0.75 * k); gKeyMul = 0.0;
  `, { head: 'uniform vec3 uBulb; uniform float uLampOn;', uniforms: { uBulb: { value: LAMP.bulb }, uLampOn: { value: 1 } } });
  LAMP.mats = [glassOut, glassIn];
  const shade = new THREE.Group();
  const sg = new THREE.CylinderGeometry(6.2, 6.2, 23, 40, 1, true, Math.PI / 2, Math.PI);   // the upper half
  const so = new THREE.Mesh(sg, glassOut); so.material.side = THREE.FrontSide; const si = new THREE.Mesh(sg, glassIn); si.material.side = THREE.BackSide;
  si.scale.setScalar(0.985);
  shade.add(so, si);
  for (const z of [-11.5, 11.5]) { const rim = new THREE.Mesh(new THREE.TorusGeometry(6.2, 0.2, 8, 40, Math.PI), brass); rim.position.y = z; rim.rotation.x = -Math.PI / 2; shade.add(rim); }
  shade.rotation.set(Math.PI / 2, 0, 0); shade.rotateOnWorldAxis(V3(0, 0, 1), -0.42);
  shade.position.set(LAMP.bulb.x - 0.6, LAMP.bulb.y + 2.2, LAMP.bulb.z);
  S.add(shade);   // (it shapes the light itself: no shadow of its own)
  const bulbM = worldMat(`alb = vec3(0.0); emit = vec3(1.0, 0.8, 0.55) * 22.0 * uLampOn;`, { head: 'uniform float uLampOn;', uniforms: { uLampOn: { value: 1 } } });
  LAMP.mats.push(bulbM);
  const bulb = new THREE.Mesh(new THREE.SphereGeometry(1.7, 24, 16), bulbM); bulb.position.copy(LAMP.bulb); bulb.position.y += 0.6; S.add(bulb);
  // ---- the inkwell (dark glass, a brass collar) and its quill; the watch; books at the back ----
  const ink = worldMat(`alb = vec3(0.005, 0.006, 0.01); F0 = vec3(0.05); rough = 0.05;`);
  const IW = V3(-31, 0, -15);
  const well = new THREE.Mesh(lathe([[0, 0], [4.2, 0], [4.5, 0.6], [4.5, 3.2], [3.6, 4.6], [1.8, 5.4], [1.8, 6.2], [0, 6.2]]), ink); well.position.copy(IW); add(S, well);
  const collar = new THREE.Mesh(new THREE.TorusGeometry(1.9, 0.35, 10, 30), brass); collar.rotation.x = Math.PI / 2; collar.position.set(IW.x, 6.1, IW.z); add(S, collar);
  const gold = worldMat(`alb = vec3(0.12, 0.08, 0.02); F0 = vec3(1.0, 0.76, 0.36); rough = 0.22 + 0.1 * fbm3(vW * 2.0);`);
  const WT = V3(-33, 0, 15);
  const cas = new THREE.Mesh(lathe([[0, 0], [4.4, 0], [4.9, 0.35], [5.0, 0.8], [4.6, 1.15], [0, 1.15]], 64), gold); cas.position.copy(WT); add(S, cas);
  const bow = new THREE.Mesh(new THREE.TorusGeometry(1.1, 0.28, 10, 28), gold); bow.position.set(WT.x + 6.2, 0.55, WT.z - 1.4); bow.rotation.set(Math.PI / 2, 0, -0.3); add(S, bow);
  const crown = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.6, 1.2, 16), gold); crown.rotation.z = Math.PI / 2; crown.rotation.y = -0.3; crown.position.set(WT.x + 5.3, 0.55, WT.z - 1.1); add(S, crown);
  // the watch's face and hands are card, printed
  const dial = piece({ poly: Array.from({ length: 48 }, (_, k) => [Math.cos(k / 48 * TAU) * 4.3, Math.sin(k / 48 * TAU) * 4.3]), t: 0.05, trans: 0, rough: 0.35, print: (g) => {
    const { ctx } = g; ctx.fillStyle = '#f3ecdc'; ctx.fillRect(-5, -5, 10, 10);
    ctx.strokeStyle = INK; ctx.lineWidth = 0.04; ctx.beginPath(); ctx.arc(0, 0, 3.9, 0, TAU); ctx.stroke(); ctx.lineWidth = 0.015; ctx.beginPath(); ctx.arc(0, 0, 3.75, 0, TAU); ctx.stroke();
    const R = ['XII', 'I', 'II', 'III', 'IIII', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI'];
    for (let k = 0; k < 60; k++) { const a = Math.PI / 2 - k / 60 * TAU, l = k % 5 ? 0.12 : 0.25; ctx.lineWidth = k % 5 ? 0.02 : 0.04; ctx.beginPath(); ctx.moveTo(Math.cos(a) * 3.75, Math.sin(a) * 3.75); ctx.lineTo(Math.cos(a) * (3.75 - l), Math.sin(a) * (3.75 - l)); ctx.stroke(); }
    for (let k = 0; k < 12; k++) { const a = Math.PI / 2 - k / 12 * TAU; G.text(ctx, R[k], Math.cos(a) * 3.0, Math.sin(a) * 3.0, 0.62, INK, { weight: 500 }); }
    ctx.beginPath(); ctx.arc(0, -1.6, 0.9, 0, TAU); ctx.lineWidth = 0.02; ctx.stroke();
  } });
  setFrame(dial, V3(WT.x, 1.2, WT.z), V3(1, 0, 0), V3(0, 0, -1));
  const hand = (len, w, col) => piece({ poly: [[-w * 0.6, -len * 0.18], [w * 0.6, -len * 0.18], [w * 0.3, len], [-w * 0.3, len]], t: 0.02, trans: 0, rough: 0.3, print: (g) => { g.ctx.fillStyle = col; g.ctx.fillRect(-1, -2, 2, 6); }, backCol: [0.05, 0.05, 0.08] });
  LAMP.hands = [hand(2.3, 0.22, '#141420'), hand(3.3, 0.16, '#141420'), hand(1.0, 0.04, '#7a1a12')];
  const leatherM = (col) => worldMat(/* glsl */`
    float band = smoothstep(0.03, 0.0, abs(fract(vL.x * 0.18) - 0.5) - 0.42);
    alb = mix(uCol, uCol * 0.5, fbm2(vW.xz * 0.6)) ; F0 = mix(vec3(0.04), vec3(0.9, 0.7, 0.35), band * step(0.97, abs(vN.x))); rough = mix(0.55, 0.3, band);
  `, { head: 'uniform vec3 uCol;', uniforms: { uCol: { value: hexc(col) } } });
  const pagesM = worldMat(`alb = vec3(0.72, 0.64, 0.5) * (0.85 + 0.15 * sin(vW.y * 90.0)); rough = 0.9;`);
  const stack = (p, w, h, d, ry, col) => {
    const m = leatherM(col);
    const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); b.position.set(p.x, p.y + h / 2, p.z); b.rotation.y = ry; add(S, b);
    const pg = new THREE.Mesh(new THREE.BoxGeometry(w - 0.6, h - 0.5, d - 0.8), pagesM); pg.position.set(p.x - 0.25 * Math.cos(ry), p.y + h / 2, p.z + 0.25 * Math.sin(ry)); pg.rotation.y = ry; add(S, pg);
  };
  stack(V3(-40, 0, -40), 26, 5, 34, -0.25, '#2f3b2a'); stack(V3(-41, 5, -41), 23, 4, 30, -0.12, '#4a1c14'); stack(V3(-39, 9, -40), 20, 3.4, 27, -0.32, '#1f2a3d');
  // ---- the quill: a feather, cut from card like everything else, standing in the well ----
  const quill = piece({ poly: (() => { const P = []; for (let k = 0; k <= 20; k++) { const t = k / 20; P.push([0.9 * Math.sin(t * Math.PI) * (1 - 0.4 * t) + 0.12, t * 15]); } for (let k = 20; k >= 0; k--) { const t = k / 20; P.push([-1.3 * Math.sin(Math.pow(t, 0.8) * Math.PI) * (1 - 0.3 * t) - 0.12, t * 15]); } return P; })(), t: 0.02, trans: 0.6,
    print: (g) => { const { ctx } = g, r = mulberry32(9); G.wash(ctx, -2, 0, 2, 15.5, '#ece4d6', { k: 0.2 }); ctx.strokeStyle = 'rgba(80,70,60,0.5)'; ctx.lineWidth = 0.015; for (let y = 0.6; y < 15; y += 0.07) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(-2, y + 0.9 + r() * 0.3); ctx.moveTo(0, y); ctx.lineTo(2, y + 0.8 + r() * 0.3); ctx.stroke(); } ctx.strokeStyle = '#c9b89a'; ctx.lineWidth = 0.12; ctx.beginPath(); ctx.moveTo(0, -1); ctx.lineTo(0, 15); ctx.stroke(); G.shade(ctx, -2, 0, 2, 4, 0.45, 0, [0.25, 0.2, 0.15], true); },
    back: (g) => { const { ctx } = g; G.wash(ctx, -2, 0, 2, 15.5, '#ddd2c0', { k: 0.2 }); } });
  { const ex = V3(0.94, 0.0, -0.33).normalize(), ey = V3(0.22, 0.95, 0.2); ey.addScaledVector(ex, -ey.dot(ex)).normalize(); setFrame(quill, V3(IW.x + 0.4, 3.5, IW.z), ex, ey); }
  LAMP.watch = WT;
}
// ---- the lamp's light and the dark round it ----
function lightFrame(T, gain) {
  const U = WORLDU;
  U.uKeyP.value.set(LAMP.bulb.x, LAMP.bulb.y, LAMP.bulb.z, 1);
  const ax = V3().subVectors(LAMP.at, LAMP.bulb).normalize();
  U.uKeySpot.value.set(ax.x, ax.y, ax.z, Math.cos(62 * D2R));
  U.uKeyC.value.set(1.0, 0.7, 0.42).multiplyScalar(3600 * gain);
  U.uKeyR.value = 5;
  U.uAmbUp.value.set(0.014, 0.018, 0.03); U.uAmbDn.value.set(0.03, 0.02, 0.011).multiplyScalar(0.4 + 0.6 * gain);
  U.uRimD.value.set(-0.5, 0.35, -0.8).normalize(); U.uRimC.value.set(0.012, 0.018, 0.03);
  U.uFogCol.value.set(0.003, 0.0035, 0.006); U.uGlow.value.set(0.02, 0.012, 0.006).multiplyScalar(gain); U.uFogD.value = 0.0012; U.uFogH.value = 400; U.uFogY.value = 0;
  for (const m of LAMP.mats) m.uniforms.uLampOn.value = gain;
  SHADOWS.on = true; SHADOWS.cube = false; SHADOWS.focus.set(1, 2, -1); SHADOWS.fov = 92; SHADOWS.near = 4; SHADOWS.far = 110; SHADOWS.soft = 2.2; SHADOWS.bias = 0.00025;
  VOL.d = 0.0009 * gain; VOL.g = 0.55; VOL.max = 140; VOL.col.set(1, 1, 1); VOL.noise = 0.6;
  // the watch: its hands
  const s = Math.floor(T), mm = 47 + T / 60, hh = 10 + mm / 60, W = LAMP.watch;
  const hands = LAMP.hands, angs = [hh / 12 * TAU, mm / 60 * TAU, s / 60 * TAU];
  for (let k = 0; k < 3; k++) { const a = angs[k]; setFrame(hands[k], V3(W.x, 1.27 + k * 0.03, W.z), V3(Math.cos(a), 0, Math.sin(a)), V3(-Math.sin(a), 0, Math.cos(a)).negate()); }
}
// ---- dust in the lamp's light: each mote a soft disc, as big as the lens blurs it ----
{
  const n = Q.motes, r = mulberry32(17);
  const g = new THREE.InstancedBufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute([-1, -1, 0, 1, -1, 0, 1, 1, 0, -1, 1, 0], 3)); g.setIndex([0, 1, 2, 0, 2, 3]);
  const I = new Float32Array(n * 4);
  for (let k = 0; k < n; k++) { I.set([lerp(-36, 42, r()), Math.pow(r(), 1.4) * 38 + 0.3, lerp(-30, 28, r()), r()], k * 4); }
  g.setAttribute('aI', new THREE.InstancedBufferAttribute(I, 4)); g.instanceCount = n;
  const m = new THREE.ShaderMaterial({
    glslVersion: THREE.GLSL3, transparent: true, depthTest: false, depthWrite: false, blending: THREE.AdditiveBlending, premultipliedAlpha: true,
    uniforms: Object.assign({ tDepth: AIRU.tDepth, uRes: AIRU.uRes, uNearFar: FU.uNearFar, uTime: WORLDU.uTime, uKeyP: WORLDU.uKeyP, uKeyC: WORLDU.uKeyC, uKeySpot: WORLDU.uKeySpot,
      uShadowM: WORLDU.uShadowM, tShadow: WORLDU.tShadow, uShadowOn: WORLDU.uShadowOn, uDust: { value: 1 } }, lensU()),
    vertexShader: /* glsl */`
      in vec4 aI; uniform float uTime, uFocus, uAperture, uPxScale; uniform vec2 uRes;
      out vec2 vQ; out float vZ, vK, vR; out vec3 vC;
      void main() {
        float s = aI.w * 37.0;
        vec3 c = aI.xyz + vec3(sin(uTime * 0.07 + s) * 1.4, sin(uTime * 0.05 + s * 1.7) * 0.9 + mod(uTime * 0.05 + s, 3.0) * -0.3, cos(uTime * 0.06 + s * 2.3) * 1.4);
        vec4 vp = viewMatrix * vec4(c, 1.0); vZ = -vp.z; vC = c;
        // its size on the film: the mote itself (a few hundredths of a millimetre), or the blur round it
        float z = max(vZ, 0.05), coc = abs(uAperture * (1.0 / uFocus - 1.0 / z) * uPxScale), px = 0.004 * uPxScale / z;
        float rpx = max(max(coc, px), 1.2); vR = rpx; vK = px * px / (rpx * rpx) * min(px, 1.5);
        vec4 cp = projectionMatrix * vp; cp.xy += position.xy * rpx / (uRes * 0.5) * cp.w;
        gl_Position = vZ < 0.05 ? vec4(2.0, 2.0, 2.0, 1.0) : cp; vQ = position.xy;
      }`,
    fragmentShader: /* glsl */`
      precision highp float; precision highp sampler2DShadow;
      uniform sampler2D tDepth; uniform vec2 uRes, uNearFar; uniform vec4 uKeyP, uKeySpot; uniform vec3 uKeyC; uniform mat4 uShadowM; uniform sampler2DShadow tShadow; uniform float uShadowOn, uDust;
      in vec2 vQ; in float vZ, vK, vR; in vec3 vC; out vec4 oColor;
      void main() {
        float r = length(vQ); if (r > 1.0) discard;
        float d = texture(tDepth, gl_FragCoord.xy / uRes).r, n = uNearFar.x, f = uNearFar.y, sz = n * f / (f - d * (f - n));
        if (vZ > sz + 0.5) discard;
        vec3 L = uKeyP.xyz - vC; float d2 = dot(L, L); L *= inversesqrt(d2);
        float spot = smoothstep(uKeySpot.w, uKeySpot.w + 0.12, dot(-L, uKeySpot.xyz)), lit = 1.0;
        if (uShadowOn > 0.5) { vec4 s = uShadowM * vec4(vC, 1.0); vec3 c = s.xyz / s.w * 0.5 + 0.5; if (all(greaterThan(c.xy, vec2(0.0))) && all(lessThan(c.xy, vec2(1.0))) && c.z < 1.0) lit = texture(tShadow, vec3(c.xy, c.z - 0.001)); }
        // a soft disc with a brighter rim when large (as a lens draws a point out of focus)
        float disc = vR > 3.0 ? smoothstep(1.0, 0.85, r) * (0.75 + 0.25 * smoothstep(0.5, 0.95, r)) : exp(-r * r * 3.0);
        oColor = vec4(uKeyC / d2 * spot * lit * disc * vK * 0.9 * uDust, 0.0);
      }`,
  });
  const mesh = new THREE.Mesh(g, m); mesh.frustumCulled = false; airScene.add(mesh);
  LAMP.dust = m;
}
// =====================================================================
// The first spread: a castle. Its curtain walls are V-folds across the
// spine: the front wall stands with its point toward the reader and the
// gate cut through that point; the back wall opens toward us. The keep
// is two V-folds meeting at their ends, a four-sided tower that is
// square when the spread lies open and flat when it shuts. As the page
// comes fully open the keep's crown unfolds like a flower and a banner
// climbs out of it; the corner towers' roofs swing up; the drawbridge
// comes down over the moat.
// =====================================================================
const CASTLE = (() => {
  const SH = { h: null }, H = () => SH.h, all = [];
  const P = (o) => { const f = piece(o); all.push(f); return f; };
  const mir = (pts) => pts.map(([x, y]) => [-x, y]);
  const STONE = '#c3b9a7', STONE_D = '#9d927f', ROOF = '#3d6b9a', ROOF_R = '#a8432f', FLAG = '#b8342a';
  // a top edge with merlons: from x0 to x1 at height y, teeth h tall
  function merlons(x0, x1, y, h, w = 0.55) {
    const pts = [], n = Math.max(1, Math.round((x1 - x0) / (w * 2))), s = (x1 - x0) / n;
    for (let k = 0; k < n; k++) { const a = x0 + k * s; pts.push([a, y + h], [a + s * 0.55, y + h], [a + s * 0.55, y], [a + s, y]); }
    return pts;
  }
  // a wall's print, drawn for the right half (x >= 0); the left half is its mirror
  function wallPrint(o) {
    return (g) => {
      const { ctx } = g, r = mulberry32(o.seed || 3);
      if (o.mirror) ctx.scale(-1, 1);
      const [, , X1, Y1] = o.box;
      G.wash(ctx, -0.5, -0.5, X1 + 0.5, Y1 + 0.5, STONE, { k: 0.5, rng: r });
      G.stones(ctx, -0.5, 0, X1 + 0.5, Y1, 0.42, STONE, { rng: r });
      G.shade(ctx, -0.5, 0, X1 + 0.5, 2.2, 0.32, 0, [0.15, 0.2, 0.08], true);
      // grass and moss at its foot, a darker band under the battlements
      ctx.strokeStyle = 'rgba(60,90,40,0.6)'; ctx.lineWidth = 0.025;
      for (let x = 0; x < X1; x += 0.07) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x + (r() - 0.5) * 0.15, 0.15 + r() * 0.35); ctx.stroke(); }
      if (o.top) G.shade(ctx, -0.5, o.top - 0.6, X1 + 0.5, o.top, 0, 0.25, [0.1, 0.08, 0.06], true);
      for (const d of o.details || []) d(ctx, r);
      G.inkShape(ctx, o.outline, 0.05);
      G.rim(ctx, o.outline, [0.25, 0.2, 0.15], 0.18, 0.18);
    };
  }
  const slit = (x, y, h = 0.9) => (ctx) => { ctx.fillStyle = '#2a211a'; ctx.fillRect(x - 0.06, y, 0.12, h); ctx.fillRect(x - 0.2, y + h * 0.45, 0.4, 0.1); };
  const win = (x, y, w, h, col = '#2b2420') => (ctx) => { G.arch(ctx, x, y, w, h, col, { lw: 0.04 }); ctx.strokeStyle = 'rgba(255,240,210,0.35)'; ctx.lineWidth = 0.03; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x, y + h * 0.8); ctx.stroke(); };
  // a round tower drawn on a wall: shaded as if round, slits up it
  const towerOn = (x0, x1, y1) => (ctx, r) => {
    const gr = ctx.createLinearGradient(x0, 0, x1, 0);
    gr.addColorStop(0, 'rgba(40,30,20,0.35)'); gr.addColorStop(0.35, 'rgba(255,250,235,0.18)'); gr.addColorStop(1, 'rgba(30,20,15,0.45)');
    ctx.fillStyle = gr; ctx.fillRect(x0, 0, x1 - x0, y1);
    ctx.strokeStyle = INK; ctx.lineWidth = 0.035; ctx.beginPath(); ctx.moveTo(x0, 0); ctx.lineTo(x0, y1); ctx.moveTo(x1, 0); ctx.lineTo(x1, y1); ctx.stroke();
    for (let y = 1.4; y < y1 - 1; y += 1.9) slit((x0 + x1) / 2 + (r() - 0.5) * 0.3, y)(ctx);
  };
  // ---- the front wall: a prow, its point the gatehouse ----
  const FW = { L: 11, h: 5.4, tw: 8.6, gw: 1.25, gh: 3.1 };
  const fwB = (() => {
    const { L, h, tw, gw, gh } = FW, pts = [[gw, 0], [L, 0], [L, tw]];
    pts.push(...merlons(L, L - 2.1, tw, 0.5, 0.35).map(([x, y]) => [x, y]));
    pts.push([L - 2.1, h]); pts.push(...merlons(L - 2.1, 2.3, h, 0.45));
    pts.push([2.3, 7.4]); pts.push(...merlons(2.3, 0, 7.4, 0.45, 0.4)); pts.push([0, 7.85], [0, gh + 0.6]);
    // the gate's arch (half of it)
    for (let k = 0; k <= 6; k++) { const a = k / 6 * Math.PI / 2; pts.push([Math.sin(a) * gw, gh + Math.cos(a) * 0.6 - 0.6 + 0.6]); }
    return pts.map(([x, y]) => [x, y]).filter((p, i, A) => i === 0 || Math.hypot(p[0] - A[i - 1][0], p[1] - A[i - 1][1]) > 1e-4);
  })();
  const fwDetails = [towerOn(FW.L - 2.1, FW.L, FW.tw), towerOn(0, 2.3, 7.4), slit(4.2, 2.4), slit(6.0, 2.4), slit(7.8, 2.4), win(1.2, 5.0, 0.7, 1.1),
    (ctx) => { // the gate: the portcullis seen in it, an arch of voussoirs round it
      ctx.strokeStyle = INK; ctx.lineWidth = 0.05; ctx.beginPath(); ctx.arc(0, FW.gh - 0.6 + 0.6, FW.gw + 0.35, 0, Math.PI / 2); ctx.stroke();
      for (let k = 0; k <= 5; k++) { const a = k / 5 * Math.PI / 2; ctx.beginPath(); ctx.moveTo(Math.cos(a) * FW.gw, FW.gh + Math.sin(a) * 0.0 + Math.sin(a) * 0.6 - 0.6 + 0.6); ctx.lineTo(Math.cos(a) * (FW.gw + 0.35), FW.gh + Math.sin(a) * 0.35 + Math.sin(a) * 0.6 - 0.6 + 0.6); ctx.stroke(); }
    }];
  const fwBox = [0, 0, FW.L, FW.tw + 0.5];
  const FWA = P({ poly: mir(fwB), print: wallPrint({ mirror: true, box: fwBox, outline: fwB, top: FW.h, details: fwDetails, seed: 11 }) });
  const FWB = P({ poly: fwB, print: wallPrint({ box: fwBox, outline: fwB, top: FW.h, details: fwDetails, seed: 12 }) });
  const fw = vfold(H, { z: 9, dir: -1, aA: 66 * D2R, aB: 66 * D2R, bA: Math.PI / 2, bB: Math.PI / 2 });
  // ---- the back wall: opening toward us ----
  const BWL = { L: 11, h: 6.6, tw: 9.8 };
  const bwB = (() => {
    const { L, h, tw } = BWL, pts = [[0, 0], [L, 0], [L, tw]];
    pts.push(...merlons(L, L - 2.3, tw, 0.5, 0.35)); pts.push([L - 2.3, h]);
    pts.push(...merlons(L - 2.3, 0, h, 0.45)); pts.push([0, h + 0.45]);
    return pts;
  })();
  const bwDetails = [towerOn(BWL.L - 2.3, BWL.L, BWL.tw), slit(2.0, 3.0), slit(4.6, 3.0), slit(7.0, 3.0), win(3.3, 4.4, 0.6, 0.9), win(5.9, 4.4, 0.6, 0.9)];
  const bwBox = [0, 0, BWL.L, BWL.tw + 0.5];
  const BWA = P({ poly: mir(bwB), print: wallPrint({ mirror: true, box: bwBox, outline: bwB, top: BWL.h, details: bwDetails, seed: 21 }) });
  const BWB = P({ poly: bwB, print: wallPrint({ box: bwBox, outline: bwB, top: BWL.h, details: bwDetails, seed: 22 }) });
  const bw = vfold(H, { z: -12.5, dir: 1, aA: 64 * D2R, aB: 64 * D2R, bA: Math.PI / 2, bB: Math.PI / 2 });
  // ---- the keep: two V-folds that meet at their ends (a square tower, its corner to us) ----
  const KS = 5, KH = 12.4, kz = 1, kb = kz - 2 * KS * Math.SQRT1_2;
  const keepB = [[0, 0], [KS, 0], [KS, KH], ...merlons(KS, 0, KH, 0.5, 0.42), [0, KH + 0.5]];
  const keepDet = (front) => [win(2.5, 3.0, 0.9, 1.5), win(2.5, 6.4, 0.8, 1.3), win(2.5, 9.4, 0.7, 1.1), slit(1.0, 7.5), slit(4.0, 7.5),
    ...(front ? [(ctx) => { G.arch(ctx, 3.3, 0, 1.2, 1.9, '#3a2618', { lw: 0.05 }); ctx.strokeStyle = '#2a1a10'; ctx.lineWidth = 0.02; for (let x = 2.8; x < 3.9; x += 0.2) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, 1.5); ctx.stroke(); } }] : [])];
  const kBox = [0, 0, KS, KH + 0.5];
  const keepF = vfold(H, { z: kz, dir: -1, aA: Math.PI / 4, aB: Math.PI / 4, bA: Math.PI / 2, bB: Math.PI / 2 });
  const keepK = vfold(H, { z: kb, dir: 1, aA: Math.PI / 4, aB: Math.PI / 4, bA: Math.PI / 2, bB: Math.PI / 2 });
  const KFA = P({ poly: mir(keepB), print: wallPrint({ mirror: true, box: kBox, outline: keepB, top: KH, details: keepDet(true), seed: 31 }) });
  const KFB = P({ poly: keepB, print: wallPrint({ box: kBox, outline: keepB, top: KH, details: keepDet(false), seed: 32 }) });
  // (the back pair is printed on the side away from us, the tower's outside)
  const KBA = P({ poly: keepB, print: wallPrint({ box: kBox, outline: keepB, top: KH, details: keepDet(false), seed: 33 }) });
  const KBB = P({ poly: mir(keepB), print: wallPrint({ mirror: true, box: kBox, outline: keepB, top: KH, details: keepDet(false), seed: 34 }) });
  // the crown: four petals on the keep's top edges, closed into a pointed roof, opening out like a flower
  const petalPrint = (seed) => (g) => {
    const { ctx } = g, r = mulberry32(seed);
    G.wash(ctx, -0.2, -0.2, KS + 0.2, 5, ROOF, { k: 0.8, rng: r });
    G.scallops(ctx, -0.2, 0, KS + 0.2, 4.8, 0.42, ROOF, { rng: r });
    G.shade(ctx, 0, 0, KS, 4.6, 0, 0.35, [0.05, 0.08, 0.15], true);
    G.inkShape(ctx, [[0, 0], [KS, 0], [KS / 2, 4.6]], 0.05);
  };
  const petals = [];
  for (let k = 0; k < 4; k++) petals.push(P({ poly: [[0, 0], [KS, 0], [KS / 2, 4.6]], print: petalPrint(41 + k), back: (g) => { G.wash(g.ctx, -KS - 1, -1, 1, 6, '#e7c66a', { k: 0.5 }); }, trans: 0.4 }));
  // the banner that climbs out of the opened crown, on its pole
  const pole = P({ poly: rect(-0.07, 0, 0.07, 7.5), print: (g) => { g.ctx.fillStyle = '#6b4a2a'; g.ctx.fillRect(-1, -1, 2, 9); }, backCol: hex3('#6b4a2a'), trans: 0 });
  const bannerShape = [[0, 0], [3.4, 0.25], [2.6, 0.9], [3.4, 1.6], [0, 1.8]];
  const banner = P({ poly: bannerShape, t: 0.03, trans: 0.55, print: (g) => {
    const { ctx } = g; G.wash(ctx, -0.2, -0.2, 3.6, 2, FLAG, { k: 2 });
    G.gold(ctx, (c) => { ctx.fillStyle = c; ctx.beginPath(); ctx.arc(1.2, 0.9, 0.42, 0, TAU); ctx.fill(); ctx.fillRect(0, 0.05, 3.4, 0.08); ctx.fillRect(0, 1.65, 3.4, 0.08); });
    G.inkShape(ctx, bannerShape, 0.035);
  }, back: (g) => { const { ctx } = g; G.wash(ctx, -3.6, -0.2, 0.2, 2, FLAG, { k: 2 }); G.gold(ctx, (c) => { ctx.fillStyle = c; ctx.beginPath(); ctx.arc(-1.2, 0.9, 0.42, 0, TAU); ctx.fill(); }); } });
  // the corner towers' roofs (cones, seen as triangles), lying back behind the walls until the page is open
  const roofShape = (w) => [[0, 0], [w, 0], [w / 2, 3.6]];
  const roofPrint = (w, seed) => (g) => {
    const { ctx } = g, r = mulberry32(seed);
    G.wash(ctx, -0.3, -0.3, w + 0.3, 4, ROOF_R, { k: 1, rng: r }); G.scallops(ctx, -0.3, 0, w + 0.3, 3.7, 0.3, ROOF_R, { rng: r });
    const gr = ctx.createLinearGradient(0, 0, w, 0); gr.addColorStop(0, 'rgba(30,10,5,0.45)'); gr.addColorStop(0.4, 'rgba(255,240,220,0.15)'); gr.addColorStop(1, 'rgba(20,5,0,0.55)');
    ctx.fillStyle = gr; ctx.fillRect(0, 0, w, 3.6);
    G.inkShape(ctx, roofShape(w), 0.045);
    ctx.fillStyle = FLAG; ctx.beginPath(); ctx.moveTo(w / 2, 3.6); ctx.lineTo(w / 2, 4.3); ctx.lineTo(w / 2 + 0.8, 4.05); ctx.lineTo(w / 2, 3.8); ctx.fill();
  };
  const roofs = [];
  for (const [par, x0, w, y] of [[FWA, -FW.L, 2.1, FW.tw + 0.5], [FWB, FW.L - 2.1, 2.1, FW.tw + 0.5], [BWA, -BWL.L, 2.3, BWL.tw + 0.5], [BWB, BWL.L - 2.3, 2.3, BWL.tw + 0.5]])
    roofs.push({ f: P({ poly: roofShape(w), print: roofPrint(w, 50 + roofs.length), backCol: hex3('#7a3424') }), par, x0, y });
  // the drawbridge, and the trees in front (a low V-fold: two trees at its ends)
  const bridge = P({ poly: rect(-1.15, 0, 1.15, 3.4), t: 0.06, print: (g) => {
    const { ctx } = g, r = mulberry32(61); G.wash(ctx, -1.3, -0.2, 1.3, 3.6, '#8a5a34', { k: 2, rng: r });
    ctx.strokeStyle = INK; ctx.lineWidth = 0.025; for (let y = 0.3; y < 3.4; y += 0.32) { ctx.beginPath(); ctx.moveTo(-1.15, y); ctx.lineTo(1.15, y + (r() - 0.5) * 0.04); ctx.stroke(); }
    ctx.fillStyle = '#3a3a3a'; for (const x of [-0.85, 0.85]) ctx.fillRect(x - 0.08, 0.3, 0.16, 2.8);
  }, backCol: hex3('#6b4428'), trans: 0.1 });
  const treeB = (() => { const pts = [[0, 0], [8.2, 0], [8.2, 1.2]]; for (let k = 0; k <= 16; k++) { const a = k / 16 * Math.PI; pts.push([6.4 + Math.cos(a) * 1.9 + Math.sin(a * 5) * 0.18, 2.6 + Math.sin(a) * 2.6 + Math.cos(a * 7) * 0.15]); } pts.push([4.4, 1.3], [3.6, 0.7], [1.5, 0.75], [0, 0.6]); return pts; })();
  const treePrint = (mirror) => (g) => {
    const { ctx } = g, r = mulberry32(mirror ? 71 : 72); if (mirror) ctx.scale(-1, 1);
    G.wash(ctx, -0.2, -0.2, 8.6, 5.6, '#6f9a4a', { k: 1.2, rng: r });
    for (let k = 0; k < 60; k++) { const x = 4.6 + r() * 3.6, y = 1.2 + r() * 3.8; ctx.strokeStyle = `rgba(40,70,25,${0.4 + r() * 0.4})`; ctx.lineWidth = 0.03; ctx.beginPath(); ctx.arc(x, y, 0.2 + r() * 0.2, Math.PI * 0.1, Math.PI * 0.9); ctx.stroke(); }
    ctx.fillStyle = '#6b4a2a'; ctx.fillRect(6.25, 0, 0.3, 1.5);
    for (let x = 0.3; x < 4.2; x += 0.5) { ctx.fillStyle = r() < 0.5 ? '#d9534f' : '#f3e6a8'; ctx.beginPath(); ctx.arc(x, 0.45 + r() * 0.2, 0.08, 0, TAU); ctx.fill(); }
    G.inkShape(ctx, treeB, 0.04);
  };
  const TRA = P({ poly: mir(treeB), print: treePrint(true) }), TRB = P({ poly: treeB, print: treePrint(false) });
  const trees = vfold(H, { z: 13.2, dir: -1, aA: 80 * D2R, aB: 80 * D2R, bA: Math.PI / 2, bB: Math.PI / 2 });

  // ---- the ground, across both pages: a meadow, the moat round the castle, the road to its gate ----
  SPREADS[1].ground = (g) => {
    const { ctx } = g, r = mulberry32(101), Y = (z) => BH / 2 - z;
    G.wash(ctx, -BW, 0, BW, BH, '#9bbb66', { k: 0.12, blob: 4, grain: 1.5, rng: r });
    // fields and hedges, far off
    for (let k = 0; k < 14; k++) { const x = -BW + r() * 2 * BW, y = r() * BH; ctx.fillStyle = rgb(mixc(hex3('#9bbb66'), r() < 0.5 ? [0.85, 0.75, 0.35] : [0.3, 0.45, 0.2], 0.25), 0.35); ctx.beginPath(); ctx.ellipse(x, y, 2 + r() * 4, 1 + r() * 2.5, r() * 3, 0, TAU); ctx.fill(); }
    // the moat
    const cy = Y(-1.8);
    ctx.lineWidth = 2.4; ctx.strokeStyle = '#4f88a8'; ctx.beginPath(); ctx.ellipse(0, cy, 13.6, 12.8, 0, 0, TAU); ctx.stroke();
    ctx.lineWidth = 0.05; ctx.strokeStyle = INK; for (const rr of [-1.2, 1.2]) { ctx.beginPath(); ctx.ellipse(0, cy, 13.6 + rr, 12.8 + rr, 0, 0, TAU); ctx.stroke(); }
    ctx.strokeStyle = 'rgba(240,250,255,0.6)'; ctx.lineWidth = 0.03;
    for (let k = 0; k < 90; k++) { const a = r() * TAU, rr = 13.6 + (r() - 0.5) * 1.6; ctx.beginPath(); ctx.ellipse(0, cy, rr, rr - 0.8, 0, a, a + 0.08); ctx.stroke(); }
    // the courtyard: packed earth, cobbles
    ctx.fillStyle = 'rgba(170,140,95,0.45)'; ctx.beginPath(); ctx.ellipse(0, cy, 11.6, 10.8, 0, 0, TAU); ctx.fill();
    G.stones(ctx, -10, cy - 6, 10, cy + 6, 0.5, '#b8a27a', { rng: r });
    // the road, from the near edge to the drawbridge
    ctx.fillStyle = '#cdb27e'; ctx.beginPath(); ctx.moveTo(-2.2, 0); ctx.quadraticCurveTo(-1.5, Y(12), -1.2, Y(10.2)); ctx.lineTo(1.2, Y(10.2)); ctx.quadraticCurveTo(1.8, Y(12), 2.6, 0); ctx.fill();
    G.ink(ctx, [[-2.2, 0], [-1.6, Y(12)], [-1.2, Y(10.2)]], 0.035); G.ink(ctx, [[2.6, 0], [1.8, Y(12)], [1.2, Y(10.2)]], 0.035);
    // flowers, little trees, a village in the far corners
    for (let k = 0; k < 400; k++) { const x = -BW + r() * 2 * BW, y = r() * BH, e = Math.hypot(x / 15, (y - cy) / 14.2); if (e < 1) continue; ctx.fillStyle = ['#e5554a', '#f4e27a', '#ffffff', '#c58ad8'][k % 4]; ctx.beginPath(); ctx.arc(x, y, 0.06 + r() * 0.05, 0, TAU); ctx.fill(); }
    for (let k = 0; k < 26; k++) { const x = (r() < 0.5 ? -1 : 1) * (15.5 + r() * 6), y = r() * BH; ctx.fillStyle = '#5d8a3f'; ctx.beginPath(); ctx.arc(x, y, 0.5 + r() * 0.5, 0, TAU); ctx.fill(); G.inkShape(ctx, Array.from({ length: 10 }, (_, i) => [x + Math.cos(i / 10 * TAU) * 0.7, y + Math.sin(i / 10 * TAU) * 0.7]), 0.025); }
    for (const [x, y] of [[-18, 27], [-15.5, 26], [17, 27.5], [19, 25.5], [-19, 4], [18.5, 3.5]]) { ctx.fillStyle = '#d9cdb4'; ctx.fillRect(x - 0.8, y - 0.5, 1.6, 1); ctx.fillStyle = ROOF_R; ctx.beginPath(); ctx.moveTo(x - 1, y + 0.5); ctx.lineTo(x, y + 1.3); ctx.lineTo(x + 1, y + 0.5); ctx.fill(); G.inkShape(ctx, [[x - 0.8, y - 0.5], [x + 0.8, y - 0.5], [x + 0.8, y + 0.5], [x - 0.8, y + 0.5]], 0.025); }
    // shadows of the walls printed on the ground (the paper's own darkening where pieces are glued)
    ctx.strokeStyle = 'rgba(40,50,25,0.25)'; ctx.lineWidth = 0.35;
    for (const [z, L, a, d] of [[9, 11, 66, -1], [-12.5, 11, 64, 1], [kz, KS, 45, -1], [kb, KS, 45, 1]]) for (const s of [-1, 1]) { const ca = Math.cos(a * D2R) * d, sa = Math.sin(a * D2R) * s; ctx.beginPath(); ctx.moveTo(0, Y(z)); ctx.lineTo(sa * L, Y(z + ca * L)); ctx.stroke(); }
  };
  // ---- each frame: the folds from the page's angle; the flourishes from how far it is open ----
  SPREADS[1].frame = (T, Hn, th) => {
    SH.h = Hn;
    const vis = th > 0.035 ? 1 : 0;
    for (const f of all) f.vis = vis;
    if (!vis) return;
    fw.solve().place(FWA, FWB); bw.solve().place(BWA, BWB); keepF.solve().place(KFA, KFB); keepK.solve().place(KBA, KBB, true); trees.solve().place(TRA, TRB);
    const open = smooth(2.55, 3.1, th);   // (the last of the opening: the crown, the roofs, the bridge)
    // the crown: petals on the keep's four top edges (each wall's edge, from its outer corner in)
    const walls = [[KFA, -KS], [KFB, 0], [KBA, 0], [KBB, -KS]];
    const pa = lerp(-0.6, 0.85, open) + 0.04 * Math.sin(T * 1.3) * open;
    walls.forEach(([w, x0], k) => flapOn(petals[k], w, x0, KH, 1, 0, pa, 0));
    // the banner: up out of the crown on its pole, waving
    const top = V3().copy(keepF.P0).lerp(keepK.P0, 0.5); top.y = YS + KH - 7.5 + 7.2 * smooth(0.3, 1, open);
    setFrame(pole, top, V3(1, 0, 0), V3(0, 1, 0)); pole.vis = open > 0.02 ? 1 : 0;
    const wv = 0.35 * Math.sin(T * 2.1) + 0.15 * Math.sin(T * 3.7);
    setFrame(banner, top.clone().add(V3(0, 5.6, 0)), V3(Math.cos(wv) * 0.9, 0, -Math.sin(wv)).normalize(), V3(0, 1, 0)); banner.vis = pole.vis;
    // the roofs swing up from behind their towers
    for (const R of roofs) flapOn(R.f, R.par, R.x0, R.y, 1, 0, lerp(-2.7, 0, open), -0.02);
    // the drawbridge: from standing against the gate to lying across the moat
    const a = V3(), b = V3(), n = V3();
    a.copy(fw.P0).addScaledVector(fw.eA, FW.gw); b.copy(fw.P0).addScaledVector(fw.eB, FW.gw);
    const ax = V3().subVectors(b, a).normalize(), up = fw.c.clone(), out = V3().crossVectors(ax, up); if (out.z < 0) out.negate();
    const ang = lerp(0, Math.PI / 2 - 0.04, open);
    n.copy(up).multiplyScalar(Math.cos(ang)).addScaledVector(out, Math.sin(ang));
    setFrame(bridge, a.clone().lerp(b, 0.5).add(V3(0, 0.05, 0)), ax.negate(), n);
  };
  return { all, keepF, keepK, fw, bw, top: () => V3().copy(keepF.P0).lerp(keepK.P0, 0.5) };
})();
// =====================================================================
// The second spread: a storm at sea. The sea is strips of card, rows of
// waves each folded across the spine (a V-fold leaning nearly flat to
// the reader); each half is mounted on a rocker under the page, so the
// rows roll one after another. A ship rises in the middle: its hull a
// narrow V-fold (its point the bow), its masts and sails hinged flaps
// that stand up as the page opens, the whole of it rocking. Behind, the
// storm clouds stand as a backdrop; lightning flips out from behind
// them, and thin strips of rain hang down.
// =====================================================================
const SEA = (() => {
  const SH = { h: null }, H = () => SH.h, all = [], ship = [], rows = [];
  const P = (o, list) => { const f = piece(o); all.push(f); if (list) list.push(f); return f; };
  const mir = (pts) => pts.map(([x, y]) => [-x, y]);
  // ---- the rows of waves ----
  const ROWS = [[11.0, 80, 2.6, '#2f7f99', 1.0], [7.4, 80, 3.0, '#2a6f8c', 0.95], [3.8, 80, 3.3, '#235f7d', 0.9], [0.2, 80, 3.4, '#1f5571', 0.86], [-3.4, 80, 3.7, '#1b4b66', 0.82], [-7.0, 80, 3.9, '#17425b', 0.78]];
  ROWS.forEach(([z, a, h, col, lum], k) => {
    const L = 22 / Math.sin(a * D2R), r = mulberry32(300 + k), ph = r() * 6.28, kx = 0.9 + r() * 0.5;
    // its top: crests with a hook of foam, low near the spine (where the ship sails)
    const top = [];
    for (let x = L; x >= 0; x -= 0.12) {
      const near = smooth(1.2, 4.2 + k * 0.2, x), wv = Math.sin(x * kx + ph), crest = Math.pow(Math.max(wv, 0), 3);
      top.push([x, (0.25 + near * (h * (0.5 + 0.28 * wv) + h * 0.35 * crest)) ]);
    }
    const outB = [[0, 0], [L, 0], ...top];
    const print = (mirror) => (g) => {
      const { ctx } = g, rr = mulberry32(310 + k * 3 + (mirror ? 1 : 0)); if (mirror) ctx.scale(-1, 1);
      const c = hex3(col);
      G.wash(ctx, -0.3, -0.3, L + 0.3, h * 2, col, { k: 0.5, rng: rr });
      // paler toward the crests, white foam along the top; curling lines of the water
      const gr = ctx.createLinearGradient(0, 0, 0, h * 1.6); gr.addColorStop(0, rgb(mixc(c, [0.02, 0.05, 0.08], 0.4), 0.6)); gr.addColorStop(1, rgb(mixc(c, [0.75, 0.9, 0.95], 0.45), 0.6));
      ctx.fillStyle = gr; ctx.fillRect(-0.3, 0, L + 0.6, h * 2);
      ctx.save(); G.path(ctx, outB); ctx.lineWidth = 0.32; ctx.strokeStyle = 'rgba(245,250,250,0.92)'; ctx.stroke(); ctx.restore();
      ctx.strokeStyle = 'rgba(235,245,250,0.7)'; ctx.lineWidth = 0.035;
      // curls of water: little spirals, turning the way the waves break
      for (let x = 0.5; x < L; x += 0.8 + rr() * 0.9) { const y = 0.3 + rr() * h * 0.65, a0 = rr() * 6.28, R = 0.22 + rr() * 0.28; ctx.beginPath(); for (let s = 0; s <= 30; s++) { const t = s / 30, a = a0 + t * 9.5, rad = R * (1 - t * 0.85); ctx.lineTo(x + Math.cos(a) * rad, y + Math.sin(a) * rad * 0.8); } ctx.stroke(); }
      for (let n = 0; n < L * 6; n++) { ctx.fillStyle = `rgba(240,250,255,${0.25 + rr() * 0.4})`; ctx.beginPath(); ctx.arc(rr() * L, h * (0.4 + rr() * 0.9), 0.03 + rr() * 0.05, 0, TAU); ctx.fill(); }
      G.ink(ctx, top.slice().reverse(), 0.04, INK);
      void lum;
    };
    const fA = P({ poly: mir(outB), print: print(true), trans: 0.25 }), fB = P({ poly: outB, print: print(false), trans: 0.25 });
    rows.push({ fA, fB, v: vfold(H, { z, dir: 1, aA: a * D2R, aB: a * D2R, bA: Math.PI / 2, bB: Math.PI / 2 }), k });
  });
  // ---- the ship: a hull folded at its bow, sails and masts on flaps, a flag ----
  const HL = 8.2;
  const hullB = (() => { const pts = [[0, 0], [HL, 0], [HL, 3.7], [HL - 1.5, 3.7], [HL - 1.5, 2.9]]; for (let x = HL - 1.6; x >= 0; x -= 0.25) pts.push([x, 1.9 + 0.012 * Math.pow(x - 3.8, 2) * 3.2 + (x < 0.9 ? (0.9 - x) * 0.9 : 0)]); pts.push([0, 3.3]); return pts; })();
  const hullPrint = (mirror) => (g) => {
    const { ctx } = g, r = mulberry32(mirror ? 401 : 402); if (mirror) ctx.scale(-1, 1);
    G.wash(ctx, -0.3, -0.3, HL + 0.3, 4.2, '#6e4426', { k: 1.4, rng: r });
    ctx.strokeStyle = 'rgba(30,15,5,0.7)'; ctx.lineWidth = 0.025; for (let y = 0.3; y < 4; y += 0.28) { ctx.beginPath(); ctx.moveTo(0, y); ctx.bezierCurveTo(2.5, y - 0.12, 5.5, y - 0.12, HL, y + 0.05); ctx.stroke(); }
    ctx.fillStyle = '#9e3b2a'; ctx.beginPath(); ctx.moveTo(0, 1.25); ctx.bezierCurveTo(2.5, 1.1, 5.5, 1.12, HL, 1.3); ctx.lineTo(HL, 1.62); ctx.bezierCurveTo(5.5, 1.42, 2.5, 1.42, 0, 1.6); ctx.fill();
    G.gold(ctx, (c) => { ctx.fillStyle = c; ctx.fillRect(0, 1.58, HL, 0.06); ctx.beginPath(); ctx.arc(0.35, 2.4, 0.3, 0, TAU); ctx.fill(); });
    for (const x of [2.4, 3.6, 4.8, 6.0]) { ctx.fillStyle = '#1c120c'; ctx.beginPath(); ctx.arc(x, 0.75, 0.16, 0, TAU); ctx.fill(); ctx.strokeStyle = '#c9a24f'; ctx.lineWidth = 0.04; ctx.stroke(); }
    G.shade(ctx, 0, 0, HL, 1, 0.45, 0, [0.05, 0.04, 0.08], true);
    G.inkShape(ctx, hullB, 0.05);
  };
  const HA = P({ poly: mir(hullB), print: hullPrint(true), trans: 0.05, t: 0.07 }, ship), HB = P({ poly: hullB, print: hullPrint(false), trans: 0.05, t: 0.07 }, ship);
  const hull = vfold(H, { z: 4.6, dir: -1, aA: 20 * D2R, aB: 20 * D2R, bA: Math.PI / 2, bB: Math.PI / 2 });
  const sailShape = (w, h, b) => { const pts = []; for (let k = 0; k <= 10; k++) { const t = k / 10; pts.push([-w / 2 * (1 - 0.12 * t) - b * Math.sin(t * Math.PI) * 0.0, 0.5 + t * h]); } pts.push([w / 2 * 0.88, 0.5 + h]); for (let k = 10; k >= 0; k--) { const t = k / 10; pts.push([w / 2 * (1 - 0.12 * t), 0.5 + t * h]); } return pts.map(([x, y], i) => [x + (i > 0 && i < 11 ? -b * Math.sin(((y - 0.5) / h) * Math.PI) : 0), y]); };
  const sailPrint = (w, h, seed) => (g) => {
    const { ctx } = g, r = mulberry32(seed);
    G.wash(ctx, -w, 0, w, h + 1, '#eadcbc', { k: 1, rng: r });
    ctx.strokeStyle = 'rgba(120,90,60,0.5)'; ctx.lineWidth = 0.02; for (let x = -w / 2; x < w / 2; x += 0.55) { ctx.beginPath(); ctx.moveTo(x, 0.5); ctx.lineTo(x * 0.92, h + 0.5); ctx.stroke(); }
    ctx.fillStyle = 'rgba(160,60,40,0.85)'; ctx.fillRect(-w / 2, 0.5 + h * 0.42, w, h * 0.12);
    ctx.fillStyle = 'rgba(200,180,140,0.7)'; ctx.fillRect(w * 0.12, 0.5 + h * 0.18, w * 0.18, h * 0.16); ctx.strokeStyle = INK; ctx.lineWidth = 0.02; ctx.strokeRect(w * 0.12, 0.5 + h * 0.18, w * 0.18, h * 0.16);
    ctx.strokeStyle = 'rgba(90,60,40,0.8)'; ctx.lineWidth = 0.025; for (const f of [0.2, 0.32]) { ctx.beginPath(); ctx.moveTo(-w / 2, 0.5 + h * (1 - f)); ctx.quadraticCurveTo(0, 0.5 + h * (1 - f) - 0.25, w / 2, 0.5 + h * (1 - f)); ctx.stroke(); }
    for (let k = 0; k < 7; k++) { const x = -w * 0.4 + k * w * 0.8 / 6; ctx.beginPath(); ctx.moveTo(x, 0.5 + h * 0.8); ctx.lineTo(x + 0.02, 0.5 + h * 0.72); ctx.stroke(); }
    G.shade(ctx, -w / 2, 0.5, w / 2, h + 0.5, 0.25, 0, [0.3, 0.25, 0.2]);
    G.inkShape(ctx, g.poly, 0.045);
  };
  const SAILS = [[0.9, 6.4, 6.0, 0.45], [3.3, 4.8, 4.3, 0.35], [-2.0, 4.0, 3.6, 0.3]].map(([z, w, h, b], k) => ({
    z, h, sail: P({ poly: sailShape(w, h, b), print: sailPrint(w, h, 420 + k), back: sailPrint(w, h, 430 + k), trans: 0.55, t: 0.03 }, ship),
    mast: P({ poly: rect(-0.11, -0.3, 0.11, h + 1.8), print: (g) => { g.ctx.fillStyle = '#5a3a20'; g.ctx.fillRect(-1, -1, 2, 20); }, backCol: hex3('#5a3a20'), trans: 0 }, ship),
  }));
  const flag = P({ poly: [[0, 0], [2.2, 0.3], [1.6, 0.6], [2.2, 0.9], [0, 1.1]], t: 0.03, trans: 0.5, print: (g) => { G.wash(g.ctx, -0.1, -0.1, 2.4, 1.3, '#b8342a', { k: 3 }); G.inkShape(g.ctx, g.poly, 0.03); } }, ship);
  // ---- the storm behind: clouds as a backdrop, a lighthouse on it; lightning; rain ----
  const CL = 22.2;
  const cloudB = (() => { const pts = [[0, 0], [CL, 0]]; for (let x = CL; x >= 0; x -= 0.2) { const y = 8.2 + 1.6 * Math.sin(x * 0.55 + 1) + 0.9 * Math.abs(Math.sin(x * 1.35)) + 0.6 * Math.sin(x * 0.21); pts.push([x, y]); } return pts; })();
  const cloudPrint = (mirror) => (g) => {
    const { ctx } = g, r = mulberry32(mirror ? 451 : 452); if (mirror) ctx.scale(-1, 1);
    G.wash(ctx, -0.3, -0.3, CL + 0.3, 12, '#4b5563', { k: 0.4, blob: 2, var: 1.5, rng: r });
    const gr = ctx.createLinearGradient(0, 0, 0, 11); gr.addColorStop(0, 'rgba(25,32,45,0.65)'); gr.addColorStop(0.6, 'rgba(70,80,95,0.2)'); gr.addColorStop(1, 'rgba(170,180,190,0.4)');
    ctx.fillStyle = gr; ctx.fillRect(-0.3, 0, CL + 0.6, 12);
    // billows: rounded lumps, pale on top
    for (let k = 0; k < 70; k++) { const x = r() * CL, y = 3 + r() * 7, rr = 0.6 + r() * 1.4; ctx.strokeStyle = `rgba(200,210,220,${0.15 + r() * 0.3})`; ctx.lineWidth = 0.05; ctx.beginPath(); ctx.arc(x, y, rr, Math.PI * 0.05, Math.PI * 0.95); ctx.stroke(); }
    // rain, slanting
    ctx.strokeStyle = 'rgba(190,205,220,0.35)'; ctx.lineWidth = 0.02; for (let k = 0; k < 260; k++) { const x = r() * CL, y = r() * 6; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x - 0.25, y - 0.9); ctx.stroke(); }
    // a lighthouse on its rock, far off on the right half
    if (!mirror) {
      ctx.fillStyle = '#3a3a40'; ctx.beginPath(); ctx.moveTo(13.6, 0); ctx.lineTo(14.2, 1.3); ctx.lineTo(16.6, 1.5); ctx.lineTo(17.4, 0); ctx.fill();
      ctx.fillStyle = '#e8e2d4'; ctx.beginPath(); ctx.moveTo(15.0, 1.4); ctx.lineTo(15.25, 5.2); ctx.lineTo(15.85, 5.2); ctx.lineTo(16.1, 1.4); ctx.fill();
      ctx.fillStyle = '#a8322a'; for (const y of [2.2, 3.6]) ctx.fillRect(15.05, y, 1.0, 0.45);
      ctx.fillStyle = '#2a2a2a'; ctx.fillRect(15.15, 5.2, 0.8, 0.12); ctx.fillRect(15.3, 5.85, 0.5, 0.25);
      G.inkShape(ctx, [[15.0, 1.4], [15.25, 5.2], [15.85, 5.2], [16.1, 1.4]], 0.035);
    }
    for (let k = 0; k < 6; k++) { const x = 3 + r() * 16, y = 6 + r() * 3; ctx.strokeStyle = INK; ctx.lineWidth = 0.035; ctx.beginPath(); ctx.moveTo(x - 0.35, y + 0.12); ctx.quadraticCurveTo(x - 0.15, y + 0.2, x, y); ctx.quadraticCurveTo(x + 0.15, y + 0.2, x + 0.35, y + 0.12); ctx.stroke(); }
    G.ink(ctx, cloudB.slice(2).reverse(), 0.045);
  };
  const CA = P({ poly: mir(cloudB), print: cloudPrint(true), trans: 0.3 }), CB = P({ poly: cloudB, print: cloudPrint(false), trans: 0.3 });
  const cloud = vfold(H, { z: -10.6, dir: 1, aA: 84 * D2R, aB: 84 * D2R, bA: Math.PI / 2, bB: Math.PI / 2 });
  // the lighthouse's lamp: a little card that gives off light, glued on the cloud
  const beacon = P({ poly: Array.from({ length: 12 }, (_, k) => [Math.cos(k / 12 * TAU) * 0.3, Math.sin(k / 12 * TAU) * 0.3]), t: 0.02, backCol: [1, 0.9, 0.6], glow: [6, 4.2, 1.8], trans: 0 });
  const boltShape = [[0, 0], [0.55, 0], [0.25, -1.6], [0.75, -1.6], [-0.1, -4.6], [0.15, -2.4], [-0.35, -2.4], [-0.2, -0.1]];
  const boltPrint = (g) => { const { ctx } = g; ctx.fillStyle = '#fff3a8'; ctx.fillRect(-1, -5, 3, 6); G.inkShape(ctx, boltShape, 0.03, '#7a5a10'); };
  const bolts = [[CB, 6.2, 4.4], [CA, -12.5, 4.0], [CB, 15.2, 3.4]].map(([par, x, y]) => ({ par, x, y, f: P({ poly: boltShape, t: 0.03, print: boltPrint, backCol: [1, 0.95, 0.65], glow: [3.5, 3.2, 1.8], trans: 0.6 }) }));
  const rain = [];
  { const r = mulberry32(470); for (let k = 0; k < 26; k++) { const side = r() < 0.5 ? CA : CB, x = (side === CA ? -1 : 1) * (1.5 + r() * 19), y = 1.0 + r() * 4.5, len = 4 + r() * 3; rain.push({ par: side, x, y, ph: r() * 6.28, f: P({ poly: rect(-0.035, -len, 0.035, 0), t: 0.015, print: (g) => { g.ctx.fillStyle = 'rgba(200,215,230,0.9)'; g.ctx.fillRect(-1, -9, 2, 10); }, backCol: [0.75, 0.82, 0.9], trans: 0.7 }) }); } }
  // ---- the ground: dark water, streaks of foam ----
  SPREADS[2].ground = (g) => {
    const { ctx } = g, r = mulberry32(480);
    G.wash(ctx, -BW, 0, BW, BH, '#1d4f6a', { k: 0.15, blob: 4, var: 1.6, grain: 1.5, rng: r });
    const gr = ctx.createLinearGradient(0, 0, 0, BH); gr.addColorStop(0, 'rgba(60,140,160,0.35)'); gr.addColorStop(1, 'rgba(5,20,35,0.5)');
    ctx.fillStyle = gr; ctx.fillRect(-BW, 0, 2 * BW, BH);
    ctx.strokeStyle = 'rgba(230,245,250,0.5)'; ctx.lineWidth = 0.04;
    for (let k = 0; k < 160; k++) { const x = -BW + r() * 2 * BW, y = r() * BH, l = 0.6 + r() * 2.5; ctx.beginPath(); ctx.moveTo(x, y); ctx.bezierCurveTo(x + l * 0.3, y + 0.25, x + l * 0.7, y - 0.25, x + l, y); ctx.stroke(); }
    for (let k = 0; k < 50; k++) { const x = -BW + r() * 2 * BW, y = r() * BH; ctx.strokeStyle = 'rgba(10,30,45,0.5)'; ctx.lineWidth = 0.035; ctx.beginPath(); ctx.arc(x, y, 0.4 + r() * 0.9, 0.2, 2.6); ctx.stroke(); }
    // the ship's wake, behind it
    ctx.strokeStyle = 'rgba(240,250,255,0.55)'; ctx.lineWidth = 0.06; for (const s of [-1, 1]) { ctx.beginPath(); ctx.moveTo(s * 1.5, BH / 2 - 4.5); ctx.quadraticCurveTo(s * 3.5, BH / 2 + 2, s * 6.5, BH / 2 + 8); ctx.stroke(); }
  };
  // ---- the lightning: when each bolt strikes ----
  const STRIKES = [[41.6, 0], [44.9, 1], [47.3, 2], [49.8, 0], [52.6, 1], [54.4, 2], [56.3, 0]];
  const strike = (T, b) => { let s = 0; for (const [t0, k] of STRIKES) if (k === b) { const d = T - t0; if (d > 0 && d < 0.75) s = Math.max(s, d < 0.07 ? d / 0.07 : d < 0.4 ? 0.75 + 0.25 * Math.sin(d * 80) : 1 - (d - 0.4) / 0.35); } return clamp(s, 0, 1); };
  const flash = (T) => { let s = 0; for (let b = 0; b < 3; b++) s = Math.max(s, strike(T, b)); return s; };
  // ---- each frame ----
  SPREADS[2].frame = (T, Hn, th) => {
    SH.h = Hn;
    const vis = th > 0.035 ? 1 : 0;
    for (const f of all) f.vis = vis;
    if (!vis) return;
    const open = smooth(2.4, 3.1, th), sea = smooth(2.8, 3.12, th);
    // the waves, each half rocking on its glue line, one row after another
    for (const R of rows) {
      R.v.solve().place(R.fA, R.fB);
      const a = 0.16 * sea * Math.sin(T * 1.25 - R.k * 0.85), b = 0.16 * sea * Math.sin(T * 1.25 - R.k * 0.85 + 0.6);
      rock([R.fA], R.v.P0, R.v.gA, a); rock([R.fB], R.v.P0, R.v.gB, -b);
    }
    // the ship: the hull from its fold; the masts and sails stand up off its deck
    hull.solve().place(HA, HB);
    const deckY = 1.95, mid = V3().copy(hull.P0).addScaledVector(hull.c, deckY);
    const back = V3(0, 0, -1), up = V3(0, 1, 0), ex = V3(1, 0, 0);
    SAILS.forEach((S, k) => {
      const ang = lerp(0.05, Math.PI / 2, smooth(0.15 + k * 0.12, 0.75 + k * 0.08, open));
      const ey = back.clone().multiplyScalar(Math.cos(ang)).addScaledVector(up, Math.sin(ang));
      const o = mid.clone().add(V3(0, 0, S.z - 4.6 + 0.0));
      setFrame(S.mast, o.clone().addScaledVector(V3().crossVectors(ex, ey), -0.1), ex, ey);
      setFrame(S.sail, o.clone().addScaledVector(ey, 0.6).add(V3(0, 0, 0.12)), ex, ey);
    });
    const ftop = V3().copy(SAILS[0].mast.o).addScaledVector(SAILS[0].mast.ey, SAILS[0].h + 1.4), wv = 0.3 * Math.sin(T * 3.1);
    setFrame(flag, ftop, V3(Math.cos(wv), 0, Math.sin(wv)), V3(0, 1, 0)); flag.vis = open > 0.6 ? 1 : 0;
    // the rocker: the ship rolls and pitches on the swell
    const pivot = V3(0, YS + 0.4, 1.2);
    rock(ship, pivot, V3(0, 0, 1), sea * (0.13 * Math.sin(T * 1.25 - 2.6) + 0.04 * Math.sin(T * 2.3)));
    rock(ship, pivot, V3(1, 0, 0), sea * 0.06 * Math.sin(T * 1.25 - 1.0));
    // the storm
    cloud.solve().place(CA, CB);
    glued(beacon, CB, 15.55, 5.55, 0.04); beacon.lit = 0.6 + 0.4 * Math.max(0, Math.sin(T * 2.2)) ;
    bolts.forEach((B, k) => { const s = strike(T, k); flapOn(B.f, B.par, B.x, B.y, 1, 0, lerp(Math.PI - 0.3, -0.32, s), 0.02); B.f.vis = s > 0.01 ? 1 : 0; B.f.lit = s; });
    for (const R of rain) flapOn(R.f, R.par, R.x, R.y, 1, 0, -0.22 - 0.06 * Math.sin(T * 1.7 + R.ph), 0.01);
  };
  SPREADS[2].lights = (T) => {
    const L = [];
    for (let b = 0; b < 3; b++) { const s = strike(T, b); if (s > 0.01) { const B = bolts[b].f; L.push([V3().copy(B.o).addScaledVector(B.ey, -2), V3(0.8, 0.85, 1).multiplyScalar(60 * s), 1.5]); } }
    L.push([V3().copy(beacon.o).add(V3(0, 0, 0.5)), V3(1, 0.8, 0.45).multiplyScalar(4 * beacon.lit), 0.6]);
    return L;
  };
  return { all, ship, rows, hull, cloud, flash };
})();
// =====================================================================
// The third spread: a dragon on its hoard, in a cave of crags. Its body
// is a V-fold down the middle of its face and chest (the fold of the
// card is the line of its snout and belly); its wings turn on paper
// brads at its shoulders, worked by the pull-tab that slides in and out
// at the page's edge. When it breathes, layered card flames run out of
// its jaws and light everything orange. Lava glows in the cracks.
// =====================================================================
const DRAGON = (() => {
  const SH = { h: null }, H = () => SH.h, all = [];
  const P = (o) => { const f = piece(o); all.push(f); return f; };
  const mir = (pts) => pts.map(([x, y]) => [-x, y]);
  const RED = '#a8322a', BELLY = '#e0b65a';
  // ---- the dragon's body: half of it seen from the front (the fold runs down its middle) ----
  const bodyB = [[0, 0], [1.2, 0], [1.5, 0.45], [2.1, 0.0], [3.5, 0.0], [3.3, 0.6], [2.9, 1.3], [2.7, 2.6], [3.5, 3.4], [3.6, 4.6], [3.1, 5.6], [2.6, 6.6], [3.2, 7.4], [3.0, 8.0], [2.1, 8.4], [1.6, 9.4],
    [1.55, 10.3], [2.5, 10.9], [2.65, 11.5], [2.2, 12.1], [1.6, 12.4], [2.3, 13.3], [2.6, 14.6], [1.7, 13.6], [1.0, 12.9], [0.5, 13.0], [0, 12.85]];
  const bodyPrint = (mirror) => (g) => {
    const { ctx } = g, r = mulberry32(mirror ? 501 : 502); if (mirror) ctx.scale(-1, 1);
    G.wash(ctx, -0.3, -0.3, 4, 15, RED, { k: 1, rng: r });
    G.scallops(ctx, 0, 0, 3.8, 12.6, 0.36, RED, { rng: r });
    // the belly: golden plates down the middle
    ctx.fillStyle = BELLY; ctx.beginPath(); ctx.moveTo(0, 0.4); ctx.quadraticCurveTo(1.6, 4.0, 1.0, 8.6); ctx.lineTo(0, 9.4); ctx.fill();
    ctx.strokeStyle = 'rgba(120,70,20,0.8)'; ctx.lineWidth = 0.035; for (let y = 1.0; y < 8.8; y += 0.5) { ctx.beginPath(); ctx.moveTo(0, y); ctx.quadraticCurveTo(0.6, y - 0.12, 1.15 - Math.abs(y - 4.4) * 0.1, y + 0.05); ctx.stroke(); }
    // shading: dark down the sides, a highlight on the chest
    G.shade(ctx, 0, 0, 3.7, 12, 0, 0.45, [0.15, 0.03, 0.02]);
    // the head: brow ridge, the eye, the nostril; the jaw open, teeth
    ctx.fillStyle = '#2a0c08'; ctx.beginPath(); ctx.moveTo(0, 10.35); ctx.quadraticCurveTo(1.0, 10.15, 1.7, 10.75); ctx.quadraticCurveTo(1.0, 11.05, 0, 10.95); ctx.fill();
    ctx.fillStyle = '#f4ead2'; for (let x = 0.15; x < 1.6; x += 0.28) { ctx.beginPath(); ctx.moveTo(x, 10.95); ctx.lineTo(x + 0.1, 10.7); ctx.lineTo(x + 0.2, 10.95); ctx.fill(); ctx.beginPath(); ctx.moveTo(x + 0.05, 10.35); ctx.lineTo(x + 0.14, 10.58); ctx.lineTo(x + 0.23, 10.35); ctx.fill(); }
    ctx.fillStyle = '#1a0604'; ctx.beginPath(); ctx.ellipse(0.32, 11.5, 0.16, 0.1, 0.3, 0, TAU); ctx.fill();
    ctx.fillStyle = '#f2c94c'; ctx.beginPath(); ctx.ellipse(0.85, 12.0, 0.36, 0.2, -0.25, 0, TAU); ctx.fill(); ctx.fillStyle = '#1a0604'; ctx.fillRect(0.81, 11.85, 0.08, 0.3);
    ctx.strokeStyle = INK; ctx.lineWidth = 0.05; ctx.beginPath(); ctx.moveTo(0.3, 12.35); ctx.quadraticCurveTo(1.0, 12.5, 1.6, 12.25); ctx.stroke();
    // horns, ivory
    ctx.fillStyle = '#efe2c0'; ctx.beginPath(); ctx.moveTo(1.55, 12.45); ctx.lineTo(2.6, 14.6); ctx.lineTo(1.75, 13.55); ctx.lineTo(1.05, 12.95); ctx.fill();
    ctx.strokeStyle = 'rgba(80,60,30,0.6)'; ctx.lineWidth = 0.02; for (let k = 0; k < 5; k++) { const t = k / 5; ctx.beginPath(); ctx.moveTo(lerp(1.55, 2.3, t), lerp(12.6, 14.0, t)); ctx.lineTo(lerp(1.15, 2.0, t), lerp(13.0, 14.0, t)); ctx.stroke(); }
    // claws
    ctx.fillStyle = '#efe2c0'; for (const x of [2.3, 2.8, 3.25]) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x + 0.12, -0.0); ctx.lineTo(x + 0.25, 0.35); ctx.fill(); }
    G.inkShape(ctx, bodyB, 0.05);
  };
  const DA = P({ poly: mir(bodyB), print: bodyPrint(true), trans: 0.2, t: 0.06 }), DB = P({ poly: bodyB, print: bodyPrint(false), trans: 0.2, t: 0.06 });
  const body = vfold(H, { z: 1.2, dir: -1, aA: 38 * D2R, aB: 38 * D2R, bA: Math.PI / 2, bB: Math.PI / 2 });
  // ---- the wings: on brads at the shoulders ----
  const wingB = [[0, 0.35], [2.2, 1.5], [4.6, 2.6], [7.0, 3.2], [9.6, 2.0], [8.4, 0.9], [7.6, 1.5], [6.8, -0.4], [5.6, 0.6], [4.7, -1.3], [3.5, -0.1], [2.4, -1.5], [1.0, -0.5], [0, -0.35]];
  const wingPrint = (mirror) => (g) => {
    const { ctx } = g, r = mulberry32(mirror ? 511 : 512); if (mirror) ctx.scale(-1, 1);
    G.wash(ctx, -0.3, -2, 10, 3.6, '#c4583f', { k: 1, rng: r });
    const gr = ctx.createLinearGradient(0, 0, 9, 0); gr.addColorStop(0, 'rgba(90,20,10,0.5)'); gr.addColorStop(1, 'rgba(255,190,120,0.25)'); ctx.fillStyle = gr; ctx.fillRect(0, -2, 10, 6);
    // the bones of the wing: the arm along the top, fingers fanning back
    ctx.strokeStyle = '#5a1a10'; ctx.lineCap = 'round';
    ctx.lineWidth = 0.22; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(4.6, 2.45); ctx.lineTo(9.4, 2.0); ctx.stroke();
    ctx.lineWidth = 0.09; for (const [x, y] of [[8.5, 1.0], [6.9, -0.25], [4.75, -1.15], [2.45, -1.35]]) { ctx.beginPath(); ctx.moveTo(4.6, 2.4); ctx.quadraticCurveTo((4.6 + x) / 2, (2.4 + y) / 2 + 0.3, x, y); ctx.stroke(); }
    ctx.fillStyle = '#efe2c0'; ctx.beginPath(); ctx.moveTo(4.5, 2.45); ctx.lineTo(4.95, 3.15); ctx.lineTo(4.85, 2.4); ctx.fill();
    G.inkShape(ctx, wingB, 0.045);
  };
  const WA = P({ poly: mir(wingB), print: wingPrint(true), back: wingPrint(false), trans: 0.75, t: 0.03 });
  const WB = P({ poly: wingB, print: wingPrint(false), back: wingPrint(true), trans: 0.75, t: 0.03 });
  const brads = [0, 1].map(() => P({ poly: Array.from({ length: 10 }, (_, k) => [Math.cos(k / 10 * TAU) * 0.22, Math.sin(k / 10 * TAU) * 0.22]), t: 0.05, trans: 0, print: (g) => { G.gold(g.ctx, (c) => { g.ctx.fillStyle = c; g.ctx.fillRect(-1, -1, 2, 2); }); } }));
  // ---- the pull-tab at the right page's edge ----
  const tab = P({ poly: [[0, 0], [2.6, 0], [3.1, 0.55], [2.6, 1.1], [0, 1.1]], t: 0.06, trans: 0.1, print: (g) => {
    const { ctx } = g; G.wash(ctx, -0.2, -0.2, 3.3, 1.3, '#d8c08a', { k: 4 }); G.text(ctx, 'PULL', 1.25, 0.55, 0.55, '#5a2418', { weight: 700 });
    ctx.fillStyle = '#5a2418'; ctx.beginPath(); ctx.moveTo(2.55, 0.3); ctx.lineTo(2.95, 0.55); ctx.lineTo(2.55, 0.8); ctx.fill(); G.inkShape(ctx, g.poly, 0.035);
  } });
  // ---- fire: three layers of card, each a cross of two sheets ----
  const flameShape = (L, W) => { const pts = [[0, -W * 0.3]]; for (let k = 1; k <= 8; k++) { const t = k / 8; pts.push([t * L, -W * (0.3 + 0.7 * Math.sin(t * Math.PI * 0.9)) + (k % 2 ? 0.15 : -0.1) * W]); } for (let k = 8; k >= 1; k--) { const t = k / 8; pts.push([t * L * (k === 8 ? 1.08 : 1), W * (0.3 + 0.7 * Math.sin(t * Math.PI * 0.9)) + (k % 2 ? -0.12 : 0.18) * W]); } pts.push([0, W * 0.3]); return pts; };
  const FL = [[7.5, 1.7, '#e0452a', [3.2, 0.9, 0.3]], [6.2, 1.25, '#ff8a2a', [3.6, 1.7, 0.45]], [4.6, 0.75, '#ffe08a', [3.6, 2.9, 1.3]]].map(([L, W, col, glow], k) => {
    const shape = flameShape(L, W), pr = (g) => { const { ctx } = g; ctx.fillStyle = col; ctx.fillRect(-1, -3, L + 2, 6); G.shade(ctx, 0, -W, L, W, 0.0, 0.4, [1, 0.95, 0.7]); G.inkShape(ctx, shape, 0.03, '#6a1a08'); };
    return [0, 1].map(() => P({ poly: shape, t: 0.02, print: pr, back: pr, glow, trans: 0.8, backCol: [1, 0.6, 0.2] }));
  });
  // ---- crags behind, the mountains at the back; the hoard in front ----
  const ragged = (L, base, peaks, seed) => { const r = mulberry32(seed), pts = [[0, 0], [L, 0]]; for (let x = L; x >= 0; x -= 0.3) { let y = base(x); for (const [px, ph, pw] of peaks) y = Math.max(y, ph * Math.max(0, 1 - Math.abs(x - px) / pw)); pts.push([x, y + (r() - 0.5) * 0.25]); } return pts; };
  const rockPrint = (pts, col, L, Hh, mirror, seed) => (g) => {
    const { ctx } = g, r = mulberry32(seed); if (mirror) ctx.scale(-1, 1);
    G.wash(ctx, -0.3, -0.3, L + 0.3, Hh + 0.5, col, { k: 0.6, rng: r });
    G.shade(ctx, 0, 0, L, Hh, 0.55, 0.0, [0.08, 0.05, 0.06], true);
    ctx.strokeStyle = 'rgba(30,20,20,0.55)'; ctx.lineWidth = 0.03;
    for (let k = 0; k < L * 5; k++) { const x = r() * L, y = r() * Hh; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + (r() - 0.5) * 0.8, y - 0.4 - r() * 0.8); ctx.stroke(); }
    G.hatch(ctx, 0, 0, L, Hh, 1.1, 0.22, 0.018, INK, 0.25);
    G.ink(ctx, pts.slice(2).reverse(), 0.045);
  };
  const mtnB = ragged(22.2, (x) => 5.2 + 0.8 * Math.sin(x * 0.7), [[3, 9.5, 4], [9.5, 12.6, 5], [16, 10.4, 4.5], [20.5, 8.4, 3]], 520);
  const MA = P({ poly: mir(mtnB), print: rockPrint(mtnB, '#5b4f5e', 22.2, 13, true, 521) }), MB = P({ poly: mtnB, print: rockPrint(mtnB, '#5b4f5e', 22.2, 13, false, 522) });
  const mtn = vfold(H, { z: -11.2, dir: 1, aA: 86 * D2R, aB: 86 * D2R, bA: Math.PI / 2, bB: Math.PI / 2 });
  const cragB = ragged(17, (x) => 0.4 + smooth(3.5, 7, x) * 1.6, [[8.5, 6.8, 2.2], [12.5, 8.6, 2.6], [15.5, 5.6, 2.0]], 530);
  const RA = P({ poly: mir(cragB), print: rockPrint(cragB, '#6e6156', 17, 9, true, 531) }), RB = P({ poly: cragB, print: rockPrint(cragB, '#6e6156', 17, 9, false, 532) });
  const crag = vfold(H, { z: -5.0, dir: -1, aA: 78 * D2R, aB: 78 * D2R, bA: Math.PI / 2, bB: Math.PI / 2 });
  const hoardB = (() => { const pts = [[0, 0], [7.4, 0]]; for (let x = 7.4; x >= 0; x -= 0.2) pts.push([x, 2.3 * Math.pow(Math.max(0, 1 - x / 7.4), 0.8) + 0.12 * Math.sin(x * 9)]); return pts; })();
  const hoardPrint = (mirror) => (g) => {
    const { ctx } = g, r = mulberry32(mirror ? 541 : 542); if (mirror) ctx.scale(-1, 1);
    G.wash(ctx, -0.3, -0.3, 7.7, 2.8, '#b8862e', { k: 2, rng: r });
    G.gold(ctx, (c) => { ctx.fillStyle = c; for (let k = 0; k < 160; k++) { ctx.beginPath(); ctx.ellipse(r() * 7.4, r() * 2.4, 0.16, 0.11, r() * 3, 0, TAU); ctx.fill(); } });
    ctx.strokeStyle = 'rgba(90,60,10,0.7)'; ctx.lineWidth = 0.02; for (let k = 0; k < 120; k++) { ctx.beginPath(); ctx.ellipse(r() * 7.4, r() * 2.4, 0.16, 0.11, r() * 3, 0, TAU); ctx.stroke(); }
    for (const [x, y, c] of [[1.2, 1.2, '#c22a3a'], [3.4, 0.6, '#2a5ac2'], [5.1, 0.9, '#2aa25a'], [2.2, 0.4, '#c22a3a']]) { ctx.fillStyle = c; ctx.beginPath(); ctx.moveTo(x, y + 0.2); ctx.lineTo(x + 0.18, y); ctx.lineTo(x, y - 0.2); ctx.lineTo(x - 0.18, y); ctx.fill(); }
    G.ink(ctx, hoardB.slice(2).reverse(), 0.04);
  };
  const TA = P({ poly: mir(hoardB), print: hoardPrint(true) }), TB = P({ poly: hoardB, print: hoardPrint(false) });
  const hoard = vfold(H, { z: 6.4, dir: 1, aA: 76 * D2R, aB: 76 * D2R, bA: Math.PI / 2, bB: Math.PI / 2 });
  // the eyes glow; lava in two cracks of the ground (cards that give off light, glued on the right page)
  const eyes = [0, 1].map(() => P({ poly: Array.from({ length: 10 }, (_, k) => [Math.cos(k / 10 * TAU) * 0.3, Math.sin(k / 10 * TAU) * 0.17]), t: 0.02, backCol: [1, 0.85, 0.3], glow: [4, 2.6, 0.5], trans: 0 }));
  const lavaShape = (seed, L) => { const r = mulberry32(seed), top = [], bot = []; for (let x = 0; x <= L; x += 0.4) { const w = 0.12 + 0.3 * Math.sin(x / L * Math.PI) * (0.6 + r() * 0.6); top.push([x, w + Math.sin(x * 0.9) * 0.3]); bot.push([x, -w + Math.sin(x * 0.9) * 0.3]); } return top.concat(bot.reverse()); };
  const lavas = [[8, 7.5, 0.3, 9], [13, 20, -0.9, 6]].map(([x, y, a, L], k) => ({ x, y, a, f: P({ poly: lavaShape(560 + k, L), t: 0.02, backCol: [1, 0.45, 0.1], glow: [3.2, 0.9, 0.12], trans: 0, print: (g) => { const { ctx } = g; ctx.fillStyle = '#ff7a1a'; ctx.fillRect(-1, -2, L + 2, 4); ctx.fillStyle = 'rgba(255,230,120,0.8)'; ctx.fillRect(-1, -0.06, L + 2, 0.12); } }) }));
  // ---- the ground: bare rock, cracked; scorch marks, coins, old bones ----
  SPREADS[3].ground = (g) => {
    const { ctx } = g, r = mulberry32(580), Y = (z) => BH / 2 - z;
    G.wash(ctx, -BW, 0, BW, BH, '#6f6358', { k: 0.15, blob: 4, var: 1.5, grain: 1.5, rng: r });
    // the rock in plates: cracks between
    ctx.strokeStyle = 'rgba(25,18,15,0.6)'; ctx.lineWidth = 0.04;
    for (let k = 0; k < 140; k++) { let x = -BW + r() * 2 * BW, y = r() * BH; ctx.beginPath(); ctx.moveTo(x, y); for (let s = 0; s < 5; s++) { x += (r() - 0.5) * 2.4; y += (r() - 0.5) * 2.4; ctx.lineTo(x, y); } ctx.stroke(); }
    for (let k = 0; k < 12; k++) { const x = -BW + r() * 2 * BW, y = r() * BH, R = 1.5 + r() * 3; const gr = ctx.createRadialGradient(x, y, 0, x, y, R); gr.addColorStop(0, 'rgba(20,10,8,0.55)'); gr.addColorStop(1, 'rgba(20,10,8,0)'); ctx.fillStyle = gr; ctx.fillRect(x - R, y - R, 2 * R, 2 * R); }
    // the glow round the dragon and its fire
    { const gr = ctx.createRadialGradient(0, Y(4), 0, 0, Y(4), 9); gr.addColorStop(0, 'rgba(255,120,40,0.35)'); gr.addColorStop(1, 'rgba(255,120,40,0)'); ctx.fillStyle = gr; ctx.fillRect(-9, Y(4) - 9, 18, 18); }
    G.gold(ctx, (c) => { ctx.fillStyle = c; for (let k = 0; k < 90; k++) { const a = r() * TAU, d = 2 + Math.pow(r(), 0.6) * 9; ctx.beginPath(); ctx.ellipse(Math.cos(a) * d, Y(6) + Math.sin(a) * d * 0.7, 0.16, 0.1, r() * 3, 0, TAU); ctx.fill(); } });
    ctx.strokeStyle = '#efe6d0'; ctx.lineWidth = 0.12; ctx.lineCap = 'round';
    for (let k = 0; k < 8; k++) { const x = (r() < 0.5 ? -1 : 1) * (6 + r() * 13), y = r() * BH, a = r() * 3; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + Math.cos(a) * 1.4, y + Math.sin(a) * 1.4); ctx.stroke(); for (const e of [0, 1.4]) { ctx.beginPath(); ctx.arc(x + Math.cos(a) * e, y + Math.sin(a) * e, 0.13, 0, TAU); ctx.stroke(); } }
    // a skull
    ctx.fillStyle = '#efe6d0'; ctx.beginPath(); ctx.arc(-13, Y(9), 0.6, 0, TAU); ctx.fill(); ctx.fillStyle = INK; ctx.beginPath(); ctx.arc(-13.2, Y(9) + 0.05, 0.13, 0, TAU); ctx.arc(-12.8, Y(9) + 0.05, 0.13, 0, TAU); ctx.fill();
  };
  // the breath: when the dragon blows fire
  const BREATHS = [68.2, 72.6, 76.4, 79.9];
  const breath = (T) => { let s = 0; for (const t0 of BREATHS) { const d = T - t0; if (d > 0 && d < 2.2) s = Math.max(s, smooth(0, 0.3, d) * (1 - smooth(1.5, 2.2, d))); } return s; };
  const beat = (T) => Math.sin(T * TAU / 1.7);
  const right = (k) => { const L = BOOK.leaves[k]; return { o: L.o, ex: L.ex, ey: L.ey, t: LEAF_T }; };
  SPREADS[3].frame = (T, Hn, th) => {
    SH.h = Hn;
    const vis = th > 0.035 ? 1 : 0;
    for (const f of all) f.vis = vis;
    if (!vis) return;
    const open = smooth(2.5, 3.1, th);
    mtn.solve().place(MA, MB); crag.solve().place(RA, RB); hoard.solve().place(TA, TB); body.solve().place(DA, DB);
    // wings on their brads: spread as the page opens; then the lever beats them
    const b = beat(T), wa = lerp(-1.25, 0.2 + 0.42 * b, open);
    for (const [w, par, s] of [[WA, DA, -1], [WB, DB, 1]]) {
      const n = V3().crossVectors(par.ex, par.ey), a = wa * s;
      const ex = V3().copy(par.ex).multiplyScalar(Math.cos(a)).addScaledVector(par.ey, Math.sin(a)), ey = V3().copy(par.ey).multiplyScalar(Math.cos(a)).addScaledVector(par.ex, -Math.sin(a));
      const o = V3().copy(par.o).addScaledVector(par.ex, 2.2 * s).addScaledVector(par.ey, 7.9).addScaledVector(n, 0.07);
      setFrame(w, o, ex, ey);
    }
    glued(brads[0], WA, 0, 0, 0.04); glued(brads[1], WB, 0, 0, 0.04);
    // the pull-tab moves with the wings (its page is the next leaf's front)
    glued(tab, right(3), BW - 1.2 + 1.0 * (0.5 + 0.5 * b), BH / 2 - 3.0, LEAF_T / 2 + 0.035);
    // the eyes
    glued(eyes[0], DA, -0.85, 12.0, 0.04); glued(eyes[1], DB, 0.85, 12.0, 0.04);
    for (const e of eyes) e.lit = 0.6 + 0.4 * Math.sin(T * 2.3) * Math.sin(T * 0.7);
    // the fire: out of the jaws, toward us and a little down; three layers, each flickering
    const s = breath(T), mouth = V3().copy(body.P0).addScaledVector(body.c, 10.65).add(V3(0, 0, 0.35));
    const dir = V3(0, -0.28, 1).normalize(), side = V3(1, 0, 0), upv = V3().crossVectors(dir, side).normalize();
    FL.forEach((pair, k) => {
      const ext = s * (0.8 + 0.2 * Math.sin(T * 23 + k * 2)), o = mouth.clone().addScaledVector(dir, -0.4 + (ext - 1) * 7.5 * (1 - k * 0.15));
      const tw = 0.15 * Math.sin(T * 17 + k * 1.3);
      const sA = side.clone().applyAxisAngle(dir, tw), sB = upv.clone().applyAxisAngle(dir, tw);
      setFrame(pair[0], o, dir, sA); setFrame(pair[1], o, dir, sB);
      pair[0].vis = pair[1].vis = s > 0.03 ? 1 : 0; pair[0].lit = pair[1].lit = s;
    });
    // lava glued in its cracks
    for (const L of lavas) { const R = right(3), ca = Math.cos(L.a), sa = Math.sin(L.a); setFrame(L.f, V3().copy(R.o).addScaledVector(R.ex, L.x).addScaledVector(R.ey, L.y).addScaledVector(V3().crossVectors(R.ex, R.ey), LEAF_T / 2 + 0.012), V3().copy(R.ex).multiplyScalar(ca).addScaledVector(R.ey, sa), V3().copy(R.ey).multiplyScalar(ca).addScaledVector(R.ex, -sa)); L.f.lit = 0.75 + 0.25 * Math.sin(T * 1.3 + L.x); }
  };
  SPREADS[3].lights = (T) => {
    const s = breath(T), L = [];
    const m = V3().copy(body.P0).addScaledVector(body.c, 10.4).add(V3(0, -1.2, 3.5));
    L.push([m, V3(1, 0.45, 0.12).multiplyScalar(45 * s * (0.85 + 0.15 * Math.sin(T * 31))), 1.2]);
    for (const Lv of lavas) L.push([V3().copy(Lv.f.o).addScaledVector(Lv.f.ex, 3).add(V3(0, 0.8, 0)), V3(1, 0.4, 0.08).multiplyScalar(3.5 * Lv.f.lit), 1.0]);
    L.push([V3().copy(body.P0).addScaledVector(body.c, 12.0).add(V3(0, 0, 1.2)), V3(1, 0.7, 0.2).multiplyScalar(0.5), 0.4]);
    return L;
  };
  return { all, body, breath, tab, mouth: () => V3().copy(body.P0).addScaledVector(body.c, 10.65) };
})();
// =====================================================================
// The last spread: a city at night. Rows of houses, each row one long
// V-fold across the spine, with an archway where the street passes
// through; their windows are cut out, and behind each row a card that
// glows, so the light comes through the windows. A clock tower in the
// middle (two V-folds, its clock faces lit); at the back the night sky
// on a tall card, its stars pricked through with a pin, the moon glued
// on. Street lamps stand up off the page as it opens.
// =====================================================================
const CITY = (() => {
  const SH = { h: null }, H = () => SH.h, all = [], panels = [];
  const P = (o) => { const f = piece(o); all.push(f); return f; };
  const mir = (pts) => pts.map(([x, y]) => [-x, y]);
  const WALLS = ['#d6c3a0', '#b9c2c9', '#cfa99c', '#a9b79b', '#d9cfb8', '#bfae94', '#c4b5c9'];
  const ROOFS = ['#4a5568', '#7b3f30', '#55606e', '#6a4a3a'];
  // ---- a row of houses along one half (x >= 0): outline, window holes, the print, the glowing card behind ----
  function row(o) {
    const r = mulberry32(o.seed), L = o.L, houses = [];
    let x = o.gate ? 1.7 : 0.0;
    while (x < L - 0.6) { const w = Math.min(lerp(o.w[0], o.w[1], r()), L - x); houses.push({ x0: x, x1: x + w, h: lerp(o.h[0], o.h[1], r()), roof: r() < 0.55 ? 'gable' : r() < 0.7 ? 'tower' : 'flat', col: WALLS[Math.floor(r() * WALLS.length)], rc: ROOFS[Math.floor(r() * ROOFS.length)] }); x += w; }
    const pts = [[0, 0], [L, 0]], holes = [], wins = [];
    for (let k = houses.length - 1; k >= 0; k--) {
      const hs = houses[k], { x0, x1, h } = hs, w = x1 - x0;
      pts.push([x1, h]);
      if (hs.roof === 'gable') pts.push([(x0 + x1) / 2, h + w * 0.42]);
      else if (hs.roof === 'tower') { pts.push([x1 - w * 0.25, h], [x1 - w * 0.25, h + w * 0.5], [(x0 + x1) / 2, h + w * 1.05], [x0 + w * 0.25, h + w * 0.5], [x0 + w * 0.25, h]); }
      else { pts.push([x1 - w * 0.3, h], [x1 - w * 0.3, h + 0.6], [x1 - w * 0.18, h + 0.6], [x1 - w * 0.18, h]); }
      pts.push([x0, h]);
      // windows: a grid, cut through
      const cols = Math.max(1, Math.floor(w / 0.85)), rows = Math.max(1, Math.floor((h - 0.9) / 1.05));
      for (let i = 0; i < cols; i++) for (let j = 0; j < rows; j++) {
        if (r() < 0.12) continue;
        const cx = x0 + (i + 0.5) * w / cols, cy = 0.95 + j * 1.05 + 0.3, ww = 0.3, hh = 0.48;
        if (cy + hh / 2 > h - 0.25 || cx - ww / 2 < x0 + 0.15 || cx + ww / 2 > x1 - 0.15) continue;
        const arch = j === rows - 1 && r() < 0.5;
        const hole = arch ? [[cx - ww / 2, cy - hh / 2], [cx + ww / 2, cy - hh / 2], [cx + ww / 2, cy + hh / 2 - ww / 2], [cx, cy + hh / 2], [cx - ww / 2, cy + hh / 2 - ww / 2]] : [[cx - ww / 2, cy - hh / 2], [cx + ww / 2, cy - hh / 2], [cx + ww / 2, cy + hh / 2], [cx - ww / 2, cy + hh / 2]];
        holes.push(hole); wins.push([cx, cy, r() < 0.72]);
      }
    }
    // (where the street passes the spine: a gateway, half its arch in each half)
    if (o.gate) { pts.push([1.7, 3.2], [0, 3.6]); for (let k = 0; k <= 5; k++) { const a = k / 5 * Math.PI / 2; pts.push([Math.sin(a) * 1.05, 1.45 + Math.cos(a) * 1.05]); } pts[0] = [1.05, 0]; }
    const outline = pts;
    const print = (mirror) => (g) => {
      const { ctx } = g, rr = mulberry32(o.seed + (mirror ? 7 : 3)); if (mirror) ctx.scale(-1, 1);
      for (const hs of houses) {
        const { x0, x1, h } = hs, w = x1 - x0;
        G.wash(ctx, x0, -0.2, x1, h + w * 1.1, hs.col, { k: 1.2, rng: rr });
        ctx.fillStyle = hs.rc; ctx.globalAlpha = 0.95;
        if (hs.roof === 'gable') { ctx.beginPath(); ctx.moveTo(x0 - 0.05, h); ctx.lineTo((x0 + x1) / 2, h + w * 0.42); ctx.lineTo(x1 + 0.05, h); ctx.fill(); G.scallops(ctx, x0, h, x1, h + w * 0.4, 0.22, hs.rc, { rng: rr }); }
        if (hs.roof === 'tower') { ctx.beginPath(); ctx.moveTo(x0 + w * 0.2, h + w * 0.5); ctx.lineTo((x0 + x1) / 2, h + w * 1.05); ctx.lineTo(x1 - w * 0.2, h + w * 0.5); ctx.fill(); }
        ctx.globalAlpha = 1;
        // timbers, a door, a sign; the corner of each house inked
        if (rr() < 0.4) { ctx.strokeStyle = 'rgba(70,40,20,0.75)'; ctx.lineWidth = 0.06; for (let y = 1.0; y < h; y += 1.05) { ctx.beginPath(); ctx.moveTo(x0, y); ctx.lineTo(x1, y); ctx.stroke(); } }
        G.arch(ctx, x0 + w * (0.3 + rr() * 0.4), 0, 0.42, 0.75, '#3b2a1c', { lw: 0.03 });
        ctx.strokeStyle = INK; ctx.lineWidth = 0.035; ctx.beginPath(); ctx.moveTo(x0, 0); ctx.lineTo(x0, h); ctx.moveTo(x1, 0); ctx.lineTo(x1, h); ctx.stroke();
        G.shade(ctx, x0, 0, x1, h, 0.0, 0.22, [0.05, 0.05, 0.12]);
      }
      // the night on it: everything a little blue, darker low down
      G.shade(ctx, 0, 0, L, o.h[1] + 3, 0.35, 0.05, [0.04, 0.05, 0.14], true);
      // window frames and sills round the holes
      ctx.strokeStyle = INK; ctx.lineWidth = 0.03; for (const hl of holes) { G.path(ctx, hl); ctx.stroke(); } for (const [cx, cy] of wins) { ctx.fillStyle = '#efe6d0'; ctx.fillRect(cx - 0.2, cy - 0.3, 0.4, 0.05); }
      if (o.gate) { ctx.strokeStyle = INK; ctx.lineWidth = 0.05; ctx.beginPath(); ctx.arc(0, 1.45, 1.35, 0, Math.PI / 2); ctx.stroke(); G.stones(ctx, 0, 0, 1.75, 3.5, 0.32, '#b5a68c', { rng: rr }); }
      G.inkShape(ctx, outline, 0.045);
    };
    // the card behind: lit windows bright, a few dark
    const glowPrint = (mirror) => (g) => {
      const { ctx } = g, rr = mulberry32(o.seed + 99); if (mirror) ctx.scale(-1, 1);
      ctx.fillStyle = '#2a1a0a'; ctx.fillRect(-1, -1, L + 2, 20);
      for (const [cx, cy, lit] of wins) { if (!lit) continue; const gr = ctx.createRadialGradient(cx, cy, 0, cx, cy, 0.5); const warm = rr(); gr.addColorStop(0, warm < 0.8 ? '#ffd27a' : '#bfe0ff'); gr.addColorStop(1, warm < 0.8 ? '#a8641e' : '#46607a'); ctx.fillStyle = gr; ctx.fillRect(cx - 0.5, cy - 0.5, 1, 1); }
    };
    return { outline, holes, print, glowPrint, wins, houses };
  }
  const ROWSPEC = [
    { z: 10.8, dir: 1, a: 80, L: 22.3, w: [1.6, 2.6], h: [1.6, 2.6], seed: 600, gate: true },
    { z: 6.6, dir: 1, a: 80, L: 22.2, w: [2.0, 3.2], h: [2.8, 4.6], seed: 610, gate: true },
    { z: 2.2, dir: 1, a: 80, L: 22.3, w: [2.2, 3.4], h: [3.8, 6.2], seed: 620, gate: true },
    { z: -5.8, dir: 1, a: 80, L: 22.3, w: [2.4, 3.8], h: [5.6, 8.4], seed: 630, gate: false },
    { z: -9.6, dir: 1, a: 80, L: 22.2, w: [2.6, 4.2], h: [7.0, 10.6], seed: 640, gate: false },
  ];
  const rows = ROWSPEC.map((S, k) => {
    const R = row(S);
    const fA = P({ poly: mir(R.outline), holes: R.holes.map(mir), print: R.print(true), trans: 0.35 }), fB = P({ poly: R.outline, holes: R.holes, print: R.print(false), trans: 0.35 });
    const gA = P({ poly: mir(R.outline), print: R.glowPrint(true), glow: [5.5, 3.6, 1.6], trans: 0, backCol: [0.1, 0.07, 0.04] }), gB = P({ poly: R.outline, print: R.glowPrint(false), glow: [5.5, 3.6, 1.6], trans: 0, backCol: [0.1, 0.07, 0.04] });
    panels.push(gA, gB);
    return { fA, fB, gA, gB, v: vfold(H, { z: S.z, dir: S.dir, aA: S.a * D2R, aB: S.a * D2R, bA: Math.PI / 2, bB: Math.PI / 2 }), k, R };
  });
  // ---- the clock tower: two V-folds meeting at their ends ----
  const TS = 2.35, THt = 13.2, tz = -0.9, tb = tz - 2 * TS * Math.SQRT1_2;
  const towerB = [[0, 0], [TS, 0], [TS, THt], [TS * 0.82, THt], [TS * 0.82, THt + 0.5], [TS * 0.5, THt + 0.5], [TS * 0.5, THt], [0, THt]];
  const towerPrint = (mirror, clock) => (g) => {
    const { ctx } = g, r = mulberry32(mirror ? 651 : 652); if (mirror) ctx.scale(-1, 1);
    G.wash(ctx, -0.2, -0.2, TS + 0.2, THt + 1, '#b8a789', { k: 1, rng: r });
    G.stones(ctx, -0.2, 0, TS + 0.2, THt, 0.34, '#b8a789', { rng: r });
    G.shade(ctx, 0, 0, TS, THt, 0.4, 0.05, [0.04, 0.05, 0.14], true);
    for (const y of [2.5, 5.0, 7.5]) G.arch(ctx, TS / 2, y, 0.42, 0.9, '#2a2030', { lw: 0.03 });
    if (clock) { ctx.fillStyle = '#3a2a1c'; ctx.beginPath(); ctx.arc(TS / 2, 10.6, 0.98, 0, TAU); ctx.fill(); }
    G.inkShape(ctx, towerB, 0.04);
  };
  const tF = vfold(H, { z: tz, dir: -1, aA: Math.PI / 4, aB: Math.PI / 4, bA: Math.PI / 2, bB: Math.PI / 2 });
  const tK = vfold(H, { z: tb, dir: 1, aA: Math.PI / 4, aB: Math.PI / 4, bA: Math.PI / 2, bB: Math.PI / 2 });
  const TFA = P({ poly: mir(towerB), print: towerPrint(true, true) }), TFB = P({ poly: towerB, print: towerPrint(false, true) });
  const TKA = P({ poly: towerB, print: towerPrint(false, false) }), TKB = P({ poly: mir(towerB), print: towerPrint(true, false) });
  const spire = [0, 1, 2, 3].map((k) => P({ poly: [[0, 0], [TS, 0], [TS / 2, 4.2]], print: (g) => { const { ctx } = g; G.wash(ctx, -0.2, -0.2, TS + 0.2, 4.4, '#4a6a7a', { k: 3 }); G.scallops(ctx, -0.2, 0, TS + 0.2, 4.2, 0.24, '#4a6a7a'); G.shade(ctx, 0, 0, TS, 4.2, 0.4, 0, [0.03, 0.04, 0.1]); G.inkShape(ctx, [[0, 0], [TS, 0], [TS / 2, 4.2]], 0.035); } }));
  const clockFace = (g) => { const { ctx } = g; ctx.fillStyle = '#f4ead0'; ctx.fillRect(-1, -1, 2, 2); ctx.strokeStyle = INK; ctx.lineWidth = 0.03; ctx.beginPath(); ctx.arc(0, 0, 0.72, 0, TAU); ctx.stroke(); for (let k = 0; k < 12; k++) { const a = k / 12 * TAU; ctx.beginPath(); ctx.moveTo(Math.cos(a) * 0.62, Math.sin(a) * 0.62); ctx.lineTo(Math.cos(a) * 0.7, Math.sin(a) * 0.7); ctx.stroke(); } ctx.lineWidth = 0.05; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0.15, 0.45); ctx.moveTo(0, 0); ctx.lineTo(-0.5, 0.12); ctx.stroke(); };
  const clocks = [0, 1].map(() => P({ poly: Array.from({ length: 24 }, (_, k) => [Math.cos(k / 24 * TAU) * 0.8, Math.sin(k / 24 * TAU) * 0.8]), t: 0.03, print: clockFace, glow: [2.4, 2.1, 1.5], trans: 0.4 }));
  // ---- the sky: a tall card at the back, stars pricked through it, the moon ----
  const SL = 22.1, SHt = 15.5;
  const skyB = (() => { const pts = [[0, 0], [SL, 0], [SL, SHt - 1.5]]; for (let k = 0; k <= 12; k++) { const x = SL - k / 12 * SL; pts.push([x, SHt - 1.5 + Math.sin(k / 12 * Math.PI) * 1.5]); } return pts; })();
  const stars = (seed) => { const r = mulberry32(seed), S = []; for (let k = 0; k < 34; k++) { const x = 0.8 + r() * (SL - 1.6), y = 6 + r() * (SHt - 8.5), s = 0.06 + r() * 0.07; S.push([[x, y - s * 1.6], [x + s, y], [x, y + s * 1.6], [x - s, y]]); } return S; };
  const starsA = stars(661), starsB = stars(662);
  const skyPrint = (mirror) => (g) => {
    const { ctx } = g, r = mulberry32(mirror ? 671 : 672); if (mirror) ctx.scale(-1, 1);
    G.wash(ctx, -0.3, -0.3, SL + 0.3, SHt + 0.3, '#1b2a4d', { k: 0.3, blob: 3, var: 1.2, rng: r });
    const gr = ctx.createLinearGradient(0, 0, 0, SHt); gr.addColorStop(0, 'rgba(70,90,140,0.6)'); gr.addColorStop(0.35, 'rgba(30,45,90,0.2)'); gr.addColorStop(1, 'rgba(5,10,30,0.6)'); ctx.fillStyle = gr; ctx.fillRect(-0.3, 0, SL + 0.6, SHt);
    G.gold(ctx, (c) => { ctx.fillStyle = c; for (let k = 0; k < 70; k++) { const x = r() * SL, y = 5 + r() * (SHt - 6), s = 0.04 + r() * 0.06; ctx.beginPath(); for (let i = 0; i < 10; i++) { const a = i / 10 * TAU, rr = i % 2 ? s * 0.4 : s * 1.6; ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); } ctx.fill(); } });
    ctx.strokeStyle = 'rgba(160,180,220,0.25)'; ctx.lineWidth = 0.07; for (let k = 0; k < 5; k++) { const x = r() * SL, y = 7 + r() * 6; ctx.beginPath(); ctx.moveTo(x, y); ctx.bezierCurveTo(x + 1.5, y + 0.3, x + 3, y - 0.2, x + 4.5, y + 0.1); ctx.stroke(); }
    // far hills and the towers of the old town, in silhouette
    ctx.fillStyle = 'rgba(12,16,34,0.9)'; ctx.beginPath(); ctx.moveTo(0, 0); for (let x = 0; x <= SL; x += 0.3) ctx.lineTo(x, 3.4 + 1.2 * Math.sin(x * 0.35 + (mirror ? 1 : 0)) + 0.5 * Math.sin(x * 1.1)); ctx.lineTo(SL, 0); ctx.fill();
    if (mirror) { const cx = 9, cy = 12; const gl = ctx.createRadialGradient(cx, cy, 0.5, cx, cy, 4.5); gl.addColorStop(0, 'rgba(255,245,210,0.35)'); gl.addColorStop(1, 'rgba(255,245,210,0)'); ctx.fillStyle = gl; ctx.fillRect(cx - 5, cy - 5, 10, 10); }
    for (const st of mirror ? starsA.map((s) => s.map(([x, y]) => [x, y])) : starsB) { G.path(ctx, st); ctx.strokeStyle = 'rgba(255,230,160,0.6)'; ctx.lineWidth = 0.03; ctx.stroke(); }
    G.inkShape(ctx, skyB, 0.04);
  };
  const SA = P({ poly: mir(skyB), holes: starsA.map(mir), print: skyPrint(true), trans: 0.15 }), SB = P({ poly: skyB, holes: starsB, print: skyPrint(false), trans: 0.15 });
  const skyGlowA = P({ poly: mir(skyB), backCol: [1, 0.92, 0.75], glow: [4, 3.6, 2.6], trans: 0 }), skyGlowB = P({ poly: skyB, backCol: [1, 0.92, 0.75], glow: [4, 3.6, 2.6], trans: 0 });
  panels.push(skyGlowA, skyGlowB);
  const sky = vfold(H, { z: -12.9, dir: 1, aA: 86 * D2R, aB: 86 * D2R, bA: Math.PI / 2, bB: Math.PI / 2 });
  const moon = P({ poly: Array.from({ length: 36 }, (_, k) => [Math.cos(k / 36 * TAU) * 1.5, Math.sin(k / 36 * TAU) * 1.5]), t: 0.04, glow: [2.2, 2.1, 1.7], trans: 0.3, print: (g) => {
    const { ctx } = g, r = mulberry32(681); G.wash(ctx, -1.6, -1.6, 1.6, 1.6, '#f3e6c0', { k: 4, rng: r });
    for (let k = 0; k < 9; k++) { ctx.fillStyle = 'rgba(150,140,110,0.35)'; ctx.beginPath(); ctx.arc((r() - 0.5) * 2, (r() - 0.5) * 2, 0.1 + r() * 0.25, 0, TAU); ctx.fill(); }
    G.inkShape(ctx, g.poly, 0.035);
  } });
  // ---- street lamps: posts that stand up off the pages ----
  const lampShape = [[-0.07, 0], [0.07, 0], [0.07, 2.6], [0.26, 2.75], [0.22, 3.25], [0.0, 3.4], [-0.22, 3.25], [-0.26, 2.75], [-0.07, 2.6]];
  const LAMPS_AT = [[-3.2, 9.0], [3.2, 9.0], [-3.0, 4.2], [3.0, 4.2], [-9, 12.6], [9.5, 12.8], [-15, 8.2], [14.5, 4.0]];
  const posts = LAMPS_AT.map(() => P({ poly: lampShape, t: 0.05, trans: 0.1, print: (g) => { const { ctx } = g; ctx.fillStyle = '#2a2a30'; ctx.fillRect(-0.4, -0.2, 0.8, 3.7); ctx.fillStyle = '#ffd98a'; ctx.fillRect(-0.16, 2.8, 0.32, 0.35); G.inkShape(ctx, lampShape, 0.02); }, back: (g) => { g.ctx.fillStyle = '#2a2a30'; g.ctx.fillRect(-0.4, -0.2, 0.8, 3.7); } }));
  const lanterns = LAMPS_AT.map(() => P({ poly: [[-0.17, 0], [0.17, 0], [0.17, 0.36], [-0.17, 0.36]], t: 0.02, backCol: [1, 0.85, 0.55], glow: [7, 5, 2.4], trans: 0 }));
  // ---- the ground: cobbled streets, a river with a bridge, pools of lamplight ----
  SPREADS[4].ground = (g) => {
    const { ctx } = g, r = mulberry32(690), Y = (z) => BH / 2 - z;
    G.wash(ctx, -BW, 0, BW, BH, '#6f7486', { k: 0.12, blob: 4, grain: 1.5, rng: r });
    G.stones(ctx, -BW, 0, BW, BH, 0.36, '#7a7f90', { rng: r });
    ctx.fillStyle = 'rgba(15,20,45,0.35)'; ctx.fillRect(-BW, 0, 2 * BW, BH);
    // the river, between the second and third rows, a bridge over it
    const ry = Y(4.2); ctx.fillStyle = '#1d3a5f'; ctx.fillRect(-BW, ry - 0.9, 2 * BW, 1.8);
    ctx.strokeStyle = 'rgba(255,210,120,0.55)'; ctx.lineWidth = 0.05; for (let k = 0; k < 60; k++) { const x = -BW + r() * 2 * BW, y = ry + (r() - 0.5) * 1.4; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + 0.3 + r() * 0.5, y); ctx.stroke(); }
    G.ink(ctx, [[-BW, ry - 0.9], [BW, ry - 0.9]], 0.04); G.ink(ctx, [[-BW, ry + 0.9], [BW, ry + 0.9]], 0.04);
    ctx.fillStyle = '#8a8070'; ctx.fillRect(-1.6, ry - 1.1, 3.2, 2.2); ctx.strokeStyle = INK; ctx.lineWidth = 0.04; ctx.strokeRect(-1.6, ry - 1.1, 3.2, 2.2);
    for (const x of [-1.6, 1.6]) for (let k = 0; k < 6; k++) { ctx.fillStyle = '#5a5248'; ctx.fillRect(x - 0.08, ry - 1.1 + k * 0.42, 0.16, 0.2); }
    // lamplight on the cobbles
    for (const [x, y] of LAMPS_AT) { const gr = ctx.createRadialGradient(x, y, 0, x, y, 2.2); gr.addColorStop(0, 'rgba(255,200,110,0.55)'); gr.addColorStop(1, 'rgba(255,200,110,0)'); ctx.fillStyle = gr; ctx.fillRect(x - 2.2, y - 2.2, 4.4, 4.4); }
  };
  // a spread's page as a surface to stand things on: x across the spread, y from the near edge (the left page seen from its front)
  const page = (x) => { const L = BOOK.leaves[x < 0 ? 3 : 4], left = x < 0; return { o: L.o, ex: left ? L.ex.clone().negate() : L.ex, ey: L.ey, t: LEAF_T }; };
  SPREADS[4].frame = (T, Hn, th) => {
    SH.h = Hn;
    const vis = th > 0.035 ? 1 : 0;
    for (const f of all) f.vis = vis;
    if (!vis) return;
    const open = smooth(2.4, 3.1, th);
    for (const R of rows) {
      R.v.solve().place(R.fA, R.fB);
      glued(R.gA, R.fA, 0, 0, -0.28); glued(R.gB, R.fB, 0, 0, -0.28);
      const fl = 0.85 + 0.15 * Math.sin(T * 0.7 + R.k * 1.9);
      R.gA.lit = R.gB.lit = fl;
    }
    tF.solve().place(TFA, TFB); tK.solve().place(TKA, TKB, true);
    [[TFA, -TS], [TFB, 0], [TKA, 0], [TKB, -TS]].forEach(([w, x0], k) => flapOn(spire[k], w, x0, THt, 1, 0, lerp(-0.05, -Math.asin(TS / 2 / 4.2), open), 0));
    glued(clocks[0], TFA, -TS / 2, 10.6, 0.04); glued(clocks[1], TFB, TS / 2, 10.6, 0.04);
    for (const c of clocks) c.lit = 0.9;
    sky.solve().place(SA, SB);
    glued(skyGlowA, SA, 0, 0, -0.3); glued(skyGlowB, SB, 0, 0, -0.3);
    skyGlowA.lit = skyGlowB.lit = 0.7 + 0.1 * Math.sin(T * 0.9);
    glued(moon, SA, -9, 12, 0.05); moon.lit = 1;
    LAMPS_AT.forEach(([x, y], k) => {
      const pg = page(x);
      flapOn(posts[k], pg, x, y, 1, 0, lerp(0.02, Math.PI / 2, smooth(0.1 + (k % 4) * 0.08, 0.7 + (k % 4) * 0.07, open)), 0);
      glued(lanterns[k], posts[k], -0.17, 2.82, 0.04); lanterns[k].lit = 0.9 + 0.1 * Math.sin(T * 9 + k * 3) * Math.sin(T * 5.3 + k);
    });
  };
  SPREADS[4].lights = (T) => {
    const L = [];
    LAMPS_AT.forEach((xy, k) => { const f = lanterns[k]; if (f.vis) L.push([V3().copy(f.o).addScaledVector(f.ey, 0.18).addScaledVector(V3().crossVectors(f.ex, f.ey), 0.25), V3(1, 0.72, 0.38).multiplyScalar(1.6 * f.lit), 0.4]); });
    L.push([V3().copy(moon.o).add(V3(0, 0, 3)), V3(0.6, 0.65, 0.8).multiplyScalar(6), 2.0]);
    return L;
  };
  return { all, rows, tF, tK, sky, panels };
})();
// =====================================================================
// The film, shot by shot (two minutes; the end comes round to the start).
//   0    the study at night: a lamp, an old book
//   7    the cover opens; we drop toward it as the castle stands up
//  14    in through the gate, up the keep to its crown, out at the lamp
//  33.5  a leaf turns: the castle folds away, the sea rises
//  39    low over the waves, round the ship, up at the storm
//  57.5  the next leaf: the dragon on its hoard; its fire; its lever
//  81.5  the last leaf: the city at night, down its street, up its tower
// 104.5  the book shuts: out between the pages as they close
// 111    the shut book on the desk, and back to where we began
// =====================================================================
// the camera: where it is, what it looks at, how wide, how much the lens blurs (as one curve through these moments)
const CAMK = [
  // t      position           looking at          fov  aperture
  [0,     -30, 44, 66,          6, 9, -3,          36, 0.35],
  [6.5,   -24, 35, 52,          4, 7, -2,          37, 0.32],
  [9.6,    16, 17, 34,         -2, 6, 0,           42, 0.18],
  [12.2,   5.5, 7.5, 23,        0, 5, 5,           46, 0.09],
  [14.2,   1.2, 3.6, 16.5,      0, 3.6, 8,         50, 0.05],
  [17.0,   0.3, 3.4, 11.5,      0, 3.6, 4,         52, 0.045],
  [19.5,   0.0, 3.4, 7.0,       0, 7.5, -2,        54, 0.04],
  [22.5,   3.0, 5.5, 4.2,       0, 11, -2.5,       54, 0.04],
  [26.0,   7.0, 12, 4.0,        0, 14.5, -2.5,     52, 0.045],
  [29.0,   6.0, 18.5, 5.0,      0, 15.5, -2.5,     50, 0.05],
  [32.2,   7.0, 18.0, 13.0,    20, 31, 2,          48, 0.05],
  [34.8,   17, 19, 14,          3, 4, -1,          46, 0.12],
  [37.4,   19, 15, 16,          5, 3, -1,          44, 0.13],
  [39.8,   8, 7, 17,            1, 4, 3,           48, 0.08],
  [42.0,  -5, 4.2, 14,          0, 4.5, 3,         52, 0.05],
  [45.0,  -7.5, 5, 6.5,         0, 5, 1,           52, 0.05],
  [48.0,  -6.5, 7.2, -5.2,      0, 5, 0,           52, 0.05],
  [51.0,   7, 7.2, -4.4,        0, 5.5, 0.5,       52, 0.05],
  [54.0,   7, 3.8, 7,           1, 8, -9,          54, 0.05],
  [57.0,   5, 4, 10,            0, 9, -10,         54, 0.05],
  [58.8,   17, 19, 14,          3, 4, -1,          46, 0.12],
  [61.6,   19, 15, 16,          4, 4, 0,           44, 0.13],
  [64.0,   4, 4, 18,            0, 7, 2,           50, 0.06],
  [67.0,   1.5, 3.2, 12,        0, 9, 1,           54, 0.05],
  [70.0,   2.5, 4.0, 9.5,       0, 10, 1,          56, 0.045],
  [73.5,   9, 7, 4,             0, 9, 0,           52, 0.05],
  [77.0,   18, 4, 6,            12, 6, 1,          50, 0.05],
  [80.5,   23.5, 3.2, 5.5,      21, 2, 3,          48, 0.04],
  [82.8,   17, 19, 14,          3, 4, -1,          46, 0.12],
  [85.6,   19, 15, 16,          2, 4, 0,           44, 0.13],
  [88.0,   0.6, 3.2, 19,        0, 3, 8,           52, 0.05],
  [91.5,   0.0, 3.0, 10,        0, 3.2, 2,         54, 0.045],
  [95.0,   0.0, 3.2, 4.0,       0, 7, -3,          54, 0.045],
  [96.6,   0.1, 3.3, 0.7,       0, 9, -3,          54, 0.045],
  [99.0,   2.5, 9.5, 0.4,      -1, 13, -3,         52, 0.05],
  [103.0,  3.5, 15, 2.5,       -9, 13.5, -12,      50, 0.05],
  [104.8,  3.0, 7.5, 5.0,      -6, 13, 1,          54, 0.05],
  [106.8,  4.5, 4.6, 5.2,      -3, 13, 3,          58, 0.05],
  [108.4,  8.5, 3.6, 5.9,       0, 11, 4,          60, 0.05],
  [109.5,  13.5, 3.3, 6.8,      4, 8, 5,           62, 0.05],
  [110.0,  17.5, 3.2, 7.5,      30, 6, 9.5,        64, 0.05],
  [110.45, 22.5, 3.0, 8.3,      34, 4, 10,         64, 0.05],
  [111.2,  27, 3.6, 8.5,        34, 3.5, 9,        56, 0.06],
  [113.0,  30, 8, 18,           6, 2.5, 0,         46, 0.15],
  [117.0, -20, 30, 52,          5, 7, -2,          38, 0.3],
  [120.0, -30, 44, 66,          6, 9, -3,          36, 0.35],
];
const _ck = [];
shot(0, LEN + 1, (T) => {
  keys(CAMK, T, _ck);
  const pos = V3(_ck[0], _ck[1], _ck[2]), tgt = V3(_ck[3], _ck[4], _ck[5]), d = pos.distanceTo(tgt);
  return { pos, tgt, fov: _ck[6], ap: _ck[7], focus: d, near: clamp(d * 0.012, 0.04, 1.2), far: 900 };
});
const WARM = [2, 16, 30, 45, 60, 72, 92, 108, 115];
// ---- the lamp (dimmer while the storm and the night last), and the exposure ----
const LAMPK = [[0, 1], [33, 1], [36.5, 0.72], [57, 0.72], [61, 0.85], [81, 0.85], [85.5, 0.28], [104.5, 0.28], [109.5, 0.7], [112, 1], [120, 1]];
const EXPK = [[0, 1.25], [12, 1.15], [27, 1.1], [29.5, 0.72], [30.8, 0.72], [31.8, 0.55], [33, 0.6], [35, 1.15], [38, 1.35], [57, 1.35], [61, 1.25], [81, 1.25], [86, 1.7], [104, 1.7], [110, 1.35], [113, 1.25], [120, 1.25]];
ROOM.hooks.push((T) => {
  bookFrame(T);
  for (let k = 1; k <= 4; k++) { const sp = SPREADS[k]; if (sp.frame) sp.frame(T, spreadHinge(k), THETA[k]); }
  lightFrame(T, key1(LAMPK, T));
  // the little lights of the open worlds (lightning, fire, lanterns), as many as there are places for
  const P = WORLDU.uLP.value, C = WORLDU.uLC.value; let n = 0;
  for (let k = 1; k <= 4 && n < NL; k++) { const sp = SPREADS[k]; if (!sp.lights || THETA[k] < 0.035) continue; const w = smooth(0.035, 1.2, THETA[k]); for (const [p, c, r] of sp.lights(T)) { if (n >= NL) break; P[n].set(p.x, p.y, p.z, r); C[n].copy(c).multiplyScalar(w); n++; } }
  for (; n < NL; n++) { P[n].set(0, -1e4, 0, 1); C[n].set(0, 0, 0); }
  WORLDU.uFlash.value = THETA[2] > 0.035 ? SEA.flash(T) * 0.18 : 0;
  uploadFrames();
});
FRAME_HOOKS.push((T) => { ENV.exposure = key1(EXPK, T); });
// =====================================================================
// The sound, all made here. The study: a pocket watch ticking, the
// lamp's faint hum, the quiet of a room at night. The book: the creak
// of its leather, pages turning (a rustle, the air they push, the soft
// thud as each lands), and the crisp snaps of card as a world locks
// open. Each world has its own music box (steel teeth plucked by a
// turning drum: a pure tone, a bright out-of-tune overtone, a click)
// and its own small sounds: birds and a breeze round the castle; wind,
// rain, waves and thunder at sea; the dragon's wings and its roar; the
// city's crickets and its clock. At the end the last music box runs
// down as the book shuts, with a thump and a breath of dust.
// =====================================================================
const AUD = { ctx: null, want: false, h: 0, rng: mulberry32(212), clock: null, off: false };
function noiseBuf(c, sec, seed) { const n = Math.ceil(sec * c.sampleRate), b = c.createBuffer(1, n, c.sampleRate), d = b.getChannelData(0), r = mulberry32(seed); for (let i = 0; i < n; i++) d[i] = r() * 2 - 1; return b; }
// noise that crackles: paper being handled (bursts of grains, each dying fast)
function crackleBuf(c, sec, seed) {
  const sr = c.sampleRate, n = Math.ceil(sec * sr), b = c.createBuffer(1, n, sr), d = b.getChannelData(0), r = mulberry32(seed);
  let env = 0;
  for (let i = 0; i < n; i++) { if (r() < 260 / sr) env = Math.max(env, 0.3 + r() * 0.7); env *= 1 - 90 / sr; d[i] = (r() * 2 - 1) * (0.08 + env); }
  return b;
}
function roomIR(c, sec, decay, seed) {
  const sr = c.sampleRate, L = Math.round(sec * sr), b = c.createBuffer(2, L, sr), r = mulberry32(seed);
  for (let ch = 0; ch < 2; ch++) { const d = b.getChannelData(ch); let lp = 0; for (let i = 0; i < L; i++) { const t = i / sr - 0.01; if (t < 0) continue; const k = 0.08 + 0.4 * Math.exp(-t / 0.3); lp += (r() * 2 - 1 - lp) * k; d[i] = lp * Math.exp(-t / decay) * Math.min(1, t / 0.02); } }
  return b;
}
function audioOn(on) {
  const A = AUD, c = A.ctx; A.want = on;
  if (!c) return;
  const now = c.currentTime, p = A.out.gain;
  hold(p, now); p.setTargetAtTime(on ? 1 : 0, now, on ? 0.4 : 0.15);
  clearTimeout(A.sleep);
  if (on) { A.h = MAIN.time; if (c.state !== 'running') { try { const q = c.resume(); if (q && q.catch) q.catch(() => { }); } catch (e) { } } }
  else A.sleep = setTimeout(() => { if (!A.want && c.state === 'running') { try { const q = c.suspend(); if (q && q.catch) q.catch(() => { }); } catch (e) { } } }, 1400);
}
function hold(p, t) { if (p.cancelAndHoldAtTime) { try { p.cancelAndHoldAtTime(t); return; } catch (e) { } } const v = p.value; p.cancelScheduledValues(t); p.setValueAtTime(v, t); }
function env(t, g, att, dec, dest, pan) { const c = AUD.ctx, e = c.createGain(), p = c.createStereoPanner(); e.gain.value = 0; e.gain.setValueAtTime(0, t); e.gain.linearRampToValueAtTime(g, t + att); e.gain.setTargetAtTime(0, t + att, dec); p.pan.value = clamp(pan, -1, 1); e.connect(p); p.connect(dest || AUD.amb); return e; }
function tone(t, f, g, dec, pan, dest, att = 0.003, type = 'sine') { const c = AUD.ctx, o = c.createOscillator(); o.type = type; o.frequency.value = f; o.connect(env(t, g, att, dec, dest, pan)); o.start(t); o.stop(t + att + dec * 7); return o; }
function burst(t, f, q, g, dec, pan, dest, type = 'bandpass', buf) { const c = AUD.ctx, s = c.createBufferSource(), bq = c.createBiquadFilter(); s.buffer = buf || AUD.noise; bq.type = type; bq.frequency.value = f; bq.Q.value = q; s.connect(bq); bq.connect(env(t, g, 0.001, dec, dest, pan)); s.start(t, AUD.rng() * 1.5); s.stop(t + dec * 7 + 0.05); return bq; }
function shape(t, end, g, att, rel) { const e = AUD.ctx.createGain(), h = Math.max(t + att, end); e.gain.value = 0; e.gain.setValueAtTime(0, t); e.gain.linearRampToValueAtTime(g, t + att); e.gain.setValueAtTime(g, h); e.gain.setTargetAtTime(0, h, rel / 3); return e; }
const pan1 = (p, dest) => { const s = AUD.ctx.createStereoPanner(); s.pan.value = clamp(p, -1, 1); s.connect(dest || AUD.amb); return s; };
function whoosh(t, d, g, f0 = 2400, f1 = 200, dest, q = 0.6) { const c = AUD.ctx, s = c.createBufferSource(), bq = c.createBiquadFilter(); s.buffer = AUD.noise; bq.type = 'bandpass'; bq.frequency.setValueAtTime(f0, t); bq.frequency.exponentialRampToValueAtTime(f1, t + d); bq.Q.value = q; const e = shape(t, t + d * 0.3, g, d * 0.25, d * 0.7); s.connect(bq); bq.connect(e); e.connect(dest || AUD.amb); s.start(t, 0.7); s.stop(t + d * 2 + 0.2); }
// ---- the voices ----
// a music box's tooth: a pure tone that rings on, a bright overtone gone at once, the pin's click
function mbox(t, m, g = 0.05, pan = 0, tempo = 1) {
  const f = mtof(m), dec = 1.4 * Math.sqrt(440 / f) * tempo, d = AUD.mus;
  tone(t, f, g, dec, pan, d, 0.002); tone(t, f * 1.0018, g * 0.5, dec * 0.8, -pan, d, 0.002);
  tone(t, f * 5.43, g * 0.12, 0.05, pan, d, 0.001); tone(t, f * 2, g * 0.12, dec * 0.25, pan, d, 0.002);
  burst(t, 6500, 1.2, g * 0.25, 0.004, pan, d);
}
// a page being handled: a rustle of crackling card through a band of the noise
function rustle(t, dur, g, f = 2600, pan = 0) {
  const c = AUD.ctx, s = c.createBufferSource(), bq = c.createBiquadFilter(), hp = c.createBiquadFilter();
  s.buffer = AUD.crackle; bq.type = 'bandpass'; bq.frequency.value = f; bq.Q.value = 0.7; hp.type = 'highpass'; hp.frequency.value = 700;
  const e = shape(t, t + dur * 0.7, g, dur * 0.2, dur * 0.4); s.connect(bq); bq.connect(hp); hp.connect(e); e.connect(pan1(pan, AUD.paper));
  s.start(t, AUD.rng() * 2); s.stop(t + dur * 1.6 + 0.1);
}
// card snapping into place
function snap(t, g, pan = 0) { burst(t, 2600 + AUD.rng() * 3000, 1.6, g, 0.012 + AUD.rng() * 0.01, pan, AUD.paper); tone(t, 180 + AUD.rng() * 140, g * 0.35, 0.03, pan, AUD.paper, 0.001); }
// something landing: a soft low thud
function thud(t, g, f = 90, pan = 0) { const c = AUD.ctx, o = c.createOscillator(); o.frequency.setValueAtTime(f * 1.6, t); o.frequency.exponentialRampToValueAtTime(f, t + 0.05); o.connect(env(t, g, 0.003, 0.09, AUD.paper, pan)); o.start(t); o.stop(t + 1); burst(t, 500, 0.8, g * 0.35, 0.05, pan, AUD.paper, 'lowpass'); }
// a bell: a tone and the out-of-tune partials of a cast bell
function bell(t, f, g, pan = 0) { for (const [k, a, d] of [[0.5, 0.5, 4], [1, 1, 3], [1.183, 0.5, 2.2], [1.506, 0.35, 1.6], [2, 0.3, 1.2], [2.514, 0.18, 0.8], [2.662, 0.15, 0.7]]) tone(t, f * k, g * a, d, pan, AUD.mus, 0.003); }
// thunder in a book: a crack, then a roll
function thunder(t, g) { burst(t, 3000, 0.6, g * 0.6, 0.03, 0, AUD.world, 'highpass'); burst(t + 0.02, 900, 0.7, g * 0.4, 0.08, 0.2, AUD.world); const c = AUD.ctx, s = c.createBufferSource(), lp = c.createBiquadFilter(); s.buffer = AUD.noise; lp.type = 'lowpass'; lp.frequency.setValueAtTime(400, t); lp.frequency.exponentialRampToValueAtTime(90, t + 2.5); const e = shape(t + 0.05, t + 0.4, g, 0.15, 2.2); s.connect(lp); lp.connect(e); e.connect(AUD.world); s.start(t, 1.3); s.stop(t + 4); }
// the dragon's fire: a roar rising and falling, crackling
function roar(t, dur, g) { const c = AUD.ctx, s = c.createBufferSource(), bq = c.createBiquadFilter(); s.buffer = AUD.noise; bq.type = 'bandpass'; bq.Q.value = 1.1; bq.frequency.setValueAtTime(260, t); bq.frequency.linearRampToValueAtTime(900, t + dur * 0.35); bq.frequency.linearRampToValueAtTime(380, t + dur); const e = shape(t, t + dur * 0.6, g, dur * 0.15, dur * 0.4); s.connect(bq); bq.connect(e); e.connect(AUD.world); s.start(t, 0.4); s.stop(t + dur * 1.6); rustle(t + 0.1, dur * 0.8, g * 0.35, 1800); const o = c.createOscillator(); o.type = 'sawtooth'; o.frequency.setValueAtTime(70, t); o.frequency.linearRampToValueAtTime(52, t + dur); const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 220; const e2 = shape(t, t + dur * 0.5, g * 0.35, dur * 0.2, dur * 0.4); o.connect(lp); lp.connect(e2); e2.connect(AUD.world); o.start(t); o.stop(t + dur * 1.6); }
// a wing's downstroke: air pushed, card fluttering
function flap(t, g, pan) { burst(t, 240, 0.9, g, 0.11, pan, AUD.world, 'lowpass'); rustle(t, 0.22, g * 0.4, 3200, pan); }
function attachAudio(c) {
  if (AUD.ctx === c) return;
  AUD.ctx = c; AUD.h = 0;
  const A = AUD, Gn = (v = 1) => { const g = c.createGain(); g.gain.value = v; return g; };
  A.clock = () => c.currentTime;
  A.out = Gn(A.off ? 1 : 0); A.out.connect(c.destination);
  A.lim = c.createDynamicsCompressor(); A.lim.threshold.value = -10; A.lim.knee.value = 6; A.lim.ratio.value = 10; A.lim.attack.value = 0.003; A.lim.release.value = 0.3; A.lim.connect(A.out);
  A.pre = Gn(1.1); A.pre.connect(A.lim);
  A.verb = c.createConvolver(); A.verb.buffer = roomIR(c, 2.6, 0.55, 7);
  A.ret = Gn(0.55); A.verb.connect(A.ret); A.ret.connect(A.pre);
  A.noise = noiseBuf(c, 4, 13); A.crackle = crackleBuf(c, 4, 21);
  A.amb = Gn(1); A.amb.connect(A.pre); { const s = Gn(0.25); A.amb.connect(s); s.connect(A.verb); }
  A.mus = Gn(0.8); A.mus.connect(A.pre); { const s = Gn(0.6); A.mus.connect(s); s.connect(A.verb); }
  A.paper = Gn(0.9); A.paper.connect(A.pre); { const s = Gn(0.3); A.paper.connect(s); s.connect(A.verb); }
  // the sounds of the worlds go through one filter, a little muffled (they are paper)
  A.world = c.createBiquadFilter(); A.world.type = 'lowpass'; A.world.frequency.value = 9000; A.world.connect(A.amb);
  const loop = (fType, f, q, gain, dest, off) => { const s = c.createBufferSource(); s.buffer = A.noise; s.loop = true; const bq = c.createBiquadFilter(); bq.type = fType; bq.frequency.value = f; bq.Q.value = q; const g = Gn(gain); s.connect(bq); bq.connect(g); g.connect(dest); s.start(c.currentTime + 0.05, off); return { bq, g, s }; };
  const lfo = (f, depth, param) => { const o = c.createOscillator(); const g = Gn(depth); o.frequency.value = f; o.connect(g); g.connect(param); o.start(); return o; };
  // the room: its quiet, the lamp's hum
  A.roomG = Gn(0); A.roomG.connect(A.amb);
  { loop('lowpass', 300, 0.5, 0.35, A.roomG, 0.3); for (const [f, a] of [[60, 0.05], [120, 0.035], [180, 0.012]]) { const o = c.createOscillator(); o.frequency.value = f; const g = Gn(a); o.connect(g); g.connect(A.roomG); o.start(); } }
  // a breeze round the castle
  A.breezeG = Gn(0); A.breezeG.connect(A.world); { const w = loop('lowpass', 700, 0.5, 0.5, A.breezeG, 1.1); lfo(0.13, 0.25, w.g.gain); lfo(0.07, 250, w.bq.frequency); }
  // the storm: wind, rain, the swell
  A.windG = Gn(0); A.windG.connect(A.world); { const w = loop('bandpass', 520, 0.8, 0.7, A.windG, 2.2); lfo(0.17, 0.35, w.g.gain); lfo(0.09, 260, w.bq.frequency); const h = loop('highpass', 3800, 0.4, 0.22, A.windG, 0.6); lfo(0.3, 0.08, h.g.gain); }
  A.seaG = Gn(0); A.seaG.connect(A.world); { const w = loop('lowpass', 420, 0.6, 0.0, A.seaG, 1.7); A.swell = w; }
  // the dragon's cave: a low rumble of the lava
  A.caveG = Gn(0); A.caveG.connect(A.world); { const w = loop('lowpass', 110, 0.7, 0.9, A.caveG, 0.9); lfo(0.05, 0.3, w.g.gain); }
  // the city at night: crickets come and go (added as they sing), a hush of air
  A.nightG = Gn(0); A.nightG.connect(A.world); loop('bandpass', 1500, 0.6, 0.035, A.nightG, 2.9);
  A.next = { tick: 0, bird: 0, drop: 0, crick: 0 };
}
// ---- the score: fixed moments ----
const EV = [];
const ev = (t, fn) => EV.push({ t, fn });
// the music boxes: [beat, note] at a tempo; each world's tune from where it opens
const TUNES = {
  castle: { at: 13.4, end: 33.4, beat: 0.56, notes: [[0, 74], [1, 78], [2, 81], [3, 83], [4.5, 81], [5, 78], [6, 79], [7, 76], [8, 73], [9, 74], [11, 69], [12, 74], [13, 78], [14, 81], [15, 86], [16.5, 85], [17, 83], [18, 81], [19, 79], [20, 76], [21, 78], [24, 79], [25, 83], [26, 79], [27, 78], [28, 81], [29, 78], [30, 76], [31, 79], [32, 73], [33, 74]],
    bass: [[0, 50], [3, 50], [6, 45], [9, 50], [12, 50], [15, 43], [18, 45], [21, 50], [24, 43], [27, 50], [30, 45], [33, 50]] },
  sea: { at: 40.2, end: 57.4, beat: 0.3, notes: [[0, 69], [3, 74], [5, 76], [6, 77], [9, 76], [11, 74], [12, 72], [15, 69], [17, 72], [18, 74], [24, 77], [27, 79], [29, 81], [30, 82], [33, 81], [35, 79], [36, 77], [39, 76], [41, 73], [42, 74], [48, 69], [51, 74], [53, 76], [54, 77], [57, 76], [59, 74], [60, 73], [63, 76], [65, 73], [66, 74]],
    bass: [[0, 50], [6, 50], [12, 48], [18, 50], [24, 41], [30, 46], [36, 45], [42, 50], [48, 50], [54, 50], [60, 45], [66, 50]] },
  dragon: { at: 64.4, end: 81.4, beat: 0.7, notes: [[0, 76], [1, 77], [2, 76], [3, 74], [4, 76], [6, 79], [7, 77], [8, 76], [9, 72], [10, 74], [11, 71], [12, 76], [16, 76], [17, 77], [18, 79], [19, 77], [20, 76], [22, 74], [23, 72], [24, 71], [25, 72], [26, 74], [27, 77], [28, 76]],
    bass: [[0, 40], [4, 40], [8, 36], [12, 40], [16, 40], [20, 41], [24, 35], [28, 40]] },
  city: { at: 88.6, end: 110.5, beat: 0.5, notes: [[0, 84], [1, 81], [2, 77], [3, 79], [4.5, 81], [5, 82], [6, 84], [8, 81], [9, 77], [12, 86], [13, 84], [14, 82], [15, 81], [16, 79], [17, 77], [18, 76], [19, 79], [20, 84], [21, 77], [24, 84], [25, 81], [26, 77], [27, 79], [28.5, 81], [29, 82], [30, 84], [32, 81], [33, 77]],
    bass: [[0, 53], [3, 48], [6, 53], [9, 53], [12, 46], [15, 53], [18, 48], [21, 53], [24, 53], [27, 48], [30, 53], [33, 53]] },
};
{
  const r = mulberry32(44);
  // the tunes (the city's runs down as the book shuts: slower and slower)
  for (const k in TUNES) {
    const tu = TUNES[k], wind = k === 'city';
    const when = (b) => { let t = tu.at + b * tu.beat; if (wind && b > 20) { const x = b - 20; t = tu.at + 20 * tu.beat + tu.beat * (x + 0.004 * x * x * x); } return t; };
    for (const [b, m] of tu.notes) { const t = when(b); if (t < tu.end) ev(t, (tt) => mbox(tt, m, 0.07, (r() - 0.5) * 0.5, wind && b > 20 ? 1.3 : 1)); }
    for (const [b, m] of tu.bass) { const t = when(b); if (t < tu.end) ev(t, (tt) => mbox(tt, m + 12, 0.042, 0, 1.2)); }
  }
  // the cover opening: the leather's creak, the spine; the castle unfolding, its pieces snapping open
  ev(T_OPEN - 0.2, (tt) => { const c = AUD.ctx, s = c.createBufferSource(), bq = c.createBiquadFilter(); s.buffer = AUD.crackle; bq.type = 'bandpass'; bq.frequency.value = 420; bq.Q.value = 3; const e = shape(tt, tt + 1.3, 0.5, 0.4, 0.5); s.connect(bq); bq.connect(e); e.connect(AUD.paper); s.start(tt, 0.5); s.stop(tt + 2.5); });
  ev(T_OPEN + 0.3, (tt) => rustle(tt, 4.2, 0.22, 2000, -0.2));
  ev(T_OPEN + 1.5, (tt) => whoosh(tt, 3.0, 0.08, 300, 1400));
  ev(T_OPEN + 5.2, (tt) => thud(tt, 0.35, 70, -0.4));
  for (let k = 0; k < 9; k++) ev(T_OPEN + 3.3 + k * 0.21 + r() * 0.1, (tt) => snap(tt, 0.1 + r() * 0.08, (r() - 0.5) * 0.8));
  // the leaves turning: lifted, carried over, laid down; the new world snapping open as the old folds
  for (let k = 1; k <= 3; k++) {
    const t0 = T_TURN[k];
    ev(t0 - 0.1, (tt) => rustle(tt, 0.6, 0.28, 3200, 0.5));
    ev(t0 + 0.6, (tt) => rustle(tt, 3.3, 0.2, 2200, 0));
    ev(t0 + 1.2, (tt) => whoosh(tt, 2.6, 0.09, 350, 1600));
    ev(t0 + 4.4, (tt) => thud(tt, 0.3, 75, -0.5));
    for (let j = 0; j < 8; j++) ev(t0 + 2.8 + j * 0.2 + r() * 0.1, (tt) => snap(tt, 0.09 + r() * 0.07, (r() - 0.2) * 0.9));
    for (let j = 0; j < 5; j++) ev(t0 + 1.0 + j * 0.25 + r() * 0.1, (tt) => snap(tt, 0.05 + r() * 0.04, -0.6));
  }
  // the storm: thunder with each bolt; the dragon: its fire; the city's clock striking
  for (const t of [41.6, 44.9, 47.3, 49.8, 52.6, 54.4, 56.3]) ev(t, (tt) => thunder(tt, 0.3));
  for (const t of [68.2, 72.6, 76.4, 79.9]) ev(t, (tt) => roar(tt, 2.0, 0.32));
  for (let t = 64.0; t < 81.5; t += 1.7) ev(t + 1.7 * 0.25, (tt) => flap(tt, 0.16, 0));
  for (let k = 0; k < 3; k++) ev(97.2 + k * 2.2, (tt) => bell(tt, 196, 0.07, -0.2));
  // the book shutting: the air it pushes, our flight out, the thump, the dust
  ev(T_CLOSE + 0.2, (tt) => rustle(tt, 3.0, 0.2, 1800, -0.4));
  ev(T_CLOSE + 2.4, (tt) => whoosh(tt, 3.6, 0.12, 250, 2200, null, 0.5));
  ev(109.4, (tt) => whoosh(tt, 1.3, 0.16, 900, 3800, null, 0.8));
  ev(T_CLOSE + D_CLOSE, (tt) => { const c = AUD.ctx, o = c.createOscillator(); o.frequency.setValueAtTime(95, tt); o.frequency.exponentialRampToValueAtTime(42, tt + 0.12); o.connect(env(tt, 0.9, 0.002, 0.18, AUD.paper, 0)); o.start(tt); o.stop(tt + 2); burst(tt, 700, 0.7, 0.5, 0.08, 0, AUD.paper, 'lowpass'); burst(tt + 0.01, 2400, 0.5, 0.18, 0.03, 0.3, AUD.paper); });
  ev(T_CLOSE + D_CLOSE + 0.05, (tt) => { const c = AUD.ctx, s = c.createBufferSource(), bq = c.createBiquadFilter(); s.buffer = AUD.noise; bq.type = 'highpass'; bq.frequency.value = 2500; const e = shape(tt, tt + 0.3, 0.05, 0.05, 1.2); s.connect(bq); bq.connect(e); e.connect(AUD.amb); s.start(tt, 2); s.stop(tt + 2.5); });
}
EV.sort((a, b) => a.t - b.t);
// ---- the beds, by the story's time ----
const BEDK = {
  room: [[0, 1], [9, 0.9], [13, 0.35], [104, 0.35], [110.4, 0.6], [111, 1], [120, 1]],
  breeze: [[0, 0], [9, 0], [12, 0.6], [33, 0.6], [36, 0], [120, 0]],
  wind: [[0, 0], [35, 0], [38, 0.7], [56, 0.8], [59, 0], [120, 0]],
  sea: [[0, 0], [35, 0], [38, 1], [57, 1], [60, 0], [120, 0]],
  cave: [[0, 0], [59, 0], [62, 0.9], [81, 0.9], [84, 0], [120, 0]],
  night: [[0, 0], [83, 0], [86, 1], [104, 1], [109, 0.4], [110.6, 0], [120, 0]],
  tick: [[0, 1], [12, 0.6], [14, 0.25], [104, 0.25], [110.6, 0.7], [112, 1], [120, 1]],
};
function bedsAt(T, at, ramp) {
  const A = AUD, set = (p, v, tc) => { if (ramp) p.linearRampToValueAtTime(v, at); else p.setTargetAtTime(v, at, tc); };
  set(A.roomG.gain, key1(BEDK.room, T) * 0.25, 0.5); set(A.breezeG.gain, key1(BEDK.breeze, T) * 0.25, 0.6);
  set(A.windG.gain, key1(BEDK.wind, T) * 0.3, 0.6); set(A.caveG.gain, key1(BEDK.cave, T) * 0.35, 0.6); set(A.nightG.gain, key1(BEDK.night, T) * 0.25, 0.6);
  // the swell rises and falls with the waves' rocking
  const s = key1(BEDK.sea, T) * (0.5 + 0.5 * Math.sin(T * 1.25 - 1.2));
  set(A.swell.g.gain, s * 0.6, 0.2); set(A.swell.bq.frequency, 260 + 500 * s, 0.2);
  // (shut in the book at the end, everything muffled for a moment)
  set(A.world.frequency, T > T_CLOSE + 4 && T < T_CLOSE + D_CLOSE + 0.2 ? 1800 : 9000, 0.3);
}
// sounds that come now and then: the watch's ticks (on the beat of the film), birds, rain drops, crickets
function liveSounds(T, at, now) {
  const A = AUD, r = A.rng, N = A.next;
  if (key1(BEDK.breeze, T) > 0.2 && now > N.bird) { const f = 3200 + r() * 2500, c = A.ctx, o = c.createOscillator(); o.frequency.setValueAtTime(f, at); o.frequency.exponentialRampToValueAtTime(f * (0.7 + r() * 0.6), at + 0.08); o.connect(env(at, 0.012 + 0.01 * r(), 0.005, 0.03, A.world, (r() - 0.5) * 1.4)); o.start(at); o.stop(at + 0.3); N.bird = now + (r() < 0.6 ? 0.1 + r() * 0.12 : 0.8 + r() * 2.2); }
  const w = key1(BEDK.wind, T); if (w > 0.1 && now > N.drop) { burst(at, 3000 + r() * 4000, 2, 0.02 * w, 0.004 + r() * 0.004, (r() - 0.5) * 1.6, A.world); N.drop = now + 0.01 + r() * 0.05 / w; }
  const n = key1(BEDK.night, T); if (n > 0.1 && now > N.crick) { const f = 4300 + r() * 600, k = 3 + Math.floor(r() * 3), p = (r() - 0.5) * 1.4; for (let j = 0; j < k; j++) tone(at + j * 0.045, f, 0.007 * n, 0.012, p, A.world, 0.002); N.crick = now + 0.4 + r() * 1.4; }
}
// the watch: two ticks a second, the film's own clock (so the loop keeps its time)
const atT = (t) => AUD.clock() + (t - MAIN.time) + 0.04;
const LOOK_AHEAD = 0.2;
function audioFrame() {
  const A = AUD, c = A.ctx;
  if (!c || !A.want || c.state !== 'running' || A.off) return;
  bedsAt(STORY.T, A.clock(), false);
  let h0 = Math.max(A.h, MAIN.time); const h1 = MAIN.time + LOOK_AHEAD;
  if (h0 >= h1) return;
  if (h1 - h0 > 0.5) h0 = h1 - 0.5;
  const s0 = storyTime(h0), s1 = s0 + (h1 - h0);
  for (const e of EV) for (const off of [0]) { const te = e.t + off; if (te >= s0 && te < s1) e.fn(atT(h0 + te - s0)); }
  for (let k = Math.ceil(s0 * 2); k / 2 < s1; k++) { const te = k / 2, g = key1(BEDK.tick, ((te % LEN) + LEN) % LEN); tick(atT(h0 + te - s0), g, k % 2); }
  liveSounds(s0, atT(MAIN.time + 0.05), MAIN.time);
  A.h = h1;
}
function tick(t, g, odd) { burst(t, odd ? 4200 : 3300, 3, 0.05 * g, 0.006, -0.5, AUD.amb); tone(t, odd ? 2900 : 2500, 0.012 * g, 0.012, -0.5, AUD.amb, 0.0005); }
function audioHook() {
  const S_ = window.__penAudio;
  if (!S_) return;
  S_.on.push((c) => { attachAudio(c); audioOn(S_.want); });
  S_.set = (on) => audioOn(on);
  if (S_.ctx) { attachAudio(S_.ctx); audioOn(S_.want); }
  document.addEventListener('visibilitychange', () => {
    const c = AUD.ctx; if (!c || !AUD.want) return;
    try { if (document.hidden) { const q = c.suspend(); if (q && q.catch) q.catch(() => { }); } else { AUD.h = MAIN.time; const q = c.resume(); if (q && q.catch) q.catch(() => { }); } } catch (e) { }
  });
}

// =====================================================================
// Putting it together: the shot of the moment, what moves (the pages,
// the folds, the lamp), the lens.
// =====================================================================
const STORY = { T: 0, len: LEN };
const MAIN = { time: 0, offset: 0, last: performance.now(), frames: 0, still: TEST && PARAMS.has('sheet') };
function resize() {
  VW = Math.max(1, innerWidth); VH = Math.max(1, innerHeight);
  PR = Math.max(0.4, Math.min(Q.dpr, devicePixelRatio || 1, Math.sqrt(Q.budget / (VW * VH))) * PERF.scale);
  renderer.setPixelRatio(PR); renderer.setSize(VW, VH, true);
  makeTargets();
}
function storyTime(t) { return Math.min(STORY.len, Math.max(0, t + MAIN.offset)); }
const _up = V3(0, 1, 0);
// the shot of this moment (in a test, perhaps a camera set by hand)
function frameShot(T) {
  const C = shotAt(T);
  return believeCameraOverride ? Object.assign({}, C, believeCameraOverride) : C;
}
function draw() {
  const T = STORY.T;
  WORLDU.uTime.value = T; WORLDU.uT.value = T;
  let C = frameShot(T);
  LV.a = C.lv; LV.b = C.b ? C.b.lv : null; LV.mix = C.b ? C.mix : 0;
  // what moves at the scales we can see; then the cameras (which may follow what has just moved)
  for (const L of [LV.a, LV.b]) if (L) for (const f of L.hooks) f(T);
  C = frameShot(T);
  placeCam(camera, C);
  if (C.b) placeCam(LV.camB, C.b);
  for (const f of FRAME_HOOKS) f(T, C);
  CAM.focus = Math.max(1e-3, C.focus); CAM.ap = C.ap;
  LENS.exposure = ENV.exposure;
  finalPass.material.uniforms.uTime.value = MAIN.time; glassPass.material.uniforms.uTime.value = MAIN.time;
  GLASS.glass = 0; GLASS.wall = 0; GLASS.fade = 1;
  developFrame();
  if (typeof audioFrame === 'function') audioFrame();
}
function adapt(dtRaw) {
  if (MAIN.still) return;
  const P = PERF;
  // (not in the first moments, while shaders are still being made; a single stall, or a hidden tab, is not the picture's cost)
  if (MAIN.frames < 90 || dtRaw > 0.12) return;
  P.win.push(dtRaw);
  if (P.win.length < 45) return;
  const w = P.win.sort((a, b) => a - b), med = w[w.length >> 1], low = w[Math.floor(w.length * 0.1)];
  P.win = []; P.k++;
  // the screen's own beat: the fastest frames ever seen (60 a second, 120...)
  P.vs = P.vs ? Math.min(P.vs, low) : low;
  if (P.k % 10 === 0) P.ceil = Math.min(1, P.ceil * 1.03);
  if (P.cool > 0) { P.cool--; return; }
  let s = P.scale;
  if (med > 0.021) { P.ceil = Math.min(P.ceil, s * 0.98); s = Math.max(0.45, s * 0.88); P.hold = 4; }
  else if (med < Math.min(0.0185, Math.max(P.vs, 0.006) * 1.15) && s < P.ceil) { if (P.hold > 0) P.hold--; else s = Math.min(P.ceil, s * 1.06); }
  if (Math.abs(s - P.scale) > 0.01) { P.scale = s; P.cool = 1; resize(); }
}
let POSTER = document.getElementById('poster'), unveilAt = 3;
function looksRight() {
  try {
    const c = document.createElement('canvas'); c.width = 16; c.height = 9;
    const x = c.getContext('2d', { willReadFrequently: true }); x.drawImage(renderer.domElement, 0, 0, 16, 9);
    const d = x.getImageData(0, 0, 16, 9).data; let s = 0;
    for (let i = 0; i < d.length; i += 4) s += d[i] + d[i + 1] + d[i + 2];
    return s / (d.length / 4) / 3 > 1;
  } catch (e) { return true; }
}
function unveil() {
  if (!looksRight()) { unveilAt = MAIN.frames + 60; return; }
  const p = POSTER; POSTER = null;
  p.classList.add('gone'); setTimeout(() => p.remove(), 2000);
}
function frame() {
  const now = performance.now(), dtRaw = (now - MAIN.last) / 1000; MAIN.last = now;
  MAIN.time += Math.min(dtRaw, 0.05);
  STORY.T = storyTime(MAIN.time);
  draw();
  adapt(dtRaw);
  MAIN.frames++;
  if (POSTER && MAIN.frames >= unveilAt && STORY.T > 1.5) unveil();
}

// Page 23 owns the one-shot clock and preloads every original world before Play.
buildPaper(); resize(); addEventListener('resize', resize);
await createBelieveEnvelope({THREE,FullScreenQuad,renderer,worldScene,
  resizeFilm:resize, adaptFilm:adapt,
  async warm(report){for(let i=0;i<WARM.length;i++){STORY.T=WARM[i];MAIN.time=WARM[i];draw();report((i+1)/WARM.length);await new Promise(r=>setTimeout(r,0));}MAIN.time=STORY.T=0;audioHook();},
  drawFilm(t,target,override){believeFilmTarget=target;believeCameraOverride=override;STORY.T=MAIN.time=t;MAIN.frames++;draw();},
  filmCamera(){const C=shotAt(120);return {...C,pos:C.pos.clone(),tgt:C.tgt.clone()};},
  seekAudio(t){AUD.h=MAIN.time=STORY.T=t;if(AUD.ctx)bedsAt(t,AUD.clock(),false);}, setSound(on){audioOn(on);}
});
