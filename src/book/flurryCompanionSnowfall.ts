import * as THREE from 'three';
import {createFlurrySnowfallState} from './flurrySnowfallState';
/** One bounded batch per visited scene. Grounded flakes keep their world positions and melt. */
export function createCompanionSnowfall(scene:THREE.Scene,height:(x:number,z:number)=>number){
 const pool=createFlurrySnowfallState(),count=pool.airLimit+pool.groundLimit;
 const quad=new THREE.PlaneGeometry(1,1),geometry=new THREE.InstancedBufferGeometry();geometry.setIndex(quad.index!.clone());geometry.setAttribute('position',quad.attributes.position.clone());geometry.setAttribute('uv',quad.attributes.uv.clone());quad.dispose();
 const centers=new THREE.InstancedBufferAttribute(new Float32Array(count*3),3).setUsage(THREE.DynamicDrawUsage),details=new THREE.InstancedBufferAttribute(new Float32Array(count*4),4).setUsage(THREE.DynamicDrawUsage);
 geometry.setAttribute('center',centers);geometry.setAttribute('details',details);geometry.instanceCount=count;
 const material=new THREE.ShaderMaterial({transparent:true,depthTest:true,depthWrite:false,side:THREE.DoubleSide,
  vertexShader:`attribute vec3 center;attribute vec4 details;varying vec2 q;varying float alpha;
   void main(){q=uv;alpha=details.y;vec2 p=position.xy*details.x;float c=cos(details.z),s=sin(details.z);p=mat2(c,-s,s,c)*p;
    vec4 view;if(details.w>.5){vec3 ground=center+vec3(p.x,0.,p.y);view=viewMatrix*vec4(ground,1.);}else{view=viewMatrix*vec4(center,1.);view.xy+=p;}gl_Position=projectionMatrix*view;}`,
  fragmentShader:`varying vec2 q;varying float alpha;
   float segment(vec2 p,vec2 a,vec2 b){vec2 v=b-a;return length(p-a-v*clamp(dot(p-a,v)/dot(v,v),0.,1.));}
   void main(){vec2 p=(q-.5)*2.;float angle=atan(p.y,p.x),sector=mod(angle+3.14159265/6.,3.14159265/3.)-3.14159265/6.;vec2 arm=vec2(cos(sector),sin(sector))*length(p);
    float stem=segment(arm,vec2(0.),vec2(.76,0.));float branches=min(segment(arm,vec2(.43,0.),vec2(.61,.18)),segment(arm,vec2(.43,0.),vec2(.61,-.18)));
    float ice=1.-smoothstep(.03,.075,min(stem,branches));float halo=exp(-dot(p,p)*5.5)*.09;
    gl_FragColor=vec4(mix(vec3(.55,.8,.95),vec3(1.2,1.3,1.4),ice),(ice*.7+halo)*alpha);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
   }`});
 const mesh=new THREE.Mesh(geometry,material);mesh.name='Flurry released snowfall and ground accumulation';mesh.frustumCulled=false;mesh.userData.skipWaterReflection=true;scene.add(mesh);
 return {mesh,update(dt:number,emitter?:THREE.Vector3){pool.step(dt,height,emitter);
  pool.particles.forEach((p,i)=>{if(!p){details.setY(i,0);return;}centers.setXYZ(i,p.x,p.y,p.z);details.setXYZW(i,p.size,(p.ground?.35:.75)*Math.min(1,p.life/8),p.angle,p.ground?1:0);});
  centers.needsUpdate=details.needsUpdate=true;mesh.visible=pool.particles.some(Boolean);
 },get diagnostics(){return pool.diagnostics;},dispose(){mesh.removeFromParent();geometry.dispose();material.dispose();}};
}
