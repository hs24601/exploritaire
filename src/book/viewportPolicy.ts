import * as THREE from 'three';
import type {BookCameraShot} from './bookCamera';
import type {FrameRect} from './responsiveFraming';

/** Logical design coordinates, never a forced physical framebuffer size. */
export const BOOK_AUTHORING_FRAME = Object.freeze({width:1920,height:1080});
export type ShotComposition = {width:number;height:number};
export function validShotComposition(value:unknown):value is ShotComposition {
  const c=value as ShotComposition;
  return !!c&&[c.width,c.height].every(n=>Number.isFinite(n)&&n>=100&&n<=16384);
}
export function compositionScale(viewport:{height:number},safe:FrameRect,reference:ShotComposition=BOOK_AUTHORING_FRAME){
  return Math.max(viewport.height/Math.max(1,safe.height),reference.width/reference.height*viewport.height/Math.max(1,safe.width));
}
/** Keep target, angle and FOV; only adapt camera distance to contain the design frame. */
export function adaptAuthoredShot(shot:BookCameraShot,viewport:{height:number},safe:FrameRect):BookCameraShot {
  const scale=compositionScale(viewport,safe,shot.composition),target=new THREE.Vector3(...shot.target);
  return {...shot,position:new THREE.Vector3(...shot.position).sub(target).multiplyScalar(scale).add(target).toArray()};
}
/** Inverse of adaptation: saving on a phone does not bake its long camera distance into the shot. */
export function authorBookShot(shot:BookCameraShot,viewport:{height:number},safe:FrameRect):BookCameraShot {
  const scale=compositionScale(viewport,safe),target=new THREE.Vector3(...shot.target);
  return {...shot,composition:{...BOOK_AUTHORING_FRAME},position:new THREE.Vector3(...shot.position).sub(target).divideScalar(scale).add(target).toArray()};
}

export type BookRenderQuality='auto'|'low'|'medium'|'high';
const QUALITY={auto:{ratio:1.5,pixels:1920*1080},low:{ratio:.75,pixels:1280*720},medium:{ratio:1,pixels:1920*1080},high:{ratio:1.75,pixels:3840*2160}};
export function renderPixelRatio(width:number,height:number,dpr:number,quality:BookRenderQuality){
  const budget=QUALITY[quality];return Math.min(Math.max(.25,dpr),budget.ratio,Math.sqrt(budget.pixels/Math.max(1,width*height)));
}
const KEY='exploritaire.book-render-quality.v1';
export function bookRenderQuality():BookRenderQuality {
  let value:string|null=null;try{value=new URLSearchParams(location.search).get('quality')??localStorage.getItem(KEY);}catch{}
  return value&&Object.prototype.hasOwnProperty.call(QUALITY,value)?value as BookRenderQuality:'auto';
}
export function setBookRenderQuality(quality:BookRenderQuality){
  try{localStorage.setItem(KEY,quality);}catch{}
  dispatchEvent(new CustomEvent('book:render-quality',{detail:quality}));
}
/** Rendering budget is independent of camera projection and logical layout. */
export function createBookViewport(renderer:THREE.WebGLRenderer,canvas:HTMLCanvasElement){
  let quality=bookRenderQuality(),width=0,height=0,lastRatio=0;
  function resize(w:number,h:number){
    const ratio=renderPixelRatio(w,h,devicePixelRatio,quality);
    if(w===width&&h===height&&ratio===lastRatio)return;
    width=w;height=h;lastRatio=ratio;renderer.setPixelRatio(ratio);renderer.setSize(w,h,false);
    Object.assign(canvas.dataset,{authoringFrame:'1920x1080',renderQuality:quality,renderResolution:`${canvas.width}x${canvas.height}`,renderPixelRatio:ratio.toFixed(3)});
  }
  const change=(event:Event)=>{const next=(event as CustomEvent).detail;if(typeof next==='string'&&Object.prototype.hasOwnProperty.call(QUALITY,next)){quality=next as BookRenderQuality;lastRatio=0;resize(width,height);}};
  addEventListener('book:render-quality',change);
  return {resize,dispose(){removeEventListener('book:render-quality',change);}};
}
