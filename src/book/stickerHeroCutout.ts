import * as THREE from 'three';
/** Reproject each sticker fragment's viewing ray onto Hero's real sprite plane.
 * Only a Hero behind the sticker punches a padded silhouette opening. No
 * render target, full-screen mask, depth override or bounding-box hole. */
export function createStickerHeroCutout(materials:THREE.Material[]){
 const uniforms={stickerHeroEnabled:{value:0},stickerHeroMap:{value:null as THREE.Texture|null},stickerHeroInverse:{value:new THREE.Matrix4()},stickerHeroUv:{value:new THREE.Matrix3()}};
 for(const material of materials){const before=material.onBeforeCompile,key=material.customProgramCacheKey();
  material.onBeforeCompile=(shader,renderer)=>{before.call(material,shader,renderer);Object.assign(shader.uniforms,uniforms);
   shader.vertexShader='varying vec3 stickerFragmentWorld;\n'+shader.vertexShader;
   shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nstickerFragmentWorld=(modelMatrix*vec4(transformed,1.)).xyz;');
   shader.fragmentShader=`varying vec3 stickerFragmentWorld;uniform float stickerHeroEnabled;uniform sampler2D stickerHeroMap;uniform mat4 stickerHeroInverse;uniform mat3 stickerHeroUv;
    float stickerHeroAlpha(vec2 uv){if(any(lessThan(uv,vec2(0.)))||any(greaterThan(uv,vec2(1.))))return 0.;return texture2D(stickerHeroMap,(stickerHeroUv*vec3(uv,1.)).xy).a;}
    float stickerHeroDilate(vec2 uv,float radius){float a=stickerHeroAlpha(uv);a=max(a,stickerHeroAlpha(uv+vec2(radius,0.)));a=max(a,stickerHeroAlpha(uv-vec2(radius,0.)));a=max(a,stickerHeroAlpha(uv+vec2(0.,radius)));a=max(a,stickerHeroAlpha(uv-vec2(0.,radius)));float d=radius*.7071;a=max(a,stickerHeroAlpha(uv+vec2(d,d)));a=max(a,stickerHeroAlpha(uv+vec2(-d,d)));a=max(a,stickerHeroAlpha(uv+vec2(d,-d)));return max(a,stickerHeroAlpha(uv-vec2(d,d)));}
   `+shader.fragmentShader;
   shader.fragmentShader=shader.fragmentShader.replace('#include <alphatest_fragment>',`if(stickerHeroEnabled>.5){
    vec3 origin=(stickerHeroInverse*vec4(cameraPosition,1.)).xyz,ray=(stickerHeroInverse*vec4(stickerFragmentWorld,1.)).xyz-origin;
    if(abs(ray.z)>.000001){float along=-origin.z/ray.z;vec2 heroUv=(origin+ray*along).xy+vec2(.5,0.);
     if(along>1.001&&all(greaterThan(heroUv,vec2(-.06)))&&all(lessThan(heroUv,vec2(1.06)))){
      if(stickerHeroDilate(heroUv,.018)>.35)discard;
      if(stickerHeroDilate(heroUv,.035)>.35)diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.45,.82,.92),.75);
     }
    }
   }
   #include <alphatest_fragment>`);
  };material.customProgramCacheKey=()=>key+'-hero-alpha-cutout-v1';material.needsUpdate=true;
 }
 return {update(hero?:THREE.Mesh<THREE.BufferGeometry,THREE.MeshBasicMaterial>){const map=hero?.material.map;uniforms.stickerHeroEnabled.value=hero?.visible&&map?1:0;if(!hero||!map)return;hero.updateWorldMatrix(true,false);map.updateMatrix();uniforms.stickerHeroInverse.value.copy(hero.matrixWorld).invert();uniforms.stickerHeroUv.value.copy(map.matrix);uniforms.stickerHeroMap.value=map;}};
}
