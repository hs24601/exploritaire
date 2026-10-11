import * as THREE from 'three';
import { shadeVolumeFace, propVolumeView, VOLUME_RASTER_HEIGHT, VOLUME_RASTER_WIDTH, VOLUME_VIEW, type PropVolume, type VolumeLight } from './propVolume';

/** One offscreen renderer for every prop, never one WebGL context per tree.
 * Its small depth-tested views are copied into the shared bounded canvas cache.
 * The pure CPU rasterizer remains available on WebGL failure/context loss. */
let renderer:THREE.WebGLRenderer|undefined, unavailable=false;
let transfer:CanvasRenderingContext2D|null=null;
const scene=new THREE.Scene(),material=new THREE.MeshBasicMaterial({vertexColors:true,toneMapped:false});
const camera=new THREE.OrthographicCamera(VOLUME_VIEW.left,VOLUME_VIEW.left+VOLUME_VIEW.width,-VOLUME_VIEW.top,-VOLUME_VIEW.top-VOLUME_VIEW.height,.1,10);
const meshes=new Map<PropVolume,{geometry:THREE.BufferGeometry;variants:Map<string,THREE.Mesh>}>();
export type VolumeRenderRequest={target:CanvasRenderingContext2D;volume:PropVolume;yaw:number;elevation:number;light:VolumeLight;monochrome:boolean};
/** Render the frame's misses into one atlas before reading any GPU pixels.
 * Interleaving render/drawImage for each prop forced a GPU wait for each view. */
export function renderVolumeGPUViews(requests:readonly VolumeRenderRequest[]) {
  if(unavailable||new URLSearchParams(location.search).get('propRenderer')==='canvas')return false;
  try {
    if(!renderer){
      renderer=new THREE.WebGLRenderer({alpha:true,antialias:false,preserveDrawingBuffer:true});
      renderer.setSize(VOLUME_RASTER_WIDTH*4,VOLUME_RASTER_HEIGHT*4,false);renderer.setClearColor(0,0);
      renderer.autoClear=false;renderer.setScissorTest(true);
      const canvas=document.createElement('canvas');canvas.width=VOLUME_RASTER_WIDTH*4;canvas.height=VOLUME_RASTER_HEIGHT*4;
      transfer=canvas.getContext('2d',{willReadFrequently:true});
    }
    if(!transfer||renderer.getContext().isContextLost())return false;
    for(let start=0;start<requests.length;start+=16){
      const batch=requests.slice(start,start+16);
      batch.forEach(({volume,yaw,elevation,light,monochrome},index)=>{
    let entry=meshes.get(volume);
    if(!entry){
      const geometry=new THREE.BufferGeometry(),positions=new Float32Array(volume.faces.length*18);
      volume.faces.forEach((face,index)=>[0,1,2,0,2,3].forEach((corner,i)=>positions.set(face.vertices[corner],index*18+i*3)));
      geometry.setAttribute('position',new THREE.BufferAttribute(positions,3));
      entry={geometry,variants:new Map()};meshes.set(volume,entry);
    }
    const key=JSON.stringify(light)+monochrome;
    let mesh=entry.variants.get(key);
    if(!mesh){
      const colors=new Float32Array(volume.faces.length*18);
      const palette=new Map<string,THREE.Color>();
      volume.faces.forEach((face,index)=>{
        const key=face.color.join(',')+'/'+face.normal.join(',');let color=palette.get(key);
        if(!color){const values=shadeVolumeFace(face,light,monochrome);color=new THREE.Color().setRGB(values[0]/255,values[1]/255,values[2]/255,THREE.SRGBColorSpace);palette.set(key,color);}
        for(let corner=0;corner<6;corner++){const offset=index*18+corner*3;colors[offset]=color.r;colors[offset+1]=color.g;colors[offset+2]=color.b;}
      });
      // Instances share positions but keep their lighting colours. Alternating
      // local lights on the same mountain used to rebuild/upload every vertex
      // colour on every orbit frame, although no world light had changed.
      const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',entry.geometry.getAttribute('position'));
      geometry.setAttribute('color',new THREE.BufferAttribute(colors,3));mesh=new THREE.Mesh(geometry,material);
      entry.variants.set(key,mesh);
      while(entry.variants.size>24){const oldest=entry.variants.keys().next().value!;entry.variants.get(oldest)!.geometry.dispose();entry.variants.delete(oldest);}
    }else{
      entry.variants.delete(key);entry.variants.set(key,mesh);
    }
    const a=yaw*Math.PI/180,e=elevation*Math.PI/180;
    const bounds=propVolumeView(volume);
    camera.left=bounds.left;camera.right=bounds.left+bounds.width;camera.top=-bounds.top;camera.bottom=-bounds.top-bounds.height;camera.updateProjectionMatrix();
    camera.position.set(Math.sin(a)*Math.cos(e)*4,Math.sin(e)*4,Math.cos(a)*Math.cos(e)*4);camera.lookAt(0,0,0);
    const x=index%4*VOLUME_RASTER_WIDTH,y=(3-Math.floor(index/4))*VOLUME_RASTER_HEIGHT;
    renderer!.setViewport(x,y,VOLUME_RASTER_WIDTH,VOLUME_RASTER_HEIGHT);renderer!.setScissor(x,y,VOLUME_RASTER_WIDTH,VOLUME_RASTER_HEIGHT);
    renderer!.clear();scene.clear();scene.add(mesh);renderer!.render(scene,camera);
      });
      const width=Math.min(4,batch.length)*VOLUME_RASTER_WIDTH,height=Math.ceil(batch.length/4)*VOLUME_RASTER_HEIGHT;
      transfer.clearRect(0,0,width,height);transfer.drawImage(renderer.domElement,0,0,width,height,0,0,width,height);
      batch.forEach(({target},index)=>{target.clearRect(0,0,VOLUME_RASTER_WIDTH,VOLUME_RASTER_HEIGHT);target.drawImage(transfer!.canvas,index%4*VOLUME_RASTER_WIDTH,Math.floor(index/4)*VOLUME_RASTER_HEIGHT,VOLUME_RASTER_WIDTH,VOLUME_RASTER_HEIGHT,0,0,VOLUME_RASTER_WIDTH,VOLUME_RASTER_HEIGHT);});
    }
    return true;
  }catch{
    unavailable=true;renderer?.dispose();renderer=undefined;transfer=null;
    disposeMeshes();return false;
  }
}
function disposeMeshes(){meshes.forEach(entry=>{entry.variants.forEach(mesh=>mesh.geometry.dispose());entry.geometry.dispose();});meshes.clear();}
if(import.meta.hot)import.meta.hot.dispose(()=>{renderer?.dispose();disposeMeshes();material.dispose();});
