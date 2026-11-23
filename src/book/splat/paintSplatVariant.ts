import * as THREE from 'three';
import type {BookRenderQuality} from '../viewportPolicy';
import {collectSplatSources,sampleSplatSurfaces,type SplatFocus} from './paintSplatSampling';
import {bakeSplatColors} from './paintSplatBake';
import {createPaintSplatCloud,packSplatTextures,SPLAT_LAYER} from './paintSplatCloud';

// A rendering variant for an existing three.js scene. The original meshes stay
// in the scene, visible and on layer 0, so every raycast, navigation query,
// camera-clearance test and pickup keeps using the real geometry. While the
// variant is on, any camera presenting the scene draws only SPLAT_LAYER: the
// splat cloud plus every object that was not converted (Hero, portals,
// particles, water, shader effects).

export const SPLAT_BUDGETS:Record<Exclude<BookRenderQuality,'auto'>,{splats:number;views:number;size:number}>={
  low:{splats:100_000,views:18,size:384},
  medium:{splats:240_000,views:28,size:512},
  high:{splats:400_000,views:40,size:640},
};

export type SplatVariantOptions={
  roots:THREE.Object3D[];
  exclude?:(mesh:THREE.Mesh)=>boolean;
  focus:SplatFocus;
  quality:BookRenderQuality;
  reduced:boolean;
  /** Share of the quality budget for this scene. */
  share?:number;
  hero?:{color:THREE.ColorRepresentation;strength:number;radius:number};
  mist?:{color:THREE.ColorRepresentation;density:number};
  beforeBake?:()=>void;
  afterBake?:()=>void;
  progress?:(fraction:number)=>void|Promise<void>;
};

export async function createPaintSplatVariant(renderer:THREE.WebGLRenderer,scene:THREE.Scene,options:SplatVariantOptions){
  const started=performance.now();
  const tier=SPLAT_BUDGETS[options.quality==='auto'?'medium':options.quality];
  scene.updateMatrixWorld(true);
  const skipped:string[]=[],sources=collectSplatSources(options.roots,options.exclude,skipped);
  const target=Math.round(tier.splats*(options.share??1));
  options.beforeBake?.();
  let bake,samples;
  try{
    // Pilot survey: a small cloud measures how much of each surface is ever
    // seen, so the real budget favours visible paint over buried geometry
    // (overlapping canopy blobs, ground under rocks).
    const pilot=sampleSplatSurfaces(sources,Math.min(30_000,target),options.focus,911);
    const pilotBake=await bakeSplatColors(renderer,scene,sources,pilot,{views:Math.min(12,tier.views),size:256,focus:options.focus,progress:fraction=>options.progress?.(fraction*.25)});
    const seen=new Float32Array(sources.length),total=new Float32Array(sources.length);
    for(let i=0;i<pilot.count;i++){total[pilot.source[i]]++;if(pilotBake.seen[i])seen[pilot.source[i]]++;}
    // Relative to the best-seen surface, since a short pilot sees no surface fully.
    const rate=Array.from(total,(count,k)=>count?seen[k]/count:0),best=Math.max(.01,...rate);
    const visibility=rate.map((value,k)=>total[k]?Math.max(.05,value/best):1);
    // Oversample: transparent card texels and buried faces are dropped in the bake.
    samples=sampleSplatSurfaces(sources,Math.round(target*1.7),options.focus,20261121,visibility);
    bake=await bakeSplatColors(renderer,scene,sources,samples,{views:tier.views,size:tier.size,focus:options.focus,progress:fraction=>options.progress?.(.25+fraction*.75)});
  }finally{options.afterBake?.();}
  // Keep at most the target count; samples are i.i.d. so trimming is uniform.
  let kept=0;for(let i=0;i<samples.count;i++)if(bake.keep[i]&&++kept>target)bake.keep[i]=0;
  const packed=packSplatTextures({...samples,colors:bake.colors},bake.keep);
  const cloud=createPaintSplatCloud(packed,{reduced:options.reduced,low:options.quality==='low',mist:options.mist});
  scene.add(cloud.mesh);
  const converted=new Set<THREE.Object3D>(sources.map(source=>source.mesh));
  const hero=options.hero??{color:'#ffd9a0',strength:0,radius:8};

  let enabled=false,frame=-1,saved=0;
  const markLayers=()=>scene.traverse(object=>{if(!converted.has(object)&&object.layers.isEnabled(0))object.layers.enable(SPLAT_LAYER);});
  const before=scene.onBeforeRender,after=scene.onAfterRender;
  type Hook=(...args:unknown[])=>void;
  scene.onBeforeRender=function(this:THREE.Scene,...args:Parameters<THREE.Scene['onBeforeRender']>){
    (before as unknown as Hook).apply(this,args);
    const [r,,camera]=args;
    if(!enabled||camera.userData.splatBake)return;
    // New effects are pooled, but re-mark periodically in case one appears.
    const info=r.info.render.frame;if(info-frame>20||frame<0){markLayers();frame=info;}
    saved=camera.layers.mask;camera.layers.set(SPLAT_LAYER);camera.userData.splatSaved=saved;
  };
  scene.onAfterRender=function(this:THREE.Scene,...args:Parameters<THREE.Scene['onAfterRender']>){
    const camera=args[2];
    if(camera.userData.splatSaved!==undefined){camera.layers.mask=camera.userData.splatSaved;delete camera.userData.splatSaved;}
    (after as unknown as Hook).apply(this,args);
  };
  const diagnostics={splats:packed.count,sources:sources.length,surveyViews:bake.views,coverage:+(bake.covered/Math.max(1,samples.count)).toFixed(3),buildMs:Math.round(performance.now()-started),kernel:'brush-stroke gaussian',bySource:bake.bySource,keptAsMesh:skipped.slice(0,24),sort:'worker 16-bit counting'};
  return {
    cloud,diagnostics,
    get enabled(){return enabled;},
    setEnabled(on:boolean){enabled=on;cloud.mesh.visible=on;if(on)frame=-1;},
    update(seconds:number,camera:THREE.Camera,heroPosition?:{x:number;y:number;z:number}){
      cloud.tick(seconds);cloud.setPrimaryCamera(camera);
      if(heroPosition)cloud.setHero(heroPosition.x,heroPosition.y,heroPosition.z,hero.color,hero.strength,hero.radius);
    },
    setLow(){cloud.setLow();cloud.setBudget(.65);},
    dispose(){cloud.dispose();scene.onBeforeRender=before;scene.onAfterRender=after;},
  };
}
export type PaintSplatVariant=Awaited<ReturnType<typeof createPaintSplatVariant>>;
