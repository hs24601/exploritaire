import * as THREE from 'three';
import type {SplatFocus,SplatSamples,SplatSource} from './paintSplatSampling';
import {seeded} from '../castlePaint';

// Survey-camera colour bake. Real Gaussian splats are fitted to photographs;
// here the "photographs" are offscreen renders of the existing painted scene
// (watercolour washes, atlas paint, lighting and emissive glow included).
// Every sample takes its colour from the most frontal, closest survey view in
// which its depth agrees with the rendered depth, so occluders never bleed in.

export const SPLAT_BAKE_LAYER=6;

export type SplatBakeOptions={views:number;size:number;focus:SplatFocus;progress?:(fraction:number)=>void|Promise<void>};
export type SplatBakeResult={colors:Uint8Array;keep:Uint8Array;seen:Uint8Array;covered:number;views:number;bySource:{name:string;samples:number;covered:number}[]};

const DEPTH_SHADER={
  vertexShader:'varying vec2 vUv;void main(){vUv=uv;gl_Position=vec4(position.xy,0.,1.);}',
  fragmentShader:`#include <packing>
    uniform sampler2D tDepth;uniform float near,far;varying vec2 vUv;
    void main(){float d=texture2D(tDepth,vUv).x;gl_FragColor=vec4(d>=.99999?1e9:-perspectiveDepthToViewZ(d,near,far),0.,0.,1.);}`,
};

