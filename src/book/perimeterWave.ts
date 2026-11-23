import * as THREE from 'three';
export type WaveTarget={id:string;point:THREE.Vector3;height:number;requireView?:boolean;set:(value:number)=>void};
export type ForestRevealSite={x:number;z:number;open:number};
/** Motes and their real/fog lamps belong to the nearest paper grove. */
export function popupLightAt(sites:ForestRevealSite[],x:number,z:number){
 let nearest:ForestRevealSite|undefined,distance=Infinity;
 for(const site of sites){const d=Math.hypot(site.x-x,site.z-z);if(d<distance){distance=d;nearest=site;}}
 return nearest?THREE.MathUtils.smoothstep(nearest.open,.15,.85)*(1-THREE.MathUtils.smoothstep(distance,1.3,2.8)):0;
}
/** Discover a grove by flying near it. Viewport gating keeps each rise on screen. */
export class PerimeterWave{
 private starts=new Map<string,number>();private next=0;private last=-1;
 reset(){this.starts.clear();this.next=0;this.last=-1;}
 update(time:number,camera:THREE.PerspectiveCamera,targets:WaveTarget[]){
  if(time<this.last)this.reset();this.last=time;camera.updateMatrixWorld();
  const visible:{target:WaveTarget;distance:number}[]=[],point=new THREE.Vector3(),right=new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld,0).normalize();
  if(time>=2)for(const target of targets){
   if(this.starts.has(target.id))continue;
   const distance=Math.hypot(target.point.x-camera.position.x,target.point.z-camera.position.z);
   if(distance>4.6)continue;
   // A close trunk or crown can fill the viewport while its center is offscreen.
   let inView=false;for(const fraction of [.15,.52,.85])for(const edge of [-.35,0,.35]){point.copy(target.point).addScaledVector(right,target.height*edge);point.y+=target.height*fraction;point.project(camera);if(point.z>-1&&point.z<1&&Math.abs(point.x)<.94&&Math.abs(point.y)<.94){inView=true;break;}}
   if(inView||target.requireView===false)visible.push({target,distance});
  }
  visible.sort((a,b)=>a.distance-b.distance||a.target.id.localeCompare(b.target.id));
  for(const {target}of visible){const start=Math.max(time,this.next);if(start>time+.2)break;this.starts.set(target.id,start);this.next=start+.09;}
  let complete=0,rising=0;
  for(const target of targets){const start=this.starts.get(target.id),n=start===undefined?0:THREE.MathUtils.smoothstep(time,start,start+1.15);target.set(n);if(n===1)complete++;else if(n>0)rising++;}
  return {total:targets.length,started:this.starts.size,complete,rising,pending:targets.filter(t=>!this.starts.has(t.id)).map(t=>t.id)};
 }
}
