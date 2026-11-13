import * as THREE from 'three';
import {seeded} from './castlePaint';

/** Page 117's watercolor treatment. Following art.md, the look comes from
 * painted surfaces rather than a filter over the frame:
 *  1. each surface has a watercolor repaint (soft washes, pigment pooled at
 *     wash edges, lost-and-found outlines, blooms, granulation), baked once;
 *  2. one shared material chunk lays paper grain and pigment density over the
 *     world, and turns light into a few soft, wobbling wash levels with a cool
 *     shadow glaze and a darker pooled rim where washes meet.
 * Painted standees (Hero) are untouched. Toggling swaps textures and a uniform,
 * so it is live and needs no shader rebuild. */

// ---------------------------------------------------------------------------
// shared material chunk

export const WATERCOLOR_UNIFORMS = {uWc: {value: 1}, uWcDirectMax: {value: 1.0}};

export const WATERCOLOR_NOISE = /* glsl */`
float wcHash(vec3 p){p=fract(p*.3183099+.1);p*=17.;return fract(p.x*p.y*p.z*(p.x+p.y+p.z));}
float wcNoise(vec3 x){vec3 i=floor(x),f=fract(x);f=f*f*(3.-2.*f);
 return mix(mix(mix(wcHash(i),wcHash(i+vec3(1,0,0)),f.x),mix(wcHash(i+vec3(0,1,0)),wcHash(i+vec3(1,1,0)),f.x),f.y),
            mix(mix(wcHash(i+vec3(0,0,1)),wcHash(i+vec3(1,0,1)),f.x),mix(wcHash(i+vec3(0,1,1)),wcHash(i+vec3(1,1,1)),f.x),f.y),f.z);}
float wcFbm(vec3 p){return .55*wcNoise(p)+.3*wcNoise(p*2.03+3.1)+.15*wcNoise(p*4.01+7.7);}
`;
const NOISE = `uniform float uWc, uWcDirectMax;varying vec3 vWcPos;${WATERCOLOR_NOISE}`;

const SHADE = /* glsl */`
if (uWc > .5) {
  // How much lamp reaches this point (0..1), from the key light's own N·L and its shadow,
  // so the banding keeps the plain shading's brightness scale.
  float wcD = 0.;
  vec3 wcFull = vec3(0.);
  #if NUM_DIR_LIGHTS > 0
    wcFull = directionalLights[0].color * BRDF_Lambert(diffuseColor.rgb);
    float wcNdl = max(dot(normal, directionalLights[0].direction), 0.);
    float wcExpect = dot(wcFull, vec3(.299, .587, .114)) * wcNdl;
    float wcShadow = clamp(dot(reflectedLight.directDiffuse, vec3(.299, .587, .114)) / max(wcExpect, 1e-5), 0., 1.);
    wcD = wcNdl * wcShadow;
  #endif
  vec3 wcP = vWcPos;
  float wcWash = wcFbm(wcP * .065);                 // broad pigment density, ~15 m blotches
  float wcEdge = wcFbm(wcP * .42 + 11.3) - .5;      // wobble for wash boundaries
  float wcT1 = .1 + wcEdge * .12, wcT2 = .48 + wcEdge * .2;
  float wcB1 = smoothstep(wcT1 - .04, wcT1 + .04, wcD), wcB2 = smoothstep(wcT2 - .06, wcT2 + .06, wcD);
  float wcLevel = .55 * wcB1 + .4 * wcB2;           // three wash levels (shadow, half, full) instead of a smooth ramp
  vec3 wcGlaze = mix(vec3(.88, .9, 1.02), vec3(1.), wcB1);          // cool ultramarine shadow glaze
  vec3 wcWarm = mix(vec3(1.), vec3(1.04, .98, .9), wcB2);           // warm lamp-lit wash
  vec3 wcCol = reflectedLight.indirectDiffuse * 1.12 * wcGlaze + wcFull * wcLevel * wcWarm;
  float wcPool = wcB1 * (1. - wcB1) * 4. * .14 + wcB2 * (1. - wcB2) * 4. * .09;   // pigment collects where washes meet
  wcCol *= 1. - wcPool;
  wcCol *= .93 + .14 * wcWash;
  float wcGrain = wcNoise(wcP * 5.5) * .6 + wcNoise(wcP * 17.) * .4;           // paper tooth
  wcCol *= .96 + .07 * wcGrain;
  wcCol *= 1. - .06 * smoothstep(.72, .96, wcNoise(wcP * 23. + 5.));           // granulation in the pits
  outgoingLight = wcCol + totalEmissiveRadiance;
}
`;

