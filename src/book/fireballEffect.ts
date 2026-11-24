import * as THREE from 'three';
import {EffectComposer} from 'three/examples/jsm/postprocessing/EffectComposer.js';
import {RenderPass} from 'three/examples/jsm/postprocessing/RenderPass.js';
import {UnrealBloomPass} from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import {FullScreenQuad} from 'three/examples/jsm/postprocessing/Pass.js';
import {fireballFlight,type FireballPoint,type FireballProfile} from './fireballPower';
/** Adapted from the user's supplied sphere + tapered-cylinder fireball shaders.
 * Uses the app's Three version and renderer, local source textures, and a bloom
 * target containing only this effect. No second render loop or camera controls. */
const vertex=`varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`;
const sphereFragment=`varying vec2 vUv;uniform sampler2D perlinnoise,sparknoise;uniform float time,grandeur;
vec2 polar(vec2 uv){vec2 d=uv-.5;return vec2(length(d)*2.,atan(d.x,d.y)/6.28);}
void main(){vec2 cor=polar(vUv);vec2 q=vec2(cor.x+time,cor.x*.2+cor.y);float n=texture2D(perlinnoise,fract(q)).r,s=texture2D(sparknoise,fract(q)).r;
float t0=1.-smoothstep(.3,.6,n),t1=smoothstep(.3,.6,s);float pct=distance(vUv,vec2(.5));
vec3 col=mix(vec3(0.),vec3(64.,27.,0.)/255.,smoothstep(.16,.525,pct));
if(t0>.29)col=vec3(81.,14.,5.)/255.;if(t1>.49)col=vec3(181.,156.,24.)/255.;
col+=vec3(1.,.33,.035)*pow(max(0.,1.-pct*1.7),3.)*.24;
gl_FragColor=vec4(col*(.9+grandeur*.1),1.);}`;
const cylinderVertex=`varying vec2 vUv;void main(){vUv=uv;vec3 pos=position;
if(pos.y>=1.87)pos.xz*=sin((pos.y-.6)*1.27)-.16;else pos.xz*=sin((pos.y/2.-.01)*.11)+.75;
gl_Position=projectionMatrix*modelViewMatrix*vec4(pos,1.);}`;
const flameVertex=`varying vec2 vUv;uniform sampler2D noise;uniform float time;void main(){vUv=uv;vec3 pos=position;
float n=texture2D(noise,fract(vec2(vUv.y-time*2.,vUv.x+time))).r;
if(pos.y>=1.87)pos.xz*=sin((pos.y-.64)*1.27)-.12;else pos.xz*=sin((pos.y/2.-.01)*.11)+.79;
pos.xz*=n;gl_Position=projectionMatrix*modelViewMatrix*vec4(pos,1.);}`;
const tailFragment=`varying vec2 vUv;uniform sampler2D perlinnoise,noise;uniform float time,grandeur,steam;
void main(){vec2 q=fract(vec2(vUv.y-time*2.,vUv.x+time));float n=steam>.5?texture2D(perlinnoise,q).r:texture2D(noise,q).r;
float a=step(mix(.44,.5,steam),n)*n*smoothstep(.2,.628,vUv.y);
if(steam>.5)a*=max(0.,sin(vUv.y)-.1);
vec3 col=mix(vec3(64.,27.,0.)/255.,vec3(79.)/255.,steam);
col+=vec3(.6,.09,.008)*(1.-steam)*pow(n,3.);gl_FragColor=vec4(col*(.9+grandeur*.15),a);}`;
const emberMaterial=()=>new THREE.ShaderMaterial({transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,uniforms:{opacity:{value:1}},vertexShader:'attribute float sparkSize;varying float a;void main(){a=sparkSize;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);gl_PointSize=sparkSize;}',fragmentShader:'varying float a;uniform float opacity;void main(){float d=length(gl_PointCoord-.5)*2.;gl_FragColor=vec4(1.,.36,.035,pow(max(0.,1.-d),2.)*opacity);}'});
export function createFireballEffect(base:string){
 const scene=new THREE.Scene(),camera=new THREE.OrthographicCamera(0,1,1,0,.1,2000),projectile=new THREE.Group();camera.position.z=1000;scene.add(projectile);
 const textures:THREE.Texture[]=[],loader=new THREE.TextureLoader();let loaded=0,error='';
 const texture=(name:string)=>{const t=loader.load(base+name,()=>loaded++,undefined,e=>{error=String(e);});t.wrapS=t.wrapT=THREE.RepeatWrapping;t.minFilter=THREE.LinearFilter;textures.push(t);return t;};
 const noise=texture('noise9.jpg'),spark=texture('sparklenoise.jpg'),water=texture('water-min.jpg');
 const uniforms={time:{value:0},grandeur:{value:1},perlinnoise:{value:noise},sparknoise:{value:spark}};
 const bodyMaterial=new THREE.ShaderMaterial({uniforms,vertexShader:vertex,fragmentShader:sphereFragment});
 const body=new THREE.Mesh(new THREE.SphereGeometry(.78,30,30),bodyMaterial);projectile.add(body);
 const tailMaterials:THREE.ShaderMaterial[]=[],tails:THREE.Mesh[]=[];
 for(let i=0;i<2;i++){
  const material=new THREE.ShaderMaterial({transparent:true,depthWrite:false,side:THREE.DoubleSide,blending:THREE.AdditiveBlending,uniforms:{time:{value:0},grandeur:{value:1},perlinnoise:{value:water},noise:{value:noise},steam:{value:i===0?1:0}},vertexShader:i===0?cylinderVertex:flameVertex,fragmentShader:tailFragment});
  const mesh=new THREE.Mesh(new THREE.CylinderGeometry(i===0?1.11:1,0,5.3,40,40,true),material);mesh.rotation.z=-Math.PI/2;projectile.add(mesh);tails.push(mesh);tailMaterials.push(material);
 }
 const sparkGeo=new THREE.BufferGeometry(),positions=new Float32Array(160*3),sizes=new Float32Array(160);for(let i=0;i<160;i++)sizes[i]=2+i%4;
 sparkGeo.setAttribute('position',new THREE.BufferAttribute(positions,3));sparkGeo.setAttribute('sparkSize',new THREE.BufferAttribute(sizes,1));const sparks=new THREE.Points(sparkGeo,emberMaterial());scene.add(sparks);
 const flashMaterial=new THREE.MeshBasicMaterial({color:new THREE.Color(3,1.1,.13),transparent:true,depthWrite:false,blending:THREE.AdditiveBlending}),flash=new THREE.Mesh(new THREE.SphereGeometry(1,24,16),flashMaterial);scene.add(flash);
 const ringMaterial=new THREE.MeshBasicMaterial({color:new THREE.Color(2,.65,.08),transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,side:THREE.DoubleSide}),ring=new THREE.Mesh(new THREE.RingGeometry(.92,1,64),ringMaterial);scene.add(ring);
 let composer:EffectComposer|undefined,bloom:UnrealBloomPass|undefined,renderPass:RenderPass|undefined,width=0,height=0;
 const compositeMaterial=new THREE.ShaderMaterial({transparent:true,depthTest:false,depthWrite:false,blending:THREE.AdditiveBlending,toneMapped:false,uniforms:{image:{value:null},exposure:{value:2.8}},vertexShader:'varying vec2 uvv;void main(){uvv=uv;gl_Position=vec4(position.xy,0.,1.);}',fragmentShader:`varying vec2 uvv;uniform sampler2D image;uniform float exposure;void main(){vec3 c=texture2D(image,uvv).rgb;gl_FragColor=vec4(vec3(1.)-exp(-max(vec3(0.),c-.018)*exposure*.4),1.);
#include <colorspace_fragment>
}`});
 const composite=new FullScreenQuad(compositeMaterial);
 type Presentation={x:number;y:number;scale:number;angle:number;phase:'flight'|'impact'|'done';impactAge:number;progress:number};
 let presentation:Presentation|undefined;
 let state:{from:FireballPoint;to:FireballPoint;age:number;profile:FireballProfile;reduced:boolean}|undefined;
 return {
  start(from:FireballPoint,to:FireballPoint,profile:FireballProfile,reduced:boolean){state={from,to,age:0,profile,reduced};presentation=undefined;},
  update(dt:number,profile:FireballProfile){if(state){state.age+=dt;state.profile=profile;}},
  present(view:Presentation){presentation=view;},
  stop(){state=undefined;presentation=undefined;},
  get diagnostics(){return state?{...fireballFlight(state.age,state.profile.flightDuration,state.from,state.to,state.reduced),...presentation,from:{...state.from},to:{...state.to},profile:{...state.profile},texturesReady:loaded===3,error}:null;},
  render(renderer:THREE.WebGLRenderer,low:boolean){
   if(!state)return;const {profile,from,to,age,reduced}=state,path=presentation??fireballFlight(age,profile.flightDuration,from,to,reduced);if(path.phase==='done')return;
   const W=innerWidth,H=innerHeight,viewportScale=Math.max(.45,Math.min(1,W/1000,H/750)),r=profile.radius*viewportScale*(presentation?.scale??1);
   camera.right=W;camera.top=H;camera.updateProjectionMatrix();
   const x=path.x*W,y=(1-path.y)*H,angle=presentation?.angle??Math.atan2(-(to.y-from.y)*H,(to.x-from.x)*W);
   projectile.visible=path.phase==='flight';projectile.position.set(x,y,0);projectile.rotation.z=angle;projectile.scale.setScalar(r);
   uniforms.time.value=reduced?0:-age/2;uniforms.grandeur.value=profile.grandeur;
   tails.forEach((tail,i)=>{tail.position.x=-(i===0?4.05:4.78)*profile.trailScale;tail.scale.set(i===0?1.5:2,(i===0?1.7:2)*profile.trailScale,i===0?1.5:2);tailMaterials[i].uniforms.time.value=reduced?0:-age/6;tailMaterials[i].uniforms.grandeur.value=profile.grandeur;});
   const impact=path.phase==='impact',u=reduced?0:path.impactAge/.55;flash.visible=impact;ring.visible=impact&&!reduced;
   flash.position.set(x,y,0);flash.scale.setScalar(r*(.5+u*1.3));flashMaterial.opacity=Math.max(0,(1-u)*(1-u)*.9);
   ring.position.set(x,y,1);ring.scale.setScalar(r*(1+u*5)*(.7+profile.grandeur*.3));ringMaterial.opacity=Math.max(0,(1-u)*.7);
   const count=reduced?0:Math.min(profile.embers,low?72:160);sparkGeo.setDrawRange(0,count);
   for(let i=0;i<count;i++){const seed=i*2.399,drift=(age*.65+i*.037)%1,dist=impact?r*(.4+u*(3+i%5*.5)):r*(.5+drift*9*profile.trailScale),a=impact?seed:angle+Math.PI+Math.sin(seed)*.22;positions[i*3]=x+Math.cos(a)*dist;positions[i*3+1]=y+Math.sin(a)*dist+Math.sin(seed+age*3)*r*.35;positions[i*3+2]=0;}
   sparkGeo.attributes.position.needsUpdate=true;(sparks.material as THREE.ShaderMaterial).uniforms.opacity.value=impact?Math.max(0,1-u):.8;
   const target=renderer.getRenderTarget(),clearColor=renderer.getClearColor(new THREE.Color()),clearAlpha=renderer.getClearAlpha(),auto=renderer.autoClear,viewport=renderer.getViewport(new THREE.Vector4()),scissor=renderer.getScissor(new THREE.Vector4()),scissorTest=renderer.getScissorTest();
   try{
    if(!composer){const rt=new THREE.WebGLRenderTarget(1,1,{type:THREE.HalfFloatType});composer=new EffectComposer(renderer,rt);composer.renderToScreen=false;composer.setPixelRatio(1);renderPass=new RenderPass(scene,camera);renderPass.clearColor=new THREE.Color(0);renderPass.clearAlpha=0;bloom=new UnrealBloomPass(new THREE.Vector2(1,1),3.5,.39,.45);composer.addPass(renderPass);composer.addPass(bloom);}
    const scale=Math.min(1,(low?768:1280)/Math.max(W,H)),w=Math.max(2,Math.round(W*scale)),h=Math.max(2,Math.round(H*scale));if(w!==width||h!==height){width=w;height=h;composer.setSize(w,h);}
    renderer.setScissorTest(false);renderer.autoClear=true;bloom!.strength=profile.bloomStrength*.3;bloom!.radius=profile.bloomRadius;composer.render(0);
    renderer.setRenderTarget(target);renderer.setViewport(viewport);renderer.setScissor(scissor);renderer.setScissorTest(scissorTest);renderer.autoClear=false;
    compositeMaterial.uniforms.image.value=composer.readBuffer.texture;compositeMaterial.uniforms.exposure.value=profile.exposure;composite.render(renderer);
   }finally{renderer.setRenderTarget(target);renderer.setViewport(viewport);renderer.setScissor(scissor);renderer.setScissorTest(scissorTest);renderer.setClearColor(clearColor,clearAlpha);renderer.autoClear=auto;}
  },
  dispose(){textures.forEach(t=>t.dispose());scene.traverse(o=>{if(o instanceof THREE.Mesh||o instanceof THREE.Points){o.geometry.dispose();for(const m of Array.isArray(o.material)?o.material:[o.material])m.dispose();}});bloom?.dispose();renderPass?.dispose();composer?.dispose();composite.dispose();compositeMaterial.dispose();}
 };
}
