import * as THREE from 'three';
import {sampleFlight,type FlightKey} from './castleLayout';

/** Precompute a terrain/solid-aware route once. Playback never pushes the
 * camera out of geometry after rendering, and never re-smooths a cleared path
 * with an unchecked Catmull spline that can cut across its corners. */
export function createClearArrivalFlight(path:readonly FlightKey[],height:(x:number,z:number)=>number,solids:readonly THREE.Box3[],options:{aspect?:number;nearPlane?:number}={}){
  const start=new THREE.Vector3(...path[0].position),end=new THREE.Vector3(...path[path.length-1].position);
  // Cover the whole near-plane footprint at the widest flight lens, not just
  // a center ray. Default to the grove's two-metre cap; smaller scene lenses
  // may provide their actual maximum to avoid inventing oversized obstacles.
  const tangent=Math.tan(THREE.MathUtils.degToRad(Math.max(...path.map(k=>k.fov))/2));
  const radius=(options.nearPlane??2)*Math.sqrt(1+tangent*tangent*(1+(options.aspect??16/9)**2))+.25;
  const boxes=solids.map(b=>b.clone().expandByScalar(radius)),bins=new Map<string,number[]>(),binSize=16;
  boxes.forEach((b,id)=>{for(let x=Math.floor(b.min.x/binSize);x<=Math.floor(b.max.x/binSize);x++)for(let z=Math.floor(b.min.z/binSize);z<=Math.floor(b.max.z/binSize);z++){
    const key=`${x},${z}`,bucket=bins.get(key)??[];bucket.push(id);bins.set(key,bucket);
  }});
  const seen=new Int32Array(boxes.length);let stamp=0;
  function intersects(a:THREE.Vector3,b:THREE.Vector3,box:THREE.Box3){
    let lo=0,hi=1;
    for(const axis of ['x','y','z'] as const){
      const d=b[axis]-a[axis];
      if(Math.abs(d)<1e-10){if(a[axis]<box.min[axis]||a[axis]>box.max[axis])return false;}
      else{const t1=(box.min[axis]-a[axis])/d,t2=(box.max[axis]-a[axis])/d;lo=Math.max(lo,Math.min(t1,t2));hi=Math.min(hi,Math.max(t1,t2));if(lo>hi)return false;}
    }return true;
  }
  const corners=[[-1,-1],[-1,1],[1,-1],[1,1]];
  function floor(x:number,z:number){
    const d=Math.hypot(x-end.x,z-end.z),lift=Math.min(radius+.75,.45+d*.4),probe=Math.min(radius,.20+d*.12);
    let floor=height(x,z)+lift;
    for(const [dx,dz]of corners)floor=Math.max(floor,height(x+dx*probe,z+dz*probe)+lift-.2);
    return floor;
  }
  function clear(a:THREE.Vector3,b:THREE.Vector3){
    stamp++;
    for(let x=Math.floor(Math.min(a.x,b.x)/binSize);x<=Math.floor(Math.max(a.x,b.x)/binSize);x++)for(let z=Math.floor(Math.min(a.z,b.z)/binSize);z<=Math.floor(Math.max(a.z,b.z)/binSize);z++)for(const id of bins.get(`${x},${z}`)??[]){
      if(seen[id]===stamp)continue;seen[id]=stamp;if(intersects(a,b,boxes[id]))return false;
    }
    const steps=Math.max(1,Math.ceil(a.distanceTo(b)/.75));
    for(let i=0;i<=steps;i++){const t=i/steps,x=THREE.MathUtils.lerp(a.x,b.x,t),z=THREE.MathUtils.lerp(a.z,b.z,t),y=THREE.MathUtils.lerp(a.y,b.y,t);if(y<floor(x,z)-1e-7)return false;}
    return true;
  }
  start.y=Math.max(start.y,floor(start.x,start.z));
  // If the authored entry is inside a crown, enter above that crown rather
  // than starting with an invisible/embedded camera.
  for(let pass=0;pass<boxes.length+1;pass++){
    const blocked=boxes.find(b=>b.containsPoint(start));if(!blocked)break;start.y=blocked.max.y+2;
  }
  if(!clear(end,end))throw new Error('Arrival endpoint is obstructed; fix the shared follow pose before planning the flight.');
  let route=[start,end];
  if(!clear(start,end)){
    // Reach a clear point above the final shoulder pose before settling onto
    // it. A coarse grid cannot connect reliably to a point exactly on the
    // minimum-clearance surface beside a rising bank.
    const approach=end.clone();approach.y+=3;
    if(!clear(approach,end))throw new Error('The final arrival descent is obstructed.');
    const step=3,minX=Math.min(start.x,end.x)-42,minZ=Math.min(start.z,end.z)-42;
    const cols=Math.ceil((Math.abs(start.x-end.x)+84)/step)+1,rows=Math.ceil((Math.abs(start.z-end.z)+84)/step)+1,count=cols*rows;
    const direction=end.clone().sub(start);direction.y=0;const length2=direction.lengthSq();
    const points=Array.from({length:count},(_,id)=>{
      const x=minX+(id%cols)*step,z=minZ+Math.floor(id/cols)*step,progress=THREE.MathUtils.clamp(((x-start.x)*direction.x+(z-start.z)*direction.z)/Math.max(.001,length2),0,1);
      // Hold the entry altitude until clear of the starting crown; immediately
      // descending from its top can trap the first grid edge inside the crown.
      const t=THREE.MathUtils.smoothstep(progress,.16,1);
      return new THREE.Vector3(x,Math.max(floor(x,z),THREE.MathUtils.lerp(start.y,end.y,t)),z);
    });
    const index=(p:THREE.Vector3)=>Math.round((p.z-minZ)/step)*cols+Math.round((p.x-minX)/step),first=index(start),last=index(approach);
    points[first]=start;points[last]=approach;
    const cost=new Float64Array(count).fill(Infinity),parent=new Int32Array(count).fill(-1),closed=new Uint8Array(count);
    const heap:{id:number;score:number}[]=[];
    function push(id:number,score:number){let i=heap.length;heap.push({id,score});while(i>0){const p=(i-1)>>1;if(heap[p].score<=score)break;heap[i]=heap[p];i=p;}heap[i]={id,score};}
    function pop(){const best=heap[0],tail=heap.pop()!;if(heap.length){let i=0;while(i*2+1<heap.length){let child=i*2+1;if(child+1<heap.length&&heap[child+1].score<heap[child].score)child++;if(heap[child].score>=tail.score)break;heap[i]=heap[child];i=child;}heap[i]=tail;}return best.id;}
    function search(){
      cost.fill(Infinity);parent.fill(-1);closed.fill(0);heap.length=0;
      cost[first]=0;push(first,start.distanceTo(approach));
      while(heap.length){
        const id=pop();if(closed[id])continue;closed[id]=1;if(id===last)break;
        const x=id%cols,z=Math.floor(id/cols);
        for(let dz=-1;dz<=1;dz++)for(let dx=-1;dx<=1;dx++){
          if(!dx&&!dz||x+dx<0||x+dx>=cols||z+dz<0||z+dz>=rows)continue;
          const next=id+dz*cols+dx;if(closed[next])continue;
          const candidate=cost[id]+points[id].distanceTo(points[next]);if(candidate>=cost[next]||!clear(points[id],points[next]))continue;
          cost[next]=candidate;parent[next]=id;push(next,candidate+points[next].distanceTo(approach));
        }
      }
      return Boolean(closed[last]);
    }
    if(!search()){
      // Dense overlapping crowns can close every horizontal gap. Add a gradual
      // over-crown option, with climbing room before each solid footprint,
      // then search again. Prefer the original around-object route when clear.
      for(let id=0;id<points.length;id++)if(id!==first&&id!==last){
        const p=points[id];
        for(let pass=0;pass<2;pass++){
          stamp++;
          for(let x=Math.floor((p.x-14)/binSize);x<=Math.floor((p.x+14)/binSize);x++)for(let z=Math.floor((p.z-14)/binSize);z<=Math.floor((p.z+14)/binSize);z++)for(const index of bins.get(`${x},${z}`)??[]){
            if(seen[index]===stamp)continue;seen[index]=stamp;const b=boxes[index];
            const distance=Math.hypot(Math.max(b.min.x-p.x,0,p.x-b.max.x),Math.max(b.min.z-p.z,0,p.z-b.max.z));
            if(distance<14&&p.y>=b.min.y&&p.y<=b.max.y+2)p.y=Math.max(p.y,b.max.y+1-distance*.8);
          }
        }
      }
      search();
    }
    if(!closed[last])throw new Error(`No clear arrival route to the follow pose (${closed.reduce((a,b)=>a+b,0)} nodes explored; entry ${start.toArray()}; landing ${end.toArray()}).`);
    route=[];for(let id=last;id!==-1;id=parent[id])route.push(points[id]);route.reverse();
    route.push(end);
    // Remove grid zigzags only when the complete shortcut is clear.
    const shortcuts=[route[0]];
    for(let i=0;i<route.length-1;){let next=route.length-1;while(next>i+1&&!clear(route[i],route[next]))next--;shortcuts.push(route[next]);i=next;}
    route=shortcuts;
  }
  // Round each corner within its verified free volume. If rounding would
  // intersect anything, retain that safe corner rather than clipping it.
  const rounded=[route[0]];
  for(let i=1;i<route.length-1;i++){
    const before=route[i].clone().lerp(route[i-1],.25),after=route[i].clone().lerp(route[i+1],.25),curve=new THREE.QuadraticBezierCurve3(before,route[i],after);
    const samples=curve.getPoints(Math.max(8,Math.ceil(curve.getLength()/.5)));
    if(clear(rounded[rounded.length-1],before)&&samples.every((p,k)=>!k||clear(samples[k-1],p)))rounded.push(...samples);
    else rounded.push(route[i]);
  }
  rounded.push(end);
  const lengths=[0];for(let i=1;i<rounded.length;i++)lengths.push(lengths[i-1]+rounded[i-1].distanceTo(rounded[i]));
  const duration=path[path.length-1].t,total=lengths[lengths.length-1];
  return {route:rounded,clear,diagnostics:{points:rounded.length,solids:solids.length,length:total,nearPlaneRadius:radius},sample(seconds:number){
    const shot=sampleFlight(seconds,path),u=THREE.MathUtils.clamp(seconds/duration,0,1),distance=(u*u*(3-2*u))*total;
    let i=1;while(i<lengths.length-1&&lengths[i]<distance)i++;
    const t=(distance-lengths[i-1])/Math.max(1e-9,lengths[i]-lengths[i-1]);
    shot.position=rounded[i-1].clone().lerp(rounded[i],t).toArray();return shot;
  }};
}
