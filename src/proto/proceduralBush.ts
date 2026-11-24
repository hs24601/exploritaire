/** Code-only watercolor experiment. The v1 module is deliberately frozen for
 * same-preset comparisons; no reference pixels enter either renderer. */
import { buildBushModel, DEFAULT_BUSH, parseBushPreset, type BushPreset, type BushMass, type BushBranch } from './proceduralBushBaseline';
export { buildBushModel, DEFAULT_BUSH, parseBushPreset } from './proceduralBushBaseline';
export type { BushPreset, BushMass, BushBranch, BushModel } from './proceduralBushBaseline';
export const BUSH_RENDERER_VERSION = 'bush-study-v2';
const TAU = Math.PI * 2;
const clamp = (n: number, low = 0, high = 1) => Math.max(low, Math.min(high, n));
const smooth = (a: number, b: number, x: number) => { const t = clamp((x-a)/(b-a)); return t*t*(3-2*t); };
function rng(seed: number) { let s=seed>>>0; return () => { s=(Math.imul(s,1664525)+1013904223)>>>0; return s/4294967296; }; }
function noise(cells: number, random: () => number) {
  const width=cells+1, values=Float32Array.from({length:width*width},random);
  return (x: number,y: number) => {
    const px=clamp(x)*cells,py=clamp(y)*cells,ix=Math.min(cells-1,Math.floor(px)),iy=Math.min(cells-1,Math.floor(py));
    const u=smooth(0,1,px-ix),v=smooth(0,1,py-iy),at=iy*width+ix;
    return (values[at]*(1-u)+values[at+1]*u)*(1-v)+(values[at+width]*(1-u)+values[at+width+1]*u)*v;
  };
}
function canvas(size: number) {
  const c=document.createElement('canvas'); c.width=c.height=size;
  const ctx=c.getContext('2d'); if(!ctx)throw new Error('Canvas 2D unavailable.');
  return {c,ctx};
}