/** Adds the watercolor chunk to a Lambert material (shared program per variant). */
export function applyWatercolor(material: THREE.MeshLambertMaterial) {
  material.onBeforeCompile = shader => {
    Object.assign(shader.uniforms, WATERCOLOR_UNIFORMS);
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vWcPos;')
      .replace('#include <fog_vertex>', `#include <fog_vertex>
  vec4 wcWorld = vec4(transformed, 1.);
  #ifdef USE_INSTANCING
  wcWorld = instanceMatrix * wcWorld;
  #endif
  vWcPos = (modelMatrix * wcWorld).xyz;`);
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\n' + NOISE)
      .replace('#include <opaque_fragment>', SHADE + '\n#include <opaque_fragment>');
  };
  material.customProgramCacheKey = () => 'castle-watercolor-v1';
  return material;
}

// ---------------------------------------------------------------------------
// watercolor repaints, baked once at load

function canvas(w: number, h: number) { const c = document.createElement('canvas'); c.width = w; c.height = h; return {c, g: c.getContext('2d')!}; }
function texture(c: HTMLCanvasElement, repeat = true) {
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping; return t;
}
type Rgb = [number, number, number];
const rgba = ([r, g, b]: Rgb, a: number) => `rgba(${r | 0},${g | 0},${b | 0},${a})`;
const darker = ([r, g, b]: Rgb, k: number): Rgb => [r * k, g * k, b * k];

/** An organic closed outline: an ellipse whose radius wanders with a few
 * low harmonics, never a clean geometric shape. */
function blob(r: () => number, cx: number, cy: number, rx: number, ry: number, rough = .16, rot = 0) {
  const p = new Path2D(), ph = [r() * 6, r() * 6, r() * 6], n = 36, cr = Math.cos(rot), sr = Math.sin(rot);
  for (let i = 0; i <= n; i++) {
    const t = i / n * Math.PI * 2, k = 1 + rough * (.5 * Math.sin(2 * t + ph[0]) + .3 * Math.sin(3 * t + ph[1]) + .2 * Math.sin(5 * t + ph[2]));
    const x = Math.cos(t) * rx * k, y = Math.sin(t) * ry * k, px = cx + x * cr - y * sr, py = cy + x * sr + y * cr;
    if (i === 0) p.moveTo(px, py); else p.lineTo(px, py);
  }
  p.closePath(); return p;
}
/** One transparent wash: a thin body, a darker rim where the pigment dried. */
function wash(g: CanvasRenderingContext2D, path: Path2D, color: Rgb, alpha: number, rim = 1.6, width = 2.5, soft = 0) {
  g.globalCompositeOperation = 'multiply';
  if (soft) g.filter = `blur(${soft}px)`;
  g.fillStyle = rgba(color, alpha); g.fill(path);
  g.strokeStyle = rgba(darker(color, .86), Math.min(1, alpha * rim)); g.lineWidth = width; g.stroke(path);
  g.filter = 'none'; g.globalCompositeOperation = 'source-over';
}
/** A cauliflower bloom: water pushed back into a drying wash leaves a pale centre and a dark frill. */
function bloom(g: CanvasRenderingContext2D, r: () => number, x: number, y: number, rad: number, color: Rgb) {
  const path = blob(r, x, y, rad, rad * (.7 + r() * .4), .28);
  g.save(); g.clip(path); const gr = g.createRadialGradient(x, y, 0, x, y, rad * 1.1);
  gr.addColorStop(0, 'rgba(255,253,246,.32)'); gr.addColorStop(.75, 'rgba(255,253,246,.1)'); gr.addColorStop(1, 'rgba(255,253,246,0)');
  g.fillStyle = gr; g.fillRect(x - rad * 1.2, y - rad * 1.2, rad * 2.4, rad * 2.4); g.restore();
  g.strokeStyle = rgba(darker(color, .78), .28); g.lineWidth = 1.6; g.stroke(path);
}
/** Draw at every wrapped offset so the tile repeats without seams. */
function wrapped(W: number, H: number, fn: (dx: number, dy: number) => void) { for (const dx of [-W, 0, W]) for (const dy of [-H, 0, H]) fn(dx, dy); }
function paper(g: CanvasRenderingContext2D, W: number, H: number, r: () => number, tint = '#f7f1e3') {
  g.fillStyle = tint; g.fillRect(0, 0, W, H);
  for (let i = 0; i < W * H / 90; i++) { g.fillStyle = r() < .5 ? `rgba(120,100,70,${r() * .06})` : `rgba(255,255,250,${r() * .1})`; g.fillRect(r() * W, r() * H, 1 + r() * 2, 1 + r() * 2); }
}
function granulate(g: CanvasRenderingContext2D, W: number, H: number, r: () => number, color: Rgb, n: number) {
  for (let i = 0; i < n; i++) { g.fillStyle = rgba(darker(color, .6), .05 + r() * .12); g.beginPath(); g.arc(r() * W, r() * H, .5 + r() * 1.3, 0, Math.PI * 2); g.fill(); }
}

