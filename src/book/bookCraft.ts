import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';

/** The book as a made object: oxblood leather boards tooled in gold, a page
 * block whose edges show every leaf, and pop-up pieces that are card (a pale
 * core at their cut edges, a plain back, fibres, lamp light through them). */

const LEATHER = '#5a2418', LEATHER_DARK = '#3b150e', CARD_CORE = '#e6dac2', CARD_BACK = '#efe4cc';

function rng(seed: number) { return () => { seed |= 0; seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
function canvas(w: number, h: number) { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }
function texture(c: HTMLCanvasElement, srgb = true) { const t = new THREE.CanvasTexture(c); if (srgb) t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t; }

/** Hide: mottled dye, fine creases, rubbed paler towards the edges. */
function paintLeather(ctx: CanvasRenderingContext2D, w: number, h: number, seed: number, rub = .35) {
  const r = rng(seed);
  ctx.fillStyle = LEATHER; ctx.fillRect(0, 0, w, h);
  for (let k = 0; k < w * h / 900; k++) {
    const x = r() * w, y = r() * h, rad = 6 + r() * 40, g = ctx.createRadialGradient(x, y, 0, x, y, rad);
    const c = r() < .5 ? '40,10,5' : '125,55,35';
    g.addColorStop(0, `rgba(${c},${.05 + r() * .08})`); g.addColorStop(1, `rgba(${c},0)`);
    ctx.fillStyle = g; ctx.fillRect(x - rad, y - rad, rad * 2, rad * 2);
  }
  ctx.lineWidth = 1;
  for (let k = 0; k < w * h / 60; k++) {
    const x = r() * w, y = r() * h, a = r() * Math.PI * 2, l = 2 + r() * 7;
    ctx.strokeStyle = r() < .7 ? 'rgba(25,8,4,.32)' : 'rgba(150,80,55,.18)';
    ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l); ctx.stroke();
  }
  if (rub > 0) {
    const m = Math.min(w, h) * .09;
    for (const [x0, y0, x1, y1] of [[0, 0, 0, m], [0, h, 0, h - m], [0, 0, m, 0], [w, 0, w - m, 0]]) {
      const g = ctx.createLinearGradient(x0, y0, x1, y1); g.addColorStop(0, `rgba(160,95,70,${rub})`); g.addColorStop(1, 'rgba(160,95,70,0)');
      ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
    }
  }
}

/** Gold laid where `draw` paints the mask: a colour map and a matching
 * roughness/metalness map (G roughness, B metalness, as three reads them). */
function gilded(w: number, h: number, seed: number, draw: (ctx: CanvasRenderingContext2D) => void) {
  const color = canvas(w, h), cc = color.getContext('2d')!; paintLeather(cc, w, h, seed);
  const mask = canvas(w, h), mc = mask.getContext('2d')!; mc.strokeStyle = mc.fillStyle = '#fff'; draw(mc);
  const gold = canvas(w, h), gc = gold.getContext('2d')!, g = gc.createLinearGradient(0, 0, w, h);
  g.addColorStop(0, '#e2bd62'); g.addColorStop(.45, '#c49a45'); g.addColorStop(1, '#a87e34');
  gc.fillStyle = g; gc.fillRect(0, 0, w, h); gc.globalCompositeOperation = 'destination-in'; gc.drawImage(mask, 0, 0);
  // tooling presses the gold into the hide: a dark rim round each line
  cc.save(); cc.globalAlpha = .55; cc.filter = 'blur(1.5px)'; cc.globalCompositeOperation = 'multiply';
  const dark = canvas(w, h), dc = dark.getContext('2d')!; dc.fillStyle = '#2a0c06'; dc.fillRect(0, 0, w, h); dc.globalCompositeOperation = 'destination-in'; dc.drawImage(mask, 0, 0);
  cc.drawImage(dark, 0, 0); cc.restore(); cc.drawImage(gold, 0, 0);
  const orm = canvas(w, h), oc = orm.getContext('2d')!; oc.fillStyle = 'rgb(255,168,0)'; oc.fillRect(0, 0, w, h);
  const metal = canvas(w, h), xc = metal.getContext('2d')!; xc.fillStyle = 'rgb(255,70,255)'; xc.fillRect(0, 0, w, h); xc.globalCompositeOperation = 'destination-in'; xc.drawImage(mask, 0, 0);
  oc.drawImage(metal, 0, 0);
  return { map: texture(color), orm: texture(orm, false) };
}

let envMap: THREE.Texture | null = null;
function goldEnvironment(renderer: THREE.WebGLRenderer) {
  if (!envMap) { const pmrem = new THREE.PMREMGenerator(renderer); envMap = pmrem.fromScene(new RoomEnvironment(), .04).texture; pmrem.dispose(); }
  return envMap;
}

function goldMaterial(renderer: THREE.WebGLRenderer, t: { map: THREE.Texture; orm: THREE.Texture }) {
  return new THREE.MeshStandardMaterial({ map: t.map, roughnessMap: t.orm, metalnessMap: t.orm, roughness: 1, metalness: 1, envMap: goldEnvironment(renderer), envMapIntensity: .55 });
}

export function createBookCraft(renderer: THREE.WebGLRenderer) {
  const hideCanvas = canvas(512, 512); paintLeather(hideCanvas.getContext('2d')!, 512, 512, 31, 0);
  const hide = texture(hideCanvas); hide.wrapS = hide.wrapT = THREE.RepeatWrapping;
  const leather = (repeat = 1, dark = false) => {
    const map = repeat === 1 ? hide : hide.clone(); map.repeat.set(repeat, repeat); map.needsUpdate = true;
    return new THREE.MeshStandardMaterial({ map, color: dark ? '#b9a39e' : '#ffffff', roughness: .62 });
  };

  /** The leaves seen edge-on: one fine line per leaf, faintly uneven. */
  const edges = canvas(1024, 64), ec = edges.getContext('2d')!, er = rng(5);
  ec.fillStyle = '#ece2cb'; ec.fillRect(0, 0, 1024, 64);
  for (let y = .5; y < 64; y += 1.4 + er() * .9) { ec.strokeStyle = `rgba(85,60,30,${.12 + er() * .22})`; ec.lineWidth = .7; ec.beginPath(); ec.moveTo(0, y); ec.lineTo(1024, y + (er() - .5) * 1.2); ec.stroke(); }
  const edgeMap = texture(edges);
  const edgeMat = new THREE.MeshStandardMaterial({ map: edgeMap, roughness: .9 }), topMat = new THREE.MeshStandardMaterial({ color: '#ece2cb', roughness: .95 });
  /** BoxGeometry face order: +x, -x, +y, -y, +z, -z. */
  const pageBlock = (w: number, h: number, d: number) => new THREE.Mesh(new THREE.BoxGeometry(w, h, d), [edgeMat, edgeMat, topMat, topMat, edgeMat, edgeMat]);

  /** Front board: triple gilt fillets, corner flourishes and a medallion. Our
   * own title, subtitle and footer stay as editable text above it. */
  function cover(width: number, depth: number) {
    const W = 1024, H = Math.round(W * depth / width), sx = W / width, z = (u: number) => (u / depth + .5) * H;
    const tooled = gilded(W, H, 17, ctx => {
      for (const [m, lw] of [[44, 7], [62, 3], [118, 3]]) { ctx.lineWidth = lw; ctx.strokeRect(m, m, W - 2 * m, H - 2 * m); }
      for (const [cx, cy, dx, dy] of [[118, 118, 1, 1], [W - 118, 118, -1, 1], [118, H - 118, 1, -1], [W - 118, H - 118, -1, -1]]) {
        ctx.lineWidth = 3;
        for (let k = 0; k < 3; k++) { ctx.beginPath(); ctx.arc(cx + dx * (38 + k * 22), cy + dy * (38 + k * 22), 18 + k * 9, 0, Math.PI * 2); ctx.stroke(); }
        ctx.beginPath(); ctx.arc(cx + dx * 22, cy + dy * 22, 9, 0, Math.PI * 2); ctx.fill();
      }
      // the medallion sits between the subtitle and the footer
      const mx = W / 2, my = z(.35), rx = 1.32 * sx, ry = 1.62 * sx;
      ctx.lineWidth = 6; ctx.beginPath(); ctx.ellipse(mx, my, rx, ry, 0, 0, Math.PI * 2); ctx.stroke();
      ctx.lineWidth = 2.5; ctx.beginPath(); ctx.ellipse(mx, my, rx - 16, ry - 16, 0, 0, Math.PI * 2); ctx.stroke();
      for (let k = 0; k < 28; k++) { const a = k / 28 * Math.PI * 2; ctx.beginPath(); ctx.arc(mx + Math.cos(a) * (rx + 22), my + Math.sin(a) * (ry + 22), 6, 0, Math.PI * 2); ctx.fill(); }
      ctx.font = `${Math.round(ry * 1.1)}px Georgia, serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('❧', mx, my + ry * .06);
      for (const [x, y] of [[mx - rx * .62, my - ry * .55], [mx + rx * .6, my - ry * .5], [mx - rx * .5, my + ry * .62], [mx + rx * .55, my + ry * .58]]) {
        ctx.beginPath(); for (let k = 0; k < 10; k++) { const a = k / 10 * Math.PI * 2 - Math.PI / 2, rr = k % 2 ? 5 : 13; ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); } ctx.fill();
      }
      // a fillet rule under the title block
      ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(W * .3, z(-1.33)); ctx.quadraticCurveTo(W / 2, z(-1.2), W * .7, z(-1.33)); ctx.stroke();
    });
    const mat = goldMaterial(renderer, tooled); mat.polygonOffset = true; mat.polygonOffsetFactor = -2;
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(width, depth), mat); mesh.rotation.x = -Math.PI / 2; mesh.receiveShadow = true;
    return mesh;
  }

  /** Rounded spine for the shut book, gilt bands across it. */
  function spine(radius: number, length: number) {
    const tooled = gilded(256, 1024, 23, ctx => { for (const v of [.1, .13, .3, .7, .87, .9]) ctx.fillRect(0, v * 1024 - 4, 256, 8); });
    const mesh = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, length, 28, 1, true, Math.PI, Math.PI), goldMaterial(renderer, tooled));
    mesh.rotation.x = Math.PI / 2; mesh.castShadow = true; mesh.receiveShadow = true;
    return mesh;
  }

  // ---- card ----
  const keyDir = { value: new THREE.Vector3(0, 1, 0) }, keyColor = { value: new THREE.Color(0, 0, 0) };
  const lampPos = { value: new THREE.Vector3() }, lampColor = { value: new THREE.Color(0, 0, 0) };
  /** Fibres (faded by pixel footprint so distant card doesn't shimmer) and
   * light through the card from behind, from the key light and the lamp. */
  function cardShader(material: THREE.MeshStandardMaterial, trans = .3, fibres = true) {
    if (material.userData.cardShader) return material; material.userData.cardShader = true;
    const before = material.onBeforeCompile.bind(material);
    material.onBeforeCompile = (shader, r) => {
      before(shader, r);
      Object.assign(shader.uniforms, { cardKeyDir: keyDir, cardKeyColor: keyColor, cardLampPos: lampPos, cardLampColor: lampColor, cardTrans: { value: trans } });
      shader.vertexShader = shader.vertexShader.replace('#include <common>', '#include <common>\nvarying vec2 vCardXY;varying vec3 vCardWorld;')
        .replace('#include <begin_vertex>', '#include <begin_vertex>\nvCardXY=position.xy;vCardWorld=(modelMatrix*vec4(position,1.)).xyz;');
      shader.fragmentShader = shader.fragmentShader.replace('#include <common>', `#include <common>
varying vec2 vCardXY;varying vec3 vCardWorld;uniform vec3 cardKeyDir,cardKeyColor,cardLampPos,cardLampColor;uniform float cardTrans;
float cardHash(vec2 p){vec3 q=fract(vec3(p.xyx)*.1031);q+=dot(q,q.yzx+33.33);return fract((q.x+q.y)*q.z);}
float cardNoise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(cardHash(i),cardHash(i+vec2(1,0)),f.x),mix(cardHash(i+vec2(0,1)),cardHash(i+vec2(1,1)),f.x),f.y);}`)
        .replace('#include <map_fragment>', `#include <map_fragment>
${fibres ? `{float px=max(length(fwidth(vCardXY)),1e-5),fade=smoothstep(.02,.004,px);
 float fib=cardNoise(vCardXY*vec2(260.,34.))*.5+cardNoise(mat2(.6,-.8,.8,.6)*vCardXY*vec2(210.,28.))*.5;
 float speck=step(.985,cardHash(floor(vCardXY*180.)))*fade;
 diffuseColor.rgb*=mix(1.,.94+.12*fib,fade)*(1.-.22*speck);}` : ''}`)
        .replace('#include <lights_fragment_end>', `#include <lights_fragment_end>
{vec3 Lk=normalize((viewMatrix*vec4(cardKeyDir,0.)).xyz);float bk=max(-dot(normal,Lk),0.);
 vec3 lp=(viewMatrix*vec4(cardLampPos,1.)).xyz-(-vViewPosition);float ld=length(lp);float bl=max(-dot(normal,lp/ld),0.)/(1.+ld*ld*.35);
 reflectedLight.directDiffuse+=(cardKeyColor*bk+cardLampColor*bl)*cardTrans*diffuseColor.rgb*.6;}`);
    };
    const key = material.customProgramCacheKey.bind(material);
    material.customProgramCacheKey = () => key() + `:book-card-${trans}-${fibres}`;
    material.needsUpdate = true;
    return material;
  }
  /** Follow the key light and the lamp (call when they change). */
  function lightCards(keyLight: THREE.DirectionalLight, lamp?: THREE.PointLight) {
    keyDir.value.copy(keyLight.position).sub(keyLight.target.position).normalize();
    keyColor.value.copy(keyLight.color).multiplyScalar(keyLight.intensity);
    if (lamp) { lamp.getWorldPosition(lampPos.value); lampColor.value.copy(lamp.color).multiplyScalar(lamp.intensity * .08); }
  }

  /** Turn a painted cut-out (an alpha-tested plane, flat or relief-displaced)
   * into card: front print, plain back, and a pale cut edge all round. */
  function cardify(front: THREE.Mesh<THREE.BufferGeometry, THREE.MeshStandardMaterial>, tex: THREE.Texture, width: number, height: number, thickness = .016, cut = .3) {
    const image = tex.image as HTMLCanvasElement | HTMLImageElement, loops = traceAlpha(image, cut);
    front.material.side = THREE.FrontSide; front.material.alphaTest = cut; front.material.needsUpdate = true;
    if (front.customDepthMaterial) { (front.customDepthMaterial as THREE.MeshDepthMaterial).alphaTest = cut; (front.customDepthMaterial as THREE.MeshDepthMaterial).side = THREE.DoubleSide; }
    cardShader(front.material);
    const relief = front.geometry.userData.reliefAt as ((u: number, v: number) => number) | undefined;
    const backGeo = front.geometry.clone(); backGeo.translate(0, 0, -thickness);
    const backMat = cardShader(new THREE.MeshStandardMaterial({ map: tex, color: CARD_BACK, side: THREE.BackSide, alphaTest: cut, roughness: .95 }));
    const prior = backMat.onBeforeCompile.bind(backMat);
    backMat.onBeforeCompile = (shader, r) => { shader.fragmentShader = shader.fragmentShader.replace('#include <map_fragment>', '#ifdef USE_MAP\n diffuseColor.a*=texture2D(map,vMapUv).a;\n#endif'); prior(shader, r); };
    const back = new THREE.Mesh(backGeo, backMat); back.position.copy(front.position); back.userData.cardBack = true;
    const pos: number[] = [], nor: number[] = [];
    for (const loop of loops) for (let k = 0; k < loop.length; k++) {
      const a = loop[k], b = loop[(k + 1) % loop.length];
      const ax = (a[0] - .5) * width, ay = (.5 - a[1]) * height, bx = (b[0] - .5) * width, by = (.5 - b[1]) * height;
      const za = relief ? relief(a[0], 1 - a[1]) : 0, zb = relief ? relief(b[0], 1 - b[1]) : 0;
      // outward, for an edge traced with the inside on its right (image y down): (dy, dx) once y is flipped
      let nx = (b[1] - a[1]) * height, ny = (b[0] - a[0]) * width; const nl = Math.hypot(nx, ny) || 1; nx /= nl; ny /= nl;
      pos.push(ax, ay, za, bx, by, zb, bx, by, zb - thickness, ax, ay, za, bx, by, zb - thickness, ax, ay, za - thickness);
      for (let i = 0; i < 6; i++) nor.push(nx, ny, 0);
    }
    const ribbonGeo = new THREE.BufferGeometry();
    ribbonGeo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); ribbonGeo.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
    const ribbon = new THREE.Mesh(ribbonGeo, new THREE.MeshStandardMaterial({ color: CARD_CORE, roughness: .9, side: THREE.DoubleSide }));
    ribbon.position.copy(front.position); ribbon.userData.cardEdge = true;
    front.parent?.add(back, ribbon);
    return { back, ribbon };
  }

  return { leather, pageBlock, cover, spine, cardShader, lightCards, cardify, LEATHER_DARK };
}

/** Outline loops of an image's alpha (in 0..1 image coordinates, y down),
 * traced along pixel boundaries on a coarse grid and simplified. */
export function traceAlpha(image: CanvasImageSource & { width: number; height: number }, cut = .3, maxCells = 256) {
  const s = Math.min(1, maxCells / Math.max(image.width, image.height)), W = Math.max(2, Math.round(image.width * s)), H = Math.max(2, Math.round(image.height * s));
  const c = canvas(W, H), ctx = c.getContext('2d', { willReadFrequently: true })!; ctx.drawImage(image, 0, 0, W, H);
  const a = ctx.getImageData(0, 0, W, H).data, inside = (x: number, y: number) => x >= 0 && y >= 0 && x < W && y < H && a[(y * W + x) * 4 + 3] > cut * 255;
  const next = new Map<number, number[][]>(), key = (x: number, y: number) => y * (W + 1) + x;
  const edge = (x0: number, y0: number, x1: number, y1: number) => { const k = key(x0, y0); (next.get(k) ?? next.set(k, []).get(k)!).push([x1, y1]); };
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (inside(x, y)) {
    if (!inside(x, y - 1)) edge(x, y, x + 1, y);
    if (!inside(x + 1, y)) edge(x + 1, y, x + 1, y + 1);
    if (!inside(x, y + 1)) edge(x + 1, y + 1, x, y + 1);
    if (!inside(x - 1, y)) edge(x, y + 1, x, y);
  }
  const loops: number[][][] = [];
  for (const [k0, list] of next) while (list.length) {
    const loop: number[][] = [[k0 % (W + 1), Math.floor(k0 / (W + 1))]];
    let cur = list.pop()!;
    for (let guard = 0; guard < 1e6; guard++) {
      if (key(cur[0], cur[1]) === k0) break;
      loop.push(cur);
      const out = next.get(key(cur[0], cur[1])); if (!out || !out.length) break;
      cur = out.pop()!;
    }
    if (loop.length >= 12) loops.push(simplify(loop, .45).map(([x, y]) => [x / W, y / H]));
  }
  return loops;
}

function simplify(loop: number[][], eps: number) {
  const n = loop.length; let far = 0, best = -1;
  for (let i = 1; i < n; i++) { const d = Math.hypot(loop[i][0] - loop[0][0], loop[i][1] - loop[0][1]); if (d > best) { best = d; far = i; } }
  const rdp = (pts: number[][]): number[][] => {
    if (pts.length < 3) return pts;
    const [ax, ay] = pts[0], [bx, by] = pts[pts.length - 1], L = Math.hypot(bx - ax, by - ay) || 1;
    let m = 0, mi = 0;
    for (let i = 1; i < pts.length - 1; i++) { const d = Math.abs((bx - ax) * (ay - pts[i][1]) - (ax - pts[i][0]) * (by - ay)) / L; if (d > m) { m = d; mi = i; } }
    if (m <= eps) return [pts[0], pts[pts.length - 1]];
    const l = rdp(pts.slice(0, mi + 1)), r = rdp(pts.slice(mi));
    return l.slice(0, -1).concat(r);
  };
  const A = rdp(loop.slice(0, far + 1)), B = rdp(loop.slice(far).concat([loop[0]]));
  return A.slice(0, -1).concat(B.slice(0, -1));
}
