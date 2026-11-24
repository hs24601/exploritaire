import * as THREE from 'three';

/** Shared mixtures for pinned marks and continuous surface paint. Autumn
 * litter retains the reference look; living wood/leaves stay brown/green. */
export const MIXED_PALETTE_GLSL=/* glsl */`
uniform vec4 darkSoilPatch;
float darkSoilAmount(vec3 world){vec2 p=(world.xz-darkSoilPatch.xy)/max(.01,darkSoilPatch.z);float edge=length(p)+sin(world.x*1.7+sin(world.z*1.2))*.07+sin(world.z*2.3)*.05;return (1.-smoothstep(.35,1.,edge))*darkSoilPatch.w;}
vec3 mixedPaintColor(float surface,float palette,float lighting,float variation,float seed){
 float kind=fract(seed*.371);
 vec3 dark=vec3(.037,.048,.049),mid=vec3(.15,.19,.18),light=vec3(.34,.37,.31);
 if(surface<.5){
  dark=vec3(.045,.041,.031);mid=vec3(.16,.18,.11);light=vec3(.35,.36,.23);
  if(palette>2.5){dark=mix(vec3(.43,.25,.20),vec3(.33,.12,.17),kind);mid=mix(vec3(.74,.47,.15),vec3(.58,.18,.11),kind);light=mix(vec3(.97,.71,.20),vec3(.80,.25,.11),kind);}
 }else if(surface<1.5){dark=vec3(.085,.045,.024);mid=vec3(.30,.175,.085);light=vec3(.61,.40,.21);}
 else if(surface<2.5){dark=vec3(.025,.065,.026);mid=vec3(.13,.265,.075);light=vec3(.38,.52,.19);}
 else if(palette>2.5){dark=vec3(.14,.12,.17);mid=vec3(.30,.26,.24);light=vec3(.57,.49,.37);}
 vec3 paint=mix(dark,mid,smoothstep(.18,.52,lighting));paint=mix(paint,light,smoothstep(.64,.95,lighting)*.65);
 paint*=1.+(fract(seed*.137)-.5)*variation;
 if(surface<.5||surface>2.5){paint=mix(paint,paint*vec3(1.2,1.03,.76),step(.5,palette)*step(palette,1.5));paint=mix(paint,paint*vec3(.78,.96,1.24),step(1.5,palette)*step(palette,2.5));}
 if(palette>3.5)paint*=vec3(.56,.52,.49);
 return paint;
}
vec3 mixedSoilTint(vec3 paint,vec3 world,vec2 field,float surface,float palette,float moss,float wet){
 if(surface<.5){vec3 tint=palette>2.5?vec3(.9,1.02,.76):vec3(.72,1.15,.85);paint=mix(paint,paint*tint,field.g*moss*.5);paint*=1.-max(field.r,wet)*.3;paint=mix(paint,paint*.10+vec3(.024,.002,.009),darkSoilAmount(world)*.96);}
 return paint;
}
`;

/** Four neighboring, world-fixed brush marks form a partition of unity.
 * A positive pigment body beneath each dry-brush mask makes normalized paint
 * defined everywhere, including zero-alpha bristle gaps and cell boundaries.
 * This is the mixed brush field itself, not an unpainted fallback color. */