/** Loose watercolor masonry: broad washes, only some bricks picked out, mortar
 * lines that come and go. Tile = 4 m, matching the flat stone. */
function paintWcMasonry(seed: number, base: Rgb, rows: number, perRow: number, W = 512, H = 512, blooms = 5) {
  const {c, g} = canvas(W, H), r = seeded(seed);
  paper(g, W, H, r);
  g.globalCompositeOperation = 'multiply'; g.fillStyle = rgba(base, .38); g.fillRect(0, 0, W, H); g.globalCompositeOperation = 'source-over';
  for (let i = 0; i < 7; i++) { const x = r() * W, y = r() * H, rad = 90 + r() * 150, col: Rgb = [base[0] + (r() - .5) * 30, base[1] + (r() - .5) * 24, base[2] + (r() - .5) * 30]; wrapped(W, H, (dx, dy) => wash(g, blob(r, x + dx, y + dy, rad, rad * (.6 + r() * .5), .25, r() * 3), col, .09 + r() * .08, 1.15, 5, 6)); }
  const bh = H / rows, bw = W / perRow;
  for (let row = 0; row < rows; row++) for (let k = -1; k <= perRow; k++) {
    const x = k * bw + (row % 2 ? bw / 2 : 0), y = row * bh;
    if (r() < .14) { // an occasional picked-out brick: its own little wash, edges pooled
      const col = darker(base, .86 + r() * .1);
      wrapped(W, H, (dx, dy) => wash(g, blob(r, x + bw / 2 + dx, y + bh / 2 + dy, bw * .44, bh * .38, .08), col, .1 + r() * .1, 2, 1.4, .6));
    }
    // mortar: broken, wavering ink-wash strokes; some edges lost
    g.strokeStyle = rgba(darker(base, .55), .22 + r() * .25); g.lineWidth = 1.2 + r() * 1.4;
    if (r() < .7) { g.beginPath(); const x0 = x + r() * bw * .2, x1 = x + bw * (.6 + r() * .4); g.moveTo(x0, y + bh); g.quadraticCurveTo((x0 + x1) / 2, y + bh + (r() - .5) * 3, x1, y + bh + (r() - .5) * 2); g.stroke(); }
    if (r() < .55) { g.beginPath(); g.moveTo(x, y + bh * .1); g.lineTo(x + (r() - .5) * 2, y + bh * (.6 + r() * .4)); g.stroke(); }
  }
  for (let i = 0; i < blooms; i++) { const x = r() * W, y = r() * H; wrapped(W, H, (dx, dy) => bloom(g, r, x + dx, y + dy, 18 + r() * 30, base)); }
  granulate(g, W, H, r, base, 1600);
  return texture(c);
}
export const paintWcStone = () => paintWcMasonry(41, [206, 202, 192], 8, 4);
export const paintWcGroundsStone = () => paintWcMasonry(121, [181, 186, 190], 24, 16, 512, 512, 0);
export const paintWcPaving = () => paintWcMasonry(43, [222, 204, 168], 6, 3);

