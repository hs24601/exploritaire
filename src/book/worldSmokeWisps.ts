import * as THREE from 'three';
// Smoke motion adapted from Patch particle-physics (788280e4) and Daniel
// Greenheck's Three.js Particle Fluids (MIT). Notices: vendor/patch-particle-physics.
import {seeded} from './castlePaint';
import {WATERCOLOR_NOISE} from './castleWatercolor';
import {STUDIO_HEIGHT_GLSL} from './worldStudioField';
import type {StudioAtmosphere} from './worldStudioDocument';

/** Analytic integral of a cooling buoyant tracer. The reference uses
 * Boussinesq heat=3, exponential cooling=.6, six-second tracers and swirl=.35.
 * This WebGL effect adapts those motions, not its WebGPU/SPH fluid solver. */
export function smokeRise(age:number,heat:number,cooling=.6){
 return cooling<.001?.5*heat*age*age:heat*(age/cooling-(1-Math.exp(-cooling*age))/(cooling*cooling));
}
export function createSmokeWisps(root:THREE.Group,field:{texture:THREE.Texture;heightMap:THREE.Texture;terrainSize:number},dry:(x:number,z:number)=>boolean,low=false){
 const count=low?96:192,random=seeded(111062),origins=new Float32Array(count*3),seeds=new Float32Array(count*3);
 for(let i=0;i<count;i++){
  let x=0,z=0;for(let tries=0;tries<150;tries++){x=(random()-.5)*200;z=(random()-.5)*194;if(dry(x,z))break;}
  if(i%5===0){x=-72+(random()-.5)*24;z=-68+(random()-.5)*15;}
  origins.set([x,0,z],i*3);seeds.set([random()*Math.PI*2,random(),random()],i*3);
 }
 const plane=new THREE.PlaneGeometry(1,1),geometry=new THREE.InstancedBufferGeometry();geometry.setIndex(plane.index);geometry.setAttribute('position',plane.attributes.position);geometry.setAttribute('uv',plane.attributes.uv);geometry.setAttribute('smokeOrigin',new THREE.InstancedBufferAttribute(origins,3));geometry.setAttribute('smokeSeed',new THREE.InstancedBufferAttribute(seeds,3));geometry.instanceCount=count;
 const uniforms={time:{value:0},smokeDensity:{value:.6},buoyancy:{value:3},swirl:{value:.35},uTerrain:{value:field.heightMap},uTerrainSize:{value:field.terrainSize},uField:{value:field.texture}};
 const material=new THREE.ShaderMaterial({transparent:true,depthWrite:false,side:THREE.DoubleSide,uniforms,
  vertexShader:`attribute vec3 smokeOrigin,smokeSeed;uniform float time,buoyancy,swirl;varying vec2 q;varying float fade,phase;varying vec3 world;
   ${STUDIO_HEIGHT_GLSL}
   void main(){q=uv;float age=mod(time*.65+smokeSeed.y*6.,6.);phase=smokeSeed.x;
    float cooled=exp(-.6*age);float rise=buoyancy*(age/.6-(1.-cooled)/.36)*.16;
    float turn=phase+swirl*age;vec3 p=smokeOrigin;
    p.xz+=vec2(cos(turn),sin(turn))*(.5+age*.28)+vec2(age*.32,sin(time*.13+phase)*.8);
    p.y=groundHeightAt(p.xz)+.5+rise;
    world=(modelMatrix*vec4(p,1.)).xyz;vec4 view=viewMatrix*vec4(world,1.);
    vec2 size=vec2(3.+smokeSeed.z*3.,4.+age*.9)*(1.+age*.08);view.xy+=position.xy*size;
    gl_Position=projectionMatrix*view;fade=smoothstep(0.,.6,age)*(1.-smoothstep(3.8,6.,age));
   }`,
  fragmentShader:`varying vec2 q;varying float fade,phase;varying vec3 world;uniform float time,smokeDensity;
   ${WATERCOLOR_NOISE}
   void main(){vec2 p=(q-.5)*2.;p.x+=sin(p.y*4.5-time*.3+phase)*.14;
    float edge=exp(-p.x*p.x*3.-p.y*p.y*1.7)*(1.-smoothstep(.65,1.,max(abs(p.x),abs(p.y))));
    float cloud=wcFbm(vec3(q*vec2(3.2,3.8)+vec2(sin(phase),-time*.10),phase));
    float ink=smoothstep(.25,.64,cloud)*edge;
    gl_FragColor=vec4(mix(vec3(.48,.53,.49),vec3(.73,.76,.69),cloud),ink*fade*smokeDensity*.30);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
   }`});
 const mesh=new THREE.Mesh(geometry,material);mesh.name='patch-adapted-smoke-wisps';mesh.frustumCulled=false;mesh.visible=false;mesh.userData.skipWaterReflection=true;root.add(mesh);
 return {mesh,apply(settings:StudioAtmosphere){mesh.visible=settings.smokeWisps&&settings.smokeDensity>0;uniforms.smokeDensity.value=settings.smokeDensity;uniforms.buoyancy.value=settings.buoyancy;uniforms.swirl.value=settings.swirl;},update(seconds:number){uniforms.time.value=seconds;},setLow(){geometry.instanceCount=Math.min(count,96);},get diagnostics(){return {enabled:mesh.visible,particles:geometry.instanceCount,renderer:'WebGL adapted buoyant/cooling wisps',draws:mesh.visible?1:0};},dispose(){mesh.removeFromParent();geometry.dispose();material.dispose();}};
}
