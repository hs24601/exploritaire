import * as THREE from 'three';
import {seeded} from './castlePaint';
import type {BookRenderQuality} from './viewportPolicy';

const MIST = /* glsl */`
varying vec3 vMeadowWorld;
uniform float uMeadowTime, uMeadowSamples;
float meadowDensity(vec3 p) {
  float banks = .67+.23*sin(p.z*.16+p.x*.12-uMeadowTime*.18)+.10*sin(p.x*.55+p.z*.27+uMeadowTime*.11);
  float floorMist = .105*exp(-max(0.,p.y+.1)*.37)*smoothstep(-3.5,-.8,p.y);
  float hangingMist = .012*exp(-abs(p.y-5.5)*.28);
  return banks*(floorMist+hangingMist);
}
vec3 meadowMist(vec3 color,vec3 endPoint) {
  vec3 delta=endPoint-cameraPosition;
  float lengthToSurface=length(delta);
  vec3 direction=delta/max(lengthToSurface,.001);
  float span=min(lengthToSurface,90.), optical=0.;
  for (int i=0;i<5;i++) {
    if(float(i)>=uMeadowSamples) break;
    float a=float(i)/uMeadowSamples,b=float(i+1)/uMeadowSamples;
    optical+=meadowDensity(cameraPosition+direction*span*(a*a+b*b)*.5)*span*(b*b-a*a);
  }
  float opacity=1.-exp(-optical);
  vec3 haze=mix(vec3(.10,.19,.23),vec3(.18,.30,.29),smoothstep(-1.,4.,endPoint.y));
  return mix(color,haze,opacity*.82);
}
`;

const WASH = /* glsl */`
uniform sampler2D uMeadowAtlas;
uniform float uMeadowKind;
varying vec3 vMeadowNormal;
vec3 meadowSwatch(vec2 p,vec2 tile) {
  // Mirrored repeats stay continuous at the tile joins. Leave a narrow inset
  // so linear sampling never pulls a neighboring pigment into a surface.
  vec2 uv=1.-abs(fract(p*.5)*2.-1.);
  return texture2D(uMeadowAtlas,tile+vec2(.010)+uv*.480).rgb;
}
vec3 meadowRock(vec3 p,vec3 weights) {
  vec2 tile=vec2(.5,.5);
  return meadowSwatch(p.zy*.16,tile)*weights.x
       + meadowSwatch(p.xz*.14,tile)*weights.y
       + meadowSwatch(p.xy*.16,tile)*weights.z;
}
vec3 meadowWash() {
  vec3 p=vMeadowWorld;
  vec3 n=normalize(vMeadowNormal);
  if(uMeadowKind==3.) {
    vec2 current=vec2(sin(p.z*.23-uMeadowTime*.18)*.16,uMeadowTime*.015);
    return meadowSwatch(p.xz*vec2(.13,.083)+current,vec2(.5,0.))*.83;
  }
  vec3 w=pow(abs(n),vec3(4.)); w/=max(.0001,w.x+w.y+w.z);
  if(uMeadowKind==2.) {
    return meadowSwatch(p.zy*vec2(.46,.19),vec2(0.))*w.x
         + meadowSwatch(p.xz*.30,vec2(0.))*w.y
         + meadowSwatch(p.xy*vec2(.46,.19),vec2(0.))*w.z;
  }
  vec3 moss=meadowSwatch(p.xz*.23+p.y*.04,vec2(0.,.5));
  float glaze=sin(p.x*.56+p.z*.39)*sin(p.z*.28-p.y*.38);
  moss=mix(moss*.72,moss*vec3(1.08,1.10,.92),smoothstep(-.7,.6,glaze));
  if(uMeadowKind==4.) {
    return mix(moss,meadowSwatch(vec2(p.x+p.z,p.y)*.27,vec2(0.,.5)),.56)*vec3(.63,.94,.80);
  }
  if(uMeadowKind==5.) {
    // Clover beds have separate vertical faces. Wrap the foliage wash around
    // those faces so they read as dense, hanging growth.
    vec2 tile=vec2(0.,.5);
    vec3 leaves=meadowSwatch(p.zy*vec2(.31,.22),tile)*w.x
      + moss*w.y + meadowSwatch(p.xy*vec2(.31,.22),tile)*w.z;
    return mix(leaves,moss,.18)*vec3(.77,.99,.66);
  }
  vec3 stone=meadowRock(p,w);
  float mossEdge=smoothstep(.34,.78,n.y+glaze*.16);
  if(uMeadowKind==1.) return mix(stone,moss,mossEdge*.46);
  return mix(stone*.82,moss,smoothstep(.23,.66,n.y+glaze*.14));
}
`;

// The GLB names these surfaces by material index. The original images remain
// attached only where their silhouettes are needed as alpha masks.
const WASH_KIND: Readonly<Record<string,number>> = {
  mat0:1, mat1:4, mat2:4, mat3:2, mat4:4, mat5:4, mat6:4, mat7:0, mat8:5,
  mat9:1, mat10:0, mat11:1, mat12:4, mat13:1, mat14:5, material_0:4, mat16:3,
};