/** The keep's face, as a watercolor elevation: washes, loose coursing, washed windows. */
export function paintWcKeep(seed = 47, showWindows = true) {
  const W = 512, H = 1116, m = W / 22, {c, g} = canvas(W, H), r = seeded(seed), base: Rgb = [206, 202, 192];
  paper(g, W, H, r);
  g.globalCompositeOperation = 'multiply'; g.fillStyle = rgba(base, .38); g.fillRect(0, 0, W, H); g.globalCompositeOperation = 'source-over';
  for (let i = 0; i < 12; i++) wash(g, blob(r, r() * W, r() * H, 90 + r() * 160, 120 + r() * 200, .25), [base[0] + (r() - .5) * 28, base[1] + (r() - .5) * 22, base[2] + (r() - .5) * 28], .09 + r() * .08, 1.15, 5, 7);
  const top = g.createLinearGradient(0, 0, 0, H); top.addColorStop(0, 'rgba(120,108,130,.22)'); top.addColorStop(.35, 'rgba(120,108,130,0)'); top.addColorStop(.9, 'rgba(110,120,80,0)'); top.addColorStop(1, 'rgba(110,120,80,.25)');
  g.globalCompositeOperation = 'multiply'; g.fillStyle = top; g.fillRect(0, 0, W, H); g.globalCompositeOperation = 'source-over';
  const rows = 96, bh = H / rows, bw = W / 11;
  for (let row = 0; row < rows; row++) for (let k = -1; k <= 11; k++) {
    const x = k * bw + (row % 2 ? bw / 2 : 0), y = row * bh;
    if (r() < .1) wash(g, blob(r, x + bw / 2, y + bh / 2, bw * .44, bh * .38, .08), darker(base, .86 + r() * .1), .1 + r() * .1, 2, 1.2, .6);
    if (r() < .45) { g.strokeStyle = rgba(darker(base, .55), .18 + r() * .22); g.lineWidth = 1 + r(); g.beginPath(); g.moveTo(x + r() * 6, y + bh); g.lineTo(x + bw * (.5 + r() * .5), y + bh + (r() - .5) * 2); g.stroke(); }
  }
  const arch = (cx: number, base0: number, w: number, h: number) => {
    const x = cx * m, y = H - base0 * m, ww = w * m, hh = h * m, p = new Path2D();
    p.moveTo(x - ww / 2, y); p.lineTo(x - ww / 2 + (r() - .5) * 2, y - hh + ww / 2); p.arc(x, y - hh + ww / 2, ww / 2, Math.PI, 0); p.lineTo(x + ww / 2, y); p.closePath(); return p;
  };
  const windows: [number, number, number, number, boolean][] = [];
  if (showWindows) {
    for (const [b0, lit] of [[13, [1, 0]], [24, [0, 1]], [35, [1, 1]]] as const) for (const [i, cx] of [6.5, 15.5].entries()) windows.push([cx, b0, 2.2, 4.4, !!lit[i]]);
  }
  windows.push([11, 0, 4.4, 7, false]);
  for (const [cx, b0, w, h, lit] of windows) {
    wash(g, arch(cx, b0 - .25, w + .8, h + .6), [176, 166, 148], .35, 1.8, 3);
    const inner = arch(cx, b0, w, h);
    if (lit) { wash(g, inner, [236, 176, 96], .85, 1.3, 3); bloom(g, r, cx * m, H - (b0 + h * .45) * m, w * m * .35, [236, 176, 96]); }
    else { wash(g, inner, b0 === 0 ? [110, 78, 52] : [58, 56, 74], .82, 1.25, 3); wash(g, inner, [40, 38, 54], .3, 1.2, 2); }
  }
  granulate(g, W, H, r, base, 3000);
  return texture(c, false);
}

