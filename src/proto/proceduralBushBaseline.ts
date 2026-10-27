/** Temporary art prototype: every branch, foliage wash and fruit is generated
 * locally. No source image, sampled raster, font or network dependency. */
export const BUSH_RENDERER_VERSION = 'bush-study-v1';
export type BushPreset = { version: 1; seed: number; fullness: number; spread: number; brush: number; warmth: number; fruit: number };
export const DEFAULT_BUSH: Readonly<BushPreset> = Object.freeze({ version: 1, seed: 81723, fullness: .7, spread: 1, brush: .65, warmth: .6, fruit: 1 });
type Point = { x: number; y: number };
export type BushMass = Point & { rx: number; ry: number; angle: number; light: number; seed: number; front: boolean };
export type BushBranch = { start: Point; bend: Point; end: Point; width: number };
export type BushModel = { branches: BushBranch[]; masses: BushMass[]; fruit: Point[] };
const clamp = (n: number, low = 0, high = 1) => Math.max(low, Math.min(high, n));
const smooth = (a: number, b: number, x: number) => { const t = clamp((x - a) / (b - a)); return t * t * (3 - 2 * t); };
function rng(seed: number) { let s = seed >>> 0; return () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; }; }
function noise(cells: number, random: () => number) {
  const width = cells + 1, values = Float32Array.from({ length: width * width }, random);
  return (x: number, y: number) => {
    const px = clamp(x) * cells, py = clamp(y) * cells, ix = Math.min(cells - 1, Math.floor(px)), iy = Math.min(cells - 1, Math.floor(py));
    const u = smooth(0, 1, px - ix), v = smooth(0, 1, py - iy);
    const top = values[iy * width + ix] * (1 - u) + values[iy * width + ix + 1] * u;
    const bottom = values[(iy + 1) * width + ix] * (1 - u) + values[(iy + 1) * width + ix + 1] * u;
    return top * (1 - v) + bottom * v;
  };
}
export function parseBushPreset(value: unknown): BushPreset {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Expected a bush preset.');
  const p = value as Record<string, unknown>;
  if (Object.keys(p).some(k => !Object.keys(DEFAULT_BUSH).includes(k))) throw new Error('Unknown bush property.');
  if (p.version !== 1 || !Number.isInteger(p.seed) || Number(p.seed) < 0 || Number(p.seed) > 4294967295) throw new Error('Use version 1 and a 32-bit seed.');
  for (const [key, low, high] of [['fullness', 0, 1], ['spread', .65, 1.25], ['brush', 0, 1], ['warmth', 0, 1], ['fruit', 0, 3]] as const) {
    if (typeof p[key] !== 'number' || !Number.isFinite(p[key]) || Number(p[key]) < low || Number(p[key]) > high) throw new Error(`${key} must be ${low}–${high}.`);
  }
  if (!Number.isInteger(p.fruit)) throw new Error('Fruit count must be an integer.');
  return { version: 1, seed: Number(p.seed), fullness: Number(p.fullness), spread: Number(p.spread), brush: Number(p.brush), warmth: Number(p.warmth), fruit: Number(p.fruit) };
}

/** A bounded seeded growth description. Fruit has its own stream and cannot
 * alter the branches/foliage when the ripe/depleted comparison is changed. */
export function buildBushModel(preset: Readonly<BushPreset> = DEFAULT_BUSH): BushModel {
  parseBushPreset(preset);
  const random = rng(preset.seed), signed = () => random() - .5;
  const spread = (x: number) => .5 + (x - .5) * preset.spread;
  // Uneven three-dimensional crown: clear lower stems, large overlapping masses
  // and holes between the limbs rather than an uninterrupted round hedge.
  const anchors = [
    [.38,.22,.135,.105,.9], [.28,.30,.12,.105,.8], [.48,.30,.115,.105,.65],
    [.17,.43,.145,.11,.8], [.26,.47,.12,.115,.28], [.14,.59,.125,.12,.4],
    [.28,.67,.12,.105,.28], [.42,.44,.12,.15,.12], [.48,.58,.115,.12,.24],
    [.65,.37,.13,.115,.85], [.77,.46,.14,.12,.72], [.78,.59,.11,.12,.3],
    [.64,.60,.13,.10,.78], [.66,.74,.145,.105,.32], [.52,.70,.10,.09,.36],
  ];
  const masses: BushMass[] = anchors.map(([x,y,rx,ry,light], i) => ({
    x: spread(x + signed() * .07), y: y + signed() * .075,
    rx: rx * (.83 + random() * .32) * (.96 + preset.fullness * .42) * preset.spread,
    ry: ry * (.82 + random() * .28) * (1 + preset.fullness * .34),
    angle: signed() * 1.1, light: clamp(light + signed() * .2), seed: (preset.seed + i * 48611) >>> 0, front: i % 3 !== 0,
  }));
  const root = { x: .50, y: .9 }, branches: BushBranch[] = [];
  for (const index of [0, 3, 9, 13]) {
    const mass = masses[index], end = { x: mass.x, y: mass.y + mass.ry * .35 };
    const bend = { x: root.x + (end.x - root.x) * (.48 + random() * .17) + signed() * .09, y: .69 + signed() * .08 };
    branches.push({ start: root, bend, end, width: .019 + random() * .012 });
    const sibling = masses[(index + 1) % masses.length];
    branches.push({ start: { x: (bend.x + end.x) * .5, y: (bend.y + end.y) * .5 }, bend: { x: sibling.x, y: (end.y + sibling.y) * .5 + .08 }, end: { x: sibling.x, y: sibling.y + .035 }, width: .007 + random() * .007 });
  }
  const fruitRandom = rng(preset.seed ^ 0x52da713);
  const fruit = Array.from({ length: preset.fruit }, (_, i) => ({ x: spread([.60, .28, .73][i] + (fruitRandom() - .5) * .045), y: [.46, .55, .65][i] + (fruitRandom() - .5) * .04 }));
  // Contain every supported seed/control combination with transparent gutters.
  // Fit around the same planted foot; it never wanders with crown variation.
  const maxReach = Math.max(...masses.map(m => Math.abs(m.x-.5) + .82*(Math.abs(Math.cos(m.angle))*m.rx+Math.abs(Math.sin(m.angle))*m.ry)));
  const fitX = Math.min(1,.46/maxReach);
  const mapPoint = (p: Point) => { p.x=.5+(p.x-.5)*fitX;p.y=.9+(p.y-.9)*.86; };
  masses.forEach(m=>{mapPoint(m);m.rx*=fitX;m.ry*=.86;});fruit.forEach(mapPoint);
  const seen=new Set<Point>();for(const branch of branches)for(const p of [branch.start,branch.bend,branch.end])if(!seen.has(p)){mapPoint(p);seen.add(p);}
  return { branches, masses, fruit };
}

