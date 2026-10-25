import { gameTime } from '../../gameTime';
import { useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { CameraState } from '../../hooks/useCameraControls';
import { getVisualTableLighting, type StandeeLighting, type StandeeShadow } from '../protoLighting';
import { buildPropVolume, propVolumeRecipe, propVolumeView, propVolumeRaster, renderPropVolume, type PropVolume as Volume, type VolumeLight } from '../propVolume';
import { renderVolumeGPUViews, volumeShadowProjection, type VolumeShadowProjection, type VolumeRenderRequest } from '../propVolumeRenderer';
import { GroundShadowPortal } from './GroundShadowLayer';

const sources=new Map<string,Promise<Volume>>();
const mirroredSources=new WeakMap<Volume,Volume>();
function loadVolume(src:string) {
  let pending=sources.get(src);
  if(!pending) {
    pending=new Promise<Volume>((resolve,reject)=>{
      const image=new Image();
      image.onload=()=>{
        const recipe=propVolumeRecipe(src)!;
        // Keep the cave's established carve grid; smooth painted output does
        // not require rebuilding its voxel geometry at texture resolution.
        const canvas=document.createElement('canvas'),scale=Math.min(1,(recipe.surface==='paint'&&recipe.shape!=='cave'?192:64)/Math.max(image.naturalWidth,image.naturalHeight));
        canvas.width=Math.max(1,Math.round(image.naturalWidth*scale));canvas.height=Math.max(1,Math.round(image.naturalHeight*scale));
        const ctx=canvas.getContext('2d',{willReadFrequently:true});
        if(!ctx){reject(new Error('Prop volume canvas unavailable'));return;}
        try { ctx.imageSmoothingEnabled=recipe.surface==='paint';ctx.drawImage(image,0,0,canvas.width,canvas.height);
          resolve(buildPropVolume(canvas.width,canvas.height,ctx.getImageData(0,0,canvas.width,canvas.height).data,recipe));
        }catch(error){reject(error);}
      };
      image.onerror=()=>reject(new Error(`Prop volume source unavailable: ${src}`));image.src=src;
    });sources.set(src,pending);
  }return pending;
}
/** Settles once every solid requested so far has been built (or failed). */
export const propVolumesSettled=()=>Promise.allSettled([...sources.values()]).then(()=>undefined);
function useVolume(src:string,flip=false) {
  const [loaded,setLoaded]=useState<{src:string;volume:Volume}|null>(null);
  useEffect(()=>{let live=true;loadVolume(src).then(volume=>{if(live)setLoaded({src,volume});},()=>{});return()=>{live=false;};},[src]);
  const source=loaded?.src===src?loaded.volume:null;
  return source ? mirrorVolume(source,flip) : null;
}
function mirrorVolume(source:Volume,flip:boolean) {
  if(!flip)return source;
  let mirrored=mirroredSources.get(source);
  if(!mirrored){mirrored={...source,faces:source.faces.map(face=>({...face,normal:[-face.normal[0],face.normal[1],face.normal[2]],vertices:face.vertices.map(([x,y,z])=>[-x,y,z]).reverse() as [number,number,number][],colors:face.colors?[...face.colors].reverse():undefined,normals:face.normals?.map(([x,y,z])=>[-x,y,z] as const).reverse()}))};mirroredSources.set(source,mirrored);}
  return mirrored;
}
/** Prepare only known scenery while the table is idle. The first immersive
 * frame should not also build voxel solids, upload geometry and compile shaders. */
export function prewarmPropVolumes(entries:readonly {sprite:string;flip?:boolean}[]) {
  let stopped=false, timer=0;
  // Scenery selection can include original painted cutouts. Warm only solids;
  // those cutouts load through the shared sprite path and have no recipe.
  const pending=entries.filter(entry=>Boolean(propVolumeRecipe(entry.sprite)));
  const next=()=>{
    const entry=pending.shift();if(stopped||!entry)return;
    void loadVolume(entry.sprite).then(source=>{
      if(stopped)return;const volume=mirrorVolume(source,Boolean(entry.flip));
      const light:VolumeLight={direction:[0,1,0],brightness:1,localDirection:[0,1,0],localAmount:0,tint:[255,255,255]};
      return viewFor(`warm|${entry.sprite}|${entry.flip}`,volume,0,30,light,false).then(()=>viewFor(`warm-shadow|${entry.sprite}|${entry.flip}`,volume,0,90,light,false,volumeShadowProjection(volume,0,-1)));
    }).catch(()=>{}).finally(()=>{if(!stopped)timer=gameTime.setTimeout(next,30);});
  };
  timer=gameTime.setTimeout(next,250);
  return()=>{stopped=true;gameTime.clearTimeout(timer);};
}
// Shared bounded LRU of tiny pixel views. Repeated trees/mountains reuse both
// solids and projections. There is no per-prop renderer or idle frame loop.
const views=new Map<string,HTMLCanvasElement>();
const pendingViews=new Map<string,Promise<HTMLCanvasElement|null>>();
let queuedViews:{key:string;canvas:HTMLCanvasElement;request:VolumeRenderRequest;resolve:(canvas:HTMLCanvasElement)=>void}[]=[];
async function flushViews(){
  const batch=queuedViews;queuedViews=[];
  const gpu=await renderVolumeGPUViews(batch.map(entry=>entry.request));
  for(const {key,canvas,request,resolve} of batch){
    if(!gpu){if(request.shadow){const {s,c}=request.shadow;paintVolumeShadow(request.target,request.volume.faces.map(face=>face.vertices.map(([x,y,z])=>[x+y*s,z+y*c])),request.shadow);}
      else{const data=request.target.createImageData(canvas.width,canvas.height);data.data.set(renderPropVolume(request.volume,request.yaw,request.elevation,request.light,request.monochrome));request.target.putImageData(data,0,0);}}
    canvas.dataset.engine=gpu?'webgl':'canvas';views.set(key,canvas);pendingViews.delete(key);resolve(canvas);
  }
  while(views.size>96)views.delete(views.keys().next().value!);
}
function viewFor(key:string,volume:Volume,yaw:number,elevation:number,light:VolumeLight,monochrome:boolean,shadow?:VolumeShadowProjection):Promise<HTMLCanvasElement|null> {
  let canvas=views.get(key);
  if(canvas){views.delete(key);views.set(key,canvas);return Promise.resolve(canvas);}
  const pending=pendingViews.get(key);if(pending)return pending;
  const raster=propVolumeRaster(volume,Boolean(shadow));
  canvas=document.createElement('canvas');canvas.width=raster.width;canvas.height=raster.height;
  const ctx=canvas.getContext('2d');if(!ctx)return Promise.resolve(null);
  const result=new Promise<HTMLCanvasElement>(resolve=>{
    queuedViews.push({key,canvas:canvas!,request:{target:ctx,volume,yaw,elevation,light,monochrome,shadow},resolve});
    if(queuedViews.length===1)queueMicrotask(flushViews);
  });pendingViews.set(key,result);return result;
}
export type PropVolumeCamera={getCamera:()=>CameraState;onCameraFrame:(listener:(camera:CameraState)=>void)=>()=>void;getElevation:(camera:CameraState)=>number};

/** A projection of a fixed solid, composited into the existing CSS depth scene.
 * Only the projection canvas billboards; geometry and texture stay in world
 * coordinates. Both yaw and descent use the live camera, between React ticks. */
export function PropVolumeArt({sprite,width,height,lighting,hours,position,camera,monochrome=false,flip=false,fallback}: {
  sprite:string;width:number;height:number;lighting:StandeeLighting;hours:number;position:{x:number;y:number};camera:PropVolumeCamera;
  monochrome?:boolean;flip?:boolean;fallback:ReactNode;
}) {
  const volume=useVolume(sprite,flip),ref=useRef<HTMLCanvasElement>(null),previousKey=useRef(''),requestedKey=useRef('');
  const paintedCanvas=useRef<HTMLCanvasElement|null>(null);
  // Lighting is a value, not the newly allocated object from each scene render.
  // Stable keys keep the live projection subscription and raster intact.
  const lightSignature=JSON.stringify([Math.round(lighting.brightness*40),Math.round((lighting.rim?.x??0)*10),Math.round((lighting.rim?.y??0)*10),Math.round((lighting.rim?.amount??0)*20),lighting.lightColor]);
  useLayoutEffect(()=>{
    const ctx=ref.current?.getContext('2d');if(!ctx||!volume)return;
    if(paintedCanvas.current!==ref.current){previousKey.current='';paintedCanvas.current=ref.current;}
    const sky=getVisualTableLighting(hours),dx=sky.source.x-position.x,dz=sky.source.y-position.y,distance=Math.max(1,Math.hypot(dx,dz));
    const quantize=(value:number)=>Math.round(value*10)/10;
    const light:VolumeLight={direction:[quantize(dx/distance),.9,quantize(dz/distance)],brightness:Math.round(lighting.brightness*40)/40,
      localDirection:[quantize(lighting.rim?.x??0),.65,quantize(lighting.rim?.y??0)],localAmount:Math.round((lighting.rim?.amount??0)*20)/20,
      tint:[lighting.lightColor.r,lighting.lightColor.g,lighting.lightColor.b]};
    const lightKey=JSON.stringify(light);
    requestedKey.current='';
    let active=true;
    const draw=(live:CameraState)=>{
      const yaw=Math.round((((live.yaw??0)%360+360)%360)/2)*2,elevation=Math.round(camera.getElevation(live));
      const key=`${sprite}|${flip}|${yaw}|${elevation}|${monochrome}|${lightKey}`;
      const drawKey=`${width}|${height}|${key}`;
      if(drawKey===previousKey.current){requestedKey.current=drawKey;return;}
      if(drawKey===requestedKey.current)return;requestedKey.current=drawKey;
      void viewFor(key,volume,yaw,elevation,light,monochrome).then(view=>{
      if(!view||!active||requestedKey.current!==drawKey)return;
      ctx.imageSmoothingEnabled=volume.surface==='paint';ctx.clearRect(0,0,ctx.canvas.width,ctx.canvas.height);ctx.drawImage(view,0,0,ctx.canvas.width,ctx.canvas.height);
      previousKey.current=drawKey;
      if(ref.current){ref.current.dataset.volumeYaw=String(yaw);ref.current.dataset.volumeElevation=String(elevation);ref.current.dataset.volumeFaces=String(volume.faces.length);ref.current.dataset.volumeEngine=view.dataset.engine;}
      });
    };draw(camera.getCamera());const unsubscribe=camera.onCameraFrame(draw);
    return()=>{active=false;unsubscribe();};
  },[volume,sprite,lightSignature,hours,position.x,position.y,camera,monochrome,flip,width,height]);
  if(!volume)return <>{fallback}</>;
  // The foot (0,0,0) is at the parent's bottom centre for every projection.
  const scale=Math.max(width,height);
  const bounds=propVolumeView(volume);
  const raster=propVolumeRaster(volume);
  // The projection already contains the complete pixel raster. Expanding it
  // to the plane-sprite oversampling size added no detail, but uploaded several
  // times as many pixels on every orbit frame. CSS nearest sampling supplies
  // enlargement at all zooms without changing the world footprint.
  return <canvas ref={ref} aria-hidden="true" data-prop-volume="solid" data-volume-surface={volume.surface??'pixel'} data-volume-source={sprite} data-volume-height={volume.height*scale} data-volume-height-scale={propVolumeRecipe(sprite)?.heightScale ?? 1} data-volume-ground-width={volume.width*scale} data-volume-ground-depth={volume.depth*scale} width={raster.width} height={raster.height}
    style={{position:'absolute',pointerEvents:'none',imageRendering:volume.surface==='paint'?'auto':'pixelated',left:width/2+bounds.left*scale,top:height+bounds.top*scale,
      width:scale*bounds.width,height:scale*bounds.height}}/>;
}

/** Cast the actual solid onto the table in the light's world direction.
 * Camera orbit never changes the shadow or its ground anchor. */
export function PropVolumeShadows({sprite,position,size,shadows,owner,flip=false}: {sprite:string;position:{x:number;y:number};size:number;shadows:StandeeShadow[];owner:string;flip?:boolean}) {
  const volume=useVolume(sprite,flip);if(!volume||!volume.faces.length)return null;
  return <GroundShadowPortal>{shadows.map(shadow=><VolumeShadow key={shadow.lightId} sprite={`${sprite}|${flip}`} volume={volume} position={position} size={size} shadow={shadow} owner={owner}/>)}</GroundShadowPortal>;
}

/** Rasterize the union of wound solid-face projections in one bounded fill. */
export function paintVolumeShadow(ctx:CanvasRenderingContext2D,polygons:readonly (readonly (readonly number[])[])[],
  {left,top,right,bottom}:{left:number;top:number;right:number;bottom:number}) {
  ctx.clearRect(0,0,ctx.canvas.width,ctx.canvas.height);ctx.fillStyle='#000';
  // Fill implicitly closes each subpath. Explicit closePath scans the
  // growing compound path for every face, making a moving-light redraw
  // quadratic in the number of solid faces. Keep the same wound polygons
  // and let the single fill close them instead.
  const path=new Path2D();
  for(const polygon of polygons){
    const area=polygon.reduce((sum,p,i)=>{const q=polygon[(i+1)%polygon.length];return sum+p[0]*q[1]-q[0]*p[1];},0);
    if(Math.abs(area)<1e-8)continue;
    const ordered=area<0?[...polygon].reverse():polygon;
    ordered.forEach(([x,y],i)=>{const px=(x-left)/(right-left)*ctx.canvas.width,py=(y-top)/(bottom-top)*ctx.canvas.height;if(i)path.lineTo(px,py);else path.moveTo(px,py);});
  }
  ctx.fill(path,'nonzero');
}

function VolumeShadow({volume,position,size,shadow,owner,sprite}:{volume:Volume;position:{x:number;y:number};size:number;shadow:StandeeShadow;owner:string;sprite:string}) {
  const ref=useRef<HTMLCanvasElement>(null),r=shadow.angle*Math.PI/180,s=Math.sin(r)*shadow.length,c=-Math.cos(r)*shadow.length;
  const projection=useMemo(()=>volumeShadowProjection(volume,s,c),[volume,s,c]);
  const {left,top,right,bottom}=projection;
  useLayoutEffect(()=>{
    const ctx=ref.current?.getContext('2d');if(!ctx)return;
    let active=true;
    const light:VolumeLight={direction:[0,1,0],brightness:1,localDirection:[0,1,0],localAmount:0,tint:[0,0,0]};
    void viewFor(`shadow|${sprite}|${s.toFixed(4)}|${c.toFixed(4)}`,volume,0,90,light,false,projection).then(view=>{
      if(!active||!view)return;ctx.clearRect(0,0,ctx.canvas.width,ctx.canvas.height);ctx.drawImage(view,0,0,ctx.canvas.width,ctx.canvas.height);
      if(ref.current)ref.current.dataset.shadowEngine=view.dataset.engine;
    });
    return()=>{active=false;};
  },[volume,s,c]);
  return <canvas ref={ref} width={256} height={256} aria-hidden="true" data-shadow-owner={owner} data-shadow-light={shadow.lightId} data-volume-shadow="true"
    style={{position:'absolute',pointerEvents:'none',left:`calc(50% + ${position.x+left*size}px)`,top:`calc(50% + ${position.y+top*size}px)`,width:(right-left)*size,height:(bottom-top)*size,opacity:shadow.opacity,transform:'translateZ(.5px)',imageRendering:'pixelated'}}/>;
}
