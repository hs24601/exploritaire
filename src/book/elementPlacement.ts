import * as THREE from 'three';
import type {FrameRect} from './responsiveFraming';

type Kind='text'|'prop'|'paint-region';
/** Find the nearest usable page point to the unobstructed view center. New
 * controls shrink only when needed to fit; camera posture is never changed. */
export function viewportElementPlacement(camera:THREE.PerspectiveCamera,viewport:{width:number;height:number},safe:FrameRect,page:number,kind:Kind,width:number,height:number){
 if(viewport.width<=0||viewport.height<=0||safe.width<=24||safe.height<=24)return;
 camera.updateMatrixWorld();
 const bounds={left:page===0?.18:-5.67,right:5.67,near:-3.57,far:3.57},baseY=page===0?.215:kind==='text'?.154:.15;
 const area={x:safe.x+8,y:safe.y+8,width:safe.width-16,height:safe.height-16};
 const offsets=[0,-.15,.15,-.3,.3,-.43,.43];
 const samples=offsets.flatMap(y=>offsets.map(x=>({x,y}))).sort((a,b)=>a.x*a.x+a.y*a.y-b.x*b.x-b.y*b.y);
 const ray=new THREE.Raycaster(),point=new THREE.Vector3(),plane=new THREE.Plane(new THREE.Vector3(0,1,0),-baseY);
 const visible=(p:THREE.Vector3)=>{const q=p.clone().project(camera),x=(q.x*.5+.5)*viewport.width,y=(-q.y*.5+.5)*viewport.height;return q.z>=-1&&q.z<=1&&x>=area.x-.001&&x<=area.x+area.width+.001&&y>=area.y-.001&&y<=area.y+area.height+.001;};
 const minimumScale=Math.max((kind==='text'?.5:.1)/width,(kind==='text'?.25:.1)/height);let previousScale=0;
 for(let attempt=0;attempt<20;attempt++){
  const scale=Math.max(minimumScale,.8**attempt),w=width*scale,h=height*scale;
  if(scale>1||scale===previousScale)break;previousScale=scale;
  plane.constant=-(baseY+(kind==='prop'?h/2:0));
  for(const sample of samples){
   const x=area.x+area.width*(.5+sample.x),y=area.y+area.height*(.5+sample.y);
   ray.setFromCamera(new THREE.Vector2(x/viewport.width*2-1,1-y/viewport.height*2),camera);
   if(!ray.ray.intersectPlane(plane,point))continue;
   const halfDepth=kind==='prop'?h*.17:h/2;
   const px=THREE.MathUtils.clamp(point.x,bounds.left+w/2,bounds.right-w/2),pz=THREE.MathUtils.clamp(point.z,bounds.near+halfDepth,bounds.far-halfDepth);
   const corners=kind==='prop'?[-w/2,w/2].flatMap(dx=>[0,h].flatMap(dy=>[-halfDepth,halfDepth].map(dz=>[dx,dy,dz]))):[-w/2,w/2].flatMap(dx=>[-h/2,h/2].flatMap(dz=>(kind==='paint-region'?[0,.02]:[0]).map(dy=>[dx,dy,dz])));
   if(corners.every(([dx,dy,dz])=>visible(new THREE.Vector3(px+dx,baseY+dy,pz+dz))))return {x:px,z:pz,width:w,height:h,scale};
  }
 }
}