function foliageStamp(mass: BushMass, preset: Readonly<BushPreset>, resolution: number) {
  const size = resolution, canvas = document.createElement('canvas'); canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d'); if (!ctx) throw new Error('Canvas 2D unavailable.');
  const random = rng(mass.seed), broad = noise(5, random), pigment = noise(14, random), paper = noise(59, random);
  const phase = random() * Math.PI * 2;
  const image = ctx.createImageData(size, size);
  const dark = [27, 68, 59], mid = [66 + preset.warmth * 28, 98 + preset.warmth * 15, 66 - preset.warmth * 14];
  const light = [169 + preset.warmth * 38, 179 + preset.warmth * 22, 88 - preset.warmth * 9];
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const u = x / (size - 1), v = y / (size - 1), px = (u - .5) / .45, py = (v - .5) / .44;
    const angle = Math.atan2(py, px), r = Math.hypot(px, py), b = broad(u, v), p = pigment(u, v), grain = paper(u, v);
    // Broad lobes define a brush-dab silhouette. Fine noise only chips the wet
    // margin; it never substitutes for crown structure or draws tiny leaves.
    const boundary = .78 + Math.sin(angle * 3 + phase) * .18 + Math.sin(angle * 5 - phase) * .09 + Math.sin(angle * 11 + phase) * .025 + (b - .5) * .24 + (p - .5) * preset.brush * .19;
    const distance = boundary - r;
    const alpha = smooth(-.045 - preset.brush * .06, .07, distance);
    if (!alpha) continue;
    const upper = clamp(.64 - v * .52 + (b - .5) * .65);
    let value = clamp(mass.light * .98 + upper * .40 - .20 + (p - .5) * .21);
    // Lost edges, pale wet patches and pooled darker boundaries; color varies
    // over whole paint masses instead of a uniform paper/noise overlay.
    const wet = Math.exp(-(((u - .34) / .32) ** 2 + ((v - .3) / .4) ** 2)) * (.4 + b * .6);
    value = clamp(value + wet * .12 + smooth(.43,.69,b)*.14 - Math.exp(-(((distance - .035) / .038) ** 2)) * preset.brush * .065);
    const valley = smooth(.42, .12, grain) * smooth(.3, .75, p) * preset.brush;
    const i = (y * size + x) * 4;
    for (let c = 0; c < 3; c++) {
      const base = value < .45 ? dark[c] + (mid[c] - dark[c]) * value / .45 : mid[c] + (light[c] - mid[c]) * (value - .45) / .55;
      image.data[i + c] = base * (1 - valley * .095) + (grain - .5) * preset.brush * 4;
    }
    image.data[i + 3] = alpha * (227 + p * 21 + grain * 7);
  }
  ctx.putImageData(image, 0, 0); return canvas;
}

