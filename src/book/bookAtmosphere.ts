import * as THREE from 'three';
import {forestHeightFogGLSL,heightFogAmount} from '../tooling/forestHeightFog';
import {DEFAULT_BOOK_ATMOSPHERE,type BookAtmosphere} from './pageDocument';
import {forestPaintGLSL} from './forestPaint';
/** A scene-owned bank has a fixed optical thickness instead of integrating the
 * changing camera ray. Keep the lab's physical depth mode available for comparison. */
export function bookFogAmount(distance:number,cameraHeight:number,surfaceHeight:number,settings:BookAtmosphere){
 if(!settings.enabled)return 0;
 if(settings.mode==='depth')return heightFogAmount(distance,cameraHeight,surfaceHeight,settings);
 const t=THREE.MathUtils.clamp((surfaceHeight-settings.height+settings.softness)/(2*Math.max(.01,settings.softness)),0,1);
 const height=(settings.thickness??6)*settings.density*(1-t*t*(3-2*t)),haze=(settings.distanceDensity??0)*Math.max(0,distance-(settings.distanceStart??0));return 1-Math.exp(-height-haze);
}
export const bookAtmosphereGLSL=forestHeightFogGLSL+/* glsl */`
${forestPaintGLSL}
uniform float bookFogPerimeter;
uniform float bookFogPaintMask;
uniform float bookFogConsistent;
uniform float bookFogThickness;
uniform float bookFogDistanceDensity;
uniform float bookFogDistanceStart;
uniform vec4 bookFogBounds;
vec3 applyBookFog(vec3 color,vec3 worldPosition){
 float radial=max(abs(worldPosition.x)/5.85,abs(worldPosition.z)/3.75);
 float outward=smoothstep(.45,1.65,radial),densityScale=mix(1.,.48+1.75*outward,bookFogPerimeter);
 vec3 original=color;color*=1.-bookFogPerimeter*outward*.7;
 float amount=1.0-exp(-bookFogThickness*fogDensity*densityScale*forestFogProfile(worldPosition.y));
 vec3 fogged=bookFogConsistent<0.5?applyForestFog(color,worldPosition):mix(color,fogColor*(1.-bookFogPerimeter*outward*.8),clamp(amount,0.0,1.0));
 float haze=1.-exp(-bookFogDistanceDensity*max(0.,distance(cameraPosition,worldPosition)-bookFogDistanceStart));fogged=mix(fogged,fogColor*(1.-bookFogPerimeter*outward*.8),haze);
 vec2 edge=smoothstep(bookFogBounds.xy,bookFogBounds.xy+vec2(.6),worldPosition.xz)*(1.-smoothstep(bookFogBounds.zw-vec2(.6),bookFogBounds.zw,worldPosition.xz));
 return mix(original,fogged,mix(edge.x*edge.y,1.,bookFogPerimeter)*(bookFogPaintMask>.5?forestPaintBehind(worldPosition):1.));
}
`;
export function createBookAtmosphere(){
 const uniforms={bookFogPerimeter:{value:0},bookFogPaintMask:{value:0},forestPaintProgress:{value:1},fogColor:{value:new THREE.Color(DEFAULT_BOOK_ATMOSPHERE.color)},fogHeight:{value:4},fogSoftness:{value:3},fogDensity:{value:0},bookFogConsistent:{value:1},bookFogThickness:{value:6},bookFogDistanceDensity:{value:0},bookFogDistanceStart:{value:0},bookFogBounds:{value:new THREE.Vector4(-1000,-1000,1000,1000)}};
 let settings={...DEFAULT_BOOK_ATMOSPHERE};
 return {maskPaint(progress:number|undefined){uniforms.bookFogPaintMask.value=progress===undefined?0:1;uniforms.forestPaintProgress.value=progress??1;},get current(){return settings;},get lightFactor(){return settings.enabled?1-settings.darkness*.85:1;},set(value:BookAtmosphere,bounds?:[number,number,number,number],perimeter=false){settings=value;uniforms.bookFogPerimeter.value=value.enabled&&perimeter?1:0;uniforms.bookFogBounds.value.fromArray(bounds??[-1000,-1000,1000,1000]);uniforms.bookFogConsistent.value=value.mode==='depth'?0:1;uniforms.bookFogThickness.value=value.thickness??6;uniforms.bookFogDistanceDensity.value=value.enabled?(value.distanceDensity??0):0;uniforms.bookFogDistanceStart.value=value.distanceStart??0;uniforms.fogColor.value.set(value.color);uniforms.fogHeight.value=value.height;uniforms.fogSoftness.value=value.softness;uniforms.fogDensity.value=value.enabled?value.density:0;},attach(root:THREE.Object3D){root.traverse(object=>{
  if(!(object instanceof THREE.Mesh)||object.userData.bookStory||object.userData.editorHelper||object.userData.bookCachedSurface)return;
  for(const material of Array.isArray(object.material)?object.material:[object.material]){
   if(material.userData.bookHeightFog||!(material instanceof THREE.MeshBasicMaterial||material instanceof THREE.MeshLambertMaterial||material instanceof THREE.MeshStandardMaterial))continue;
   material.userData.bookHeightFog=true;const before=material.onBeforeCompile.bind(material),key=material.customProgramCacheKey.bind(material);
   material.onBeforeCompile=(shader,renderer)=>{before(shader,renderer);Object.assign(shader.uniforms,uniforms);shader.vertexShader='varying vec3 bookFogWorld;\n'+shader.vertexShader;shader.vertexShader=shader.vertexShader.replace('#include <project_vertex>','#include <project_vertex>\nbookFogWorld=(modelMatrix*vec4(transformed,1.)).xyz;');shader.fragmentShader=bookAtmosphereGLSL+'\nvarying vec3 bookFogWorld;\n'+shader.fragmentShader;shader.fragmentShader=shader.fragmentShader.replace('#include <opaque_fragment>','outgoingLight=applyBookFog(outgoingLight,bookFogWorld);\n'+(object.userData.bookSurround?'diffuseColor.a*=1.-bookFogPerimeter*smoothstep(1.4,3.2,max(abs(bookFogWorld.x)/5.85,abs(bookFogWorld.z)/3.75));if(diffuseColor.a<.01)discard;\n':'')+'#include <opaque_fragment>');};
   material.customProgramCacheKey=()=>key()+':book-height-fog-v3'+(object.userData.bookSurround?':surround':'');material.needsUpdate=true;
  }
 });}};
}