export function createMeadowArt(quality:BookRenderQuality,reduced:boolean,atlas:THREE.Texture|undefined) {
  const time={value:0}, samples={value:quality==='low'?2:quality==='high'?5:4};
  const particleTime={value:0};
  let low=quality==='low';
  let motes:THREE.Points|undefined;
  const materials=new Map<THREE.MeshStandardMaterial,THREE.MeshLambertMaterial>();
  function paint(source:THREE.MeshStandardMaterial) {
    const existing=materials.get(source);
    if(existing) return existing;
    if(!atlas) return source;
    const material=new THREE.MeshLambertMaterial({
      name:source.name,side:source.side,alphaTest:source.alphaTest,map:source.alphaTest>0?source.map:null,
    });
    material.onBeforeCompile=shader=>{
      Object.assign(shader.uniforms,{
        uMeadowAtlas:{value:atlas},uMeadowKind:{value:WASH_KIND[source.name]??0},
        uMeadowTime:time,uMeadowSamples:samples,
      });
      shader.vertexShader=shader.vertexShader
        .replace('#include <common>','#include <common>\nvarying vec3 vMeadowWorld,vMeadowNormal;')
        .replace('#include <fog_vertex>',`#include <fog_vertex>
          vMeadowWorld=(modelMatrix*vec4(transformed,1.)).xyz;
          vMeadowNormal=inverseTransformDirection(normalize(transformedNormal),viewMatrix);`);
      shader.fragmentShader=shader.fragmentShader
        .replace('#include <common>','#include <common>\n'+MIST+WASH)
        .replace('#include <map_fragment>','#include <map_fragment>\ndiffuseColor.rgb=meadowWash();')
        .replace('#include <tonemapping_fragment>','gl_FragColor.rgb=meadowMist(gl_FragColor.rgb,vMeadowWorld);\n#include <tonemapping_fragment>');
    };
    material.customProgramCacheKey=()=> 'meadow-wash-atlas-v1';
    materials.set(source,material);
    return material;
  }

  function addMotes(scene:THREE.Scene,door:{x:number;z:number},scale:number,height:(x:number,z:number)=>number) {
    const random=seeded(11872),positions:number[]=[],seeds:number[]=[];
    const count=quality==='high'?250:175;
    for(let i=0;i<count;i++){
      const near=i%3===0 || i%7===0;
      const x=door.x+(random()-.5)*(near?6:13)*scale;
      const z=door.z-(.65+random()*(near?13:50))*scale;
      const y=Math.max(-.25,height(x,z))+.35+random()**1.8*(near?3.4:6);
      positions.push(x,y,z); seeds.push(random(),random());
    }
    const geometry=new THREE.BufferGeometry();
    geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
    geometry.setAttribute('aMote',new THREE.Float32BufferAttribute(seeds,2));
    const viewport=new THREE.Vector4(), pixels={value:480};
    motes=new THREE.Points(geometry,new THREE.ShaderMaterial({
      uniforms:{uMoteTime:particleTime,uMotePixels:pixels},
      transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,
      vertexShader:/* glsl */`
        attribute vec2 aMote;
        uniform float uMoteTime,uMotePixels;
        varying vec3 vMoteColor;
        varying float vMoteFade;
        void main() {
          float phase=aMote.x*36.;
          vec3 p=position+vec3(sin(phase+uMoteTime*.29)*.55,
            sin(phase*1.2+uMoteTime*.37)*.32,cos(phase*.8+uMoteTime*.24)*.62);
          vec4 mv=modelViewMatrix*vec4(p,1.);
          float depth=max(.1,-mv.z);
          gl_Position=projectionMatrix*mv;
          gl_PointSize=clamp(uMotePixels*projectionMatrix[1][1]*(.095+.105*aMote.y)/depth,1.5,25.);
          float twinkle=.38+.62*pow(.5+.5*sin(phase+uMoteTime*(.8+aMote.y)),1.8);
          vMoteFade=twinkle*smoothstep(.45,2.,depth)*(1.-smoothstep(34.,81.,depth));
          vMoteColor=mix(vec3(.51,1.,.78),vec3(1.,.88,.48),smoothstep(.33,.83,aMote.y));
        }`,
      fragmentShader:/* glsl */`
        varying vec3 vMoteColor;
        varying float vMoteFade;
        void main() {
          float r=length(gl_PointCoord-.5);
          float halo=exp(-r*r*15.)*(1.-smoothstep(.35,.50,r));
          float core=exp(-r*r*205.);
          gl_FragColor=vec4(mix(vMoteColor,vec3(1.,1.,.88),core),vMoteFade*(halo*.27+core*.85));
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
        }`,
    }));
    motes.frustumCulled=false;
    motes.renderOrder=3;
    motes.onBeforeRender=renderer=>{pixels.value=renderer.getCurrentViewport(viewport).w;};
    geometry.setDrawRange(0,low?65:count);
    scene.add(motes);
  }

  return {
    paint,addMotes,
    update(t:number){time.value=reduced||low?0:t;particleTime.value=reduced?0:t;},
    setLow(){low=true;samples.value=2;time.value=0;motes?.geometry.setDrawRange(0,65);},
    get diagnostics(){return {painted:materials.size,motes:motes?.geometry.drawRange.count??0,mistSamples:samples.value};},
  };
}