type Leaf = {x:number;y:number;dx:number;dy:number;length:number;width:number;bend:number;light:number;phase:number};
// A wet brush pulled away from its base: a broad shoulder, bent center and
// tapered tip. Lookup tables keep the inner raster loop free of trig/powers.
const profile=Float32Array.from({length:256},(_,i)=>Math.sin(i/255*Math.PI)**.53*(1.08-i/255*.25));
const bow=Float32Array.from({length:256},(_,i)=>4*(i/255)*(1-i/255));
function foliageStamp(mass: BushMass,preset: Readonly<BushPreset>,size: number) {
  const {c,ctx}=canvas(size),random=rng(mass.seed^0x5ae713),broad=noise(5,random),deposit=noise(22,random),paper=noise(113,random);
  const leaves:Leaf[]=[];
  // Unequal fan strokes, with a couple of hanging leaves. The lower strokes
  // remain cooler; the upper strokes break into separate lit planes.
  const angles=[2.55, .65, -2.75, -1.67, -.53];
  for(let i=0;i<angles.length;i++) {
    const a=angles[i]+(random()-.5)*.5,dx=Math.cos(a),dy=Math.sin(a),length=.39+random()*.14;
    leaves.push({x:.5+(random()-.5)*.12,y:.54+(random()-.5)*.1,dx,dy,length,
      width:.135+random()*.05,bend:(random()-.5)*.13,
      light:clamp(mass.light+(i<2?-.1:.04)+(random()-.5)*.32+(mass.light>.18&&mass.light<.5&&i===2?.28:0)),phase:random()*TAU});
  }
  const image=ctx.createImageData(size,size),rgba=image.data;
  const temperature=smooth(.38,.76,mass.light),dark=[22,61,52];
  const mid=[52+temperature*(10+preset.warmth*25),103+temperature*preset.warmth*16,86-temperature*(13+preset.warmth*16)];
  const light=[119+temperature*(62+preset.warmth*43),166+temperature*(27+preset.warmth*28),141-temperature*(42+preset.warmth*29)];
  const field=new Float32Array(size*size*3);
  for(let i=0;i<size*size;i++){
    const u=(i%size)/(size-1),v=Math.floor(i/size)/(size-1);
    field[i*3]=broad(u,v);field[i*3+1]=deposit(u,v);field[i*3+2]=paper(u,v);
  }
  for(const leaf of leaves) {
    const widths=Float32Array.from(profile,(w,i)=>leaf.width*w*(1+Math.sin(i/255*13+leaf.phase)*.065));
    const tipX=leaf.x+leaf.dx*leaf.length,tipY=leaf.y+leaf.dy*leaf.length;
    const reach=leaf.width+Math.abs(leaf.bend)+.03;
    const minX=Math.max(0,Math.floor((Math.min(leaf.x,tipX)-reach)*size)),maxX=Math.min(size-1,Math.ceil((Math.max(leaf.x,tipX)+reach)*size));
    const minY=Math.max(0,Math.floor((Math.min(leaf.y,tipY)-reach)*size)),maxY=Math.min(size-1,Math.ceil((Math.max(leaf.y,tipY)+reach)*size));
    for(let y=minY;y<=maxY;y++)for(let x=minX;x<=maxX;x++) {
      const u=x/(size-1)-leaf.x,v=y/(size-1)-leaf.y,t=(u*leaf.dx+v*leaf.dy)/leaf.length;
      if(t<=0||t>=1)continue;
      const lut=Math.min(255,Math.floor(t*255)),cross=-u*leaf.dy+v*leaf.dx-leaf.bend*bow[lut];
      const f=(y*size+x)*3,b=field[f],p=field[f+1],g=field[f+2];
      // Medium-scale raggedness follows the edge. It does not turn every leaf
      // into a noisy star, and brush=0 still preserves the directional form.
      const edge=widths[lut]+(p-.5)*(.008+preset.brush*.039)+(g-.5)*preset.brush*.015-Math.abs(cross);
      const alpha=smooth(-.003-preset.brush*.008,.008,edge)*(.93+g*.07);
      if(alpha<.002)continue;
      const side=cross/leaf.width;
      const wet=smooth(.36,.73,b)*smooth(.12,.45,t)*(1-smooth(.65,1,t));
      const rim=(1-smooth(.002,.018,edge))*smooth(.28,.7,p);
      let value=clamp(leaf.light+(t-.5)*.12+(b-.5)*.34+(p-.5)*.095+wet*.12-rim*.105);
      // A broken broad fold, rather than a drawn vein or spherical gradient.
      value=clamp(value-smooth(-.15,.55,side)*smooth(.8,.3,b)*.16);
      const grain=(g-.5)*(12+preset.brush*29),index=(y*size+x)*4;
      const oldAlpha=rgba[index+3]/255,outAlpha=alpha+oldAlpha*(1-alpha);
      for(let k=0;k<3;k++) {
        let color=value<.48?dark[k]+(mid[k]-dark[k])*value/.48:mid[k]+(light[k]-mid[k])*(value-.48)/.52;
        color+=grain*(k===2?.75:1);
        rgba[index+k]=(color*alpha+rgba[index+k]*oldAlpha*(1-alpha))/outAlpha;
      }
      rgba[index+3]=outAlpha*255;
    }
  }
  ctx.putImageData(image,0,0);return c;
}

