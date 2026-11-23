import * as THREE from 'three';
import {seeded} from './castlePaint';

/** Local black wine-colored smoke, one depth-tested batch, no extra lights. */
export function createSlimeMiasma(root:THREE.Group,point:THREE.Vector3,low=false,height:(x:number,z:number)=>number=()=>point.y){
 const count=low?84:144,random=seeded(111171),origins=new Float32Array(count*3),seeds=new Float32Array(count*4);
 for(let i=0;i<count;i++){const a=random()*Math.PI*2,r=Math.sqrt(random())*2.3,x=Math.cos(a)*r,z=Math.sin(a)*r;origins.set([x,height(point.x+x,point.z+z)-point.y,z],i*3);seeds.set([random(),random(),random(),i%8===0?1:0],i*4);}
 const plane=new THREE.PlaneGeometry(1,1),geometry=new THREE.InstancedBufferGeometry();geometry.setIndex(plane.index!.clone());geometry.setAttribute('position',plane.attributes.position.clone());geometry.setAttribute('uv',plane.attributes.uv.clone());plane.dispose();geometry.setAttribute('origin',new THREE.InstancedBufferAttribute(origins,3));geometry.setAttribute('seed',new THREE.InstancedBufferAttribute(seeds,4));geometry.instanceCount=count;
 const time={value:0},material=new THREE.ShaderMaterial({transparent:true,depthWrite:false,uniforms:{time},vertexShader:`attribute vec3 origin;attribute vec4 seed;uniform float time;varying vec2 q;varying vec4 mistSeed;varying vec3 miasmaWorld;void main(){q=uv;float age=fract(seed.x+time*(.05+seed.y*.04));mistSeed=vec4(seed.yz,age,seed.w);vec3 p=origin;p.y+=.15+age*(2.1+seed.y*1.8);p.x+=sin(time*.35+seed.z*6.28+age*4.)*.45;p.z+=cos(time*.27+seed.z*6.28)*.4;miasmaWorld=(modelMatrix*vec4(p,1.)).xyz;vec4 view=viewMatrix*vec4(miasmaWorld,1.);float size=mix(1.1+age*1.7,.10,seed.w);view.xy+=position.xy*size;gl_Position=projectionMatrix*view;}`,fragmentShader:`uniform float time;varying vec2 q;varying vec4 mistSeed;void main(){vec2 p=(q-.5)*2.;float r=length(p);float grain=.65+.35*sin(p.x*12.+sin(p.y*9.+time*.4)+mistSeed.x*6.);float alpha=(1.-smoothstep(.15,1.,r))*sin(mistSeed.z*3.14159)*grain;vec3 color=mix(vec3(.008,.001,.006),vec3(.12,.003,.013),mistSeed.x);color=mix(color,vec3(.32,.004,.018),mistSeed.w);gl_FragColor=vec4(color,alpha*mix(.24,.5,mistSeed.w));
 #include <tonemapping_fragment>
 #include <colorspace_fragment>
 }`});material.userData.basinMistWorld='miasmaWorld';const mesh=new THREE.Mesh(geometry,material);mesh.position.copy(point);mesh.name='dark-slime-red-black-miasma';mesh.frustumCulled=false;mesh.userData.skipWaterReflection=true;root.add(mesh);
 return {mesh,update(seconds:number,reduced=false){time.value=reduced?0:seconds;},setLow(){geometry.instanceCount=Math.min(count,84);},get diagnostics(){return {particles:geometry.instanceCount,draws:1,time:time.value,radius:2.3};},dispose(){mesh.removeFromParent();geometry.dispose();material.dispose();}};
}