/** Roof scallops as overlapping soft dabs, pale so the material tints them. */
export function paintWcScales(seed = 53) {
  const W = 256, {c, g} = canvas(W, W), r = seeded(seed), s = 32, tone: Rgb = [214, 212, 208];
  paper(g, W, W, r, '#fbf9f4');
  for (let i = 0; i < 6; i++) { const x = r() * W, y = r() * W, rad = 50 + r() * 70; wrapped(W, W, (dx, dy) => wash(g, blob(r, x + dx, y + dy, rad, rad * .7, .3), tone, .25, 1.3, 3)); }
  for (let row = 0; row < W / s * 2 + 1; row++) for (let k = -1; k <= W / s; k++) {
    const x = k * s + (row % 2 ? s / 2 : 0) + s / 2, y = row * s / 2;
    const p = new Path2D(); p.moveTo(x - s / 2, y); p.bezierCurveTo(x - s / 2, y + s * .62, x + s / 2, y + s * .62, x + s / 2, y + (r() - .5) * 2);
    g.strokeStyle = rgba(darker(tone, .55), .25 + r() * .3); g.lineWidth = 1.4 + r(); if (r() < .8) g.stroke(p);
    if (r() < .35) { const d = new Path2D(p); d.closePath(); wash(g, d, darker(tone, .85), .2, 1.4, 1); }
  }
  granulate(g, W, W, r, tone, 900);
  return texture(c);
}

/** Water: horizontal washes laid wet, darker pooled ripples, white paper left for glints. */
export function paintWcWater(seed = 59) {
  const W = 256, {c, g} = canvas(W, W), r = seeded(seed), blue: Rgb = [92, 140, 186];
  paper(g, W, W, r);
  g.globalCompositeOperation = 'multiply'; g.fillStyle = rgba(blue, .62); g.fillRect(0, 0, W, W); g.globalCompositeOperation = 'source-over';
  for (let i = 0; i < 9; i++) { const x = r() * W, y = r() * W, rad = 30 + r() * 60; wrapped(W, W, (dx, dy) => wash(g, blob(r, x + dx, y + dy, rad, rad * (.5 + r() * .4), .3, r() * 3), [blue[0] + (r() - .5) * 30, blue[1] + (r() - .5) * 20, blue[2]], .12 + r() * .1, 1.1, 4, 5)); }
  for (let i = 0; i < 40; i++) {
    const x = r() * W, y = r() * W, l = 18 + r() * 36;
    wrapped(W, W, (dx, dy) => { g.strokeStyle = rgba(darker(blue, .7), .12 + r() * .16); g.lineWidth = 1.5 + r() * 1.5; g.beginPath(); g.moveTo(x + dx, y + dy); g.quadraticCurveTo(x + dx + l / 2, y + dy - 3, x + dx + l, y + dy); g.stroke(); });
  }
  for (let i = 0; i < 18; i++) { const x = r() * W, y = r() * W; g.strokeStyle = 'rgba(255,255,252,.35)'; g.lineWidth = 2; g.beginPath(); g.moveTo(x, y); g.lineTo(x + 8 + r() * 14, y + (r() - .5) * 2); g.stroke(); }
  granulate(g, W, W, r, blue, 700);
  return texture(c);
}

