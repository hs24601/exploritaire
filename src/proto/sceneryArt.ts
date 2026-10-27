import type { ArtStyle } from './artStyle';
import { DEN_ORBIT_FILES } from './directionalScenery';
import { proceduralCluster, proceduralPine, sceneryFileName } from './proceduralWoods';

const paintedVariants:Record<string,string>={
  'dirt-ground.png':'dirt-ground-v1.png',
  ...Object.fromEntries(['a','b','c','d'].map(key=>['pebble-'+key+'.svg','stone-spill-v1.png'])),
  ...Object.fromEntries(['a','b','c'].flatMap(key=>[['sprig-'+key+'.svg','berry-spill-v1.png'],['clod-'+key+'.svg','earth-spill-v1.png']])),
  'small_woods_pines.png':'woods-cluster-sprite-v1.png',
  'woods_side.svg':'pine-sprite-v1.png',
  'woods_front.svg':'pine-sprite-v1.png',
  'hero-den-standee-v3.png':'hero-den-sprite-v2.png',
  'hero-den-topdown-v3.png':'hero-den-overhead-v3.png',
  'hero-den-ground-v3.png':'hero-den-ground-v2.png',
  'berry-bush.svg':'berry-patch-sprite-v2.png',
  'berry-patch-topdown.svg':'berry-patch-overhead-v2.png',
  'berry-patch-ground.svg':'woodland-ground-v1.png',
  'mountain_standee.svg':'mountain-peak-sprite-v1.png',
  'mountain_standee_peak.svg':'mountain-peak-sprite-v1.png',
  'mountain_standee_spur.svg':'mountain-peak-sprite-v1.png',
  'mountain_standee_ridge.svg':'mountain-ridge-sprite-v1.png',
  'mountain_standee_ridge_ns.svg':'mountain-ridge-ns-sprite-v1.png',
  'impassable-mountain_topdown.svg':'mountain-overhead-v1.png',
};
const paintedCutouts=new Set(['woods-cluster-sprite-v1.png','pine-sprite-v1.png','hero-den-sprite-v1.png',...DEN_ORBIT_FILES,'berry-patch-sprite-v1.png','berry-patch-sprite-v2.png',
  'manaberry-sparse-standee-v1.png','manaberry-sparse-standee-empty-v1.png','berry-patch-sprite-empty-v1.png',
  'mountain-peak-sprite-v1.png','mountain-ridge-sprite-v1.png','mountain-ridge-ns-sprite-v1.png']);

/** Variant selection belongs to scenery, not gameplay tile definitions. Missing
 * counterparts continue to use their original art. Keep every pixel source.
 * Paint pines and three-pine clusters resolve to baked procedural variants
 * (`proceduralWoods.ts`) chosen by `key`, falling back to the static cutouts. */
export function scenerySprite(src:string|undefined,style:ArtStyle,key?:string):string|undefined {
  if(!src)return src;
  // Recipe fragments may already name watercolor art rather than a legacy key.
  src = src.replace('deprecated/pixel/environment/watercolor-v1/', 'runtime/environment/watercolor/v1/');
  if(style!=='paint')return src;
  const name=src.split('/').pop()?.split('?')[0];
  const variant=name?paintedVariants[name]:undefined;
  if(variant==='pine-sprite-v1.png')return paintPineSprite(key??src);
  if(variant==='woods-cluster-sprite-v1.png')return proceduralCluster(key??src)??`${import.meta.env.BASE_URL}assets/runtime/environment/watercolor/v1/${variant}`;
  return variant?`${import.meta.env.BASE_URL}assets/runtime/environment/watercolor/v1/${variant}`:src;
}

/** A Paint pine for this key: a baked procedural variant, or the static cutout. */
export const paintPineSprite=(key:string)=>proceduralPine(key)??`${import.meta.env.BASE_URL}assets/runtime/environment/watercolor/v1/pine-sprite-v1.png`;

/** Approved watercolor cutouts keep their source artwork and smooth sampling.
 * They deliberately have no sprite-derived volume recipe. */
export function isPaintedScenerySprite(src:string|undefined):boolean {
  const name=sceneryFileName(src);
  return Boolean(name&&(paintedCutouts.has(name)||name==='curious-sapling-sprite-v1.png'));
}

/** Radians in the authored world frame; undefined means camera-facing.
 * The den entrance stays north even though its art is an unmodified painting. */
export function sceneryWorldHeading(src:string|undefined):number|undefined {
  const name=sceneryFileName(src);
  if(name&&(DEN_ORBIT_FILES as readonly string[]).includes(name))return Math.PI;
  return isPaintedScenerySprite(src)?undefined:0;
}
export function woodsOverheadSprite(style:ArtStyle,danger:boolean) {
  return style==='paint'?`${import.meta.env.BASE_URL}assets/runtime/environment/watercolor/v1/woods-overhead-v1.png`
    : `${import.meta.env.BASE_URL}assets/deprecated/pixel/environment/${danger?'dark-woods':'woods'}_topdown.svg`;
}
