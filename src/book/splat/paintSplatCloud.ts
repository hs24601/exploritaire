import * as THREE from 'three';
import type {SplatSamples} from './paintSplatSampling';

// Painterly Gaussian splat renderer. Each splat is a 3D Gaussian (centre +
// covariance) projected with the standard EWA screen-space Jacobian, then
// shaded not as a smooth blob but as a brush mark: bristle streaks along the
// projected major axis, a ragged flat body, pooled pigment at the wet edge,
// paper granulation and dry-brush skips. Splats are depth-sorted back to front
// in a worker and blended; opaque meshes (Hero, portals) still depth-test.

export const SPLAT_LAYER=5;
const WIDTH=2048;
const KERNEL=2.35; // quad half-extent in sigmas (the brush body ends near 2.3σ)

const VERTEX=/* glsl */`
uniform highp sampler2D uCenter;
uniform highp sampler2D uCovA;
uniform highp sampler2D uCovB;
uniform highp sampler2D uColor;
uniform vec2 uViewport;
uniform float uSigmaScale,uTime,uBoil;
attribute float aIndex;
varying vec2 vUv;
varying vec4 vColor;
varying float vSeed,vKind,vPixels;
varying vec3 vWorld;
#include <fog_pars_vertex>
#include <clipping_planes_pars_vertex>
void main(){
  int i=int(aIndex+.5);ivec2 t=ivec2(i%${WIDTH},i/${WIDTH});
  vec4 c=texelFetch(uCenter,t,0),a=texelFetch(uCovA,t,0),b=texelFetch(uCovB,t,0);
  vColor=texelFetch(uColor,t,0);vSeed=c.w;vKind=b.w;vWorld=c.xyz;
  vec4 mvPosition=viewMatrix*vec4(c.xyz,1.);
  vec4 clip=projectionMatrix*mvPosition;
  if(clip.w<=0.){gl_Position=vec4(0.,0.,2.,1.);return;}
  mat3 S=mat3(a.x,a.y,a.z,a.y,b.x,b.y,a.z,b.y,b.z)*(uSigmaScale*uSigmaScale);
  mat3 R=mat3(viewMatrix);mat3 V=R*S*transpose(R);
  float z=mvPosition.z;
  vec2 focal=vec2(projectionMatrix[0][0],projectionMatrix[1][1])*uViewport*.5;
  vec3 j0=vec3(focal.x/-z,0.,focal.x*mvPosition.x/(z*z));
  vec3 j1=vec3(0.,focal.y/-z,focal.y*mvPosition.y/(z*z));
  vec3 s0=V*j0,s1=V*j1;
  // +0.3 px² is the usual low-pass that keeps distant splats from aliasing.
  float A=dot(j0,s0)+.3,B=dot(j0,s1),D=dot(j1,s1)+.3;
  float mid=.5*(A+D),radius=length(vec2(.5*(A-D),B));
  float l1=mid+radius,l2=max(mid-radius,.1);
  vec2 e1=abs(B)>1e-7?normalize(vec2(B,l1-A)):(A>=D?vec2(1.,0.):vec2(0.,1.));
  // "Boiling" brushwork: each mark re-lays a few times a second.
  float wobble=uBoil*(fract(sin(vSeed*91.7+floor(uTime*5.)*13.1)*43758.5)-.5)*.22;
  e1=mat2(cos(wobble),sin(wobble),-sin(wobble),cos(wobble))*e1;
  vec2 e2=vec2(-e1.y,e1.x);
  // Near-camera marks are capped so a close wash never smears the screen.
  float r1=sqrt(l1),r2=sqrt(l2),shrink=min(1.,uViewport.y*.2/r1);
  r1*=shrink;r2*=shrink;
  vPixels=r2;
  vUv=position.xy*${KERNEL.toFixed(2)};
  vec2 offset=(position.x*r1*e1+position.y*r2*e2)*${KERNEL.toFixed(2)};
  gl_Position=vec4(clip.xy+offset*2./uViewport*clip.w,clip.z,clip.w);
  #ifdef USE_FOG
  vFogDepth=-mvPosition.z;
  #endif
  #include <clipping_planes_vertex>
}`;

