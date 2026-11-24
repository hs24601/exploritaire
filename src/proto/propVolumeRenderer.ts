import { gameTime } from '../gameTime';
import * as THREE from 'three';
import { propVolumeView, propVolumeRaster, PAINT_VOLUME_RASTER_HEIGHT as SLOT_HEIGHT, PAINT_VOLUME_RASTER_WIDTH as SLOT_WIDTH, VOLUME_VIEW, type PropVolume, type VolumeLight } from './propVolume';

/** One offscreen renderer for every prop, never one WebGL context per tree.
 * Its small depth-tested views are copied into the shared bounded canvas cache.
 * The pure CPU rasterizer remains available on WebGL failure/context loss. */
let renderer:THREE.WebGLRenderer|undefined, unavailable=false;
let transfer:CanvasRenderingContext2D|OffscreenCanvasRenderingContext2D|null=null;
// Keep source ink and face normals on the GPU. A moving candle only changes
// uniforms; it must not rebuild/upload every face's colour buffer.
const scene=new THREE.Scene(),material=new THREE.ShaderMaterial({
  uniforms:{sun:{value:new THREE.Vector3()},local:{value:new THREE.Vector3()},brightness:{value:1},amount:{value:0},tint:{value:new THREE.Vector3()},monochrome:{value:0},paint:{value:0}},
  vertexShader:`varying vec3 ink;
    uniform vec3 sun, local, tint; uniform float brightness, amount, monochrome, paint;
    void main() {
      float shade = (mix(.64,.8,paint) + mix(.48,.25,paint) * max(0., dot(normal, sun))) * brightness;
      float rim = max(0., dot(normal, local)) * amount * .38;
      ink = clamp(mix(color, vec3(45.,60.,73.) / 255., monochrome) * shade + tint * rim, 0., 1.);
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.);
    }`,
  fragmentShader:'varying vec3 ink; void main() { gl_FragColor = vec4(ink, 1.); }',
  vertexColors:true,toneMapped:false,
});
const camera=new THREE.OrthographicCamera(VOLUME_VIEW.left,VOLUME_VIEW.left+VOLUME_VIEW.width,-VOLUME_VIEW.top,-VOLUME_VIEW.top-VOLUME_VIEW.height,.1,10);
const shadowMaterial=new THREE.ShaderMaterial({
  uniforms:{shear:{value:new THREE.Vector2()},bounds:{value:new THREE.Vector4()}},
  vertexShader:`uniform vec2 shear; uniform vec4 bounds;
    void main() { vec2 p = vec2(position.x, position.z) + position.y * shear;
      gl_Position = vec4((p.x-bounds.x)/(bounds.z-bounds.x)*2.-1., 1.-(p.y-bounds.y)/(bounds.w-bounds.y)*2., 0., 1.); }`,
  // Every projected face is at the same depth and has the same black ink.
  // Strict depth testing forms their union while rejecting covered fragments;
  // blending thousands of overlapping voxel faces wasted most shadow work.
  fragmentShader:'void main() { gl_FragColor = vec4(0.,0.,0.,1.); }', side:THREE.DoubleSide,depthTest:true,depthWrite:true,depthFunc:THREE.LessDepth,toneMapped:false,
});
const meshes=new Map<PropVolume,THREE.Mesh>();
export type VolumeShadowProjection={s:number;c:number;left:number;top:number;right:number;bottom:number};
export type VolumeRenderRequest={target:CanvasRenderingContext2D;volume:PropVolume;yaw:number;elevation:number;light:VolumeLight;monochrome:boolean;shadow?:VolumeShadowProjection};
function batchRaster(requests:readonly VolumeRenderRequest[]) {
  const rasters=requests.map(({volume,shadow})=>propVolumeRaster(volume,Boolean(shadow)));
  return {width:Math.max(...rasters.map(r=>r.width)),height:Math.max(...rasters.map(r=>r.height))};
}
const vertices=new WeakMap<PropVolume,Float32Array>();
export function volumeShadowProjection(volume:PropVolume,s:number,c:number):VolumeShadowProjection {
  let points=vertices.get(volume);
  if(!points){points=new Float32Array(volume.faces.length*12);volume.faces.forEach((face,i)=>face.vertices.forEach((point,j)=>points!.set(point,i*12+j*3)));vertices.set(volume,points);}
  let left=Infinity,top=Infinity,right=-Infinity,bottom=-Infinity;
  for(let i=0;i<points.length;i+=3){const x=points[i]+points[i+1]*s,y=points[i+2]+points[i+1]*c;left=Math.min(left,x);right=Math.max(right,x);top=Math.min(top,y);bottom=Math.max(bottom,y);}
  return {s,c,left,top,right,bottom};
}
/** Render the frame's misses into one atlas before reading any GPU pixels.
 * Interleaving render/drawImage for each prop forced a GPU wait for each view. */
