import * as THREE from 'three';

/** Page 117's painted paper surfaces, drawn once to canvases at load. Most are
 * near-white so one texture can be tinted by several materials. */
export function seeded(seed: number) {
  let a = seed >>> 0;
  return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
function canvas(w: number, h: number) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  return {c, g: c.getContext('2d')!};
}
function texture(c: HTMLCanvasElement, repeat = true, maxAniso = 4) {
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = maxAniso;
  if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}
function speckle(g: CanvasRenderingContext2D, w: number, h: number, r: () => number, n: number, dark = .12, light = .1) {
  for (let i = 0; i < n; i++) {
    g.fillStyle = r() < .5 ? `rgba(60,45,30,${r() * dark})` : `rgba(255,252,240,${r() * light})`;
    g.fillRect(r() * w, r() * h, 1 + r() * 2.2, 1 + r() * 2.2);
  }
}

/** Running-bond cream bricks with inked mortar; tile = 4 m square. */
function drawBricks(g: CanvasRenderingContext2D, x0: number, y0: number, w: number, h: number, rows: number, perRow: number, r: () => number, base = [224, 220, 210], mortar = '#b0aa9c') {
  const bh = h / rows, bw = w / perRow;
  g.fillStyle = mortar; g.fillRect(x0, y0, w, h);
  for (let row = 0; row < rows; row++) {
    const off = row % 2 ? bw / 2 : 0;
    for (let k = -1; k <= perRow; k++) {
      const x = x0 + k * bw + off, y = y0 + row * bh, v = (r() - .5) * 22;
      g.fillStyle = `rgb(${base[0] + v},${base[1] + v},${base[2] + v * .8})`;
      g.fillRect(x + bw * .035, y + bh * .07, bw * .93, bh * .86);
      g.fillStyle = 'rgba(255,250,236,.22)'; g.fillRect(x + bw * .035, y + bh * .07, bw * .93, bh * .12);
      g.strokeStyle = 'rgba(80,62,44,.42)'; g.lineWidth = Math.max(1, bh * .05);
      g.strokeRect(x + bw * .035, y + bh * .07, bw * .93, bh * .86);
    }
  }
}

export function paintStone(seed = 3) {
  const {c, g} = canvas(512, 512), r = seeded(seed);
  drawBricks(g, 0, 0, 512, 512, 8, 4, r);
  speckle(g, 512, 512, r, 5000);
  return texture(c);
}

export function paintPaving(seed = 5) {
  const {c, g} = canvas(512, 512), r = seeded(seed);
  drawBricks(g, 0, 0, 512, 512, 6, 3, r, [228, 214, 184], '#bfae8c');
  speckle(g, 512, 512, r, 6000, .2, .08);
  return texture(c);
}

/** One keep face (22 × 48 m): bricks, arched windows, a door. Returns the
 * colour map and an emissive map where some windows glow. */
export function paintKeep(seed = 9, showWindows = true) {
  const W = 512, H = 1116, m = W / 22, r = seeded(seed);
  const {c, g} = canvas(W, H), glow = canvas(W, H);
  drawBricks(g, 0, 0, W, H, 96, 11, r);
  speckle(g, W, H, r, 9000);
  glow.g.fillStyle = '#000'; glow.g.fillRect(0, 0, W, H);
  const arch = (ctx: CanvasRenderingContext2D, cx: number, base: number, w: number, h: number) => {
    const x = cx * m, y = H - base * m, ww = w * m, hh = h * m;
    ctx.beginPath(); ctx.moveTo(x - ww / 2, y); ctx.lineTo(x - ww / 2, y - hh + ww / 2); ctx.arc(x, y - hh + ww / 2, ww / 2, Math.PI, 0); ctx.lineTo(x + ww / 2, y); ctx.closePath();
  };
  const windows: [number, number, number, number, boolean][] = [];
  if (showWindows) {
    for (const [base, lit] of [[13, [1, 0]], [24, [0, 1]], [35, [1, 1]]] as const) for (const [i, cx] of [6.5, 15.5].entries()) windows.push([cx, base, 2.2, 4.4, !!lit[i]]);
  }
  windows.push([11, 0, 4.4, 7, false]);
  for (const [cx, base, w, h, lit] of windows) {
    // voussoir rim, dark opening, a sill
    arch(g, cx, base - .25, w + .7, h + .55); g.fillStyle = '#cbbd9f'; g.fill(); g.strokeStyle = 'rgba(70,52,36,.6)'; g.lineWidth = 3; g.stroke();
    arch(g, cx, base, w, h); g.fillStyle = lit ? '#e8a95a' : base === 0 ? '#4a3524' : '#2a221d'; g.fill();
    g.strokeStyle = 'rgba(40,28,20,.8)'; g.lineWidth = 2.5; g.stroke();
    if (lit) { arch(glow.g, cx, base, w, h); glow.g.fillStyle = '#ffb760'; glow.g.fill(); }
    if (base > 0) { g.strokeStyle = 'rgba(30,20,14,.7)'; g.lineWidth = 2; g.beginPath(); g.moveTo(cx * m, H - base * m); g.lineTo(cx * m, H - (base + h * .82) * m); g.stroke(); }
    else for (let k = 1; k < 5; k++) { g.strokeStyle = 'rgba(20,12,6,.5)'; g.beginPath(); g.moveTo((cx - w / 2 + k * w / 5) * m, H); g.lineTo((cx - w / 2 + k * w / 5) * m, H - 5.4 * m); g.stroke(); }
  }
  // a darker band beneath the roof line and grass at the foot
  const top = g.createLinearGradient(0, 0, 0, 3 * m); top.addColorStop(0, 'rgba(40,28,18,.35)'); top.addColorStop(1, 'rgba(40,28,18,0)'); g.fillStyle = top; g.fillRect(0, 0, W, 3 * m);
  return {map: texture(c, false), emissive: texture(glow.c, false)};
}

