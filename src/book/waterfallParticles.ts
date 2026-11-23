import * as THREE from 'three';
import {seeded} from './castlePaint';

export interface FallingStroke {x:number;y:number;vy:number;width:number;height:number;ink:number;active:boolean}
interface Bubble {x:number;y:number;radius:number;age:number;active:boolean}

/** Continuous-time version of the supplied gravity emitter. Positions use
 * canvas pixels, with acceleration converted from metres/second squared. */
export function advanceFallingStroke(p:FallingStroke,dt:number,gravity:number,floor:number){
  p.y+=p.vy*dt+.5*gravity*dt*dt;p.vy+=gravity*dt;
  return p.y+p.height>=floor;
}

export class WaterfallParticles {
  readonly particles:FallingStroke[];
  readonly bubbles:Bubble[];
  readonly gravity:number;
  readonly rate:number;
  private random:()=>number;
  private emission=0;
  private bubbleIndex=0;
  constructor(readonly width:number,readonly height:number,worldHeight:number,low=false,seed=12072){
    this.gravity=9.8*height/worldHeight;this.rate=low?45:85;this.random=seeded(seed);
    this.particles=Array.from({length:low?160:320},()=>({x:0,y:0,vy:0,width:0,height:0,ink:0,active:false}));
    this.bubbles=Array.from({length:low?24:48},()=>({x:0,y:0,radius:0,age:0,active:false}));
  }
  step(dt:number){
    for(const b of this.bubbles)if(b.active){b.age+=dt;if(b.age>=.65)b.active=false;}
    for(const p of this.particles)if(p.active&&advanceFallingStroke(p,dt,this.gravity,this.height-10)){
      p.active=false;
      const b=this.bubbles[this.bubbleIndex++%this.bubbles.length];
      Object.assign(b,{x:p.x,y:this.height-7-this.random()*6,radius:1+this.random()*4,age:0,active:true});
    }
    this.emission+=dt*this.rate;
    const count=Math.floor(this.emission);this.emission-=count;
    let born=0;
    for(const p of this.particles){if(born>=count)break;if(p.active)continue;
      const width=.7+this.random()*9,height=4+this.random()*this.height*.15;
      Object.assign(p,{x:9+width*.5+this.random()*(this.width-18-width),y:-height,vy:0,width,height,ink:.04+this.random()*.05,active:true});born++;
    }
  }
}

/** Small, private alpha canvas per drop. Paint/palette is supplied by the river
 * shader; the canvas carries only the supplied emitter's strokes and bubbles.
 * No independent RAF, unbounded arrays, readbacks, or screen-space overlay. */
export function createWaterfallFlow(worldHeight:number,low=false,seed=12072){
  const canvas=document.createElement('canvas');canvas.width=128;canvas.height=worldHeight>20?256:128;
  const ctx=canvas.getContext('2d')!;
  const model=new WaterfallParticles(canvas.width,canvas.height,worldHeight,low,seed);
  const brush=document.createElement('canvas');brush.width=48;brush.height=128;
  const paint=brush.getContext('2d')!;
  // Broad overlapping, feathered, round-capped dabs; no fine digital grain.
  paint.lineCap='round';paint.shadowColor='rgba(255,255,255,.18)';paint.shadowBlur=4;
  for(let i=0;i<3;i++){
    const gradient=paint.createLinearGradient(0,0,0,128);
    gradient.addColorStop(0,'transparent');gradient.addColorStop(.22,'rgba(255,255,255,.34)');
    gradient.addColorStop(.72,'rgba(255,255,255,.55)');gradient.addColorStop(1,'transparent');
    paint.strokeStyle=gradient;paint.lineWidth=22-i*4;
    paint.beginPath();paint.moveTo(22+i*2,17);paint.quadraticCurveTo(26-i,62,23+i,110);paint.stroke();
  }
  const foam=document.createElement('canvas');foam.width=foam.height=32;
  const foamPaint=foam.getContext('2d')!,foamWash=foamPaint.createRadialGradient(16,16,0,16,16,16);
  foamWash.addColorStop(0,'rgba(255,255,255,.5)');foamWash.addColorStop(.5,'rgba(255,255,255,.25)');foamWash.addColorStop(1,'transparent');
  foamPaint.fillStyle=foamWash;foamPaint.fillRect(0,0,32,32);
  const texture=new THREE.CanvasTexture(canvas);texture.generateMipmaps=false;
  texture.minFilter=texture.magFilter=THREE.LinearFilter;texture.name=`waterfall-particle-alpha-${seed}`;
  let last:number|undefined,disposed=false;
  function tick(dt:number){
    model.step(dt);
    // Frame-rate independent equivalent of destination-out .06 at 60 Hz.
    ctx.globalCompositeOperation='destination-out';ctx.globalAlpha=1-Math.pow(.94,dt*60);
    ctx.fillStyle='white';ctx.fillRect(0,0,canvas.width,canvas.height);
    ctx.globalCompositeOperation='lighter';
    for(const p of model.particles)if(p.active){
      ctx.globalAlpha=p.ink*dt*60;
      ctx.drawImage(brush,p.x-p.width,p.y,p.width*2,p.height);
    }
    for(const b of model.bubbles)if(b.active){
      const fade=1-b.age/.65;
      const radius=b.radius*(1+b.age*2);
      ctx.globalAlpha=.06*fade*dt*60;
      ctx.drawImage(foam,b.x-radius,b.y-b.radius*.5,radius*2,b.radius);
    }
    ctx.globalAlpha=1;ctx.globalCompositeOperation='source-over';
  }
  // A filled, deterministic still at startup also serves reduced motion.
  for(let i=0;i<120;i++)tick(1/30);
  return {texture,model,update(seconds:number){
    if(disposed)return;
    if(last===undefined){last=seconds;return;}
    const dt=seconds-last;
    if(dt<1/(low?20:30))return;
    last=seconds;
    // A hidden tab or paused game resumes without a burst or catch-up loop.
    if(dt>.25)return;
    tick(dt);texture.needsUpdate=true;
  },dispose(){disposed=true;texture.dispose();canvas.width=canvas.height=brush.width=brush.height=foam.width=foam.height=1;}};
}
