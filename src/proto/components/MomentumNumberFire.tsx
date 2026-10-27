import {useEffect,useRef,useState} from 'react';
import * as THREE from 'three';
import {EffectComposer} from 'three/examples/jsm/postprocessing/EffectComposer.js';
import {RenderPass} from 'three/examples/jsm/postprocessing/RenderPass.js';
import {UnrealBloomPass} from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import {ShaderPass} from 'three/examples/jsm/postprocessing/ShaderPass.js';
import {createMomentumNumberFire} from '../momentumNumberFire';
import './MomentumNumberFire.css';

/** The live spendable value is the scaffold, including its holes and sidewalls. */
export function MomentumNumberFire({value,paused=false,timeScale=1,decorative=false}:{value:number;paused?:boolean;timeScale?:number;decorative?:boolean}){
 const host=useRef<HTMLSpanElement>(null),latest=useRef({value,paused,timeScale}),draw=useRef(()=>{});
 const [ready,setReady]=useState(false);
 latest.current={value,paused,timeScale};
 useEffect(()=>{
  const element=host.current;if(!element)return;
  let renderer:THREE.WebGLRenderer;
  try{renderer=new THREE.WebGLRenderer({alpha:true,antialias:true,preserveDrawingBuffer:true});}catch{return;}
  renderer.setClearColor(0,0);renderer.setPixelRatio(1);renderer.outputColorSpace=THREE.SRGBColorSpace;
  renderer.domElement.setAttribute('aria-hidden','true');element.append(renderer.domElement);
  const scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera(38,1,.1,30);camera.position.z=3.9;
  const maskScene=new THREE.Scene(),maskTarget=new THREE.WebGLRenderTarget(180,180);
  const composer=new EffectComposer(renderer),renderPass=new RenderPass(scene,camera);
  const bloom=new UnrealBloomPass(new THREE.Vector2(180,180),.65,.2,1.0);
  // Keep the digit face and dense ink above both flame layers. A bounded smoke
  // cloud separates the whole value from the spiral without a rectangular panel.
  const transparent=new ShaderPass({uniforms:{tDiffuse:{value:null},tGlyph:{value:maskTarget.texture},uStroke:{value:new THREE.Vector2()},uGlyphSize:{value:new THREE.Vector2()},uTime:{value:.8},uLit:{value:0}},vertexShader:'varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',fragmentShader:`
   uniform sampler2D tDiffuse,tGlyph;uniform vec2 uStroke,uGlyphSize;uniform float uTime,uLit;varying vec2 vUv;
   float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
   float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(hash(i),hash(i+vec2(1.,0.)),f.x),mix(hash(i+vec2(0.,1.)),hash(i+vec2(1.,1.)),f.x),f.y);}
   void main(){
    vec3 c=clamp(texture2D(tDiffuse,vUv).rgb,0.,1.);
    float edge=min(min(vUv.x,1.-vUv.x),min(vUv.y,1.-vUv.y));
    float a=smoothstep(.025,.25,max(c.r,max(c.g,c.b)))*smoothstep(0.,.12,edge);
    float glyph=texture2D(tGlyph,vUv).r,dilated=glyph;
    // Sample the full stroke width, not only a thin ring that can miss narrow stems.
    for(int ring=1;ring<=3;ring++)for(int i=0;i<12;i++){float angle=float(i)*6.2831853/12.;dilated=max(dilated,texture2D(tGlyph,vUv+vec2(cos(angle),sin(angle))*uStroke*float(ring)/3.).r);}
    vec2 p=vUv-.5,extent=uGlyphSize*.5+vec2(.035,.035);
    float turbulence=noise(p*19.+vec2(uTime*.08,-uTime*.12));
    float smoke=1.-smoothstep(.72,1.12,length(p/(extent+vec2(.055))));
    for(int puff=0;puff<10;puff++){
     float id=float(puff),seed=hash(vec2(id,7.)),angle=id*6.2831853/10.;
     vec2 center=vec2(cos(angle),sin(angle))*extent+vec2(sin(uTime*.3+id),cos(uTime*.23+id))*.008;
     float radius=.055+seed*.035+(turbulence-.5)*.018;
     smoke=max(smoke,(1.-smoothstep(radius*.5,radius,length(p-center)))*(.8+seed*.2));
    }
    smoke*=uLit*smoothstep(0.,.09,edge);
    vec3 soot=mix(vec3(.018,.016,.022),vec3(.075,.045,.04),turbulence*.55);
    vec3 color=mix(c*a,soot,smoke*.985);a=max(a,smoke);
    float ink=smoothstep(.2,.8,dilated)*(1.-glyph);
    color=mix(color,vec3(.012,.014,.018),ink);a=max(a,ink);
    // A hot, readable face stays in front of stray streaks and bloom.
    vec3 face=mix(vec3(1.,.67,.21),vec3(1.,.96,.74),smoothstep(.15,.9,c.g));
    color=mix(color,face,glyph);a=max(a,glyph);
    gl_FragColor=vec4(color,a);
   }`});
  // ShaderPass clones its initial uniforms; bind the live render-target texture.
  transparent.uniforms.tGlyph.value=maskTarget.texture;
  composer.addPass(renderPass);composer.addPass(bloom);composer.addPass(transparent);
  const viewport={width:180,height:180},fire=createMomentumNumberFire(scene,camera,viewport,maskScene);
  const reduced=matchMedia('(prefers-reduced-motion: reduce)');
  let frame=0,last=performance.now(),painted=0,time=.8,visible=true,dead=false;
  const render=()=>{if(dead||renderer.getContext().isContextLost()||!visible||document.hidden)return;
   const width=Math.max(96,Math.min(360,Math.round(element.clientWidth*Math.min(devicePixelRatio,1.5))));
   if(viewport.width!==width||renderer.domElement.width!==width){viewport.width=viewport.height=width;renderer.setSize(width,width,false);composer.setSize(width,width);maskTarget.setSize(width,width);fire.resize();}
   fire.setValue(latest.current.value);fire.update(0,time);
   renderer.setRenderTarget(maskTarget);renderer.clear();renderer.render(maskScene,camera);renderer.setRenderTarget(null);
   transparent.uniforms.uStroke.value.set(4.5/Math.max(1,element.clientWidth),4.5/Math.max(1,element.clientHeight));
   const viewHeight=2*camera.position.z*Math.tan(THREE.MathUtils.degToRad(camera.fov)*.5);
   transparent.uniforms.uGlyphSize.value.set(fire.bounds.width/viewHeight,fire.bounds.height/viewHeight);
   transparent.uniforms.uTime.value=time;transparent.uniforms.uLit.value=latest.current.value>=1?1:0;
   bloom.enabled=latest.current.value>=1;composer.render();setReady(true);
  };
  draw.current=render;
  const tick=(now:number)=>{
   const dt=Math.min(.05,(now-last)/1000);last=now;
   if(visible&&!document.hidden&&!latest.current.paused&&!reduced.matches){
    const step=dt*Math.max(0,latest.current.timeScale);time+=step;
    if(now-painted>=33){fire.setValue(latest.current.value);fire.update(Math.min(.1,(now-painted)/1000)*Math.max(0,latest.current.timeScale),time);render();painted=now;}
   }else painted=now;
   frame=requestAnimationFrame(tick);
  };
  const observer=new IntersectionObserver(entries=>{visible=entries[0]?.isIntersecting??true;if(visible)render();});observer.observe(element);
  const resize=new ResizeObserver(render);resize.observe(element);
  const contextLost=(event:Event)=>{event.preventDefault();setReady(false);};renderer.domElement.addEventListener('webglcontextlost',contextLost);
  const changed=()=>render();reduced.addEventListener('change',changed);
  render();frame=requestAnimationFrame(tick);
  return()=>{dead=true;draw.current=()=>{};cancelAnimationFrame(frame);observer.disconnect();resize.disconnect();reduced.removeEventListener('change',changed);renderer.domElement.removeEventListener('webglcontextlost',contextLost);fire.dispose();maskTarget.dispose();renderPass.dispose();bloom.dispose();transparent.dispose();composer.dispose();renderer.dispose();renderer.forceContextLoss();renderer.domElement.remove();};
 },[]);
 useEffect(()=>draw.current(),[value,paused,timeScale]);
 const whole=Math.floor(Math.max(0,value)+1e-8);
 return <span ref={host} className="momentum-number-fire" data-value={whole} data-ready={ready||undefined} role={decorative?undefined:'img'} aria-hidden={decorative||undefined} aria-label={decorative?undefined:`${whole} Momentum`}><span className="momentum-number-fire__fallback" aria-hidden="true">{whole}</span></span>;
}
