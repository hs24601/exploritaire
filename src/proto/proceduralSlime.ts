import * as THREE from 'three';
import type { DirectionalFrame, DirectionalSpriteDefinition } from './directionalSprites';

/** QvEbVZ-inspired overlapping stamp masks, using original generated pigment.
 * Bake pigment once; a shader continuously spreads and dissolves its boundary. */
export function createProceduralSlime() {
  const size = 384;
  const canvas = document.createElement('canvas'); canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  let seed = 81723;
  const random = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
  const smooth = (a: number, b: number, x: number) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
  const grid = (n: number) => {
    const values = Array.from({ length: (n + 1) ** 2 }, random);
    return (x: number, y: number) => {
      const px = Math.max(0, Math.min(n - .001, x * n)), py = Math.max(0, Math.min(n - .001, y * n));
      const ix = Math.floor(px), iy = Math.floor(py), u = smooth(0, 1, px - ix), v = smooth(0, 1, py - iy);
      const at = (dx: number, dy: number) => values[(iy + dy) * (n + 1) + ix + dx];
      return (at(0, 0) * (1 - u) + at(1, 0) * u) * (1 - v) + (at(0, 1) * (1 - u) + at(1, 1) * u) * v;
    };
  };
  const broad = grid(8), broken = grid(34), paper = grid(149);
  // Pigment covers the full local field. No fixed body mask survives underneath
  // the shader's changing coverage, so new spreading lobes also contain paint.
  const image = ctx.createImageData(size, size);
  const palette = [[172,143,218], [95,75,184], [37,24,91], [129,105,200], [55,39,120]];
  const stamps = Array.from({ length: 26 }, (_, i) => {
    const angle = random() * Math.PI;
    return { x: .13 + random() * .74, y: .37 + random() * .53, rx: .10 + random() * .21, ry: .06 + random() * .16,
      c: Math.cos(angle), s: Math.sin(angle), color: palette[i % palette.length], load: .23 + random() * .32, water: random() };
  });
  // Large deposited masses keep the paint readable at gameplay scale. These
  // are spatial pigment loads, with noise breaking their wet boundaries.
  const masses = [
    {x:.31,y:.55,rx:.14,ry:.18,color:[172,143,226],load:.80},
    {x:.48,y:.51,rx:.12,ry:.12,color:[122,99,208],load:.65},
    {x:.58,y:.69,rx:.15,ry:.23,color:[20,12,68],load:.85},
    {x:.40,y:.77,rx:.14,ry:.14,color:[35,22,104],load:.75},
    {x:.22,y:.82,rx:.10,ry:.07,color:[142,114,220],load:.72},
    {x:.73,y:.83,rx:.12,ry:.08,color:[107,79,193],load:.68},
  ];
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const u = x / size, v = y / size, i = (y * size + x) * 4;
    const b = broad(u, v), e = broken(u, v), p = paper(u, v);
    const a = smooth(0,.04,Math.min(u,v,1-u,1-v));
    if (!a) continue;
    let color = [75+b*37, 55+b*29, 135+b*49];
    const mix = (paint: number[], amount: number) => { const t = Math.max(0,Math.min(1,amount)); color = color.map((c,k) => c*(1-t)+paint[k]*t); };
    for (const stamp of stamps) {
      const dx = u-stamp.x, dy = v-stamp.y;
      const radius = Math.hypot((dx*stamp.c+dy*stamp.s)/stamp.rx, (-dx*stamp.s+dy*stamp.c)/stamp.ry);
      const d = 1 + (b-.5)*.65 + (e-.5)*.22 - radius;
      const coverage = smooth(-.055,.11,d);
      if (!coverage) continue;
      // Clear watery centers and irregular dark tidal rims shape each wash.
      const rim = Math.exp(-Math.pow((d-.065)/.045,2))*(.3+e*.7);
      const bloom = Math.exp(-radius*radius*5)*(.4+stamp.water*.6);
      mix(stamp.color,coverage*stamp.load*(1-bloom*.65)); mix([30,19,78],rim*.25);
    }
    for (const mass of masses) {
      const r=Math.hypot((u-mass.x)/mass.rx,(v-mass.y)/mass.ry);
      const d=1+(b-.5)*.8+(e-.5)*.20-r;
      mix(mass.color,smooth(-.07,.19,d)*mass.load);
      mix([30,18,83],Math.exp(-(((d-.04)/.045)**2))*(.08+e*.15));
    }
    // Paint broad light-facing planes and a deep flank to give the mass volume.
    const shoulder = Math.exp(-(((u-.37)/.18)**2 + ((v-.47)/.13)**2));
    mix([187,164,224],shoulder*smooth(.23,.73,b+e*.24)*.75);
    mix([22,14,60],smooth(.45,.83,u+(b-.5)*.27)*smooth(.4,.9,v)*.56);
    // Sediment accumulates sparsely in paper valleys; no uniform grain veil.
    mix([29,19,72],smooth(.43,.19,p)*smooth(.35,.75,e)*.12);
    for(let k=0;k<3;k++) image.data[i+k]=color[k];
    image.data[i+3]=a*255;
  }
  ctx.putImageData(image,0,0);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace=THREE.SRGBColorSpace; texture.generateMipmaps=false;
  texture.minFilter=texture.magFilter=THREE.LinearFilter; texture.userData.watercolor=true;
  const frame: DirectionalFrame={id:'procedural-wash',source:'proceduralSlime',parts:[{id:'body',rect:[0,0,size,size],x:0,y:.5,height:1,depth:0,pivot:[.5,0]}]};
  const definition: DirectionalSpriteDefinition={id:'procedural-slime',motion:'slime',low:Array(5).fill(frame),high:Array(5).fill(frame),top:frame};
  const clock = { value: 0 };
  return {texture,definition,get time(){return clock.value;},update:(seconds:number,reduced:boolean)=>{clock.value=reduced?0:seconds;},dispose:()=>texture.dispose()};
}