/** Wood: dry-brush streaks along the grain over a pale wash. */
export function paintWcWood(seed = 61) {
  const W = 512, {c, g} = canvas(W, W), r = seeded(seed), tone: Rgb = [214, 200, 178];
  paper(g, W, W, r);
  for (let k = 0; k < 6; k++) wrapped(W, W, (dx, dy) => wash(g, blob(r, W / 2 + dx, k * W / 6 + W / 12 + dy, W * .7, W / 14, .1), [tone[0] + (r() - .5) * 20, tone[1] + (r() - .5) * 16, tone[2]], .35, 1.5, 2));
  for (let i = 0; i < 160; i++) { const y = r() * W, x = r() * W, l = 40 + r() * 160; g.strokeStyle = rgba(darker(tone, .55), .08 + r() * .2); g.lineWidth = .8 + r() * 1.6; g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x + l / 2, y + (r() - .5) * 4, x + l, y + (r() - .5) * 2); g.stroke(); }
  return texture(c);
}

/** The page meadow repainted wet: pale green washes, shrubs as pooled-edge
 * blobs with blooms, cottages and flowers as loose dabs. */
export function paintWcField(radius: number, seed = 67) {
  const S = 2048, {c, g} = canvas(S, S), r = seeded(seed), m = S / (radius * 2), px = (v: number) => S / 2 + v * m;
  paper(g, S, S, r, '#f6f2e2');
  g.globalCompositeOperation = 'multiply'; g.fillStyle = 'rgba(196,214,150,.85)'; g.fillRect(0, 0, S, S); g.globalCompositeOperation = 'source-over';
  for (let i = 0; i < 40; i++) wash(g, blob(r, r() * S, r() * S, 160 + r() * 360, 120 + r() * 300, .3, r() * 3), [176 + (r() - .5) * 36, 200 + (r() - .5) * 26, 132 + (r() - .5) * 40], .16 + r() * .12, 1.12, 6, 10);
  for (let i = 0; i < 14; i++) bloom(g, r, r() * S, r() * S, 40 + r() * 90, [150, 186, 110]);
  const clear = (wx: number, wz: number) => Math.hypot(wx, wz) < 78 || (wz > 0 && Math.abs(wx) < 14);
  for (let i = 0; i < 150; i++) {
    const a = r() * Math.PI * 2, d = 80 + Math.sqrt(r()) * (radius - 90), wx = Math.cos(a) * d, wz = Math.sin(a) * d;
    if (clear(wx, wz)) continue;
    const n = 2 + Math.floor(r() * 4), green: Rgb = [96 + r() * 30, 146 + r() * 24, 76 + r() * 20];
    for (let k = 0; k < n; k++) wash(g, blob(r, px(wx + (r() - .5) * 9), px(wz + (r() - .5) * 5), (2.4 + r() * 3.6) * m, (1.2 + r() * 1.6) * m, .22, (r() - .5) * .5), green, .38 + r() * .2, 1.35, 2.2, 1.2);
  }
  for (let i = 0; i < 16; i++) {
    const a = r() * Math.PI * 2, d = 110 + r() * (radius - 140), wx = Math.cos(a) * d, wz = Math.sin(a) * d;
    if (clear(wx, wz)) continue;
    const x = px(wx), y = px(wz), w = 7 * m, h = 3.4 * m, body = new Path2D(), roof = new Path2D();
    body.rect(x - w / 2, y - h / 2, w, h); roof.moveTo(x - w / 2 - 4, y - h / 2); roof.lineTo(x + w * .15, y - h * 1.5); roof.lineTo(x + w / 2 + 4, y - h / 2); roof.closePath();
    wash(g, body, [214, 206, 190], .45, 1.8, 2); wash(g, roof, [196, 84, 66], .75, 1.5, 2.5);
  }
  for (let i = 0; i < 2200; i++) { const col: Rgb = [[226, 150, 170], [236, 228, 214], [208, 104, 100], [232, 200, 112]][Math.floor(r() * 4)] as Rgb; g.fillStyle = rgba(col, .35 + r() * .4); g.beginPath(); g.ellipse(r() * S, r() * S, 1.6 + r() * 2.4, 1.2 + r() * 1.8, r() * 3, 0, Math.PI * 2); g.fill(); }
  granulate(g, S, S, r, [150, 170, 110], 26000);
  return texture(c, false);
}