type WoodSample={x:number;y:number;nx:number;ny:number;w:number};
function branchSamples(branch:BushBranch,random:()=>number):WoodSample[] {
  const {start,bend,end,width}=branch,phase=random()*TAU;
  return Array.from({length:45},(_,i)=>{
    const t=i/44,a=1-t,dx=2*a*(bend.x-start.x)+2*t*(end.x-bend.x),dy=2*a*(bend.y-start.y)+2*t*(end.y-bend.y);
    const length=Math.hypot(dx,dy)||1,nx=-dy/length,ny=dx/length;
    const sway=Math.sin(t*Math.PI)*Math.sin(t*8+phase)*width*.8;
    return {x:a*a*start.x+2*a*t*bend.x+t*t*end.x+nx*sway,y:a*a*start.y+2*a*t*bend.y+t*t*end.y+ny*sway,nx,ny,
      w:width*(1-t*.88)*(.87+Math.sin(t*13+phase)*.12+Math.sin(t*29+phase)*.055)};
  });
}
function woodRibbon(ctx:CanvasRenderingContext2D,samples:WoodSample[],lo:number,hi:number,phase:number,taper=false) {
  ctx.beginPath();
  const center=(lo+hi)/2,half=(hi-lo)/2;
  const amount=(i:number,side:number)=>center+side*(half+Math.sin(i*.4+phase)*.07)*(taper?Math.sin(i/(samples.length-1)*Math.PI)**.65:1);
  samples.forEach((p,i)=>{const n=amount(i,-1),x=p.x+p.nx*p.w*n,y=p.y+p.ny*p.w*n;i?ctx.lineTo(x,y):ctx.moveTo(x,y);});
  [...samples].reverse().forEach((p,i)=>{const n=amount(samples.length-1-i,1);ctx.lineTo(p.x+p.nx*p.w*n,p.y+p.ny*p.w*n);});
  ctx.closePath();ctx.fill();
}
function woodyCanvas(model:ReturnType<typeof buildBushModel>,seed:number,size:number,brush:number) {
  const {c,ctx}=canvas(size),random=rng(seed^0x423bd);ctx.scale(size,size);
  model.branches.forEach(branch=>{
    const samples=branchSamples(branch,random),phase=random()*TAU;
    ctx.save();
    ctx.fillStyle='#4b3935';woodRibbon(ctx,samples,-1,1,phase);ctx.clip();
    ctx.fillStyle='#765d45';woodRibbon(ctx,samples,-.73,.72,phase+1.3);
    ctx.fillStyle='#a38a5e45';woodRibbon(ctx,samples,-.48,.18,phase+2.1);
    // Bark is chipped across the branch, with unequal long warm planes and
    // shorter cool seams. Neither a flat ribbon nor regular parallel rails.
    for(let j=0;j<11;j++) {
      const from=2+Math.floor(random()*31),length=4+Math.floor(random()*10),portion=samples.slice(from,from+length);
      const side=random()*1.2-.6;
      ctx.fillStyle=j%3?'#b29c74ae':'#292d3896';woodRibbon(ctx,portion,side,side+.3+random()*.65,random()*TAU,true);
    }
    for(let j=0;j<4;j++) {
      const from=Math.floor(random()*28),portion=samples.slice(from,from+8+Math.floor(random()*10));
      const side=(random()-.5)*1.3;ctx.beginPath();
      portion.forEach((p,i)=>{const n=side+Math.sin(i*.6+phase)*.15,x=p.x+p.nx*p.w*n,y=p.y+p.ny*p.w*n;i?ctx.lineTo(x,y):ctx.moveTo(x,y);});
      ctx.strokeStyle='#302a345c';ctx.lineWidth=.0013;ctx.stroke();
    }
    for(let j=0;j<3;j++) {
      const p=samples[6+Math.floor(random()*29)];
      ctx.fillStyle=j%2?'#c2aa7970':'#302d407d';ctx.beginPath();
      ctx.ellipse(p.x+p.nx*p.w*.4,p.y+p.ny*p.w*.4,p.w*.5,p.w*(.8+random()),Math.atan2(p.ny,p.nx),0,TAU);ctx.fill();
    }
    ctx.restore();
  });
  // The forks meet in an uneven dark root collar, with a short broken plane
  // of exposed wood. This avoids a fan of bright rails ending in a sharp V.
  ctx.fillStyle='#504134';ctx.beginPath();ctx.moveTo(.48,.886);ctx.bezierCurveTo(.493,.891,.506,.883,.52,.887);ctx.lineTo(.515,.902);ctx.quadraticCurveTo(.5,.914,.487,.901);ctx.closePath();ctx.fill();
  ctx.fillStyle='#96816093';ctx.beginPath();ctx.moveTo(.49,.889);ctx.lineTo(.502,.89);ctx.lineTo(.507,.905);ctx.lineTo(.497,.902);ctx.closePath();ctx.fill();
  ctx.resetTransform();
  const pixels=ctx.getImageData(0,0,size,size),broad=noise(19,random),paper=noise(170,random);
  for(let y=0;y<size;y++)for(let x=0;x<size;x++) {
    const at=(y*size+x)*4;if(!pixels.data[at+3])continue;
    const b=broad(x/size,y/size),g=paper(x/size,y/size),variation=(b-.5)*37+(g-.5)*(12+brush*25);
    for(let k=0;k<3;k++)pixels.data[at+k]+=variation*(k===2?.7:1);
    // Dry broken exterior pigment only on the antialiased margin.
    if(pixels.data[at+3]<240)pixels.data[at+3]*=.75+g*.25;
  }
  ctx.putImageData(pixels,0,0);return c;
}

