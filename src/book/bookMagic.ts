import * as THREE from 'three';
import {forestPaintOrder} from './forestPaint';

export const BOOK_MAGIC={previewEnd:3.5,arrival:3.5,spine:4.4,rim:5.2,opening:6.1,opened:8.3,paintStart:8.3,paintEnd:17,close:18.2,end:20} as const;
export function magicPhase(t:number,paintEnd=17,close=18.2){return t<3.5?'sketch-preview':t<4.4?'arriving':t<5.2?'spine-sweep':t<6.1?'cover-rim':t<8.3?'lifting-cover':t<paintEnd?'painting':t<close?'painted-world':'closing';}
export function magicPopupOpen(progress:number,x:number,z:number,height:number){
 // The leading folded edge is forward of its hinge. Its first pigment wakes
 // the mechanism; the remaining panel unfolds while the line climbs it.
 const order=forestPaintOrder(x+height*.2,0,z+height*.4);
 return THREE.MathUtils.smoothstep(progress,Math.max(0,order-.018),Math.min(1,order+.12));
}
/** Fixed local coordinates on the top board's perimeter. These ride the hinge. */
export function coverRimPoint(phase:number){
 const width=5.8,depth=7.55,perimeter=2*(width+depth);let s=THREE.MathUtils.euclideanModulo(phase,1)*perimeter;
 if(s<width)return new THREE.Vector3(.05+s,.075,-depth/2);s-=width;
 if(s<depth)return new THREE.Vector3(.05+width,.075,-depth/2+s);s-=depth;
 if(s<width)return new THREE.Vector3(.05+width-s,.075,depth/2);s-=width;
 return new THREE.Vector3(.05,.075,depth/2-s);
}

/** An object-local foil sheen, plus a swarm that arrives from screen-right,
 * crosses the leather and adheres to the cover's rim while it opens. */