/** Tree flats repainted: layered green washes on the same organic canopies, pooled rims, blooms, a washed trunk. */
export function paintWcTrees(seed = 17) {
  const W = 1024, H = 1024, {c, g} = canvas(W, H), r = seeded(seed);
  const variant = (ox: number, tall: boolean) => {
    const cx = ox + 256, base = H - 20, trunkTop = tall ? 760 : 700, lean = (r() - .5) * 26;
    const trunk = new Path2D(); trunk.moveTo(cx - 26, base); trunk.quadraticCurveTo(cx - 18 + lean * .3, (base + trunkTop) / 2, cx - 10 + lean, trunkTop - 60);
    trunk.lineTo(cx + 12 + lean, trunkTop - 60); trunk.quadraticCurveTo(cx + 22 + lean * .3, (base + trunkTop) / 2, cx + 28, base); trunk.closePath();
    g.fillStyle = 'rgba(150,112,80,.95)'; g.fill(trunk); g.strokeStyle = 'rgba(92,62,40,.8)'; g.lineWidth = 3; g.stroke(trunk);
    const ccy = tall ? 400 : 430, rx = tall ? 150 : 205, ry = tall ? 330 : 255, lobes: Path2D[] = [];
    const whole = new Path2D();
    const parts: [number, number, number][] = [[cx + lean, ccy, 1]];
    for (let k = 0; k < 7; k++) { const a = r() * Math.PI * 2, d = .45 + r() * .3; parts.push([cx + lean + Math.cos(a) * rx * d, ccy + Math.sin(a) * ry * d, .45 + r() * .3]); }
    for (const [lx, ly, s] of parts) { const p = blob(r, lx, ly, rx * .62 * s, ry * .62 * s, .14); lobes.push(p); whole.addPath(p); }
    // an opaque light-green underpaint so the flat reads solid against the dark, then glazes
    g.fillStyle = '#b4c98a'; g.fill(whole, 'nonzero');
    g.save(); g.clip(whole, 'nonzero');
    for (const p of lobes) wash(g, p, [132 + r() * 30, 170 + r() * 20, 96 + r() * 20], .42, 1.05, 3, 2.5);
    for (let k = 0; k < 6; k++) wash(g, blob(r, cx + lean - rx * .3 + r() * rx * .2, ccy + r() * ry * .5, rx * (.25 + r() * .3), ry * (.2 + r() * .2), .3), [92, 132, 74], .22, 1.3, 3, 4);   // shade side
    for (let k = 0; k < 5; k++) bloom(g, r, cx + lean + (r() - .2) * rx * .7, ccy - r() * ry * .5, 26 + r() * 40, [110, 150, 80]);
    granulate(g, W, H, r, [90, 120, 60], 1200);
    g.restore();
    g.strokeStyle = 'rgba(52,84,44,.55)'; g.lineWidth = 3; g.stroke(whole);
  };
  variant(0, false); variant(512, true);
  const t = texture(c, false); t.generateMipmaps = true; return t;
}

/** Paper grain for the low "felt" bank ring under the watercolor look. */
export function paintWcBank(seed = 71) {
  const W = 256, {c, g} = canvas(W, W), r = seeded(seed);
  paper(g, W, W, r, '#f1ecdc');
  for (let i = 0; i < 8; i++) { const x = r() * W, y = r() * W; wrapped(W, W, (dx, dy) => wash(g, blob(r, x + dx, y + dy, 50 + r() * 60, 30 + r() * 40, .3), [196, 188, 160], .25, 1.5, 2)); }
  return texture(c);
}

/** A page-wide brush map shared across the separate dry terraces. The 3D
 * shoreline clips the print, so paths and washes can never cover the water. */