const FRAGMENT=/* glsl */`
uniform float uPaper,uHeroRadius,uMistDensity;
uniform vec3 uMistColor;
uniform sampler2D uNoise;
uniform vec3 uHeroPos,uHeroLight;
varying vec2 vUv;
varying vec4 vColor;
varying float vSeed,vKind,vPixels;
varying vec3 vWorld;
#include <fog_pars_fragment>
#include <clipping_planes_pars_fragment>
// One tiling RGBA value-noise texture (4 lattice frequencies) replaces
// per-fragment hash noise: the kernel is fill-rate bound on laptop GPUs.
vec4 nz(vec2 p){return texture2D(uNoise,p);}
vec3 toLinear(vec3 c){return mix(c/12.92,pow((c+.055)/1.055,vec3(2.4)),step(.04045,c));}
void main(){
  #include <clipping_planes_fragment>
  vec2 q=vUv;float along=q.x,across=q.y;
  float g=exp(-.5*dot(q,q));
  float wash=1.-step(.5,vKind),dab=step(1.5,vKind);
  // Bristles run the length of the stroke, so they vary only across it.
  vec4 stroke=nz(vec2(across*(.19+dab*.12)+vSeed*7.,along*.02+vSeed*3.1));
  float bristle=stroke.g*.6+stroke.b*.4;
  float ragged=nz(q*.11+vSeed*5.3).r;
  float body=g*(.74+(.5-wash*.28)*bristle)+(ragged-.5)*.24;
  // Edge softness of about a pixel and a half: crisp, ragged marks up close,
  // soft washes far away, never an out-of-focus blob.
  float edge=clamp(1.5/max(vPixels,1.),.012,.16);
  float alpha=smoothstep(.17-edge,.17+edge,body);
  vec4 tooth=nz(gl_FragCoord.xy*(1./97.));
  float paper=tooth.b*.6+tooth.a*.4;
  // Dry-brush: paper tooth shows through the trailing ends of strokes.
  alpha*=1.-uPaper*smoothstep(.5,.95,paper)*smoothstep(.2,1.,abs(along)/${KERNEL.toFixed(2)})*(.65-wash*.3);
  alpha*=vColor.a;
  if(alpha<.012)discard;
  vec3 color=toLinear(vColor.rgb);
  float rim=smoothstep(.3,.1,body);
  color*=1.-uPaper*(.24*rim+.09*(paper-.5))-.07*(1.-bristle);
  float d=distance(vWorld,uHeroPos);
  color+=color*uHeroLight*exp(-d*d/(uHeroRadius*uHeroRadius));
  // Optional camera-distance veil for scenes whose mist lives in material
  // shaders rather than scene.fog (the grove's localized daylight mist).
  float veil=1.-exp(-pow(length(cameraPosition-vWorld)*uMistDensity,2.));
  color=mix(color,uMistColor,veil);
  gl_FragColor=vec4(color,alpha);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
  #include <fog_fragment>
}`;

let noiseTexture:THREE.DataTexture|undefined;
/** Tileable value noise: r,g,b,a at 4, 8, 16 and 32 lattice cells. */
function paintNoise(){
  if(noiseTexture)return noiseTexture;
  const size=128,data=new Uint8Array(size*size*4),cells=[4,8,16,32];
  const lattice=cells.map((n,c)=>{const values=new Float32Array(n*n);let state=1013904223+c*7919;for(let i=0;i<values.length;i++){state=(state*1664525+1013904223)>>>0;values[i]=state/4294967296;}return values;});
  for(let y=0;y<size;y++)for(let x=0;x<size;x++)for(let c=0;c<4;c++){
    const n=cells[c],fx=x/size*n,fy=y/size*n,ix=Math.floor(fx),iy=Math.floor(fy);let u=fx-ix,v=fy-iy;u=u*u*(3-2*u);v=v*v*(3-2*v);
    const at=(i:number,j:number)=>lattice[c][((j+n)%n)*n+(i+n)%n];
    const value=THREE.MathUtils.lerp(THREE.MathUtils.lerp(at(ix,iy),at(ix+1,iy),u),THREE.MathUtils.lerp(at(ix,iy+1),at(ix+1,iy+1),u),v);
    data[(y*size+x)*4+c]=value*255;
  }
  noiseTexture=new THREE.DataTexture(data,size,size,THREE.RGBAFormat);
  noiseTexture.wrapS=noiseTexture.wrapT=THREE.RepeatWrapping;noiseTexture.magFilter=noiseTexture.minFilter=THREE.LinearFilter;noiseTexture.needsUpdate=true;
  return noiseTexture;
}

