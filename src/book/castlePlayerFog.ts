import * as THREE from 'three';
import type {BookRenderQuality} from './viewportPolicy';

export const fogSampleBudget=(quality:BookRenderQuality)=>quality==='low'?2:quality==='high'?6:4;
export function playerFogClearance(distance:number) {return .045+.955*THREE.MathUtils.smoothstep(distance,5,24);}
/** World-space rim banks deepen into a tall blanket beyond the playable basin. */
export function craterMistDensity(x:number,y:number,z:number){
  const radius=Math.hypot(x/123,(z-10)/126);
  const rim=THREE.MathUtils.smoothstep(radius,.68,.98)*(1-THREE.MathUtils.smoothstep(radius,1.1,1.55));
  const outside=THREE.MathUtils.smoothstep(radius,.94,1.5);
  return (.010*rim*Math.exp(-Math.max(0,y-3)*.055)+.038*outside*Math.exp(-Math.max(0,y-24)*.018))*THREE.MathUtils.smoothstep(y,-30,-12);
}

/** A bounded, world-space participating volume. Integration stops at the visible
 * surface, so masonry occludes the fog behind it without a depth prepass.
 * Shared by scenery and sky; the clearing is attached to Hero, never the camera. */
export const PLAYER_FOG_GLSL=/* glsl */`
uniform vec3 uFogPlayer, uFogLamps[6];
uniform float uFogPower[6],uFogTime,uFogSamples,uFogEnabled;
float castleOuterMist(vec3 p){
  float radius=length(vec2(p.x/123.,(p.z-10.)/126.));
  float rim=smoothstep(.68,.98,radius)*(1.-smoothstep(1.1,1.55,radius));
  float outside=smoothstep(.94,1.5,radius);
  return (.010*rim*exp(-max(0.,p.y-3.)*.055)+.038*outside*exp(-max(0.,p.y-24.)*.018))*smoothstep(-30.,-12.,p.y);
}
float castleFogDensity(vec3 p){
  float clearing=.045+.955*smoothstep(5.,24.,length((p-uFogPlayer)*vec3(1.,.6,1.)));
  float bank=exp(-max(0.,p.y+1.)*.20)*smoothstep(-5.,-1.5,p.y);
  float folds=.64+.22*sin(p.x*.067+sin(p.z*.053)+uFogTime*.045)
    +.14*sin(p.z*.109+p.y*.37-uFogTime*.029);
  return (.025*bank+castleOuterMist(p))*clearing*folds;
}
vec2 castleFogInterval(vec3 origin,vec3 direction,float distance){
  float start=0.,end=min(distance,1200.);
  if(abs(direction.y)>.0001){
    float a=(-30.-origin.y)/direction.y,b=(120.-origin.y)/direction.y;
    start=max(0.,min(a,b));end=min(end,max(a,b));
  }else if(origin.y>120.||origin.y< -30.)end=0.;
  return vec2(start,max(start,end));
}
float castleFogOpticalDepth(vec3 origin,vec3 endPoint){
  if(uFogEnabled<.5)return 0.;
  vec3 delta=endPoint-origin;
  float distance=length(delta);
  vec3 direction=delta/max(.001,distance);
  vec2 interval=castleFogInterval(origin,direction,distance);
  float span=interval.y-interval.x,optical=0.;
  for(int i=0;i<6;i++){
    if(float(i)>=uFogSamples)break;
    float a=float(i)/uFogSamples,b=float(i+1)/uFogSamples;
    // Quadratic spacing resolves the nearby clearing before distant banks.
    float t=interval.x+span*(a*a+b*b)*.5;
    optical+=castleFogDensity(origin+direction*t)*span*(b*b-a*a);
  }
  return optical;
}
vec3 castleFog(vec3 color,vec3 origin,vec3 endPoint){
  float transmission=exp(-castleFogOpticalDepth(origin,endPoint));
  vec3 delta=endPoint-origin;
  float distance=length(delta);
  vec3 direction=delta/max(.001,distance);
  vec2 interval=castleFogInterval(origin,direction,distance);
  float outer=smoothstep(.72,1.5,length(vec2(endPoint.x/123.,(endPoint.z-10.)/126.)));
  vec3 scattered=mix(vec3(.035,.060,.095),vec3(.095,.14,.18),outer);
  // Bounded lantern halos inside the traversed volume. No extra light/shadow passes.
  for(int i=0;i<6;i++){
    float t=clamp(dot(uFogLamps[i]-origin,direction),interval.x,interval.y);
    vec3 p=origin+direction*t;
    float reach=max(0.,1.-length(p-uFogLamps[i])/10.);
    scattered+=vec3(.24,.095,.018)*reach*reach*uFogPower[i];
  }
  return color*transmission+scattered*(1.-transmission);
}
`;