export const MIXED_SURFACE_GLSL=/* glsl */`
float mixedHash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
vec3 continuousMixedPaint(vec3 world,vec3 normal,float surface,vec3 basePigment){
 vec3 n=normalize(normal),an=abs(n);vec2 p=world.xz;
 if(an.x>an.y&&an.x>an.z)p=world.zy;else if(an.z>an.y)p=world.xy;
 float size=max(.2,strokeSize*2.6);
 p/=size;if(surface>.5&&surface<1.5)p.y*=.36;
 vec2 cell=floor(p),f=fract(p);vec3 sum=vec3(0.);float weightSum=0.;
 vec3 sunDirection=paletteShift>2.5?vec3(-.44,.5,-.75):vec3(-.4,.7,.5);
 float lighting=clamp(dot(n,normalize(sunDirection))*.55+.4,0.,1.);
 for(int y=0;y<2;y++)for(int x=0;x<2;x++){
  vec2 offset=vec2(float(x),float(y)),anchor=cell+offset;
  float seed=mixedHash(anchor+surface*17.3)*10000.;
  float tile=floor(mod(seed,8.));vec2 q=(f-offset)*.42+.5;
  if(fract(seed*.31)>.5)q.x=1.-q.x;
  vec2 uv=(vec2(mod(tile,4.),floor(tile/4.))+q)/vec2(4.,2.);
  vec3 ink=texture2D(brush,uv).rgb;
  vec2 blendAxes=mix(vec2(1.)-f,f,offset);
  float weight=blendAxes.x*blendAxes.y*(.18+.82*ink.g);
  vec3 color=mixedPreserveColor>.5?basePigment*(1.+(fract(seed*.137)-.5)*variation):mixedPaintColor(surface,paletteShift,lighting,variation,seed);
  color*=.94+ink.b*.12;color*=1.+(ink.r-.5)*relief*.28;
  sum+=color*weight;weightSum+=weight;
 }
 vec3 paint=sum/max(.00001,weightSum);
 return mixedSoilTint(paint,world,texture2D(uField,world.xz/220.+.5).rg,surface,paletteShift,soilMoss,soilWet);
}
`;

export function applyMixedPaintSurface(material:THREE.MeshLambertMaterial|THREE.MeshStandardMaterial|THREE.MeshBasicMaterial,surface:number,uniforms:Record<string,THREE.IUniform>,options:{preserveColor?:boolean}={}){
 const before=material.onBeforeCompile,key=material.customProgramCacheKey();
 material.onBeforeCompile=(shader,renderer)=>{
  before.call(material,shader,renderer);Object.assign(shader.uniforms,uniforms,{mixedSurface:{value:surface},mixedPreserveColor:{value:options.preserveColor?1:0}});
  shader.vertexShader=shader.vertexShader.replace('#include <common>','#include <common>\nvarying vec3 mixedWorld,mixedNormal;').replace('#include <fog_vertex>',`#include <fog_vertex>
   vec4 mixPosition=vec4(transformed,1.);vec3 mixNormal=normal;
   #ifdef USE_INSTANCING
    mixPosition=instanceMatrix*mixPosition;
    mat3 mixInstance=mat3(instanceMatrix);
    mixNormal/=vec3(dot(mixInstance[0],mixInstance[0]),dot(mixInstance[1],mixInstance[1]),dot(mixInstance[2],mixInstance[2]));
    mixNormal=mixInstance*mixNormal;
   #endif
   mixedWorld=(modelMatrix*mixPosition).xyz;mixedNormal=normalize(mat3(modelMatrix)*mixNormal);
  `);
  shader.fragmentShader=shader.fragmentShader.replace('#include <common>',`#include <common>
   varying vec3 mixedWorld,mixedNormal;uniform sampler2D brush,uField;
   uniform float strokeSize,relief,variation,paletteShift,soilMoss,soilWet,mixedCoverage,mixedSurface,mixedRealLighting,mixedPreserveColor;
   ${MIXED_PALETTE_GLSL}
   ${MIXED_SURFACE_GLSL}
  `).replace('#include <color_fragment>',`#include <color_fragment>
   if(mixedPreserveColor>.5&&mixedCoverage>0.)diffuseColor.rgb=mix(diffuseColor.rgb,continuousMixedPaint(mixedWorld,mixedNormal,mixedSurface,diffuseColor.rgb),mixedCoverage);
  `).replace('#include <opaque_fragment>',`if(mixedPreserveColor<.5&&mixedCoverage>0.){vec3 pigment=continuousMixedPaint(mixedWorld,mixedNormal,mixedSurface,diffuseColor.rgb);vec3 illumination=clamp(outgoingLight/max(diffuseColor.rgb,vec3(.04)),vec3(.14),vec3(1.));outgoingLight=mix(outgoingLight,pigment*mix(vec3(1.),illumination*.82,mixedRealLighting),mixedCoverage);}
   #include <opaque_fragment>`);
 };
 material.customProgramCacheKey=()=>key+`-continuous-mixed-surface-${surface}-${!!options.preserveColor}-v2`;material.needsUpdate=true;
}
