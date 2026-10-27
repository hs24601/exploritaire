import {useEffect,useRef,useState} from 'react';
import {momentumSpiral} from '../momentumSpiral';
import {WebMomentumFlame,FLAME_STUDIES} from './WebMomentumFlame';
import {TidalHaloPaint,TIDAL_LAYERS,type TidalLayer} from './TidalHaloPaint';
import {MomentumIcon} from './MomentumIcon';
import {MomentumNumberFire} from './MomentumNumberFire';
import './MomentumDesignSandbox.css';

export const MOMENTUM_STUDIES=[
 {name:'Spiraling Ember',note:'Six connected warm coils, closest to the current ember.',rings:6,style:0},
 {name:'Ember Orbits',note:'Seven connected coils with a gently wandering center.',rings:7,style:1},
 {name:'Tidal Halo',note:'ImageGen watercolor · five registered amber, gold and burnt-orange spiral paths.',rings:5,style:2},
 {name:'Solar Bloom',note:'Six connected scalloped turns, opening like a painted sun.',rings:6,style:3},
 {name:'Ink Vortex',note:'Eight finer coils; dark red ink gathers into bright gold.',rings:8,style:4},
] as const;
const SIZE=360;
const clamp=(n:number)=>Math.max(0,Math.min(1,n));
const smooth=(n:number)=>{const t=clamp(n);return t*t*(3-2*t);};
// Stable multiscale pigment field, following the discovery reveal's noise-threshold
// and soft bleed method. Bake geometry and grain once; only alpha changes on fill.
const noise=(x:number,y:number,seed:number)=>{
 const hash=(a:number,b:number)=>{const n=Math.sin(a*127.1+b*311.7+seed*73.1)*43758.5453;return n-Math.floor(n);};
 const field=(scale:number)=>{const a=x/scale,b=y/scale,i=Math.floor(a),j=Math.floor(b),u=smooth(a-i),v=smooth(b-j);return (hash(i,j)*(1-u)+hash(i+1,j)*u)*(1-v)+(hash(i,j+1)*(1-u)+hash(i+1,j+1)*u)*v;};
 return field(28)*.55+field(9)*.3+field(2)*.15;
};
type Bake={rgba:Uint8ClampedArray;band:Int8Array;position:Float32Array;threshold:Float32Array;coverage:Float32Array;length:number;sketch:HTMLCanvasElement};
const cache=new Map<number,Bake>();
function bake(variant:number):Bake {
 const cached=cache.get(variant);if(cached)return cached;
 const study=MOMENTUM_STUDIES[variant],rgba=new Uint8ClampedArray(SIZE*SIZE*4),band=new Int8Array(SIZE*SIZE).fill(-1),threshold=new Float32Array(SIZE*SIZE),coverage=new Float32Array(SIZE*SIZE);
 const sketch=document.createElement('canvas');sketch.width=sketch.height=SIZE;const ctx=sketch.getContext('2d')!;const ink=ctx.createImageData(SIZE,SIZE);
 const path=momentumSpiral(study.rings,variant),position=new Float32Array(SIZE*SIZE),nearest=new Float32Array(SIZE*SIZE).fill(Infinity);
 const width=(150/study.rings)*(variant===2?.34:variant===4?.24:.28),reach=width+3;
 // Rasterize neighboring stamps along the single path once; keep the nearest
 // point's arc-length coordinate so the wet front cannot jump to another turn.
 for(let i=1;i<path.points.length;i++){
  const from=path.points[i-1],to=path.points[i],steps=Math.max(1,Math.ceil((to.distance-from.distance)/.65));
  for(let j=0;j<=steps;j++){
   const q=j/steps,cx=from.x+(to.x-from.x)*q,cy=from.y+(to.y-from.y)*q,d=from.distance+(to.distance-from.distance)*q;
   for(let y=Math.max(0,Math.floor(cy-reach));y<=Math.min(SIZE-1,Math.ceil(cy+reach));y++)for(let x=Math.max(0,Math.floor(cx-reach));x<=Math.min(SIZE-1,Math.ceil(cx+reach));x++){
    const p=y*SIZE+x,delta=(x-cx)**2+(y-cy)**2;if(delta>=nearest[p]||delta>reach*reach)continue;
    nearest[p]=delta;position[p]=d/path.length;band[p]=Math.min(study.rings-1,Math.floor((from.t+(to.t-from.t)*q)*study.rings));
   }
  }
 }
 for(let p=0;p<band.length;p++){
  if(band[p]<0)continue;const n=noise(p%SIZE,Math.floor(p/SIZE),variant+1),edge=1-smooth((Math.sqrt(nearest[p])-width+n*2)/3);
  coverage[p]=edge*(.58+n*.42);threshold[p]=n;
  const t=Math.sqrt(position[p]),granule=.7+n*.3;
  let color=[255,115+100*(1-t),42+85*(1-t)];
  if(variant===2&&t>.55)color=[106,189,186];
  if(variant===4)color=[232+23*(1-t),78+130*(1-t),47+65*(1-t)];
  if(variant===3)color=[255,153+69*(1-t),67+65*(1-t)];
  for(let c=0;c<3;c++)rgba[p*4+c]=color[c]*granule;
  ink.data[p*4]=180;ink.data[p*4+1]=165;ink.data[p*4+2]=132;ink.data[p*4+3]=edge*(.12+n*.14)*255;
 }
 ctx.putImageData(ink,0,0);const result={rgba,band,position,threshold,coverage,length:path.length,sketch};cache.set(variant,result);return result;
}
function PaintedMomentum({variant,value,capacity,numbers,size}:{variant:number;value:number;capacity:number;numbers:boolean;size:number}){
 const canvas=useRef<HTMLCanvasElement>(null);
 const buffers=useRef<{wash:HTMLCanvasElement;image:ImageData}|null>(null);
 useEffect(()=>{
  const ctx=canvas.current?.getContext('2d');if(!ctx)return;
  if(!buffers.current){const wash=document.createElement('canvas');wash.width=wash.height=SIZE;buffers.current={wash,image:ctx.createImageData(SIZE,SIZE)};}
  const {wash,image}=buffers.current;
  const b=bake(variant),rings=MOMENTUM_STUDIES[variant].rings,charge=clamp(value/capacity);
  image.data.set(b.rgba);
  for(let p=0;p<b.band.length;p++)if(b.band[p]>=0){const alpha=charge===0?0:charge===1?1:smooth((charge-b.position[p])*b.length/4+.5+(b.threshold[p]-.5)*.5);image.data[p*4+3]=255*b.coverage[p]*alpha;}
  ctx.clearRect(0,0,SIZE,SIZE);ctx.drawImage(b.sketch,0,0);
  wash.getContext('2d')!.putImageData(image,0,0);ctx.drawImage(wash,0,0);
  // A small ember/flame at the center ties each ring study to the existing motif.
  if(value>0){ctx.save();ctx.globalAlpha=smooth(Math.min(1,value/(capacity/rings)));ctx.translate(180,180);ctx.rotate(-.3);const glow=ctx.createRadialGradient(0,0,1,0,0,9);glow.addColorStop(0,'#fff3bd');glow.addColorStop(.5,'#f9bc68');glow.addColorStop(1,'#d76b2e00');ctx.fillStyle=glow;ctx.beginPath();ctx.arc(0,0,9,0,Math.PI*2);ctx.fill();ctx.restore();}
 },[variant,value,capacity]);
 return <div className="momentum-study__icon" style={{width:size,maxWidth:'100%'}}><canvas ref={canvas} width={SIZE} height={SIZE} role="img" aria-label={`${MOMENTUM_STUDIES[variant].name}: ${Math.floor(value)} of ${capacity} Momentum, continuous spiral watercolor fill`}/>{numbers&&<strong>{Math.floor(value)}</strong>}</div>;
}
export function MomentumDesignSandbox(){
 const [smoke,setSmoke]=useState(true);
 const [bloom,setBloom]=useState(true),[flameSeed,setFlameSeed]=useState(1);
 const [references,setReferences]=useState(false),[flameMotion,setFlameMotion]=useState(true),[energy,setEnergy]=useState(1),[webSelected,setWebSelected]=useState(0);
 const [painted,setPainted]=useState(false),[layer,setLayer]=useState<TidalLayer>('composite');
 const [value,setValue]=useState(0),[capacity]=useState(12),[selected,setSelected]=useState(2),[mode,setMode]=useState<'all'|'focus'>('all'),[numbers,setNumbers]=useState(true),[paper,setPaper]=useState(false),[running,setRunning]=useState(false),[decay,setDecay]=useState(true),[size,setSize]=useState(240);
 const target=useRef(0),shown=useRef(0),playing=useRef(false);
 const [motionRevision,wakeMotion]=useState(0);
 const reduced=useRef(window.matchMedia('(prefers-reduced-motion: reduce)').matches);
 const change=(n:number)=>{target.current=Math.max(0,Math.min(capacity*5,n));if(reduced.current){shown.current=target.current;setValue(target.current);}};
 useEffect(()=>{playing.current=running;},[running]);
 useEffect(()=>{
  if(!running&&!decay&&Math.abs(target.current-shown.current)<.001)return;
  let frame=0,last=performance.now(),painted=0;
  const step=(now:number)=>{const dt=Math.min(.1,(now-last)/1000);last=now;
   if(!document.hidden){if(playing.current)target.current=Math.min(capacity*5,target.current+dt*capacity/12);else if(decay)target.current=Math.max(0,target.current-dt*.375);
    shown.current+= (target.current-shown.current)*(1-Math.exp(-dt*7));if(Math.abs(shown.current-target.current)<.003)shown.current=target.current;
    if(now-painted>=33){setValue(shown.current);painted=now;}
    if(playing.current&&target.current>=capacity*5){playing.current=false;setRunning(false);}
   }
   if(playing.current || (decay&&target.current>0) || Math.abs(shown.current-target.current)>.003)frame=requestAnimationFrame(step);
   else {shown.current=target.current;setValue(target.current);}

  };frame=requestAnimationFrame(step);return()=>cancelAnimationFrame(frame);
 },[running,decay,capacity,motionRevision]);
 // Explicitly wake the animation: adding Number.EPSILON can round away once
 // the displayed value grows, leaving a changed target with no scheduled frame.
 const adjust=(n:number)=>{change(n);wakeMotion(revision=>revision+1);};
 const shownStudies=mode==='all'?MOMENTUM_STUDIES.map((_,i)=>i):[selected];
 return <main className="momentum-lab" data-paper={paper}><header><div><p>Exploritaire · design sandbox</p><h1>Momentum / living flame</h1><p>A hidden spiral guides growth. Flame tongues, torn ribbons and layered pigment bring it to life.</p></div><a href="?combatsbx&scenario=005">Combat sandbox ↗</a></header>
 <section className="momentum-lab__controls" aria-label="Momentum design controls"><label className="momentum-lab__slider">Momentum <output>{Math.floor(value)} / {capacity}{value>capacity?` · Overflow +${Math.floor(value-capacity)}`:''}</output><input aria-label="Momentum fill" type="range" min="0" max={capacity*5} step="0.05" value={value} onChange={e=>adjust(Number(e.target.value))}/></label><div className="momentum-lab__buttons">{[.25,1,3,6].map(n=><button key={n} onClick={()=>adjust(target.current+n)}>+{n}</button>)}<button onClick={()=>adjust(target.current-3)}>Spend 3</button><button onClick={()=>adjust(target.current-6)}>Spend 6</button><button onClick={()=>{setRunning(false);adjust(0);}}>Empty</button><button onClick={()=>adjust(capacity)}>Full</button><button onClick={()=>adjust(target.current+12)}>+12 overflow</button><button aria-pressed={running} onClick={()=>setRunning(v=>!v)}>{running?'Pause fill':'Play fill'}</button></div>
 <div className="momentum-lab__options"><label><input type="checkbox" checked={flameMotion} onChange={e=>setFlameMotion(e.target.checked)}/> Live flame motion</label><label>Flame energy <input aria-label="Flame energy" type="range" min="0.25" max="2" step="0.05" value={energy} onChange={e=>setEnergy(Number(e.target.value))}/></label><label><input type="checkbox" checked={references} onChange={e=>setReferences(e.target.checked)}/> Earlier paint studies</label>{references && <><label><input type="checkbox" checked={painted} onChange={e=>setPainted(e.target.checked)}/> ImageGen Tidal Halo</label><label>Paint layer <select aria-label="Tidal paint layer" value={layer} onChange={e=>setLayer(e.target.value as TidalLayer)}>{TIDAL_LAYERS.map(name=><option key={name}>{name}</option>)}</select></label></>}<span>Base range: 12 · overflow to 60</span><label><input type="checkbox" checked={bloom} onChange={e=>setBloom(e.target.checked)}/> Bloom overlap</label><label><input type="checkbox" checked={smoke} onChange={e=>setSmoke(e.target.checked)}/> Smoky billow</label><button onClick={()=>setFlameSeed(v=>v+1)}>Rekindle shape</button><label>Size <input aria-label="Icon size" type="range" min="96" max="320" step="8" value={size} onChange={e=>setSize(Number(e.target.value))}/>{size}px</label><label><input type="checkbox" checked={numbers} onChange={e=>setNumbers(e.target.checked)}/> Values</label><label><input type="checkbox" checked={decay} onChange={e=>setDecay(e.target.checked)}/> Decay</label><label><input type="checkbox" checked={paper} onChange={e=>setPaper(e.target.checked)}/> Light paper</label><button aria-pressed={mode==='all'} onClick={()=>setMode(mode==='all'?'focus':'all')}>{mode==='all'?'Focus selected':'Compare all four'}</button></div></section>
 <section className="momentum-lab__studies" aria-label="Flaming Momentum number"><article className="momentum-study"><h2>Omni Flames / living value</h2><div style={{width:size,height:size,maxWidth:'100%',margin:'auto'}}><MomentumNumberFire value={value} paused={!flameMotion} timeScale={energy}/></div><p>The current number is the scaffold. Curl-driven surface flames become drifting ash; zero stays unlit.</p><small>Adapted from your supplied flame lab · 112 surface particles · 30 fps</small></article></section>
 <section className="momentum-lab__studies momentum-lab__flames" data-mode={mode} aria-label="Live flame designs">{(mode==='all'?[0,1,2,3]:[webSelected]).map(i=><article key={i} className="momentum-study" data-selected={i===webSelected}><button className="momentum-study__select" aria-pressed={i===webSelected} onClick={()=>setWebSelected(i)}><span>0{i+1}</span><h2>{FLAME_STUDIES[i].name}</h2></button><WebMomentumFlame variant={i} value={value} capacity={capacity} size={size} numbers={numbers} animated={flameMotion} energy={energy} bloom={bloom} seed={flameSeed} smoke={smoke}/><p>{FLAME_STUDIES[i].note}</p><small>Live WebGL · capped resolution · 30 fps motion</small></article>)}</section>
 {references && <section className="momentum-lab__studies" data-mode={mode} aria-label="Momentum variants">{shownStudies.map(i=><article key={i} className="momentum-study" data-selected={i===selected}><button className="momentum-study__select" aria-pressed={i===selected} onClick={()=>setSelected(i)}><span>0{i+1}</span><h2>{MOMENTUM_STUDIES[i].name}</h2></button>{i===2&&painted?<TidalHaloPaint value={value} capacity={capacity} numbers={numbers} size={size} layer={layer}/>:<PaintedMomentum variant={i} value={value} capacity={capacity} numbers={numbers} size={size}/>}<p>{MOMENTUM_STUDIES[i].note}</p><small>{MOMENTUM_STUDIES[i].rings} connected turns · constant path-speed fill</small><div className="momentum-study__stages" aria-label="Ring fill levels">{Array.from({length:MOMENTUM_STUDIES[i].rings},(_,r)=><i key={r} data-filled={value/capacity>=momentumSpiral(MOMENTUM_STUDIES[i].rings,i).turnEnds[r]} data-active={value/capacity>(r===0?0:momentumSpiral(MOMENTUM_STUDIES[i].rings,i).turnEnds[r-1])&&value/capacity<momentumSpiral(MOMENTUM_STUDIES[i].rings,i).turnEnds[r]}/>)}</div></article>)}</section>}
 <footer><MomentumIcon/><div><strong>Current Spiraling Ember reference</strong><p>Ember Tongues is now the combat sandbox gauge. This lab retains all four designs for comparison. Four web-rendered studies use local procedural noise, irregular flame edges and a hidden fill path. Motion pauses offscreen; reduced motion keeps a still flame. Temperature-inspired colors are an art cue, not a combustion simulation. Earlier paint studies remain available for comparison.</p></div></footer></main>;
}