export function createBookMagic(world:THREE.Scene,cover:THREE.Group,surfaces:THREE.Mesh[]){
 const uniforms={magicTime:{value:0},magicStrength:{value:0},magicSweep:{value:5.8}};
 for(const mesh of surfaces)for(const mat of Array.isArray(mesh.material)?mesh.material:[mesh.material]){
  const before=mat.onBeforeCompile.bind(mat),key=mat.customProgramCacheKey.bind(mat);
  mat.onBeforeCompile=(shader,r)=>{before(shader,r);Object.assign(shader.uniforms,uniforms);shader.vertexShader='varying vec3 magicLocal;\n'+shader.vertexShader;shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nmagicLocal=position;');shader.fragmentShader='uniform float magicTime,magicStrength,magicSweep;\nvarying vec3 magicLocal;\n'+shader.fragmentShader;shader.fragmentShader=shader.fragmentShader.replace('#include <opaque_fragment>',`float foilPhase=magicLocal.x*.8+magicLocal.y*.35+magicLocal.z*.3-magicTime*.9;
vec3 foil=.5+.5*cos(vec3(0.,2.1,4.2)+foilPhase*5.);
float foilBand=pow(.5+.5*sin(foilPhase*3.),6.);float sheen=pow(1.-abs(dot(normalize(normal),normalize(vViewPosition))),.7);
float wake=exp(-pow((magicLocal.x+2.95-magicSweep)/1.2,2.));
outgoingLight+=magicStrength*foil*(foilBand*.55+sheen*.18)*(.3+.7*wake);
#include <opaque_fragment>`);};mat.customProgramCacheKey=()=>key()+':cover-magic-foil-v1';mat.needsUpdate=true;
 }
 const count=360,positions=new Float32Array(count*3),colors=new Float32Array(count*3),seeds=new Float32Array(count);
 const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.BufferAttribute(positions,3).setUsage(THREE.DynamicDrawUsage));geometry.setAttribute('color',new THREE.BufferAttribute(colors,3));geometry.setAttribute('seed',new THREE.BufferAttribute(seeds,1));
 const palette=[new THREE.Color('#ffe8a8'),new THREE.Color('#a5f9e5'),new THREE.Color('#d7c4ff')];for(let i=0;i<count;i++){colors.set(palette[i%3].toArray(),i*3);seeds[i]=i*.61803398875;}
 const material=new THREE.ShaderMaterial({transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,vertexColors:true,uniforms:{time:uniforms.magicTime,visibility:{value:0},pixelHeight:{value:720}},
  vertexShader:`attribute float seed;uniform float pixelHeight;varying vec3 tint;varying float phase;void main(){phase=seed;tint=color;vec4 p=viewMatrix*vec4(position,1.);gl_Position=projectionMatrix*p;gl_PointSize=clamp(pixelHeight*(.035+.04*fract(seed))/max(.15,-p.z),2.,23.);}`,
  fragmentShader:`varying vec3 tint;varying float phase;uniform float time,visibility;void main(){vec2 p=gl_PointCoord-.5;float core=exp(-dot(p,p)*140.);float star=exp(-abs(p.x)*65.-abs(p.y)*7.)+exp(-abs(p.y)*65.-abs(p.x)*7.);float twinkle=.3+.7*pow(.5+.5*sin(time*18.+phase*6.),3.);gl_FragColor=vec4(tint*(core*2.+star),visibility*twinkle);
#include <tonemapping_fragment>
#include <colorspace_fragment>
}`});
 const swarm=new THREE.Points(geometry,material);swarm.name='cover-opening-sparkles';swarm.frustumCulled=false;swarm.visible=false;world.add(swarm);
 const v=new THREE.Vector3(),start=new THREE.Vector3(),end=new THREE.Vector3();
 return {swarm,update(t:number,enabled:boolean,camera:THREE.PerspectiveCamera,pixelHeight:number){
  const active=enabled&&t>=BOOK_MAGIC.arrival&&t<BOOK_MAGIC.opened+.75,phase=magicPhase(t);swarm.visible=active;uniforms.magicTime.value=t;uniforms.magicSweep.value=THREE.MathUtils.lerp(5.65,.15,THREE.MathUtils.smoothstep(t,4.4,5.2));uniforms.magicStrength.value=active?THREE.MathUtils.smoothstep(t,3.5,4.3)*(1-THREE.MathUtils.smoothstep(t,8.1,9.05)):0;material.uniforms.visibility.value=active?1-THREE.MathUtils.smoothstep(t,8.45,9.05):0;material.uniforms.pixelHeight.value=pixelHeight;
  cover.updateWorldMatrix(true,false);const depth=new THREE.Vector3(2.95,.25,0).project(camera).z;
  if(active)for(let i=0;i<count;i++){
   const seed=seeds[i],a=seed%1,q=i/count;
   if(t<4.4){const u=THREE.MathUtils.smoothstep(t,3.5+q*.12,4.4);start.set(1.22+a*.35,(q-.5)*.42,depth).unproject(camera);end.set(5.65,.075,(a-.5)*1.4).applyMatrix4(cover.matrixWorld);v.lerpVectors(start,end,u);v.y+=Math.sin(Math.PI*u)*(.6+a*.45);}
   else if(t<5.2){const u=THREE.MathUtils.smoothstep(t,4.4,5.2);v.set(THREE.MathUtils.lerp(5.65,.15,u),.075+Math.sin(q*20+t*8)*.025,(a-.5)*1.4).applyMatrix4(cover.matrixWorld);}
   else {const target=coverRimPoint(q),u=THREE.MathUtils.smoothstep(t,5.2+q*.12,6.1);v.set(.15,.075,(a-.5)*1.4).lerp(target,u);if(t>8.05)v.lerp(new THREE.Vector3(.1,-.075,3.65),THREE.MathUtils.smoothstep(t,8.05,9.05));v.applyMatrix4(cover.matrixWorld);}
   positions[i*3]=v.x;positions[i*3+1]=v.y;positions[i*3+2]=v.z;
  }
  geometry.attributes.position.needsUpdate=true;return {phase,active,shimmer:uniforms.magicStrength.value};
 },dispose(){swarm.removeFromParent();geometry.dispose();material.dispose();}};
}
