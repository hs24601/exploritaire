import * as THREE from 'three';
export type SentientOverlapMode='outline'|'cutout';
export type SentientPlane=THREE.Mesh<THREE.BufferGeometry,THREE.MeshBasicMaterial>;

/** Project a hidden sentient plane's alpha contour onto its sentient occluder.
 * Normal depth, fog, atlas selection and mirroring stay intact. No capture,
 * fullscreen mask, new light, material replacement or extra render pass. */
export function createSentientOverlap(materials:THREE.Material[]){
 const uniforms={sentientEnabled:{value:0},sentientMap:{value:null as THREE.Texture|null},sentientInverse:{value:new THREE.Matrix4()},sentientUv:{value:new THREE.Matrix3()},sentientBounds:{value:new THREE.Vector4(.5,0,1,1)}};
 for(const material of materials){const before=material.onBeforeCompile,key=material.customProgramCacheKey();
  material.onBeforeCompile=(shader,renderer)=>{before.call(material,shader,renderer);Object.assign(shader.uniforms,uniforms);
   shader.vertexShader='varying vec3 sentientFragmentWorld;\n'+shader.vertexShader;
   shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nsentientFragmentWorld=(modelMatrix*vec4(transformed,1.)).xyz;');
   shader.fragmentShader=`varying vec3 sentientFragmentWorld;uniform float sentientEnabled;uniform sampler2D sentientMap;uniform mat4 sentientInverse;uniform mat3 sentientUv;uniform vec4 sentientBounds;
    float sentientAlpha(vec2 uv){if(any(lessThan(uv,vec2(0.)))||any(greaterThan(uv,vec2(1.))))return 0.;return texture2D(sentientMap,(sentientUv*vec3(uv,1.)).xy).a;}
    vec2 sentientSpread(vec2 uv,float r){float a=sentientAlpha(uv),hi=a,lo=a;for(int i=0;i<8;i++){float t=float(i)*.7853981634;float n=sentientAlpha(uv+vec2(cos(t),sin(t))*r);hi=max(hi,n);lo=min(lo,n);}return vec2(hi,lo);}
   `+shader.fragmentShader;
   shader.fragmentShader=shader.fragmentShader.replace('#include <alphatest_fragment>',`if(sentientEnabled>.5){
    vec3 origin=(sentientInverse*vec4(cameraPosition,1.)).xyz,ray=(sentientInverse*vec4(sentientFragmentWorld,1.)).xyz-origin;
    if(abs(ray.z)>.000001){float along=-origin.z/ray.z;vec2 actorUv=(origin+ray*along).xy*sentientBounds.zw+sentientBounds.xy;
     if(along>1.001&&all(greaterThan(actorUv,vec2(-.06)))&&all(lessThan(actorUv,vec2(1.06)))){
      vec2 edge=sentientSpread(actorUv,.012),glow=sentientSpread(actorUv,.035);
      float stroke=smoothstep(.2,.65,edge.x)*(1.-smoothstep(.2,.65,edge.y));
      float halo=smoothstep(.15,.6,glow.x)*(1.-smoothstep(.15,.6,glow.y));
      diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.5,1.15,1.65),halo*.38);diffuseColor.rgb=mix(diffuseColor.rgb,vec3(1.25,2.05,2.4),stroke*.94);
     }
    }
   }
   #include <alphatest_fragment>`);
  };material.customProgramCacheKey=()=>key+'-sentient-overlap-v1';material.needsUpdate=true;
 }
 return {update(actor?:SentientPlane){const map=actor?.material.map;uniforms.sentientEnabled.value=actor?.visible&&map?1:0;if(!actor||!map)return;
   actor.updateWorldMatrix(true,false);map.updateMatrix();uniforms.sentientInverse.value.copy(actor.matrixWorld).invert();uniforms.sentientUv.value.copy(map.matrix);uniforms.sentientMap.value=map;
   if(!actor.geometry.boundingBox)actor.geometry.computeBoundingBox();const b=actor.geometry.boundingBox!,w=b.max.x-b.min.x,h=b.max.y-b.min.y;
   if(w<=0||h<=0){uniforms.sentientEnabled.value=0;return;}uniforms.sentientBounds.value.set(-b.min.x/w,-b.min.y/h,1/w,1/h);
  },get enabled(){return !!uniforms.sentientEnabled.value;}};
}