function renderVolumeGPUViewsSync(requests:readonly VolumeRenderRequest[],copy=true) {
  if(unavailable||new URLSearchParams(location.search).get('propRenderer')==='canvas')return false;
  try {
    if(!renderer){
      const surface=typeof document==='undefined'?new OffscreenCanvas(SLOT_WIDTH*4,SLOT_HEIGHT*4):document.createElement('canvas');
      renderer=new THREE.WebGLRenderer({canvas:surface,alpha:true,antialias:false,preserveDrawingBuffer:true});
      renderer.setSize(SLOT_WIDTH*4,SLOT_HEIGHT*4,false);renderer.setClearColor(0,0);
      renderer.autoClear=false;renderer.setScissorTest(true);
      if(copy){const canvas=document.createElement('canvas');canvas.width=SLOT_WIDTH*4;canvas.height=SLOT_HEIGHT*4;
        transfer=canvas.getContext('2d',{willReadFrequently:true});}
    }
    if((copy&&!transfer)||renderer.getContext().isContextLost())return false;
    for(let start=0;start<requests.length;start+=16){
      const batch=requests.slice(start,start+16);
      const slot=batchRaster(batch);
      batch.forEach(({volume,yaw,elevation,light,monochrome,shadow},index)=>{
    let mesh=meshes.get(volume);
    if(!mesh){
      const geometry=new THREE.BufferGeometry(),positions=new Float32Array(volume.faces.length*18),colors=new Float32Array(positions.length),normals=new Float32Array(positions.length);
      volume.faces.forEach((face,index)=>{
        [0,1,2,0,2,3].forEach((corner,i)=>{
          const offset=index*18+i*3;positions.set(face.vertices[corner],offset);normals.set(face.normals?.[corner]??face.normal,offset);
          colors.set((face.colors?.[corner]??face.color).map(value=>value/255),offset);
        });
      });
      geometry.setAttribute('position',new THREE.BufferAttribute(positions,3));
      geometry.setAttribute('normal',new THREE.BufferAttribute(normals,3));geometry.setAttribute('color',new THREE.BufferAttribute(colors,3));
      mesh=new THREE.Mesh(geometry,material);meshes.set(volume,mesh);
    }
    material.uniforms.sun.value.set(...light.direction).normalize();material.uniforms.local.value.set(...light.localDirection).normalize();
    material.uniforms.brightness.value=light.brightness;material.uniforms.amount.value=light.localAmount;
    material.uniforms.tint.value.set(...light.tint).multiplyScalar(1/255);material.uniforms.monochrome.value=monochrome?1:0;
    material.uniforms.paint.value=volume.surface==='paint'&&volume.paintShading!==false?1:0;
    mesh.material=shadow?shadowMaterial:material;
    if(shadow){shadowMaterial.uniforms.shear.value.set(shadow.s,shadow.c);shadowMaterial.uniforms.bounds.value.set(shadow.left,shadow.top,shadow.right,shadow.bottom);}
    const a=((yaw%360+360)%360)*Math.PI/180,e=elevation*Math.PI/180;
    const bounds=propVolumeView(volume);
    camera.left=bounds.left;camera.right=bounds.left+bounds.width;camera.top=-bounds.top;camera.bottom=-bounds.top-bounds.height;camera.updateProjectionMatrix();
    camera.position.set(Math.sin(a)*Math.cos(e)*4,Math.sin(e)*4,Math.cos(a)*Math.cos(e)*4);camera.lookAt(0,0,0);
    const raster=propVolumeRaster(volume,Boolean(shadow));
    const x=index%4*slot.width,y=4*SLOT_HEIGHT-Math.floor(index/4)*slot.height-raster.height;
    renderer!.setViewport(x,y,raster.width,raster.height);renderer!.setScissor(x,y,raster.width,raster.height);
    renderer!.clear();scene.clear();scene.add(mesh);renderer!.render(scene,camera);
      });
      if(!copy)continue;
      const width=Math.min(4,batch.length)*slot.width,height=Math.ceil(batch.length/4)*slot.height;
      transfer!.clearRect(0,0,width,height);transfer!.drawImage(renderer.domElement,0,0,width,height,0,0,width,height);
      batch.forEach(({target,volume,shadow},index)=>{const {width:w,height:h}=propVolumeRaster(volume,Boolean(shadow));target.clearRect(0,0,w,h);target.drawImage(transfer!.canvas,index%4*slot.width,Math.floor(index/4)*slot.height,w,h,0,0,w,h);});
    }
    return true;
  }catch{
    unavailable=true;renderer?.dispose();renderer=undefined;transfer=null;
    disposeMeshes();return false;
  }
}
/** Worker-only: transfer the GPU atlas without a CPU readback on the UI thread. */
export function renderVolumeGPUAtlas(requests:readonly VolumeRenderRequest[]) {
  if(!renderVolumeGPUViewsSync(requests,false))return null;
  return (renderer!.domElement as unknown as OffscreenCanvas).transferToImageBitmap();
}
let worker:Worker|undefined,workerUnavailable=false,serial=0,volumeSerial=0;
const volumeIds=new WeakMap<PropVolume,number>();
const replies=new Map<number,{resolve:(value:ImageBitmap|null)=>void;timer:number}>();
function stopWorker(){worker?.terminate();worker=undefined;workerUnavailable=true;for(const pending of replies.values()){gameTime.clearTimeout(pending.timer);pending.resolve(null);}replies.clear();}
async function workerAtlas(requests:readonly VolumeRenderRequest[]) {
  if(!worker){worker=new Worker(new URL('./propVolumeWorker.ts',import.meta.url),{type:'module'});
    worker.onmessage=event=>{const pending=replies.get(event.data.id);if(!pending){event.data.bitmap?.close();return;}
      replies.delete(event.data.id);gameTime.clearTimeout(pending.timer);pending.resolve(event.data.bitmap);};
    worker.onerror=()=>stopWorker();}
  const models:{id:number;volume:PropVolume}[]=[];
  const entries=requests.map(({target,volume,...request})=>{let id=volumeIds.get(volume);
    if(!id){id=++volumeSerial;volumeIds.set(volume,id);models.push({id,volume});}return {...request,volumeId:id};});
  const id=++serial;
  return new Promise<ImageBitmap|null>(resolve=>{
    const timer=gameTime.setTimeout(()=>stopWorker(),10000);replies.set(id,{resolve,timer});
    worker!.postMessage({id,models,entries});
  });
}
/** Async atlas transfers keep shader setup, geometry upload and GPU waits away
 * from the travel/input clock. Unsupported workers retain the existing fallback. */
