import * as THREE from 'three';
import {forestPaintGLSL,forestPaintOrder,FOREST_PAINT_EDGE} from './forestPaint';
import {proximityPaintGLSL,proximityPaintUniforms,type ProximityPaint} from './proximityPaint';

const MAX=16000;
type Patch={mesh:THREE.Mesh;local:THREE.Vector3[];start:number};
/** Sample the actual painted faces/ground once per layout. The moving sparkles
 * retain the sampled pigment hue; no per-frame image reads or GPU readback. */
export function createForestPaintSparkles(world:THREE.Scene,options:{maxSamples?:number;pointScale?:number}={}){
 const limit=options.maxSamples??MAX;
 const geometry=new THREE.BufferGeometry(),positions=new Float32Array(limit*3),colors=new Float32Array(limit*3),seeds=new Float32Array(limit);
 geometry.setAttribute('position',new THREE.BufferAttribute(positions,3).setUsage(THREE.DynamicDrawUsage));geometry.setAttribute('color',new THREE.BufferAttribute(colors,3));geometry.setAttribute('seed',new THREE.BufferAttribute(seeds,1));geometry.setDrawRange(0,0);
 const material=new THREE.ShaderMaterial({vertexColors:true,transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,
  uniforms:{...proximityPaintUniforms(),forestPaintProgress:{value:0},time:{value:0},pixelHeight:{value:720},pointScale:{value:options.pointScale??1}},
  vertexShader:`attribute float seed;uniform float time,pixelHeight,pointScale;varying vec3 tint,w;varying float phase;void main(){w=position;phase=seed;vec3 p=position+vec3(sin(time*5.+seed),cos(time*4.3+seed),sin(time*3.7+seed*2.))*.012*pointScale;vec4 v=viewMatrix*vec4(p,1.);gl_Position=projectionMatrix*v;gl_PointSize=clamp(pixelHeight*(.025+.025*fract(seed))*pointScale/max(.15,-v.z),2.,28.);tint=color;}`,
  fragmentShader:`varying vec3 tint,w;varying float phase;uniform float time;${forestPaintGLSL}${proximityPaintGLSL}
void main(){float edge;if(forestProximityEnabled>.5){float n=proximityPaintAt(w);edge=4.*n*(1.-n);}else{if(forestPaintProgress<=0.||forestPaintProgress>=1.)discard;edge=1.-smoothstep(.007,.026,abs(forestPaintOrder(w)-forestPaintProgress));}if(edge<=0.)discard;vec2 p=gl_PointCoord-.5;float core=exp(-dot(p,p)*160.);float star=exp(-abs(p.x)*65.-abs(p.y)*8.)+exp(-abs(p.y)*65.-abs(p.x)*8.);float pulse=.25+.75*pow(.5+.5*sin(time*15.+phase*3.),3.);gl_FragColor=vec4(tint*(core*2.+star*.8),edge*pulse);
#include <tonemapping_fragment>
#include <colorspace_fragment>
}`});
 const points=new THREE.Points(geometry,material);points.name='forest-painting-sparkles';points.frustumCulled=false;points.visible=false;world.add(points);
 const images=new WeakMap<object,{data:Uint8ClampedArray;width:number;height:number}>();let patches:Patch[]=[],count=0,sourceReads=0;
 function pixels(image:HTMLCanvasElement|HTMLImageElement){
  const old=images.get(image);if(old)return old;
  if(!('getContext'in image)&&!('naturalWidth'in image))return;
  const canvas=document.createElement('canvas');canvas.width=canvas.height=64;const ctx=canvas.getContext('2d',{willReadFrequently:true})!;ctx.drawImage(image,0,0,64,64);const result={data:ctx.getImageData(0,0,64,64).data,width:64,height:64};images.set(image,result);sourceReads++;return result;
 }
 function configure(root:THREE.Group){
  patches=[];count=0;let seed=73991;const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};root.updateWorldMatrix(true,true);
  const surfaces:THREE.Mesh[]=[];root.traverse(o=>{if(o instanceof THREE.Mesh)surfaces.push(o);});
  const paintedFace=(o:THREE.Mesh)=>!Array.isArray(o.material)&&o.material.alphaTest>0?1:0;
  surfaces.sort((a,b)=>paintedFace(b)-paintedFace(a)).forEach(o=>{
   if(count>=limit||!(o instanceof THREE.Mesh)||o.userData.editorHelper||o.userData.bookStory||o.userData.paperStand||o.userData.foldRenderBatch)return;
   let visible=true;for(let p:THREE.Object3D|null=o;p&&p!==root;p=p.parent)if(!p.userData.woodlandMoment)visible&&=p.visible;if(!visible)return;
   const mat=Array.isArray(o.material)?undefined:o.material as THREE.MeshStandardMaterial;if(!mat?.map)return;
   const image=mat.map.image as HTMLCanvasElement,source=image?pixels(image):undefined;if(!source)return;
   const p=o.geometry.getAttribute('position'),uv=o.geometry.getAttribute('uv'),index=o.geometry.index;if(!uv)return;
   const triangles=Math.floor((index?.count??p.count)/3),cdf:number[]=[],a=new THREE.Vector3(),b=new THREE.Vector3(),c=new THREE.Vector3();let area=0;
   const at=(i:number)=>index?index.getX(i):i;
   for(let t=0;t<triangles;t++){a.fromBufferAttribute(p,at(t*3));b.fromBufferAttribute(p,at(t*3+1));c.fromBufferAttribute(p,at(t*3+2));area+=b.sub(a).cross(c.sub(a)).length()*.5;cdf.push(area);}
   if(area<=0)return;const scale=o.getWorldScale(new THREE.Vector3()),tries=Math.min(500,Math.max(30,Math.ceil(area*scale.x*scale.y*150))),local:THREE.Vector3[]=[],start=count;
   for(let i=0;i<tries&&count<limit;i++){
    const choose=random()*area;let t=0;while(t<cdf.length-1&&cdf[t]<choose)t++;
    const ia=at(t*3),ib=at(t*3+1),ic=at(t*3+2),r=Math.sqrt(random()),s=random(),wa=1-r,wb=r*(1-s),wc=r*s;
    const u=wa*uv.getX(ia)+wb*uv.getX(ib)+wc*uv.getX(ic),v=wa*uv.getY(ia)+wb*uv.getY(ib)+wc*uv.getY(ic),x=Math.max(0,Math.min(63,Math.floor(u*64))),y=Math.max(0,Math.min(63,Math.floor((1-v)*64))),k=(y*64+x)*4;
    if(source.data[k+3]<22)continue;
    const point=new THREE.Vector3().fromBufferAttribute(p,ia).multiplyScalar(wa).addScaledVector(b.fromBufferAttribute(p,ib),wb).addScaledVector(c.fromBufferAttribute(p,ic),wc);point.z+=.012;local.push(point);
    const color=new THREE.Color(source.data[k]/255,source.data[k+1]/255,source.data[k+2]/255).convertSRGBToLinear();const peak=Math.max(.035,color.r,color.g,color.b);color.multiplyScalar(1.3/peak);colors.set(color.toArray(),count*3);seeds[count]=random()*97;count++;
   }
   if(local.length)patches.push({mesh:o,local,start});
  });
  geometry.setDrawRange(0,count);geometry.attributes.color.needsUpdate=true;geometry.attributes.seed.needsUpdate=true;
 }
 return {configure,points,get sourceReads(){return sourceReads;},update(t:number,progress:number,open:number,enabled:boolean,pixelHeight:number,proximity?:ProximityPaint){
  points.visible=enabled&&open>.99&&(proximity?proximity.painting>0:progress>0&&progress<1);material.uniforms.forestProximityEnabled.value=proximity?1:0;material.uniforms.forestProximityMap.value=proximity?.texture??null;if(proximity)material.uniforms.forestProximityBounds.value.copy(proximity.bounds);material.uniforms.time.value=t;material.uniforms.forestPaintProgress.value=progress;material.uniforms.pixelHeight.value=pixelHeight;
  let active=0;const v=new THREE.Vector3();
  if(points.visible)for(const patch of patches){let visible=true;for(let o:THREE.Object3D|null=patch.mesh;o;o=o.parent)visible&&=o.visible;patch.mesh.updateWorldMatrix(true,false);for(let i=0;i<patch.local.length;i++){const at=(patch.start+i)*3;if(!visible){positions[at]=positions[at+1]=positions[at+2]=100000;continue;}v.copy(patch.local[i]).applyMatrix4(patch.mesh.matrixWorld);positions[at]=v.x;positions[at+1]=v.y;positions[at+2]=v.z;const n=proximity?.amountAt(v.x,v.z);if(n!==undefined?n>0&&n<1:Math.abs(forestPaintOrder(v.x,v.y,v.z)-progress)<FOREST_PAINT_EDGE)active++;}}geometry.attributes.position.needsUpdate=true;
  return {active,samples:count};
 },dispose(){points.removeFromParent();geometry.dispose();material.dispose();}};
}