export type SplatCloudData=SplatSamples&{colors:Uint8Array};

function rgbToHsl(r:number,g:number,b:number,out:number[]){const max=Math.max(r,g,b),min=Math.min(r,g,b),l=(max+min)/2;let h=0,s=0;if(max!==min){const d=max-min;s=l>.5?d/(2-max-min):d/(max+min);h=max===r?(g-b)/d+(g<b?6:0):max===g?(b-r)/d+2:(r-g)/d+4;h/=6;}out[0]=h;out[1]=s;out[2]=l;}

/** Packs kept samples into GPU textures with painterly pigment variation:
 * slight hue drift, saturation lift, value jitter, and warm-lit tops versus
 * cool shadowed undersides (the classic landscape painter's temperature shift). */
export function packSplatTextures(data:SplatCloudData,keep:Uint8Array){
  let count=0;for(let i=0;i<data.count;i++)if(keep[i])count++;
  const height=Math.max(1,Math.ceil(count/WIDTH)),texels=WIDTH*height;
  const center=new Float32Array(texels*4),covA=new Float32Array(texels*4),covB=new Float32Array(texels*4),color=new Uint8Array(texels*4),centers=new Float32Array(count*3);
  const hsl=[0,0,0],tint=new THREE.Color();
  let k=0;
  for(let i=0;i<data.count;i++){
    if(!keep[i])continue;
    const seed=data.seed[i],ny=data.normals[i*3+1];
    center.set([data.centers[i*3],data.centers[i*3+1],data.centers[i*3+2],seed],k*4);
    centers.set([data.centers[i*3],data.centers[i*3+1],data.centers[i*3+2]],k*3);
    const c=data.covariance;covA.set([c[i*6],c[i*6+1],c[i*6+2],0],k*4);covB.set([c[i*6+3],c[i*6+4],c[i*6+5],data.kind[i]],k*4);
    rgbToHsl(data.colors[i*4]/255,data.colors[i*4+1]/255,data.colors[i*4+2]/255,hsl);
    const jitter=(seed*7.31)%1-.5,temperature=THREE.MathUtils.clamp(ny,-1,1);
    tint.setHSL((hsl[0]+jitter*.035+temperature*.012+1)%1,THREE.MathUtils.clamp(hsl[1]*1.12+.03,0,1),THREE.MathUtils.clamp(hsl[2]*(1+jitter*.14),0,1),THREE.LinearSRGBColorSpace);
    color[k*4]=tint.r*255;color[k*4+1]=tint.g*255;color[k*4+2]=tint.b*255;color[k*4+3]=data.colors[i*4+3];
    k++;
  }
  const texture=(array:Float32Array|Uint8Array,type:THREE.TextureDataType)=>{const t=new THREE.DataTexture(array as never,WIDTH,height,THREE.RGBAFormat,type);t.minFilter=t.magFilter=THREE.NearestFilter;t.generateMipmaps=false;t.needsUpdate=true;return t;};
  return {count,centers,center:texture(center,THREE.FloatType),covA:texture(covA,THREE.FloatType),covB:texture(covB,THREE.FloatType),color:texture(color,THREE.UnsignedByteType)};
}