export function paintWcGrounds(paths: readonly (readonly (readonly [number, number])[])[], extent: number,joinPaths=false) {
  const S = 1536, {c,g} = canvas(S,S), r = seeded(118), px = (v: number) => (v/extent+1)*S/2;
  paper(g,S,S,r,'#d9dfab');
  for (let i = 0; i < 80; i++) {
    const green: Rgb = [128+r()*50,157+r()*38,82+r()*47];
    wash(g,blob(r,r()*S,r()*S,40+r()*145,30+r()*115,.27,r()*6),green,.11+r()*.24,1.2,4,5);
  }
  for (let i = 0; i < 42; i++) bloom(g,r,r()*S,r()*S,12+r()*42,[129,158,91]);
  for (let i = 0; i < 700; i++) {
    const x = r()*S, y = r()*S;
    wash(g,blob(r,x,y,2+r()*8,2+r()*5,.3,r()*3),r()>.7?[228,203,117]:[90,128,75],.18+r()*.23,1.1,1);
  }
  g.lineCap = g.lineJoin = 'round';
  const strokes=paths.map((route,index) => {
    const p = new Path2D();
    p.moveTo(px(route[0][0]),px(route[0][1]));
    for (let i = 1; i < route.length-1; i++) {
      const [x,z] = route[i], [nx,nz] = route[i+1];
      p.quadraticCurveTo(px(x),px(z),px((x+nx)/2),px((z+nz)/2));
    }
    const [x,z] = route[route.length-1]; p.lineTo(px(x),px(z));
    const width = S/(extent*2)*(index===0?11:index===3?5:8);
    return {p,width};
  });
  const layers=[['#a18c59',1.16,3],['#dbbf80',1.03,2],['#f2dca3',.84,1]] as const;
  const stroke=({p,width}:typeof strokes[number],[color,weight,soft]:typeof layers[number])=>{
    g.filter=`blur(${soft}px)`;g.strokeStyle=color;g.lineWidth=width*weight;g.stroke(p);
  };
  // All road margins precede all inner washes, so a branch can never stamp its
  // dark end cap across a road already painted underneath. Baked once only.
  if(joinPaths)for(const layer of layers)for(const path of strokes)stroke(path,layer);
  else for(const path of strokes)for(const layer of layers)stroke(path,layer);
  g.filter='none';
  granulate(g,S,S,r,[142,150,96],14000);
  return texture(c,false);
}

/** Chalk and slate washes follow the cut rather than printing a stone wall. */
export function paintWcCliff() {
  const W = 512, {c,g} = canvas(W,W), r = seeded(119);
  paper(g,W,W,r,'#ddd8ca');
  for (let i = 0; i < 28; i++) {
    const x = r()*W, y = r()*W, tone: Rgb = [138+r()*48,145+r()*38,146+r()*29];
    wrapped(W,W,(dx,dy) => wash(g,blob(r,x+dx,y+dy,22+r()*65,70+r()*85,.26,-.25),tone,.13+r()*.22,1.3,2,3));
  }
  for (let i = 0; i < 16; i++) {
    const x = r()*W, y = r()*W;
    g.strokeStyle = 'rgba(101,104,109,.14)'; g.lineWidth = 1+r()*2;
    g.beginPath(); g.moveTo(x,y); g.quadraticCurveTo(x-11,y+24,x-19,y+55+r()*64); g.stroke();
  }
  granulate(g,W,W,r,[134,133,128],3200);
  return texture(c);
}

/** Wet blue ribbons and broken dry-brush gouache highlights on the cascade. */
export function paintWcFalls() {
  const W = 256, {c,g} = canvas(W,W), r = seeded(120);
  paper(g,W,W,r,'#a4c9d1');
  for (let i = 0; i < 22; i++) {
    const x = r()*W, y = r()*W;
    wrapped(W,W,(dx,dy) => wash(g,blob(r,x+dx,y+dy,8+r()*22,60+r()*110,.22,-.08),[68+r()*39,132+r()*36,169+r()*40],.2+r()*.2,1.2,2,2));
  }
  for (let i = 0; i < 100; i++) {
    const x = r()*W, y = r()*W;
    g.strokeStyle = `rgba(250,252,237,${.18+r()*.5})`; g.lineWidth = .7+r()*3;
    g.beginPath(); g.moveTo(x,y); g.quadraticCurveTo(x+3,y+10,x+2,y+18+r()*48); g.stroke();
  }
  return texture(c);
}