export function createPlayerFog(quality:BookRenderQuality,reduced:boolean,lights:{positions:THREE.Vector3[];power:{value:number[]}}) {
  const player=new THREE.Vector3();
  const uniforms={uFogPlayer:{value:player},uFogLamps:{value:lights.positions},uFogPower:lights.power,uFogTime:{value:0},uFogSamples:{value:fogSampleBudget(quality)},uFogEnabled:{value:1}};
  let still=reduced||quality==='low';
  return {
    uniforms,
    shade(material:THREE.MeshLambertMaterial){
      const previous=material.onBeforeCompile;
      const key=material.customProgramCacheKey();
      material.onBeforeCompile=(shader,renderer)=>{
        previous.call(material,shader,renderer);Object.assign(shader.uniforms,uniforms);
        shader.fragmentShader=shader.fragmentShader
          .replace('#include <common>','#include <common>\n'+PLAYER_FOG_GLSL)
          .replace('#include <tonemapping_fragment>','gl_FragColor.rgb=castleFog(gl_FragColor.rgb,cameraPosition,vWcPos);\n#include <tonemapping_fragment>');
      };
      material.customProgramCacheKey=()=>key+'-player-volume-v1';return material;
    },
    shadeActor(material:THREE.MeshBasicMaterial){
      const previous=material.onBeforeCompile;
      const key=material.customProgramCacheKey();
      material.onBeforeCompile=(shader,renderer)=>{
        previous.call(material,shader,renderer);Object.assign(shader.uniforms,uniforms);
        shader.vertexShader=shader.vertexShader
          .replace('#include <common>','#include <common>\nvarying vec3 vFogActorWorld;')
          .replace('#include <fog_vertex>',`#include <fog_vertex>
            vec4 fogWorld=vec4(transformed,1.);
            #ifdef USE_INSTANCING
              fogWorld=instanceMatrix*fogWorld;
            #endif
            vFogActorWorld=(modelMatrix*fogWorld).xyz;`);
        shader.fragmentShader=shader.fragmentShader
          .replace('#include <common>','#include <common>\nvarying vec3 vFogActorWorld;\n'+PLAYER_FOG_GLSL)
          .replace('#include <tonemapping_fragment>','gl_FragColor.rgb=castleFog(gl_FragColor.rgb,cameraPosition,vFogActorWorld);\n#include <tonemapping_fragment>');
      };
      material.customProgramCacheKey=()=> key+'-castle-player-actor-fog-v2';return material;
    },
    update(seconds:number,x:number,y:number,z:number){player.set(x,y+.8,z);uniforms.uFogTime.value=still?0:seconds;},
    setLow(){still=true;uniforms.uFogSamples.value=2;uniforms.uFogTime.value=0;},
    setEnabled(enabled:boolean){uniforms.uFogEnabled.value=enabled?1:0;},
    densityAt(x:number,y:number,z:number){
      if(!uniforms.uFogEnabled.value)return 0;
      const d=Math.hypot(x-player.x,(y-player.y)*.6,z-player.z);
      const bank=Math.exp(-Math.max(0,y+1)*.20)*THREE.MathUtils.smoothstep(y,-5,-1.5);
      const time=uniforms.uFogTime.value;
      const folds=.64+.22*Math.sin(x*.067+Math.sin(z*.053)+time*.045)+.14*Math.sin(z*.109+y*.37-time*.029);
      return (.025*bank+craterMistDensity(x,y,z))*playerFogClearance(d)*folds;
    },
    get diagnostics(){return {enabled:Boolean(uniforms.uFogEnabled.value),samples:uniforms.uFogSamples.value,player:player.toArray(),animated:!still,nearRadius:5,farRadius:24,craterMist:true,volumeHeight:120,volumeReach:1200};},
  };
}