export async function bakeSplatColors(renderer:THREE.WebGLRenderer,scene:THREE.Scene,sources:SplatSource[],samples:SplatSamples,options:SplatBakeOptions):Promise<SplatBakeResult>{
  const {size,focus}=options,n=samples.count;
  const color=new THREE.WebGLRenderTarget(size,size,{colorSpace:THREE.SRGBColorSpace});color.depthTexture=new THREE.DepthTexture(size,size);
  const depth=new THREE.WebGLRenderTarget(size,size,{type:THREE.FloatType,minFilter:THREE.NearestFilter,magFilter:THREE.NearestFilter});
  const quadMaterial=new THREE.ShaderMaterial({...DEPTH_SHADER,uniforms:{tDepth:{value:color.depthTexture},near:{value:.1},far:{value:1000}},depthTest:false,depthWrite:false});
  const quadScene=new THREE.Scene(),quadCamera=new THREE.OrthographicCamera(-1,1,1,-1,0,1);
  quadScene.add(new THREE.Mesh(new THREE.PlaneGeometry(2,2),quadMaterial));
  const camera=new THREE.PerspectiveCamera(72,1,.1,1000);camera.userData.splatBake=true;camera.layers.set(SPLAT_BAKE_LAYER);
  // Only the converted surfaces (plus lights) are photographed: particles,
  // veils, portals and Hero are not part of the painted ground truth.
  for(const {mesh} of sources)mesh.layers.enable(SPLAT_BAKE_LAYER);
  scene.traverse(object=>{if((object as THREE.Light).isLight)object.layers.enable(SPLAT_BAKE_LAYER);});
  const pixels=new Uint8Array(size*size*4),depths=new Float32Array(size*size*4);
  const best=new Float32Array(n).fill(-1),rgb=new Float32Array(n*3),rejected=new Uint8Array(n),occluded=new Uint8Array(n);
  const view=new THREE.Matrix4(),p=new THREE.Vector3(),eye=new THREE.Vector3(),target=new THREE.Vector3();
  const previous={target:renderer.getRenderTarget(),autoClear:renderer.autoClear,shadow:renderer.shadowMap.needsUpdate,clipping:renderer.clippingPlanes,clear:renderer.getClearColor(new THREE.Color()),alpha:renderer.getClearAlpha(),fog:scene.fog,density:(scene.fog as THREE.FogExp2|null)?.density,far:(scene.fog as THREE.Fog|null)?.far,background:scene.background};
  const random=seeded(7741);
  const R=focus.radius,tanHalf=Math.tan(THREE.MathUtils.degToRad(camera.fov/2));
  let covered=0,views=0;

  function shoot(){
    camera.updateMatrixWorld(true);camera.updateProjectionMatrix();
    renderer.setRenderTarget(color);renderer.clear();renderer.render(scene,camera);
    quadMaterial.uniforms.near.value=camera.near;quadMaterial.uniforms.far.value=camera.far;
    renderer.setRenderTarget(depth);renderer.render(quadScene,quadCamera);
    renderer.readRenderTargetPixels(color,0,0,size,size,pixels);
    renderer.readRenderTargetPixels(depth,0,0,size,size,depths);
    view.multiplyMatrices(camera.projectionMatrix,camera.matrixWorldInverse);
    const e=view.elements,cam=camera.position;
    for(let i=0;i<n;i++){
      const x=samples.centers[i*3],y=samples.centers[i*3+1],z=samples.centers[i*3+2];
      const w=e[3]*x+e[7]*y+e[11]*z+e[15];if(w<=camera.near)continue;
      const sx=(e[0]*x+e[4]*y+e[8]*z+e[12])/w,sy=(e[1]*x+e[5]*y+e[9]*z+e[13])/w;
      if(sx<=-1||sx>=1||sy<=-1||sy>=1)continue;
      const dx=cam.x-x,dy=cam.y-y,dz=cam.z-z,distance=Math.hypot(dx,dy,dz);
      const facing=Math.abs((samples.normals[i*3]*dx+samples.normals[i*3+1]*dy+samples.normals[i*3+2]*dz)/distance);
      const score=(.15+facing)/(1+distance/(R*.35));
      if(score<=best[i]&&best[i]>=0)continue;
      const col=Math.floor((sx*.5+.5)*size),row=Math.floor((sy*.5+.5)*size);
      // Depth agreement: perspective w is the view depth for a perspective camera.
      const footprint=w*2*tanHalf/size,tolerance=.006*w+1.6*samples.sigma[i]+2*footprint,seen=depths[(row*size+col)*4];
      if(Math.abs(seen-w)>tolerance){
        // Hidden behind nearer paint while facing this camera: evidence that the
        // sample is buried (e.g. inside overlapping canopy blobs).
        if(seen<w&&facing>.25&&occluded[i]<255)occluded[i]++;
        continue;
      }
      // A small depth-matched box filter: the colour of the stroke, not a texel.
      let r=0,g=0,b=0,count=0;
      for(let oy=-1;oy<=1;oy++)for(let ox=-1;ox<=1;ox++){
        const cx=col+ox,cy=row+oy;if(cx<0||cy<0||cx>=size||cy>=size)continue;
        const k=cy*size+cx;if(Math.abs(depths[k*4]-w)>tolerance)continue;
        r+=pixels[k*4];g+=pixels[k*4+1];b+=pixels[k*4+2];count++;
      }
      if(best[i]<0)covered++;
      best[i]=score;rgb[i*3]=r/count;rgb[i*3+1]=g/count;rgb[i*3+2]=b/count;
    }
    views++;
  }

  try{
    renderer.autoClear=true;renderer.shadowMap.needsUpdate=false;renderer.clippingPlanes=[];
    // Thin the fog via its uniforms rather than removing it, so no material
    // has to compile a fog-free program just for the survey.
    renderer.setClearColor(0x000000,1);scene.background=null;
    if(scene.fog instanceof THREE.FogExp2)scene.fog.density=0;else if(scene.fog instanceof THREE.Fog)scene.fog.far=1e9;
    camera.near=Math.max(.05,R*.004);camera.far=R*14;
    // Establishing views: an overhead plan and an oblique ring.
    camera.up.set(0,0,-1);camera.position.set(focus.x,focus.y+R*1.6,focus.z);camera.lookAt(focus.x,focus.y,focus.z);shoot();
    camera.up.set(0,1,0);
    const ring=Math.min(6,Math.max(3,Math.floor(options.views/5)));
    for(let k=0;k<ring;k++){const angle=k/ring*Math.PI*2+.4;camera.position.set(focus.x+Math.cos(angle)*R*.9,focus.y+R*.5,focus.z+Math.sin(angle)*R*.9);camera.lookAt(focus.x,focus.y,focus.z);shoot();await options.progress?.(views/options.views);}
    // Interior views from the heart of the scene look outward at enclosing
    // walls, cliffs and tree lines that the outer ring only sees from behind.
    for(let k=0;k<ring;k++){const angle=k/ring*Math.PI*2;camera.position.set(focus.x,focus.y+R*.08,focus.z);camera.lookAt(focus.x+Math.cos(angle)*R,focus.y+R*.12,focus.z+Math.sin(angle)*R);shoot();}
    // A coarse plan grid of oblique high views covers broad ground quickly.
    for(const [gx,gz] of [[-1,-1],[1,-1],[-1,1],[1,1],[0,0]]){
      const x=focus.x+gx*R*.6,z=focus.z+gz*R*.6;
      camera.position.set(x-gx*R*.12,focus.y+R*.55,z-gz*R*.12+R*.08);camera.lookAt(x,focus.y,z);shoot();
    }
    await options.progress?.(views/options.views);
    // Greedy coverage: aim the next survey camera squarely at a random
    // still-uncovered sample. Samples that stay dark after their own close-up
    // are transparent card texels or buried faces and are rejected.
    const distance=R*.2;
    let attempts=0;
    while(views<options.views&&covered<n*.985&&attempts<n){
      attempts++;
      const i=Math.floor(random()*n);if(best[i]>=0||rejected[i])continue;
      p.fromArray(samples.centers,i*3);eye.fromArray(samples.normals,i*3);
      if(eye.y<-.2&&sources[samples.source[i]].cutout)eye.negate();
      eye.multiplyScalar(distance).add(p);eye.y+=distance*.35;
      target.copy(p);camera.position.copy(eye);camera.lookAt(target);shoot();
      if(best[i]<0)rejected[i]=1;
      if(views%4===0)await options.progress?.(views/options.views);
    }
  }finally{
    renderer.setRenderTarget(previous.target);renderer.autoClear=previous.autoClear;renderer.shadowMap.needsUpdate=previous.shadow;renderer.clippingPlanes=previous.clipping;
    renderer.setClearColor(previous.clear,previous.alpha);scene.background=previous.background;
    if(scene.fog instanceof THREE.FogExp2)scene.fog.density=previous.density!;else if(scene.fog instanceof THREE.Fog)scene.fog.far=previous.far!;
    color.depthTexture?.dispose();color.dispose();depth.dispose();quadMaterial.dispose();
  }

  // Uncovered opaque samples borrow the nearest covered sample of the same
  // surface (then its mean colour); uncovered cut-out samples are dropped
  // because they sit on transparent texels.
  const sums=new Float64Array(sources.length*4),cell=R/28,grid=new Map<number,number[]>();
  const key=(i:number,dx=0,dy=0,dz=0)=>((((Math.floor(samples.centers[i*3]/cell)+dx)*73856093)^((Math.floor(samples.centers[i*3+1]/cell)+dy)*19349663)^((Math.floor(samples.centers[i*3+2]/cell)+dz)*83492791))>>>0)*64+samples.source[i]%64;
  for(let i=0;i<n;i++)if(best[i]>=0){
    const s=samples.source[i]*4;sums[s]+=rgb[i*3];sums[s+1]+=rgb[i*3+1];sums[s+2]+=rgb[i*3+2];sums[s+3]++;
    const k=key(i);const list=grid.get(k);if(list)list.push(i);else grid.set(k,[i]);
  }
  function nearest(i:number){
    const x=samples.centers[i*3],y=samples.centers[i*3+1],z=samples.centers[i*3+2];
    for(let ring=0;ring<=2;ring++){
      let found=-1,distance=Infinity;
      for(let dx=-ring;dx<=ring;dx++)for(let dy=-ring;dy<=ring;dy++)for(let dz=-ring;dz<=ring;dz++){
        if(Math.max(Math.abs(dx),Math.abs(dy),Math.abs(dz))!==ring)continue;
        for(const j of grid.get(key(i,dx,dy,dz))??[]){if(samples.source[j]!==samples.source[i])continue;const d=(samples.centers[j*3]-x)**2+(samples.centers[j*3+1]-y)**2+(samples.centers[j*3+2]-z)**2;if(d<distance){distance=d;found=j;}}
      }
      if(found>=0)return found;
    }
    return -1;
  }
  const colors=new Uint8Array(n*4),keep=new Uint8Array(n),fallback=new THREE.Color();
  for(let i=0;i<n;i++){
    const source=sources[samples.source[i]],s=samples.source[i]*4;
    if(best[i]>=0){colors[i*4]=rgb[i*3];colors[i*4+1]=rgb[i*3+1];colors[i*4+2]=rgb[i*3+2];keep[i]=1;}
    // Never photographed, and hidden behind nearer paint in two or more views
    // that faced it: buried surface, dropped like a transparent texel.
    else if(!source.cutout&&!rejected[i]&&occluded[i]<2){
      const j=nearest(i);
      if(j>=0){colors[i*4]=rgb[j*3];colors[i*4+1]=rgb[j*3+1];colors[i*4+2]=rgb[j*3+2];}
      else if(sums[s+3]>0){colors[i*4]=sums[s]/sums[s+3];colors[i*4+1]=sums[s+1]/sums[s+3];colors[i*4+2]=sums[s+2]/sums[s+3];}
      else{fallback.copy((source.mesh.material as THREE.MeshLambertMaterial).color??fallback.set(1,1,1)).convertLinearToSRGB();colors[i*4]=fallback.r*200;colors[i*4+1]=fallback.g*200;colors[i*4+2]=fallback.b*200;}
      keep[i]=1;
    }
    colors[i*4+3]=Math.round(samples.opacity[i]*255);
  }
  const bySource=sources.map(source=>({name:source.mesh.name||`${source.mesh.geometry.type}/${(source.mesh.material as THREE.Material).type}/${(source.mesh as THREE.InstancedMesh).count??1}`,samples:0,covered:0}));
  for(let i=0;i<n;i++){const entry=bySource[samples.source[i]];entry.samples++;if(best[i]>=0)entry.covered++;}
  bySource.sort((a,b)=>b.samples-a.samples);
  const seen=new Uint8Array(n);for(let i=0;i<n;i++)seen[i]=best[i]>=0?1:0;
  return {colors,keep,seen,covered,views,bySource:bySource.slice(0,12)};
}
