import * as THREE from 'three';
/** Open only the projected printed rank quads through Hero. Floor/scenery depth remains intact. */
export function createWorldGridRankClearance(material:THREE.MeshBasicMaterial){
 const previous=material.onBeforeCompile,oldKey=material.customProgramCacheKey;
 const count={value:0},quads={value:Array.from({length:32},()=>new THREE.Vector3())};
 material.onBeforeCompile=(shader,renderer)=>{previous.call(material,shader,renderer);shader.uniforms.worldGridRankCount=count;shader.uniforms.worldGridRankQuads=quads;
  shader.vertexShader='varying vec4 vWorldGridClip;\n'+shader.vertexShader;shader.vertexShader=shader.vertexShader.replace('#include <project_vertex>','#include <project_vertex>\nvWorldGridClip=gl_Position;');
  shader.fragmentShader=`varying vec4 vWorldGridClip;uniform int worldGridRankCount;uniform vec3 worldGridRankQuads[32];
 float gridEdge(vec2 a,vec2 b,vec2 p){return (b.x-a.x)*(p.y-a.y)-(b.y-a.y)*(p.x-a.x);}
 `+shader.fragmentShader;
  shader.fragmentShader=shader.fragmentShader.replace('#include <alphatest_fragment>',`#include <alphatest_fragment>
 vec2 gridP=vWorldGridClip.xy/vWorldGridClip.w*.5+.5;
 for(int i=0;i<8;i++){if(i>=worldGridRankCount)break;vec3 a=worldGridRankQuads[i*4],b=worldGridRankQuads[i*4+1],c=worldGridRankQuads[i*4+2],d=worldGridRankQuads[i*4+3];
 float e0=gridEdge(a.xy,b.xy,gridP),e1=gridEdge(b.xy,c.xy,gridP),e2=gridEdge(c.xy,d.xy,gridP),e3=gridEdge(d.xy,a.xy,gridP);
 if(((min(min(e0,e1),min(e2,e3))>=0.)||(max(max(e0,e1),max(e2,e3))<=0.))&&gl_FragCoord.z<(a.z+b.z+c.z+d.z)*.25-.000001)discard;}
 `);
 };
 material.customProgramCacheKey=()=>oldKey.call(material)+'-world-grid-rank-clearance-v1';material.needsUpdate=true;
 return {update(camera:THREE.Camera,surfaces:THREE.Vector3[][],enabled:boolean){count.value=enabled?Math.min(8,surfaces.length):0;for(let i=0;i<count.value;i++)for(let j=0;j<4;j++){const p=quads.value[i*4+j].copy(surfaces[i][j]).project(camera);p.set(p.x*.5+.5,p.y*.5+.5,p.z*.5+.5);}},
 dispose(){material.onBeforeCompile=previous;material.customProgramCacheKey=oldKey;material.needsUpdate=true;}};
}
