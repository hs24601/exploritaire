import * as THREE from 'three';
import {WATER_PIGMENT_GLSL} from './waterPigment';
import {Reflector} from 'three/examples/jsm/objects/Reflector.js';
import {FullScreenQuad} from 'three/examples/jsm/postprocessing/Pass.js';
import {GROUNDS_LAND, GROUNDS_WATER_LEVEL} from './castleGroundsLayout';
import type {BookRenderQuality} from './viewportPolicy';

const EXTENT=144, FIELD_SIZE=256, SHORE_RANGE=12;

/** Distance to actual dry-land edges: water-channel joins are deliberately absent. */
export function groundsShoreDistance(x:number,z:number) {
  let distance2=Infinity;
  for(const land of GROUNDS_LAND) for(let i=0;i<land.length;i++) {
    const [ax,az]=land[i], [bx,bz]=land[(i+1)%land.length];
    const dx=bx-ax,dz=bz-az;
    const t=THREE.MathUtils.clamp(((x-ax)*dx+(z-az)*dz)/(dx*dx+dz*dz),0,1);
    distance2=Math.min(distance2,(x-ax-t*dx)**2+(z-az-t*dz)**2);
  }
  return Math.sqrt(distance2);
}

function shoreTexture() {
  const data=new Uint8Array(FIELD_SIZE*FIELD_SIZE*4);
  for(let y=0;y<FIELD_SIZE;y++) for(let x=0;x<FIELD_SIZE;x++) {
    const distance=groundsShoreDistance((x+.5)/FIELD_SIZE*EXTENT*2-EXTENT,(y+.5)/FIELD_SIZE*EXTENT*2-EXTENT);
    const i=(y*FIELD_SIZE+x)*4;
    data[i]=Math.round(Math.min(1,distance/SHORE_RANGE)*255); data[i+3]=255;
  }
  const texture=new THREE.DataTexture(data,FIELD_SIZE,FIELD_SIZE);
  texture.minFilter=texture.magFilter=THREE.LinearFilter; texture.needsUpdate=true;
  texture.generateMipmaps=false; texture.name='castle-water-shore-distance';
  return texture;
}

export const groundsWaterBudget=(quality:BookRenderQuality)=>({size:quality==='low'?0:quality==='high'?384:256,hz:quality==='high'?18:12});

/** Susurrus-inspired reflection + animated wash, entirely confined to water.
 * The tiny reflection is filtered at capture cadence, never over the main frame.
 * Own authored shader; source/research notes: docs/research/castle-watercolor-susurrus.md. */