/** Overlapping scallop tiles, light grey on white, tinted per roof. */
export function paintScales(seed = 4) {
  const {c, g} = canvas(256, 256), r = seeded(seed), s = 32;
  g.fillStyle = '#f2f0ec'; g.fillRect(0, 0, 256, 256);
  for (let row = 0; row < 256 / s * 2 + 1; row++) for (let k = -1; k <= 256 / s; k++) {
    const x = k * s + (row % 2 ? s / 2 : 0), y = row * s / 2, v = 225 + (r() - .5) * 40;
    g.beginPath(); g.arc(x + s / 2, y, s / 2, 0, Math.PI); g.fillStyle = `rgb(${v},${v},${v})`; g.fill();
    g.strokeStyle = 'rgba(40,35,30,.55)'; g.lineWidth = 2; g.stroke();
  }
  speckle(g, 256, 256, r, 1500, .18, .1);
  return texture(c);
}

/** Felt: short crossing fibres around a pale base, tinted green by material. */
export function paintFelt(seed = 7) {
  const {c, g} = canvas(512, 512), r = seeded(seed);
  g.fillStyle = '#d8d8d2'; g.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 9000; i++) {
    const x = r() * 512, y = r() * 512, a = r() * Math.PI, l = 3 + r() * 9, v = 160 + r() * 95;
    g.strokeStyle = `rgba(${v},${v},${v - 6},.55)`; g.lineWidth = .8 + r();
    g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l); g.stroke();
  }
  return texture(c);
}

export function paintWater(seed = 11) {
  const {c, g} = canvas(256, 256), r = seeded(seed);
  g.fillStyle = '#4c7ca6'; g.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 70; i++) {
    const x = r() * 256, y = r() * 256, l = 14 + r() * 30;
    g.strokeStyle = `rgba(${r() < .5 ? '210,232,250' : '34,62,96'},${.25 + r() * .35})`; g.lineWidth = 1.5 + r() * 1.5;
    g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x + l / 2, y - 4, x + l, y); g.stroke();
    g.beginPath(); g.moveTo(x - 256, y); g.quadraticCurveTo(x - 256 + l / 2, y - 4, x - 256 + l, y); g.stroke();
  }
  speckle(g, 256, 256, r, 800, .15, .15);
  return texture(c);
}

/** Wood grain, pale so it can be stained per material. */
export function paintWood(seed = 13) {
  const {c, g} = canvas(512, 512), r = seeded(seed);
  g.fillStyle = '#e4dccb'; g.fillRect(0, 0, 512, 512);
  for (let y = 0; y < 512; y += 1.6) {
    const v = 190 + Math.sin(y * .09 + r() * .4) * 26 + (r() - .5) * 22;
    g.strokeStyle = `rgba(${v},${v - 8},${v - 20},.6)`; g.lineWidth = 1.2;
    g.beginPath(); g.moveTo(0, y); for (let x = 0; x <= 512; x += 32) g.lineTo(x, y + Math.sin(x * .02 + y * .05) * 2.2); g.stroke();
  }
  for (let k = 0; k < 6; k++) { g.fillStyle = 'rgba(70,50,30,.5)'; g.fillRect(0, k * 512 / 6, 512, 2); }
  return texture(c);
}

/** Felt tree flats: organic, lumpy canopies (never perfect circles) with a
 * stitched rim and a leaning trunk. Two variants side by side in one atlas. */
