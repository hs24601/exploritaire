import * as THREE from 'three';
import {createFlurryFaceRig,flurryFaceUV,type FlurryFaceId} from '../sticker/flurryExpressions';

/** Keep the ordinary mapped material for alpha-aware world prop picking.
 * Blink only the eye half of the atlas, preserving the current mouth/blush. */
export function rigFlurryFace(material:THREE.MeshBasicMaterial,random:()=>number=Math.random){
 const map=material.map!;map.repeat.set(.25,.2);map.generateMipmaps=false;map.minFilter=THREE.LinearFilter;
 const rig=createFlurryFaceRig(random),base={value:new THREE.Vector2()},blink={value:new THREE.Vector2()},active={value:0};
 const before=material.onBeforeCompile,key=material.customProgramCacheKey();
 material.onBeforeCompile=(shader,renderer)=>{before.call(material,shader,renderer);Object.assign(shader.uniforms,{flurryFaceOffset:base,flurryBlinkOffset:blink,flurryBlink:active});
  shader.fragmentShader='uniform vec2 flurryFaceOffset,flurryBlinkOffset;uniform float flurryBlink;\n'+shader.fragmentShader;
  shader.fragmentShader=shader.fragmentShader.replace('#include <map_fragment>',`vec2 localFaceUv=(vMapUv-flurryFaceOffset)*vec2(4.,5.);
   vec2 blinkUv=localFaceUv/vec2(4.,5.)+flurryBlinkOffset;
   float blinkMask=step(.5,localFaceUv.y)*flurryBlink;
   diffuseColor*=mix(texture2D(map,vMapUv),texture2D(map,blinkUv),blinkMask);`);
 };material.customProgramCacheKey=()=>key+'-flurry-emotions-v2';material.needsUpdate=true;
 let pose=rig.update(0,true);
 return {update(seconds:number,reduced=false,override?:FlurryFaceId){pose=rig.update(seconds,reduced);if(override&&!reduced)pose={face:override,blink:null};const cell=flurryFaceUV(pose.face),eyelids=flurryFaceUV(pose.blink??'blink-half');map.offset.set(cell.x,cell.y);base.value.set(cell.x,cell.y);blink.value.set(eyelids.x,eyelids.y);active.value=pose.blink?1:0;map.updateMatrix();return pose;},get pose(){return pose;}};
}
