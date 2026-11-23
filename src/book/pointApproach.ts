import * as THREE from 'three';
import {CASTLE} from './castleLayout';
export type ApproachPoint={x:number;y:number;z:number};
export type ApproachTarget={x:number;z:number;radius?:number;label?:string};
export type ApproachCandidate=ApproachPoint&{score:number};

/** Shared world-object convention, including per-instance tree/lantern anchors. */
export function pointApproachTarget(hit:THREE.Intersection):ApproachTarget|undefined{
  const data=hit.object.userData,instances=data.pointApproachInstances as ApproachTarget[]|undefined;
  if(instances){
    if(hit.instanceId!==undefined)return instances[hit.instanceId];
    return instances.reduce<ApproachTarget|undefined>((best,p)=>!best||Math.hypot(p.x-hit.point.x,p.z-hit.point.z)<Math.hypot(best.x-hit.point.x,best.z-hit.point.z)?p:best,undefined);
  }
  return data.pointApproach as ApproachTarget|undefined;
}

/** Sample actual supported layers around the clicked surface/anchor. Rank by
 * closeness first, preferring Hero's current elevation and side of an object. */
export function approachCandidates(hero:ApproachPoint,target:ApproachTarget,sample:(x:number,z:number)=>ApproachPoint[],maxReach=8){
  const candidates:ApproachCandidate[]=[],seen=new Set<string>(),start=Math.atan2(hero.z-target.z,hero.x-target.x),base=target.radius??0;
  const invalid:(number|undefined)[]=Array(16).fill(undefined);
  for(const reach of [CASTLE.heroRadius+.06,.72,1,1.5,2.3,3.5,5.3,8,12,20,32]){
    if(reach>maxReach)break;
    for(let i=0;i<16;i++){
      const angle=start+i*Math.PI/8,r=base+reach,x=target.x+Math.cos(angle)*r,z=target.z+Math.sin(angle)*r;
      let points=sample(x,z);
      if(points.length&&invalid[i]!==undefined){
        let low=invalid[i]!,high=reach,edge=points;
        for(let refine=0;refine<6;refine++){const mid=(low+high)/2,candidate=sample(target.x+Math.cos(angle)*(base+mid),target.z+Math.sin(angle)*(base+mid));if(candidate.length){high=mid;edge=candidate;}else low=mid;}
        points=[...edge,...points];invalid[i]=undefined;
      }else if(!points.length)invalid[i]=reach;
      for(const point of points){
        const key=`${point.x.toFixed(3)},${point.y.toFixed(3)},${point.z.toFixed(3)}`;if(seen.has(key))continue;seen.add(key);
        const score=Math.hypot(point.x-target.x,point.z-target.z)+Math.abs(point.y-hero.y)*(target.radius===undefined?4:.05)+Math.hypot(point.x-hero.x,point.z-hero.z)*.0002;
        candidates.push({...point,score});
      }
    }
  }
  return candidates.sort((a,b)=>a.score-b.score);
}

/** Ignore hidden objects and transparent texels instead of treating a whole
 * tree billboard as a solid rectangle that steals clicks from the ground. */
const masks=new WeakMap<THREE.Texture,{width:number;height:number;data:Uint8ClampedArray}|null>();
export function visiblePointHit(hit:THREE.Intersection){
  for(let object:THREE.Object3D|null=hit.object;object;object=object.parent)if(!object.visible)return false;
  if(!(hit.object instanceof THREE.Mesh))return false;
  const material=(Array.isArray(hit.object.material)?hit.object.material[hit.face?.materialIndex??0]:hit.object.material) as THREE.MeshBasicMaterial;
  if(!material?.visible)return false;
  const clips=material.clippingPlanes;
  if(clips?.length&&(material.clipIntersection?clips.every(plane=>plane.distanceToPoint(hit.point)<0):clips.some(plane=>plane.distanceToPoint(hit.point)<0)))return false;
  if(!material.map||!material.alphaTest||!hit.uv)return true;
  let mask=masks.get(material.map);
  if(mask===undefined){
    try{
      const image=material.map.image,canvas=document.createElement('canvas');canvas.width=256;canvas.height=256;const context=canvas.getContext('2d',{willReadFrequently:true})!;context.drawImage(image,0,0,256,256);mask={width:256,height:256,data:context.getImageData(0,0,256,256).data};
    }catch{mask=null;}
    masks.set(material.map,mask);
  }
  if(!mask)return true;
  const uv=material.map.transformUv(hit.uv.clone()),x=THREE.MathUtils.clamp(Math.floor(uv.x*mask.width),0,mask.width-1),y=THREE.MathUtils.clamp(Math.floor(uv.y*mask.height),0,mask.height-1);
  return mask.data[(y*mask.width+x)*4+3]/255>=material.alphaTest;
}