export function paintTrees(seed = 17) {
  const W = 1024, H = 1024, {c, g} = canvas(W, H), r = seeded(seed);
  const variant = (ox: number, tall: boolean) => {
    const cx = ox + 256, base = H - 20, trunkTop = tall ? 760 : 700, lean = (r() - .5) * 26;
    // trunk
    g.beginPath(); g.moveTo(cx - 26, base); g.quadraticCurveTo(cx - 18 + lean * .3, (base + trunkTop) / 2, cx - 10 + lean, trunkTop - 60);
    g.lineTo(cx + 12 + lean, trunkTop - 60); g.quadraticCurveTo(cx + 22 + lean * .3, (base + trunkTop) / 2, cx + 28, base); g.closePath();
    g.fillStyle = '#6b4a30'; g.fill(); g.strokeStyle = 'rgba(36,22,12,.7)'; g.lineWidth = 3; g.stroke();
    // canopy as a union of noisy lobes
    const lobes: [number, number, number][] = [];
    const ccy = tall ? 400 : 430, rx = tall ? 150 : 205, ry = tall ? 330 : 255;
    lobes.push([cx + lean, ccy, 1]);
    for (let k = 0; k < 7; k++) { const a = r() * Math.PI * 2, d = .45 + r() * .3; lobes.push([cx + lean + Math.cos(a) * rx * d, ccy + Math.sin(a) * ry * d, .45 + r() * .3]); }
    const shape = new Path2D();
    for (const [lx, ly, s] of lobes) {
      const ph = [r() * 6, r() * 6, r() * 6];
      for (let i = 0; i <= 64; i++) {
        const t = i / 64 * Math.PI * 2, n = 1 + .07 * Math.sin(3 * t + ph[0]) + .05 * Math.sin(5 * t + ph[1]) + .03 * Math.sin(9 * t + ph[2]);
        const x = lx + Math.cos(t) * rx * .62 * s * n, y = ly + Math.sin(t) * ry * .62 * s * n;
        if (i === 0) shape.moveTo(x, y); else shape.lineTo(x, y);
      }
      shape.closePath();
    }
    const grad = g.createLinearGradient(cx + rx, ccy - ry, cx - rx, ccy + ry);
    grad.addColorStop(0, '#7e9a48'); grad.addColorStop(.55, '#55742f'); grad.addColorStop(1, '#2f4a20');
    g.fillStyle = grad; g.fill(shape, 'nonzero');
    g.save(); g.clip(shape, 'nonzero');
    for (let i = 0; i < 6000; i++) {
      const x = cx - rx * 1.2 + r() * rx * 2.4, y = ccy - ry * 1.2 + r() * ry * 2.4, a = r() * Math.PI, l = 3 + r() * 7;
      g.strokeStyle = r() < .5 ? 'rgba(200,220,150,.22)' : 'rgba(20,40,14,.25)'; g.lineWidth = 1;
      g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l); g.stroke();
    }
    g.restore();
    g.setLineDash([9, 7]); g.strokeStyle = 'rgba(226,236,190,.55)'; g.lineWidth = 2.5;
    g.save(); g.translate(cx, ccy); g.scale(.95, .96); g.translate(-cx, -ccy); g.stroke(shape); g.restore(); g.setLineDash([]);
    g.strokeStyle = 'rgba(22,34,14,.75)'; g.lineWidth = 3; g.stroke(shape);
  };
  variant(0, false); variant(512, true);
  const t = texture(c, false); t.generateMipmaps = true;
  return t;
}

/** Soft dark disc for standees' contact shadow. */
export function paintBlob() {
  const {c, g} = canvas(128, 128), grad = g.createRadialGradient(64, 64, 4, 64, 64, 62);
  grad.addColorStop(0, 'rgba(10,6,4,.62)'); grad.addColorStop(.55, 'rgba(10,6,4,.32)'); grad.addColorStop(1, 'rgba(10,6,4,0)');
  g.fillStyle = grad; g.fillRect(0, 0, 128, 128);
  return texture(c, false);
}

export function paintGlow(color = '255,190,110') {
  const {c, g} = canvas(128, 128), grad = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  grad.addColorStop(0, `rgba(${color},1)`); grad.addColorStop(.25, `rgba(${color},.45)`); grad.addColorStop(1, `rgba(${color},0)`);
  g.fillStyle = grad; g.fillRect(0, 0, 128, 128);
  return texture(c, false);
}

/** The page's printed meadow, seen from above: pale green ground, clumps of
 * darker shrubs, tiny red-roofed cottages and confetti flowers. One sheet spans
 * the whole field disc (repeat 1), so nothing visibly tiles. */
