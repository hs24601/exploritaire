import { useEffect, useState } from 'react';
import { BUSH_RENDERER_VERSION, DEFAULT_BUSH, parseBushPreset, proceduralBushCanvas, type BushPreset } from '../proto/proceduralBush';
import { BUSH_RENDERER_VERSION as BASELINE_VERSION, proceduralBushCanvas as baselineBushCanvas } from '../proto/proceduralBushBaseline';
import { BUSH_PAINTER_VERSION, paintedBushCanvas } from '../proto/bushPainter';
import { radialDabCanvas } from '../proto/radialDabs';
import { loadMediaImage } from '../proto/mediaCache';
import './WatercolorLab.css';
import './BushLab.css';

const base = import.meta.env.BASE_URL;
const controls = {
  fullness: { label: 'Crown fullness', min: 0, max: 1 }, spread: { label: 'Crown spread', min: .65, max: 1.25 },
  brush: { label: 'Wet brush edges', min: 0, max: 1 }, warmth: { label: 'Olive / yellow warmth', min: 0, max: 1 },
} as const;
function initial() { try { return parseBushPreset(JSON.parse(localStorage.getItem('exploritaire.bush-study.v1') ?? 'null')); } catch { return { ...DEFAULT_BUSH }; } }
function exportFile(name: string, href: string) { const link = document.createElement('a'); link.download=name;link.href=href;link.click(); }
function canvas(size=512) { const c=document.createElement('canvas');c.width=c.height=size;return c; }
function referenceCanvas(image: HTMLImageElement) {
  const scan=canvas();scan.width=image.naturalWidth;scan.height=image.naturalHeight;
  const scanCtx=scan.getContext('2d')!;scanCtx.drawImage(image,0,0);
  const pixels=scanCtx.getImageData(0,0,scan.width,scan.height).data;
  let left=scan.width,top=scan.height,right=0,bottom=0;
  for(let y=0;y<scan.height;y++)for(let x=0;x<scan.width;x++)if(pixels[(y*scan.width+x)*4+3]>16){left=Math.min(left,x);right=Math.max(right,x);top=Math.min(top,y);bottom=Math.max(bottom,y);}
  const result=canvas(),ctx=result.getContext('2d')!;
  const w=right-left+1,h=bottom-top+1,scale=Math.min(512*.86/w,512*.78/h);
  ctx.drawImage(image,left,top,w,h,(512-w*scale)/2,512*.9-h*scale,w*scale,h*scale);return result;
}
function scene(cutout: HTMLCanvasElement) {
  const c=canvas(),ctx=c.getContext('2d')!;
  const sky=ctx.createLinearGradient(0,0,0,360);sky.addColorStop(0,'#4f6265');sky.addColorStop(1,'#2c3c39');ctx.fillStyle=sky;ctx.fillRect(0,0,512,512);
  ctx.fillStyle='#343f31';ctx.beginPath();ctx.moveTo(0,295);ctx.quadraticCurveTo(300,334,512,294);ctx.lineTo(512,512);ctx.lineTo(0,512);ctx.fill();
  const soil=ctx.createLinearGradient(0,305,0,512);soil.addColorStop(0,'#5b5035');soil.addColorStop(1,'#3d392b');ctx.fillStyle=soil;ctx.fillRect(0,333,512,179);
  const wash=radialDabCanvas('dirt');
  if(wash){ctx.globalAlpha=.8;for(let i=0;i<8;i++)ctx.drawImage(wash,(i%4)*170-100,300+Math.floor(i/4)*95,260,130);ctx.globalAlpha=1;}
  const shadow=ctx.createRadialGradient(256,461,8,256,461,125);shadow.addColorStop(0,'#121e1890');shadow.addColorStop(1,'#121e1800');ctx.save();ctx.translate(0,330);ctx.scale(1,.3);ctx.fillStyle=shadow;ctx.fillRect(80,330,350,260);ctx.restore();
  ctx.drawImage(cutout,0,0);return c;
}
export function BushLab() {
  const [preset,setPreset]=useState<BushPreset>(initial),[surface,setSurface]=useState('scene');
  const [renderer,setRenderer]=useState(BUSH_PAINTER_VERSION);
  const [paintedRenderer,setPaintedRenderer]=useState('');
  const [paintedSurface,setPaintedSurface]=useState('');
  const generate=renderer===BASELINE_VERSION?baselineBushCanvas:renderer===BUSH_PAINTER_VERSION?paintedBushCanvas:proceduralBushCanvas;
  const [images,setImages]=useState<string[]>([]),[variants,setVariants]=useState<{seed:number;src:string}[]>([]);
  const [busy,setBusy]=useState(true),[message,setMessage]=useState('Preparing bush comparison…'),[error,setError]=useState('');
  useEffect(()=>{
    let active=true;setBusy(true);
    const timer=window.setTimeout(async()=>{
      try{
        const original=referenceCanvas(await loadMediaImage(`${base}assets/runtime/environment/watercolor/v1/manaberry-sparse-standee-v1.png`));
        const started=performance.now(),generated=generate(preset),elapsed=performance.now()-started;
        const cacheStart=performance.now();const cached=generate(preset);const cacheMs=performance.now()-cacheStart;
        if(cached!==generated)throw new Error('Bush cache did not reuse its texture.');
        const render=surface==='scene'?scene:(c:HTMLCanvasElement)=>c;
        if(!active)return;
        setImages([render(original).toDataURL(),render(generated).toDataURL()]);setPaintedRenderer(renderer);setPaintedSurface(surface);
        setMessage(`512px bush: ${elapsed.toFixed(1)} ms draw · ${cacheMs.toFixed(2)} ms cached. Static result; prototype only.`);setError('');
        const next=[];
        for(let i=0;i<6;i++){
          await new Promise(resolve=>window.setTimeout(resolve,0));if(!active)return;
          const seed=(81723+i)>>>0,small=canvas(128),ctx=small.getContext('2d')!;
          ctx.drawImage(render(generate({...preset,seed})),0,0,128,128);next.push({seed,src:small.toDataURL()});
        }
        if(active){setVariants(next);try{localStorage.setItem('exploritaire.bush-study.v1',JSON.stringify(preset));}catch{}}
      }catch(reason){if(active)setError(reason instanceof Error?reason.message:'Unable to render the bush study.');}
      finally{if(active)setBusy(false);}
    },120);
    return()=>{active=false;window.clearTimeout(timer);};
  },[preset,surface,renderer,generate]);
  return <main className="watercolor-lab bush-study">
    <header><div><h1>Procedural bush study</h1><p>ImageGen reference / entirely generated from code</p></div><a href={`${base}tools/watercolor-lab.html`}>Watercolor lab</a><a href={`${base}proto.html?scene=day01.khad-roots-exposed`}>Playtest</a></header>
    <aside aria-label="Bush controls"><h2>Growth &amp; paint</h2>
      <label>Procedural renderer<select aria-label="Procedural renderer" value={renderer} onChange={e=>setRenderer(e.target.value)}><option value={BUSH_PAINTER_VERSION}>Lit leaf planes · pass 3</option><option value={BUSH_RENDERER_VERSION}>Refined brushwork · pass 2</option><option value={BASELINE_VERSION}>Original prototype · pass 1</option></select></label>
      <label>Seed<input aria-label="Bush seed" type="number" min={0} max={4294967295} value={preset.seed} onChange={e=>{const seed=Number(e.target.value);if(Number.isInteger(seed)&&seed>=0&&seed<=4294967295)setPreset({...preset,seed});}}/></label>
      {Object.entries(controls).map(([key,control])=><label key={key}>{control.label}<output>{preset[key as keyof typeof controls].toFixed(2)}</output><input aria-label={control.label} type="range" min={control.min} max={control.max} step={.01} value={preset[key as keyof typeof controls]} onChange={e=>setPreset({...preset,[key]:Number(e.target.value)})}/></label>)}
      <label>Fruit marks <output>{preset.fruit}</output><input aria-label="Fruit marks" type="range" min={0} max={3} step={1} value={preset.fruit} onChange={e=>setPreset({...preset,fruit:Number(e.target.value)})}/></label>
      <label>Comparison surface<select aria-label="Comparison surface" value={surface} onChange={e=>setSurface(e.target.value)}><option value="scene">Matched landscape</option><option value="cutout">Transparent cutouts</option></select></label>
      <div className="watercolor-lab__commands"><button onClick={()=>setPreset({...DEFAULT_BUSH})}>Reset bush</button><button disabled={busy} onClick={()=>exportFile(`procedural-bush-${renderer}-${preset.seed}.png`,generate(preset).toDataURL())}>Export transparent PNG</button>
        <button disabled={busy} onClick={()=>{const url=URL.createObjectURL(new Blob([JSON.stringify({renderer,preset},null,2)+'\n'],{type:'application/json'}));exportFile('bush-preset.json',url);setTimeout(()=>URL.revokeObjectURL(url),1000);}}>Export bush preset</button>
        <label>Import bush preset<input aria-label="Import bush preset" type="file" accept=".json,application/json" onChange={async e=>{const file=e.target.files?.[0];e.target.value='';if(!file)return;try{if(file.size>4096)throw new Error('Preset exceeds 4 KB.');const value=JSON.parse(await file.text());if(value&&typeof value==='object'&&'renderer' in value){if(![BUSH_PAINTER_VERSION,BUSH_RENDERER_VERSION,BASELINE_VERSION].includes(value.renderer)||Object.keys(value).some(k=>k!=='renderer'&&k!=='preset'))throw new Error('Unknown bush renderer or export property.');const next=parseBushPreset(value.preset);setPreset(next);setRenderer(value.renderer);}else setPreset(parseBushPreset(value));setError('');}catch(reason){setError(reason instanceof Error?reason.message:'Invalid bush preset.');}}}/></label>
      </div><p>Fruit marks here are visual samples. The game’s harvest state is unchanged.</p>
    </aside>
    <section className="watercolor-lab__preview bush-study__preview" aria-label="Bush comparison" aria-busy={busy} data-renderer={paintedRenderer} data-surface={paintedSurface}>
      <div className="bush-study__pair">{images.map((src,i)=><figure key={i}><h2>{i?(renderer===BASELINE_VERSION?'Original · code only':renderer===BUSH_PAINTER_VERSION?'Pass 3 · code only':'Refined · code only'):'Approved · ImageGen'}</h2><img className={`bush-study__large ${surface==='cutout'?'bush-study__alpha':''}`} src={src} alt={i?'Procedural watercolor bush':'ImageGen watercolor bush'}/><figcaption>{i?(renderer===BASELINE_VERSION?'Frozen first pass · identical seed and growth':renderer===BUSH_PAINTER_VERSION?'Lit crown of serrated leaf planes · own growth model':'Directional leaf washes, broken bark and painted fruit'):'Existing approved painting · comparison only'}</figcaption><img className="bush-study__game" src={src} alt={i?'Procedural bush at game size':'ImageGen bush at game size'}/><p>128px game-size view</p></figure>)}</div>
      <div><h2>Seeded variations</h2><div className="bush-study__variants">{variants.map(v=><button key={v.seed} aria-label={`Use bush seed ${v.seed}`} aria-pressed={preset.seed===v.seed} onClick={()=>setPreset({...preset,seed:v.seed})}><img src={v.src} alt=""/><span>{v.seed}</span></button>)}</div></div>
    </section><footer><p role="status">{busy?'Painting seeded variations…':message}</p>{error&&<p role="alert">{error}</p>}</footer>
  </main>;
}