function paintBranch(ctx: CanvasRenderingContext2D, branch: BushBranch, random: () => number) {
  const { start, bend, end, width } = branch;
  const samples = Array.from({ length: 19 }, (_, i) => {
    const t = i / 18, a = 1 - t;
    const dx=2*a*(bend.x-start.x)+2*t*(end.x-bend.x),dy=2*a*(bend.y-start.y)+2*t*(end.y-bend.y),length=Math.hypot(dx,dy)||1;
    return { x: a*a*start.x + 2*a*t*bend.x + t*t*end.x, y: a*a*start.y + 2*a*t*bend.y + t*t*end.y, w: width * (1 - t * .82), nx:-dy/length,ny:dx/length };
  });
  ctx.beginPath();
  for (const [index, p] of samples.entries()) { const w=p.w*(.7+random()*.25); const x=p.x-p.nx*w,y=p.y-p.ny*w;index ? ctx.lineTo(x,y) : ctx.moveTo(x,y); }
  for (const p of [...samples].reverse()) {const w=p.w*(.65+random()*.2);ctx.lineTo(p.x+p.nx*w,p.y+p.ny*w);}
  ctx.closePath();
  const shade = ctx.createLinearGradient(start.x - width, 0, start.x + width * 1.5, 0);
  shade.addColorStop(0, '#71543d'); shade.addColorStop(.45, '#a68055'); shade.addColorStop(1, '#473c35'); ctx.fillStyle = shade; ctx.fill();
  ctx.save(); ctx.clip();
  for(const [k,tint]of ['#d3ac7950','#403b3d55'].entries()){ctx.strokeStyle=tint;ctx.lineWidth=width*.13;ctx.lineCap='round';ctx.beginPath();samples.forEach((p,i)=>{const offset=(k?-.33:.32)*p.w;const x=p.x+p.nx*offset,y=p.y+p.ny*offset;i?ctx.lineTo(x,y):ctx.moveTo(x,y);});ctx.stroke();}
  for (let i = 0; i < 6; i++) {
    const point = samples[Math.floor(random() * samples.length)];
    ctx.fillStyle = i % 2 ? '#342f3930' : '#c6a57630';
    ctx.beginPath(); ctx.ellipse(point.x + (random() - .5) * point.w, point.y, point.w * (.3 + random() * .4), .008 + random() * .009, -.5, 0, Math.PI * 2); ctx.fill();
  }
  ctx.restore();
}
function paintFruit(ctx: CanvasRenderingContext2D, point: Point, seed: number) {
  const random = rng(seed), r = .044;
  const glow = ctx.createRadialGradient(point.x, point.y, r * .5, point.x, point.y, r * 2);
  glow.addColorStop(0, '#99dcff40'); glow.addColorStop(1, '#80ceff00'); ctx.fillStyle = glow; ctx.fillRect(point.x-r*2,point.y-r*2,r*4,r*4);
  ctx.beginPath();
  for (let i = 0; i < 64; i++) { const a = i / 64 * Math.PI * 2, radius = r * (1 + Math.sin(a * 11) * .075 + (random() - .5) * .06); const x = point.x + Math.cos(a) * radius, y = point.y + Math.sin(a) * radius; i ? ctx.lineTo(x,y) : ctx.moveTo(x,y); }
  ctx.closePath();
  const color = ctx.createRadialGradient(point.x-r*.3,point.y-r*.4,r*.1,point.x,point.y,r*1.1);
  color.addColorStop(0,'#e4596a');color.addColorStop(.45,'#b12a4b');color.addColorStop(1,'#641b35');ctx.fillStyle=color;ctx.fill();
  ctx.save();ctx.clip();
  for(let i=0;i<5;i++){const x=point.x+(random()-.5)*r*1.6,y=point.y+(random()-.5)*r*1.6;ctx.fillStyle=i%2?'#ef80922c':'#701a382c';ctx.beginPath();ctx.ellipse(x,y,r*.42,r*.29,random()*3,0,Math.PI*2);ctx.fill();}
  ctx.restore();
}

const cache = new Map<string, HTMLCanvasElement>();
export function proceduralBushCanvas(preset: Readonly<BushPreset> = DEFAULT_BUSH, size = 512): HTMLCanvasElement {
  parseBushPreset(preset);
  if (!Number.isInteger(size) || size < 128 || size > 768) throw new Error('Bush raster must be 128–768 pixels.');
  const key = `${BUSH_RENDERER_VERSION}:${size}:${JSON.stringify(preset)}`, hit = cache.get(key);
  if (hit) { cache.delete(key); cache.set(key,hit); return hit; }
  const canvas = document.createElement('canvas');canvas.width=canvas.height=size;
  const ctx=canvas.getContext('2d');if(!ctx)throw new Error('Canvas 2D unavailable.');
  const model=buildBushModel(preset), random=rng(preset.seed ^ 0x423bd);
  ctx.scale(size,size);
  const paint=(mass:BushMass)=>{const stamp=foliageStamp(mass,preset,128);ctx.save();ctx.translate(mass.x,mass.y);ctx.rotate(mass.angle);ctx.drawImage(stamp,-mass.rx,-mass.ry,mass.rx*2,mass.ry*2);ctx.restore();};
  model.masses.filter(m=>!m.front).forEach(paint);
  model.branches.forEach(branch=>paintBranch(ctx,branch,random));
  model.masses.filter(m=>m.front).forEach(paint);
  model.fruit.forEach((point,i)=>paintFruit(ctx,point,preset.seed+i));
  cache.set(key,canvas);if(cache.size>12)cache.delete(cache.keys().next().value!);
  return canvas;
}