export function createPaintSplatCloud(packed:ReturnType<typeof packSplatTextures>,options:{reduced:boolean;low:boolean;mist?:{color:THREE.ColorRepresentation;density:number}}){
  const {count}=packed;
  const geometry=new THREE.InstancedBufferGeometry();
  geometry.setAttribute('position',new THREE.Float32BufferAttribute([-1,-1,0,1,-1,0,1,1,0,-1,1,0],3));
  geometry.setIndex([0,1,2,0,2,3]);
  const order=new Float32Array(count);for(let i=0;i<count;i++)order[i]=i;
  const index=new THREE.InstancedBufferAttribute(order,1);index.setUsage(THREE.DynamicDrawUsage);
  geometry.setAttribute('aIndex',index);geometry.instanceCount=count;
  const uniforms={
    ...THREE.UniformsUtils.clone(THREE.UniformsLib.fog),
    uCenter:{value:packed.center},uCovA:{value:packed.covA},uCovB:{value:packed.covB},uColor:{value:packed.color},
    uViewport:{value:new THREE.Vector2(1,1)},uSigmaScale:{value:1},uTime:{value:0},uBoil:{value:options.reduced||options.low?0:1},
    uPaper:{value:options.low?.6:1},uNoise:{value:paintNoise()},uHeroPos:{value:new THREE.Vector3(0,-1e5,0)},uHeroLight:{value:new THREE.Color(0,0,0)},uHeroRadius:{value:8},uMistColor:{value:new THREE.Color(options.mist?.color??0)},uMistDensity:{value:options.mist?.density??0},
  };
  const material=new THREE.ShaderMaterial({vertexShader:VERTEX,fragmentShader:FRAGMENT,uniforms,transparent:true,depthWrite:false,depthTest:true,fog:true,clipping:true});
  const mesh=new THREE.Mesh(geometry,material);
  mesh.name='painterly-gaussian-splats';mesh.frustumCulled=false;mesh.renderOrder=1;mesh.layers.set(SPLAT_LAYER);
  mesh.userData.noSplat=true;mesh.raycast=()=>{};

  // ---- worker depth sort, for whichever camera is presenting this cloud ----
  const worker=new Worker(new URL('./paintSplatSort.worker.ts',import.meta.url),{type:'module'});
  worker.postMessage({type:'centers',centers:packed.centers});
  let spare:Float32Array|undefined=new Float32Array(count),pending=false,budget=count,dirty=true,requestId=0;
  const lastView=new THREE.Matrix4(),viewProjection=new THREE.Matrix4(),drawing=new THREE.Vector2();
  let primary:THREE.Camera|undefined,primaryFrame=-10,frame=0;
  worker.onmessage=(event:MessageEvent<{id:number;count:number;out:Float32Array}>)=>{
    const {count:visible,out}=event.data;
    order.set(out.subarray(0,visible));index.clearUpdateRanges();index.addUpdateRange(0,visible);index.needsUpdate=true;
    geometry.instanceCount=visible;spare=out;pending=false;
  };
  function requestSort(camera:THREE.Camera){
    camera.updateMatrixWorld();
    const moved=!camera.matrixWorldInverse.equals(lastView);
    if(pending||!spare||!(moved||dirty))return;
    lastView.copy(camera.matrixWorldInverse);dirty=false;pending=true;
    viewProjection.multiplyMatrices(camera.projectionMatrix,camera.matrixWorldInverse);
    const out=spare;spare=undefined;
    worker.postMessage({type:'sort',id:++requestId,view:new Float32Array(camera.matrixWorldInverse.elements),viewProjection:new Float32Array(viewProjection.elements),budget,out},[out.buffer]);
  }
  mesh.onBeforeRender=(renderer,_scene,camera)=>{
    if(camera.userData.splatBake)return;
    const target=renderer.getRenderTarget();
    if(target)uniforms.uViewport.value.set(target.width,target.height);
    else uniforms.uViewport.value.copy(renderer.getDrawingBufferSize(drawing));
    // Water reflections and portal previews reuse the order sorted for the
    // presenting camera; only an otherwise unseen cloud sorts for them.
    if(camera===primary){primaryFrame=frame;requestSort(camera);}
    else if(frame-primaryFrame>2)requestSort(camera);
  };
  return {
    mesh,count,
    setPrimaryCamera(camera:THREE.Camera){primary=camera;},
    tick(seconds:number){frame++;uniforms.uTime.value=seconds;},
    setHero(x:number,y:number,z:number,light:THREE.ColorRepresentation,strength:number,radius:number){uniforms.uHeroPos.value.set(x,y+1,z);uniforms.uHeroLight.value.set(light).multiplyScalar(strength);uniforms.uHeroRadius.value=radius;},
    /** Thin to a uniform subsample and widen the survivors to keep coverage. */
    setBudget(fraction:number){budget=Math.max(1,Math.floor(count*THREE.MathUtils.clamp(fraction,.05,1)));uniforms.uSigmaScale.value=Math.sqrt(count/budget);dirty=true;},
    setLow(){uniforms.uBoil.value=0;uniforms.uPaper.value=.6;},
    dispose(){worker.terminate();geometry.dispose();material.dispose();for(const t of [packed.center,packed.covA,packed.covB,packed.color])t.dispose();mesh.removeFromParent();},
  };
}
