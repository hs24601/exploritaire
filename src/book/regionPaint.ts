import {DEFAULT_DABS,DAB_PALETTES} from '../proto/radialDabs';
import {DEFAULT_WASH,type WashPalette} from '../proto/watercolorWash';
import {parsePaintPreset,type PaintPreset} from '../proto/watercolorPaint';
import type {PageControl} from './pageDocument';

export type RegionPaintOptions={content:'artwork'|'wash'|'both';palette:WashPalette;preset:PaintPreset;technique:'ink-spread-sprite'|'radial-bloom'|'luminance-fill';duration:number;direction?:'light-to-dark'|'dark-to-light'};
/** These use the same saved generators/seeds as Live Paint, not lookalike textures. */
export const BOOK_PAINT_RECIPES=[
 {id:'live-dabs',name:'Live Paint · radial dabs',palette:'woodland',preset:DEFAULT_DABS},
 {id:'live-wash',name:'Live Paint · watercolor wash',palette:'dirt',preset:DEFAULT_WASH},
 {id:'woodland-wash',name:'Woodland wash',palette:'woodland',preset:DEFAULT_WASH},
 {id:'stone-wash',name:'Stone wash',palette:'slate',preset:DEFAULT_WASH},
 {id:'water-wash',name:'Water wash',palette:'water',preset:DEFAULT_WASH},
 {id:'wine-dabs',name:'Twilight dabs',palette:'wine',preset:DEFAULT_DABS},
] as const;
export function defaultRegionPaint(content:RegionPaintOptions['content']='wash'):RegionPaintOptions {
 return {content,palette:'woodland',preset:structuredClone(DEFAULT_DABS),technique:'ink-spread-sprite',duration:2.6};
}
export const getRegionPaint=(control:PageControl)=>control.regionPaint??defaultRegionPaint('artwork');
export function validRegionPaint(value:unknown):value is RegionPaintOptions {
 const p=value as RegionPaintOptions;
 if(!p||(p.direction!==undefined&&!['light-to-dark','dark-to-light'].includes(p.direction))||!['artwork','wash','both'].includes(p.content)||!DAB_PALETTES.includes(p.palette)||!['ink-spread-sprite','radial-bloom','luminance-fill'].includes(p.technique)||!Number.isFinite(p.duration)||p.duration<.1||p.duration>30)return false;
 try{parsePaintPreset(p.preset);return true;}catch{return false;}
}
export function paintSeedNumber(seed:string|number){let hash=2166136261;for(const char of String(seed))hash=Math.imul(hash^char.charCodeAt(0),16777619);return (hash>>>0)%4096;}
export function regionHasWash(control:PageControl){return control.kind==='paint-region'&&getRegionPaint(control).content!=='artwork';}
/** Conservative footprint inventory; actual reveal clips pixels to rotated region bounds. */
export function regionArtworkTargets(region:PageControl,controls:PageControl[]){
 const a=region.rotation*Math.PI/180,co=Math.cos(a),si=Math.sin(a);
 return controls.filter(c=>{if(c.kind!=='prop'||!c.visible)return false;const dx=c.x-region.x,dz=c.z-region.z;return Math.abs(dx*co-dz*si)<=region.width/2+c.width/2&&Math.abs(dx*si+dz*co)<=region.height/2+c.width/2;});
}