export function createGroundsWater(material:THREE.MeshLambertMaterial, quality:BookRenderQuality, reduced:boolean,options:{movingReflections?:boolean;naturalRiver?:boolean}={}) {
  const movingReflections=options.movingReflections??false;
  const budget=groundsWaterBudget(quality);
  const clock={value:0}, reflectionReady={value:0}, detail={value:quality==='low'?0:1};
  const rippleClock={value:0};
  const reflectionMatrix={value:new THREE.Matrix4()}, shore=shoreTexture();
  const fallback=new THREE.DataTexture(new Uint8Array([0,0,0,255]),1,1); fallback.needsUpdate=true;
  const reflectionMap:{value:THREE.Texture}={value:fallback};
  let size=budget.size,lastCapture=-Infinity,captures=0,low=quality==='low';
  const reflectionCamera=new THREE.PerspectiveCamera();
  let reflector:Reflector|undefined, target:THREE.WebGLRenderTarget|undefined, quad:FullScreenQuad|undefined;
  let hidden:THREE.Object3D[]|undefined;
  const inverseReflector=new THREE.Matrix4();
  const wasVisible:boolean[]=[];
  if(size) {
    reflector=new Reflector(new THREE.PlaneGeometry(1,1),{textureWidth:size,textureHeight:size,multisample:0,clipBias:.003});
    reflector.rotation.x=-Math.PI/2; reflector.position.y=GROUNDS_WATER_LEVEL;
    reflector.updateMatrixWorld(true); inverseReflector.copy(reflector.matrixWorld).invert();
    target=new THREE.WebGLRenderTarget(size,size,{type:THREE.HalfFloatType,depthBuffer:false});
    reflectionMap.value=target.texture;
    quad=new FullScreenQuad(new THREE.ShaderMaterial({
      depthTest:false,depthWrite:false,
      uniforms:{source:{value:reflector.getRenderTarget().texture},texel:{value:new THREE.Vector2(1/size,1/size)}},
      vertexShader:'varying vec2 uvPaint;void main(){uvPaint=uv;gl_Position=vec4(position.xy,0.,1.);}',
      // Four compact quadrants, four taps each: preserve reflection silhouettes
      // while grouping small texture detail into broad, quiet painted marks.
      fragmentShader:`uniform sampler2D source;uniform vec2 texel;varying vec2 uvPaint;
        void main(){
          vec3 chosen=vec3(0.);float least=1e10;
          for(int sector=0;sector<4;sector++){
            vec2 direction=vec2(sector<2?-1.:1.,(sector==0||sector==2)?-1.:1.);
            vec3 mean=vec3(0.),squared=vec3(0.);
            for(int x=0;x<2;x++)for(int y=0;y<2;y++){
              vec2 offset=direction*vec2(float(x),float(y))*texel*1.5;
              vec3 c=texture2D(source,clamp(uvPaint+offset,texel,vec2(1.)-texel)).rgb;
              mean+=c;squared+=c*c;
            }
            mean*=.25;vec3 variance=max(vec3(0.),squared*.25-mean*mean);
            float v=dot(variance,vec3(.299,.587,.114));
            if(v<least){least=v;chosen=mean;}
          }
          gl_FragColor=vec4(chosen,1.);
        }`,
    }));
  }

  const previousCompile=material.onBeforeCompile;
  material.onBeforeCompile=(shader,renderer)=>{
    previousCompile.call(material,shader,renderer);
    Object.assign(shader.uniforms,{uWaterTime:clock,uWaterReflection:reflectionMap,uWaterReflectionMatrix:reflectionMatrix,uWaterReflectionReady:reflectionReady,uWaterShore:{value:shore},uWaterDetail:detail});
    if(movingReflections)shader.uniforms.uWaterRippleTime=rippleClock;
    shader.fragmentShader=shader.fragmentShader
      .replace('#include <common>',`#include <common>
        uniform float uWaterTime,uWaterReflectionReady,uWaterDetail;
        uniform sampler2D uWaterReflection,uWaterShore;
        uniform mat4 uWaterReflectionMatrix;
        vec2 waterWarp;float waterWash,waterShore,waterPaper;
        ${WATER_PIGMENT_GLSL}
        ${movingReflections?`
          uniform float uWaterRippleTime;
          vec2 waterRippleSlope;
          vec2 gentleWaterSlope(vec2 p,float t){
            vec2 a=vec2(.72,.69),b=vec2(-.93,.37),c=vec2(.28,-.96);
            float first=dot(p,a)*.055+t*.18;
            float second=dot(p,b)*.081-t*.13;
            float third=dot(p,c)*.12+t*.08+sin(first*.27)*.6;
            return a*cos(first)*.45+b*cos(second)*.28+c*cos(third)*.16;
          }
        `:''}`)
      .replace('#include <map_fragment>',`
        vec2 wp=vWcPos.xz;
        ${options.naturalRiver?`float best=1.e8,along=0.,lengthSoFar=0.,lateral=0.;
        vec2 path[9];path[0]=vec2(-72.,-76.);path[1]=vec2(-76.,-48.);path[2]=vec2(-54.,-32.);path[3]=vec2(-28.,-68.);path[4]=vec2(9.,-72.);path[5]=vec2(44.,-47.);path[6]=vec2(66.,-10.);path[7]=vec2(101.,44.);path[8]=vec2(140.,68.);
        for(int i=0;i<8;i++){vec2 d=path[i+1]-path[i];float len=length(d),q=clamp(dot(wp-path[i],d)/(len*len),0.,1.);vec2 delta=wp-path[i]-d*q;float distanceToPath=length(delta);if(distanceToPath<best){best=distanceToPath;along=lengthSoFar+q*len;lateral=dot(delta,vec2(-d.y,d.x)/len);}lengthSoFar+=len;}wp=vec2(along,lateral);`:''}
        vec2 flow=wp*vec2(.12,.19)+vec2(uWaterTime*${options.naturalRiver?'-.16':movingReflections?'.0024':'.024'},-uWaterTime*${movingReflections?'.0017':'.017'});
        waterWarp=vec2(wcNoise(vec3(flow*.75,2.7)),wcNoise(vec3(flow*.8+8.3,5.1)))-.5;
        ${movingReflections?'waterRippleSlope=gentleWaterSlope(wp,uWaterRippleTime);':''}
        waterWash=wcFbm(vec3(flow*.65+waterWarp*1.4,1.2));
        waterShore=${options.naturalRiver?'max(0.,15.-abs(wp.y))':'texture2D(uWaterShore,(wp+144.)/288.).r*12.'};
        // Pigment settles along wash boundaries; paper tooth stays world-anchored.
        float footprint=length(fwidth(wp));
        waterPaper=mix(wcNoise(vec3(wp*5.2,8.1))-.5,0.,smoothstep(.08,.65,footprint));
        diffuseColor.rgb=waterPigment(waterWash,waterShore,waterWarp.x,waterPaper);
      `)
      .replace('#include <opaque_fragment>',`
        vec4 mirrored=uWaterReflectionMatrix*vec4(vWcPos,1.);
        vec2 reflectionUv=mirrored.xy/max(.001,mirrored.w);
        reflectionUv+=waterWarp*vec2(.014,.008);
        float within=step(0.,reflectionUv.x)*step(reflectionUv.x,1.)*step(0.,reflectionUv.y)*step(reflectionUv.y,1.);
        float reflectionPlane=1.-smoothstep(.08,.5,abs(vWcPos.y+1.6));
        float fresnel=pow(1.-clamp(dot(normal,normalize(vViewPosition)),0.,1.),2.);
        ${movingReflections?`
          vec3 waveNormal=normalize((viewMatrix*vec4(normalize(vec3(-waterRippleSlope.x*.025,1.,-waterRippleSlope.y*.025)),0.)).xyz);
          fresnel=pow(1.-clamp(dot(waveNormal,normalize(vViewPosition)),0.,1.),2.);
        `:''}
        vec3 reflected=texture2D(uWaterReflection,clamp(reflectionUv,.002,.998)).rgb;
        float reflectionMix=(.24+fresnel*.25)*uWaterReflectionReady*within*reflectionPlane;
        outgoingLight=mix(outgoingLight,reflected*(.82+waterWash*.18),reflectionMix);
        // Broken elongated brush ribbons: no periodic points or sparkle grid.
        float ribbon=wcNoise(vec3(vWcPos.x*.30+waterWarp.y,vWcPos.z*1.9-uWaterTime*.08,6.4));
        float fleck=smoothstep(.70,.86,ribbon)*smoothstep(.43,.70,waterWash);
        float foam=(1.-smoothstep(.1,2.,waterShore))*smoothstep(.47,.72,ribbon);
        outgoingLight+=vec3(.13,.19,.19)*(fleck*.16*uWaterDetail+foam*.22);
        #include <opaque_fragment>`);
  };
  material.customProgramCacheKey=()=> movingReflections?'castle-water-view-parallax-v2':'castle-water-washes-reflection-v1';

  return {
    shadeFalls(fall:THREE.MeshLambertMaterial) {
      const previous=fall.onBeforeCompile;
      fall.onBeforeCompile=(shader,renderer)=>{
        previous.call(fall,shader,renderer);
        shader.uniforms.uFallsTime=clock;
        shader.fragmentShader=shader.fragmentShader
          .replace('#include <common>','#include <common>\nuniform float uFallsTime;')
          .replace('#include <map_fragment>',`
            float wash=wcFbm(vWcPos*vec3(.16,.035,.16)+vec3(0.,uFallsTime*.22,0.));
            float stroke=wcNoise(vWcPos*vec3(.7,.16,.7)+vec3(0.,uFallsTime*.5,0.));
            diffuseColor.rgb*=mix(vec3(.32,.55,.62),vec3(.82,.91,.86),smoothstep(.28,.72,wash)*.7+stroke*.3);
          `);
      };
      fall.customProgramCacheKey=()=> 'castle-falling-water-wash-v1';
      return fall;
    },
    update(seconds:number) {clock.value=reduced||(low&&!movingReflections)?0:seconds;rippleClock.value=reduced?0:seconds;},
    capture(renderer:THREE.WebGLRenderer,scene:THREE.Scene,camera:THREE.PerspectiveCamera,seconds:number) {
      if(!reflector||!target||!quad||low||document.hidden||camera.position.y<=GROUNDS_WATER_LEVEL+.1||seconds-lastCapture<1/budget.hz)return;
      if(!hidden){
        hidden=[];
        scene.traverse(object=>{
          if(object.userData.skipWaterReflection || object instanceof THREE.Mesh && (object.material===material || Array.isArray(object.material)&&object.material.includes(material)) || object instanceof THREE.Points && !object.userData.celestial) hidden!.push(object);
        });
      }
      scene.updateMatrixWorld(); camera.updateMatrixWorld();
      hidden.forEach((object,i)=>{wasVisible[i]=object.visible;object.visible=false;});
      const renderTarget=renderer.getRenderTarget();
      const xr=renderer.xr.enabled, shadowAuto=renderer.shadowMap.autoUpdate, shadowUpdate=renderer.shadowMap.needsUpdate;
      try {
        renderer.shadowMap.needsUpdate=false;
        const reflectionMaterial=reflector.material as THREE.ShaderMaterial;
        let view=camera;
        if(movingReflections&&!reduced){
          // Re-render from a gently drifting virtual eye, like the small camera
          // movements that reveal the reflected world's depth. Same capture budget;
          // no noisy per-fragment UV swimming or movement of the player's camera.
          reflectionCamera.copy(camera);
          reflectionCamera.position.x+=Math.sin(seconds*.24)*.32;
          reflectionCamera.position.z+=Math.sin(seconds*.17+.8)*.22;
          reflectionCamera.position.y+=Math.sin(seconds*.19)*.06;
          reflectionCamera.updateMatrixWorld(true);view=reflectionCamera;
        }
        reflector.onBeforeRender(renderer,scene,view,reflector.geometry,reflectionMaterial,null!);
        reflectionMatrix.value.copy(reflectionMaterial.uniforms.textureMatrix.value).multiply(inverseReflector);
        renderer.setRenderTarget(target);quad.render(renderer);
        reflectionReady.value=1;lastCapture=seconds;captures++;
      } finally {
        hidden.forEach((object,i)=>{object.visible=wasVisible[i];});
        renderer.xr.enabled=xr;renderer.shadowMap.autoUpdate=shadowAuto;renderer.shadowMap.needsUpdate=shadowUpdate;
        renderer.setRenderTarget(renderTarget);
      }
    },
    setLow() {
      low=true;clock.value=0;detail.value=0;reflectionReady.value=0;reflectionMap.value=fallback;
      reflector?.dispose();reflector?.geometry.dispose();target?.dispose();
      if(quad){(quad.material as THREE.Material).dispose();quad.dispose();}
      reflector=undefined;target=undefined;quad=undefined;size=0;
    },
    get diagnostics(){return {reflectionSize:size,reflectionHz:low?0:budget.hz,captures,animated:!reduced&&(!low||movingReflections),shoreField:FIELD_SIZE,movingReflections,rippleTime:movingReflections?rippleClock.value:0};},
  };
}