function fruitStamp(seed:number,size=112) {
  const {c,ctx}=canvas(size),random=rng(seed^0x213e7),broad=noise(5,random),deposit=noise(21,random),paper=noise(81,random);
  const bumps=Array.from({length:9},(_,i)=>({a:i/9*TAU+(random()-.5)*.27,w:.15+random()*.14,h:.04+random()*.065}));
  const rim=Float32Array.from({length:512},(_,i)=>{
    const a=i/512*TAU;
    let r=.85+Math.sin(a*3+1)*.025;
    for(const bump of bumps){const d=Math.atan2(Math.sin(a-bump.a),Math.cos(a-bump.a));r+=bump.h*Math.exp(-((d/bump.w)**2));}
    return r;
  });
  const image=ctx.createImageData(size,size);
  for(let y=0;y<size;y++)for(let x=0;x<size;x++) {
    const u=x/(size-1),v=y/(size-1),px=(u-.5)/.46,py=(v-.5)/.46,r=Math.hypot(px,py);
    const a=(Math.atan2(py,px)+TAU)%TAU,b=broad(u,v),p=deposit(u,v),g=paper(u,v);
    const edge=rim[Math.floor(a/TAU*512)]+(p-.5)*.04+(g-.5)*.016-r;
    const alpha=smooth(-.012,.015,edge);if(!alpha)continue;
    const light=clamp(.68-px*.28-py*.35-r*.16+(b-.5)*.48+(p-.5)*.13);
    const bloom=Math.exp(-(((px+.32)/.45)**2+((py+.43)/.37)**2))*.4;
    const lobe=Math.sin(a*7+r*3)*.055*(.3+r*.7);
    const value=clamp(light+bloom+lobe-(1-smooth(.015,.12,edge))*.09);
    const dark=[72,15,49],mid=[184,17,81],bright=[255,153,195];
    const at=(y*size+x)*4;
    for(let k=0;k<3;k++)image.data[at+k]=(value<.55?dark[k]+(mid[k]-dark[k])*value/.55:mid[k]+(bright[k]-mid[k])*(value-.55)/.45)+(g-.5)*31;
    image.data[at+3]=alpha*(248+g*7);
  }
  ctx.putImageData(image,0,0);return c;
}

const cache=new Map<string,HTMLCanvasElement>();
export function proceduralBushCanvas(preset:Readonly<BushPreset>=DEFAULT_BUSH,size=512):HTMLCanvasElement {
  parseBushPreset(preset);
  if(!Number.isInteger(size)||size<128||size>768)throw new Error('Bush raster must be 128–768 pixels.');
  const key=`${BUSH_RENDERER_VERSION}:${size}:${JSON.stringify(preset)}`,hit=cache.get(key);
  if(hit){cache.delete(key);cache.set(key,hit);return hit;}
  const {c,ctx}=canvas(size),model=buildBushModel(preset),resolution=clamp(Math.ceil(size*.25),80,192);
  const stamps=new Map<BushMass,HTMLCanvasElement>();
  ctx.scale(size,size);
  const paint=(mass:BushMass)=>{
    let stamp=stamps.get(mass);if(!stamp){stamp=foliageStamp(mass,preset,resolution);stamps.set(mass,stamp);}
    ctx.save();ctx.translate(mass.x,mass.y);ctx.rotate(mass.angle);
    ctx.drawImage(stamp,-mass.rx,-mass.ry,mass.rx*2,mass.ry*2);ctx.restore();
  };
  model.masses.filter(m=>!m.front).forEach(paint);
  ctx.drawImage(woodyCanvas(model,preset.seed,size,preset.brush),0,0,1,1);
  // Authored occlusion makes the high yellow planes cross the cool hanging
  // foliage, instead of every later dark stamp hiding those foreground planes.
  // Repainting rear crown stamps also buries branch tips inside their leaves.
  for(const index of [7,8,14,0,2,9,10,11,4,5,6,13,1,3,12])paint(model.masses[index]);
  model.fruit.forEach((point,i)=>{
    const r=.051,glow=ctx.createRadialGradient(point.x,point.y,r*.5,point.x,point.y,r*1.8);
    glow.addColorStop(0,'#a4e7ff40');glow.addColorStop(.5,'#70baff16');glow.addColorStop(1,'#80ceff00');
    ctx.fillStyle=glow;ctx.fillRect(point.x-r*1.8,point.y-r*1.8,r*3.6,r*3.6);
    ctx.drawImage(fruitStamp(preset.seed+i),point.x-r*1.18,point.y-r*1.18,r*2.36,r*2.36);
  });
  cache.set(key,c);if(cache.size>12)cache.delete(cache.keys().next().value!);return c;
}
