import * as THREE from 'three';
import {forestPaintGLSL} from './forestPaint';
import {proximityPaintGLSL,proximityPaintUniforms} from './proximityPaint';
import {BookPaintTimeline,DEFAULT_PAGE_PAINT,type PaintCue} from './paintTimeline';
import type {BookPageLayout} from './pageDocument';
import {getRegionPaint,paintSeedNumber} from './regionPaint';
export const MAX_PAINT_REGIONS=16;
const paintGLSL=/* glsl */`
${forestPaintGLSL}
${proximityPaintGLSL}
uniform float forestPaintEnabled;
uniform float bookPaintFilmOnly;
uniform sampler2D bookInkSprite;
uniform float bookPaintProgress;
uniform float bookPaintOverride;
uniform float bookPaintSurfaceRegion;
uniform float bookPaintRegionCount;
uniform vec2 bookPaintTexel;
uniform vec3 bookSketchPaper;
uniform vec4 bookPaintRegions[16];
uniform vec2 bookPaintRegionState[16];
uniform vec4 bookPaintRegionStyle[16];
varying vec3 bookPaintWorld;
float bookInkAmount(float progress,vec2 uv,float technique,float seed,float luminance,float direction){
 if(progress<=.0001)return 0.;if(progress>=.9999)return 1.;
 if(technique>1.5){float order=direction>.5?luminance:1.-luminance;return smoothstep(order-.04,order+.04,progress);}
 if(technique>.5){vec2 center=vec2(.5)+vec2(sin(seed),cos(seed*1.7))*.1;float edge=length(uv-center)/.8+sin(uv.x*22.+seed)*sin(uv.y*19.-seed)*.065;return 1.-smoothstep(progress-.06,progress+.06,edge);}
 vec2 offset=vec2(sin(seed),cos(seed*1.7))*.09;uv=clamp(uv*.8+.1+offset,.003,.997);
 float frame=floor(clamp(progress,0.,1.)*39.);
 return 1.-texture2D(bookInkSprite,vec2((frame+uv.x)/40.,uv.y)).a;
}
vec3 applyBookPaint(vec3 color){
 if(forestPaintEnabled<.5&&bookPaintFilmOnly>.5)return color;
 if(forestPaintEnabled<.5&&bookPaintProgress>=.9999&&bookPaintRegionCount<.5&&bookPaintOverride<0.)return color;
 float progress=bookPaintProgress;vec2 position=bookPaintWorld.xz;
 vec2 uv=vec2(bookPaintWorld.x/14.+.5,.5-(bookPaintWorld.z-bookPaintWorld.y*.45)/10.);
 float technique=0.,seed=0.,direction=0.;
 for(int i=0;i<16;i++){
  if(float(i)>=bookPaintRegionCount)break;
  vec4 r=bookPaintRegions[i],style=bookPaintRegionStyle[i];if(r.z<=0.)continue;
  if(bookPaintSurfaceRegion>=0.&&abs(float(i)-bookPaintSurfaceRegion)>.1)continue;
  if(style.w>.5&&style.w<1.5&&abs(float(i)-bookPaintSurfaceRegion)>.1)continue;
  float a=bookPaintRegionState[i].y;vec2 delta=position-r.xy;
  vec2 local=vec2(cos(a)*delta.x-sin(a)*delta.y,sin(a)*delta.x+cos(a)*delta.y);
  if(all(lessThanEqual(abs(local),r.zw*.5))){progress=bookPaintRegionState[i].x;uv=local/r.zw+.5;technique=style.x;seed=style.y;direction=style.z;}
 }
 if(bookPaintOverride>=0.)progress=bookPaintOverride;
 if(progress>=.9999&&forestPaintEnabled<.5)return color;
 float ink=0.,luminance=dot(color,vec3(.2126,.7152,.0722));
 #ifdef USE_MAP
 vec4 center=texture2D(map,vMapUv),l=texture2D(map,vMapUv-vec2(bookPaintTexel.x,0.)),r=texture2D(map,vMapUv+vec2(bookPaintTexel.x,0.)),t=texture2D(map,vMapUv+vec2(0.,bookPaintTexel.y)),b=texture2D(map,vMapUv-vec2(0.,bookPaintTexel.y));
 float gradient=length(l.rgb-r.rgb)+length(t.rgb-b.rgb),alphaEdge=1.-min(min(l.a,r.a),min(t.a,b.a));
 ink=smoothstep(.035,.22,gradient*2.+alphaEdge*.8);luminance=dot(center.rgb,vec3(.2126,.7152,.0722));
 #endif
 vec3 sketch=mix(bookSketchPaper,vec3(.12,.095,.07),ink*.85);
 if(forestProximityEnabled>.5){float p=proximityPaintAt(bookPaintWorld);float amount=bookInkAmount(p,uv,0.,0.,luminance,0.);vec3 pigment=normalize(max(color,vec3(.002)));return mix(sketch,color,amount)+pigment*(4.*p*(1.-p))*.06;}
 if(forestPaintEnabled>.5){float amount=forestPaintAmount(bookPaintWorld);float rim=forestPaintProgress>0.&&forestPaintProgress<1.?1.-smoothstep(.003,.018,abs(forestPaintOrder(bookPaintWorld)-forestPaintProgress)):0.;vec3 pigment=normalize(max(color,vec3(.002)));return mix(sketch,color,amount)+pigment*rim*.12;}
 return mix(sketch,color,bookInkAmount(progress,uv,technique,seed,luminance,direction));
}
`;
export function createBookPaint(sprite:THREE.Texture,changed:(page:number)=>void){
 const timeline=new BookPaintTimeline(changed),layouts=new Map<number,BookPageLayout>(),uniformPages=new Map<number,ReturnType<typeof uniforms>>();
 const links=new Map<THREE.Material,{page:number;id?:string;surface:boolean;override:{value:number};region:{value:number}}>();
 function uniforms(){return{...proximityPaintUniforms(),forestPaintEnabled:{value:0},forestPaintProgress:{value:0},bookInkSprite:{value:sprite},bookPaintProgress:{value:0},bookPaintRegionCount:{value:0},bookSketchPaper:{value:new THREE.Color('#f0e2c2')},bookPaintRegions:{value:Array.from({length:16},()=>new THREE.Vector4())},bookPaintRegionState:{value:Array.from({length:16},()=>new THREE.Vector2())},bookPaintRegionStyle:{value:Array.from({length:16},()=>new THREE.Vector4())}};}
 function pageUniforms(page:number){let value=uniformPages.get(page);if(!value){value=uniforms();uniformPages.set(page,value);}return value;}
 return {timeline,
  configure(layout:BookPageLayout){layouts.set(layout.page,layout);timeline.configure(layout.page,layout.paint??DEFAULT_PAGE_PAINT,layout.controls.filter(c=>c.kind!=='text'));},
  enter(page:number){timeline.enter(page);},replay(page:number){timeline.replay(page);},cue(page:number,cue:PaintCue){return timeline.cue(page,cue);},flag(name:string,value:boolean,durationMs?:number){timeline.flag(name,value,durationMs);},
  setForestPaint(page:number,progress:number|undefined){const u=pageUniforms(page);u.forestPaintEnabled.value=progress===undefined?0:1;u.forestPaintProgress.value=progress??0;},
  setProximityPaint(page:number,texture:THREE.Texture|null,bounds?:THREE.Vector4){const u=pageUniforms(page);u.forestProximityEnabled.value=texture?1:0;u.forestProximityMap.value=texture;if(bounds)u.forestProximityBounds.value.copy(bounds);},
  attach(root:THREE.Object3D,page:number,filmOnly=false){root.traverse(object=>{
   if(!(object instanceof THREE.Mesh)||object.userData.bookStory||object.userData.editorHelper||object.userData.bookPaper&&!filmOnly||object.userData.interactionMarker)return;
   for(const material of Array.isArray(object.material)?object.material:[object.material]){
    if(!(material instanceof THREE.MeshBasicMaterial||material instanceof THREE.MeshLambertMaterial||material instanceof THREE.MeshStandardMaterial)||links.has(material))continue;
    const override={value:-1},region={value:-1},before=material.onBeforeCompile.bind(material),key=material.customProgramCacheKey.bind(material),map=material.map;
    links.set(material,{page,id:object.userData.pageControlId,surface:!!object.userData.paintSurface,override,region});
    material.onBeforeCompile=(shader,renderer)=>{before(shader,renderer);Object.assign(shader.uniforms,pageUniforms(page),{bookPaintFilmOnly:{value:filmOnly?1:0},bookPaintOverride:override,bookPaintSurfaceRegion:region,bookPaintTexel:{value:new THREE.Vector2(2/(map?.image?.width??512),2/(map?.image?.height??512))}});shader.vertexShader='varying vec3 bookPaintWorld;\n'+shader.vertexShader;shader.vertexShader=shader.vertexShader.replace('#include <project_vertex>','#include <project_vertex>\nbookPaintWorld=(modelMatrix*vec4(transformed,1.)).xyz;');shader.fragmentShader=shader.fragmentShader.replace('void main() {',paintGLSL+'\nvoid main() {');shader.fragmentShader=shader.fragmentShader.replace('#include <opaque_fragment>','outgoingLight=applyBookPaint(outgoingLight);\n#include <opaque_fragment>');};
    material.customProgramCacheKey=()=>key()+':book-region-paint-v4:'+filmOnly;material.needsUpdate=true;
   }
  });},
  update(dt:number,reduced:boolean,paused:boolean){
   timeline.update(dt,reduced,paused);const regionIds=new Map<number,string[]>();
   for(const [page,layout]of layouts){const u=pageUniforms(page),regions=layout.controls.filter(c=>c.kind==='paint-region'&&c.visible).slice(0,16);regionIds.set(page,regions.map(r=>r.id));u.bookPaintProgress.value=timeline.value(page);u.bookPaintRegionCount.value=regions.length;
    for(let i=0;i<16;i++){const r=regions[i],paint=r?getRegionPaint(r):undefined;u.bookPaintRegions.value[i].set(r?.x??0,r?.z??0,r?.width??0,r?.height??0);u.bookPaintRegionState.value[i].set(r?timeline.value(page,r.id):0,THREE.MathUtils.degToRad(r?.rotation??0));u.bookPaintRegionStyle.value[i].set(paint?['ink-spread-sprite','radial-bloom','luminance-fill'].indexOf(paint.technique):0,paint?paintSeedNumber(paint.preset.seed):0,paint?.direction==='dark-to-light'?1:0,paint?['artwork','wash','both'].indexOf(paint.content):0);}
   }
   for(const link of links.values()){link.override.value=link.id?timeline.value(link.page,link.id):-1;link.region.value=link.surface?regionIds.get(link.page)?.indexOf(link.id!)??-1:-1;}
  },progress(page:number){return timeline.value(page);},snapshotKey(page:number){return JSON.stringify([pageUniforms(page).forestProximityEnabled.value,pageUniforms(page).forestPaintEnabled.value>.5?pageUniforms(page).forestPaintProgress.value:null,timeline.value(page),...(layouts.get(page)?.controls??[]).filter(c=>c.kind!=='text').map(c=>[c.id,timeline.value(page,c.id)])]);}
 };
}
