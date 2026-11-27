import * as THREE from 'three';
import {seeded} from './castlePaint';

export const FLURRY_STORM={height:26,radius:4.6,lowCount:384,count:768};
export {flurryCuriosity} from '../sticker/flurryIdle';

/** One bounded, depth-tested GPU batch. A soft halo is part of each flake,
 * without point lights, bloom, per-frame buffer uploads or a capture pass. */
export function createFlurryStorm(root:THREE.Group,point:THREE.Vector3,low=false,height:(x:number,z:number)=>number=()=>point.y){
 const count=low?FLURRY_STORM.lowCount:FLURRY_STORM.count,random=seeded(111127),origins=new Float32Array(count*3),seeds=new Float32Array(count*4);
 for(let i=0;i<count;i++){
  const angle=random()*Math.PI*2,near=i%4===0,r=Math.sqrt(random())*(near?2.1:FLURRY_STORM.radius),x=Math.cos(angle)*r,z=Math.sin(angle)*r;
  origins.set([x,height(point.x+x,point.z+z)-point.y,z],i*3);seeds.set([random(),random(),random(),near?1:0],i*4);
 }
 const plane=new THREE.PlaneGeometry(1,1),geometry=new THREE.InstancedBufferGeometry();geometry.setIndex(plane.index!.clone());geometry.setAttribute('position',plane.attributes.position.clone());geometry.setAttribute('uv',plane.attributes.uv.clone());plane.dispose();
 geometry.setAttribute('flakeOrigin',new THREE.InstancedBufferAttribute(origins,3));geometry.setAttribute('flakeSeed',new THREE.InstancedBufferAttribute(seeds,4));geometry.instanceCount=count;
 const time={value:0},material=new THREE.ShaderMaterial({transparent:true,depthWrite:false,side:THREE.DoubleSide,uniforms:{time},
  vertexShader:`attribute vec3 flakeOrigin;attribute vec4 flakeSeed;uniform float time;varying vec2 q;varying float opacity,spin;varying vec3 stormWorld;
   void main(){q=uv;float fall=fract(flakeSeed.x+time*(.027+flakeSeed.y*.026));float age=1.-fall;
    float phase=flakeSeed.z*6.283185;float reach=mix(26.,6.,flakeSeed.w);vec3 p=flakeOrigin;
    p.y+=.25+age*reach;p.x+=sin(time*.24+phase+age*5.)*(.25+.5*age);p.z+=cos(time*.19+phase+age*3.)*.45;
    stormWorld=(modelMatrix*vec4(p,1.)).xyz;vec4 view=viewMatrix*vec4(stormWorld,1.);
    float size=.12+flakeSeed.y*.2;view.xy+=position.xy*size;gl_Position=projectionMatrix*view;
    spin=phase+time*(.35+flakeSeed.y*.6);opacity=smoothstep(0.,.06,fall)*(1.-smoothstep(.92,1.,fall));
   }`,
  fragmentShader:`varying vec2 q;varying float opacity,spin;
   float segment(vec2 p,vec2 a,vec2 b){vec2 v=b-a;return length(p-a-v*clamp(dot(p-a,v)/dot(v,v),0.,1.));}
   void main(){vec2 p=(q-.5)*2.;float c=cos(spin),s=sin(spin);p=mat2(c,-s,s,c)*p;
    float angle=atan(p.y,p.x),sector=mod(angle+3.14159265/6.,3.14159265/3.)-3.14159265/6.;vec2 arm=vec2(cos(sector),sin(sector))*length(p);
    float stem=segment(arm,vec2(0.),vec2(.76,0.));
    float branches=min(segment(arm,vec2(.43,0.),vec2(.61,.18)),segment(arm,vec2(.43,0.),vec2(.61,-.18)));
    float ice=1.-smoothstep(.025,.065,min(stem,branches));float halo=exp(-dot(p,p)*5.5)*.13;
    float a=(ice*.78+halo)*opacity;gl_FragColor=vec4(mix(vec3(.42,.76,.96),vec3(1.35,1.48,1.55),ice),a);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
   }`});
 const mesh=new THREE.Mesh(geometry,material);mesh.name='flurry-local-snowstorm';mesh.position.copy(point);mesh.frustumCulled=false;mesh.userData.skipWaterReflection=true;mesh.renderOrder=2;root.add(mesh);
 return {mesh,update(seconds:number,reduced=false){time.value=reduced?0:seconds;},setLow(){geometry.instanceCount=Math.min(count,FLURRY_STORM.lowCount);},get diagnostics(){return {flakes:geometry.instanceCount,height:FLURRY_STORM.height,radius:FLURRY_STORM.radius,draws:1,softLuminosity:true,time:time.value};},dispose(){mesh.removeFromParent();geometry.dispose();material.dispose();}};
}
