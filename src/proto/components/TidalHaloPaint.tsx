import {useEffect,useRef,useState} from 'react';
export const TIDAL_LAYERS=['composite','pigment','underpaint','highlights','turn-01','turn-02','turn-03','turn-04','turn-05'] as const;
export type TidalLayer=typeof TIDAL_LAYERS[number];
const SIZE=360,base='/assets/runtime/ui/momentum/tidal-halo-v1/';
type PaintData={rgba:Uint8ClampedArray;progress:Float32Array;sketch:HTMLCanvasElement};
const cache=new Map<string,Promise<PaintData>>();
function load(layer:TidalLayer){
 const key=layer==='composite'?'pigment':layer;
 if(cache.has(key))return cache.get(key)!;
 const image=(file:string)=>new Promise<HTMLImageElement>((resolve,reject)=>{const img=new Image();img.onload=()=>resolve(img);img.onerror=()=>reject(new Error('Could not load Tidal Halo '+file));img.src=base+file+'.png';});
 const promise=Promise.all([image(key),image('path-map')]).then(([paint,map])=>{
  const canvas=document.createElement('canvas');canvas.width=canvas.height=SIZE;const ctx=canvas.getContext('2d')!;ctx.drawImage(paint,0,0,SIZE,SIZE);const rgba=ctx.getImageData(0,0,SIZE,SIZE).data;
  ctx.clearRect(0,0,SIZE,SIZE);ctx.imageSmoothingEnabled=false;ctx.drawImage(map,0,0,SIZE,SIZE);const path=ctx.getImageData(0,0,SIZE,SIZE).data,progress=new Float32Array(SIZE*SIZE);
  const sketch=ctx.createImageData(SIZE,SIZE);for(let p=0;p<progress.length;p++){progress[p]=(path[p*4]*256+path[p*4+1])/65535;for(let c=0;c<3;c++)sketch.data[p*4+c]=rgba[p*4+c];sketch.data[p*4+3]=rgba[p*4+3]*.12;}
  ctx.clearRect(0,0,SIZE,SIZE);ctx.putImageData(sketch,0,0);return{rgba,progress,sketch:canvas};
 });cache.set(key,promise);return promise;
}
export function TidalHaloPaint({value,capacity,numbers,size,layer}:{value:number;capacity:number;numbers:boolean;size:number;layer:TidalLayer}){
 const canvas=useRef<HTMLCanvasElement>(null),buffer=useRef<{wash:HTMLCanvasElement;image:ImageData}|null>(null);
 const [data,setData]=useState<PaintData|null>(null),[error,setError]=useState('');
 useEffect(()=>{let active=true;setError('');load(layer).then(paint=>{if(active)setData(paint);}).catch(e=>{if(active)setError(String(e));});return()=>{active=false;};},[layer]);
 useEffect(()=>{const ctx=canvas.current?.getContext('2d');if(!ctx||!data)return;if(!buffer.current){const wash=document.createElement('canvas');wash.width=wash.height=SIZE;buffer.current={wash,image:ctx.createImageData(SIZE,SIZE)};}
  const {wash,image}=buffer.current,fill=Math.max(0,Math.min(1,value/capacity));image.data.set(data.rgba);
  for(let p=0;p<data.progress.length;p++){const k=p*4;const jitter=(data.rgba[k]+data.rgba[k+1])/510*.4;const t=fill===0?0:fill===1?1:Math.max(0,Math.min(1,(fill-data.progress[p])/.003+.4+jitter));image.data[k+3]=data.rgba[k+3]*t*t*(3-2*t);}
  ctx.clearRect(0,0,SIZE,SIZE);if(layer==='composite')ctx.drawImage(data.sketch,0,0);wash.getContext('2d')!.putImageData(image,0,0);ctx.drawImage(wash,0,0);
 },[data,layer,value,capacity]);
 return <div className="momentum-study__icon" style={{width:size,maxWidth:'100%'}} data-tidal-layer={layer}><canvas ref={canvas} width={SIZE} height={SIZE} role="img" aria-label={`ImageGen Tidal Halo ${layer}: ${value.toFixed(2)} of ${capacity}`}/>{numbers&&<strong>{Number(value.toFixed(2))}</strong>}{error&&<span role="alert">{error}</span>}</div>;
}