export async function renderVolumeGPUViews(requests:readonly VolumeRenderRequest[]) {
  if(new URLSearchParams(location.search).get('propRenderer')==='canvas')return false;
  if(workerUnavailable||typeof Worker==='undefined'||typeof OffscreenCanvas==='undefined')return renderVolumeGPUViewsSync(requests);
  try{for(let start=0;start<requests.length;start+=16){const batch=requests.slice(start,start+16),slot=batchRaster(batch),bitmap=await workerAtlas(batch);
    if(!bitmap){stopWorker();return renderVolumeGPUViewsSync(requests);}
    try{batch.forEach(({target,volume,shadow},i)=>{const {width:w,height:h}=propVolumeRaster(volume,Boolean(shadow));target.clearRect(0,0,w,h);target.drawImage(bitmap,i%4*slot.width,Math.floor(i/4)*slot.height,w,h,0,0,w,h);});}finally{bitmap.close();}}
    return true;
  }catch{stopWorker();return renderVolumeGPUViewsSync(requests);}
}
function disposeMeshes(){meshes.forEach(mesh=>mesh.geometry.dispose());meshes.clear();}
if(import.meta.hot)import.meta.hot.dispose(()=>{stopWorker();renderer?.dispose();disposeMeshes();material.dispose();shadowMaterial.dispose();});