export function paintFieldPrint(radius: number, seed = 29) {
  const S = 2048, {c, g} = canvas(S, S), r = seeded(seed), m = S / (radius * 2), toPx = (v: number) => S / 2 + v * m;
  g.fillStyle = '#c3d494'; g.fillRect(0, 0, S, S);
  for (let i = 0; i < 260; i++) { // soft printed mottling
    const x = r() * S, y = r() * S, rad = 40 + r() * 160, grad = g.createRadialGradient(x, y, 0, x, y, rad);
    grad.addColorStop(0, r() < .5 ? 'rgba(170,196,112,.35)' : 'rgba(214,224,160,.35)'); grad.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = grad; g.fillRect(x - rad, y - rad, rad * 2, rad * 2);
  }
  const clear = (wx: number, wz: number) => Math.hypot(wx, wz) < 78 || (wz > 0 && Math.abs(wx) < 14);
  for (let i = 0; i < 140; i++) { // shrub clumps: overlapping organic ovals with a darker rim
    const a = r() * Math.PI * 2, d = 80 + Math.sqrt(r()) * (radius - 90), wx = Math.cos(a) * d, wz = Math.sin(a) * d;
    if (clear(wx, wz)) continue;
    const n = 2 + Math.floor(r() * 4);
    for (let k = 0; k < n; k++) {
      const x = toPx(wx + (r() - .5) * 9), y = toPx(wz + (r() - .5) * 5), rx = (2.4 + r() * 3.6) * m, ry = rx * (.45 + r() * .2);
      g.beginPath(); g.ellipse(x, y, rx, ry, (r() - .5) * .5, 0, Math.PI * 2);
      g.fillStyle = r() < .5 ? '#7fa55c' : '#8cb066'; g.fill(); g.strokeStyle = 'rgba(70,104,52,.8)'; g.lineWidth = 2.2; g.stroke();
    }
  }
  for (let i = 0; i < 16; i++) { // cottages
    const a = r() * Math.PI * 2, d = 110 + r() * (radius - 140), wx = Math.cos(a) * d, wz = Math.sin(a) * d;
    if (clear(wx, wz)) continue;
    const x = toPx(wx), y = toPx(wz), w = 7 * m, h = 3.4 * m;
    g.fillStyle = '#f2ece0'; g.fillRect(x - w / 2, y - h / 2, w, h);
    g.fillStyle = '#c4473a'; g.beginPath(); g.moveTo(x - w / 2 - 4, y - h / 2); g.lineTo(x + w * .15, y - h * 1.5); g.lineTo(x + w / 2 + 4, y - h / 2); g.closePath(); g.fill();
    g.strokeStyle = 'rgba(80,60,48,.7)'; g.lineWidth = 2; g.strokeRect(x - w / 2, y - h / 2, w, h);
  }
  for (let i = 0; i < 2600; i++) { // confetti flowers
    const x = r() * S, y = r() * S;
    g.fillStyle = ['#e9a3b6', '#f6f1e6', '#d96d6d', '#efd27c'][Math.floor(r() * 4)]; g.globalAlpha = .55 + r() * .4;
    g.beginPath(); g.arc(x, y, 1.4 + r() * 1.8, 0, Math.PI * 2); g.fill();
  }
  g.globalAlpha = 1;
  speckle(g, S, S, r, 20000, .1, .08);
  const t = texture(c, false); return t;
}

/** A cream quill feather for the inkwell beyond the page. */
export function paintFeather(seed = 31) {
  const W = 256, H = 1024, {c, g} = canvas(W, H), r = seeded(seed);
  const vane = new Path2D(); vane.moveTo(128, 1000); vane.bezierCurveTo(30, 760, 40, 260, 120, 20); vane.bezierCurveTo(200, 240, 226, 700, 140, 1000); vane.closePath();
  const grad = g.createLinearGradient(0, 0, W, 0); grad.addColorStop(0, '#d9ccb2'); grad.addColorStop(.5, '#f6efe0'); grad.addColorStop(1, '#cfc0a2');
  g.fillStyle = grad; g.fill(vane);
  g.save(); g.clip(vane);
  for (let y = 40; y < 990; y += 5) { g.strokeStyle = `rgba(150,128,96,${.15 + r() * .2})`; g.lineWidth = 1.2; g.beginPath(); g.moveTo(128, y); g.lineTo(20, y - 60 - r() * 30); g.moveTo(132, y); g.lineTo(236, y - 60 - r() * 30); g.stroke(); }
  g.restore();
  g.strokeStyle = '#a2503e'; g.lineWidth = 5; g.beginPath(); g.moveTo(128, 1024); g.quadraticCurveTo(122, 520, 120, 24); g.stroke();
  g.strokeStyle = 'rgba(90,70,50,.6)'; g.lineWidth = 2; g.stroke(vane);
  return texture(c, false);
}
