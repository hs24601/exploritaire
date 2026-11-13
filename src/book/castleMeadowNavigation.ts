import * as THREE from 'three';
import {CASTLE,resolveMove} from './castleLayout';
import {PLATFORM_MOTION,type CastlePlatformMotion,type PlatformSurface} from './castlePlatformMotion';
import {approachCandidates,type ApproachTarget} from './pointApproach';

export type MeadowPoint={x:number;y:number;z:number};
export type MeadowTravelIntent={x:number;z:number;run:boolean;jump:boolean;jumpTier?:1|2|3;jumpLanding?:MeadowPoint};
type Bounds={minX:number;maxX:number;minZ:number;maxZ:number;minY:number;cellSize?:number};
type Triangle={shape:THREE.Triangle;up:boolean;minY:number;maxY:number};
type Waypoint=MeadowPoint&{jumpTier?:1|2|3};
const spacing=.6,indexSize=1.2,radius=CASTLE.heroRadius;
const footingOffsets=[[-1,0],[1,0],[0,-1],[0,1],[-Math.SQRT1_2,-Math.SQRT1_2],[-Math.SQRT1_2,Math.SQRT1_2],[Math.SQRT1_2,-Math.SQRT1_2],[Math.SQRT1_2,Math.SQRT1_2]];
const gap=(a:MeadowPoint,b:MeadowPoint)=>Math.hypot(a.x-b.x,a.z-b.z);
const distance=(a:MeadowPoint,b:MeadowPoint)=>Math.hypot(a.x-b.x,a.y-b.y,a.z-b.z);
const key=(x:number,z:number,size=indexSize)=>`${Math.floor(x/size)},${Math.floor(z/size)}`;

/** Static world-triangle index. Queries retain overlapping floors separately,
 * rather than treating the highest triangle at XZ as every actor's floor. */
export function createMeadowTerrain(meshes:THREE.Mesh[],bounds:Bounds){
  const indexSize=bounds.cellSize??1.2;
  const key=(x:number,z:number)=>`${Math.floor(x/indexSize)},${Math.floor(z/indexSize)}`;
  let routeObstacle:(x:number,z:number,r:number,y:number)=>boolean=()=>false;
  const triangles:Triangle[]=[],cells=new Map<string,number[]>();
  const a=new THREE.Vector3(),b=new THREE.Vector3(),c=new THREE.Vector3(),normal=new THREE.Vector3();
  for(const mesh of meshes){
    const p=mesh.geometry.attributes.position,index=mesh.geometry.index;
    for(let i=0;i<(index?.count??p.count);i+=3){
      a.fromBufferAttribute(p,index?index.getX(i):i).applyMatrix4(mesh.matrixWorld);
      b.fromBufferAttribute(p,index?index.getX(i+1):i+1).applyMatrix4(mesh.matrixWorld);
      c.fromBufferAttribute(p,index?index.getX(i+2):i+2).applyMatrix4(mesh.matrixWorld);
      const minX=Math.max(bounds.minX-1,Math.min(a.x,b.x,c.x)),maxX=Math.min(bounds.maxX+1,Math.max(a.x,b.x,c.x));
      const minZ=Math.max(bounds.minZ-1,Math.min(a.z,b.z,c.z)),maxZ=Math.min(bounds.maxZ+1,Math.max(a.z,b.z,c.z));
      if(minX>maxX||minZ>maxZ)continue;
      const shape=new THREE.Triangle(a.clone(),b.clone(),c.clone());shape.getNormal(normal);
      if(normal.lengthSq()<.5)continue;
      const id=triangles.length;
      triangles.push({shape,up:normal.y>.62,minY:Math.min(a.y,b.y,c.y),maxY:Math.max(a.y,b.y,c.y)});
      for(let x=Math.floor(minX/indexSize);x<=Math.floor(maxX/indexSize);x++)for(let z=Math.floor(minZ/indexSize);z<=Math.floor(maxZ/indexSize);z++){
        const k=`${x},${z}`,list=cells.get(k);if(list)list.push(id);else cells.set(k,[id]);
      }
    }
  }
  const probe=new THREE.Vector3(),closest=new THREE.Vector3(),seen=new Uint32Array(triangles.length);
  let stamp=0;
  const inBounds=(x:number,z:number,r=0)=>x>=bounds.minX+r&&x<=bounds.maxX-r&&z>=bounds.minZ+r&&z<=bounds.maxZ-r;
  function layers(x:number,z:number){
    const result:number[]=[];
    for(const id of cells.get(key(x,z))??[]){
      const t=triangles[id];if(!t.up)continue;
      const {a,b,c}=t.shape,dx=b.x-a.x,dz=b.z-a.z,ex=c.x-a.x,ez=c.z-a.z;
      const determinant=dx*ez-ex*dz;if(Math.abs(determinant)<1e-8)continue;
      const u=((x-a.x)*ez-(z-a.z)*ex)/determinant,v=(dx*(z-a.z)-dz*(x-a.x))/determinant;
      if(u<-.00001||v<-.00001||u+v>1.00001)continue;
      const y=a.y+u*(b.y-a.y)+v*(c.y-a.y);
      if(y>bounds.minY&&!result.some(old=>Math.abs(old-y)<.05))result.push(y);
    }
    return result.sort((a,b)=>b-a);
  }
  function height(x:number,z:number,reference=Infinity){return layers(x,z).find(y=>y<=reference+.27);}
  function bodyClear(x:number,y:number,z:number,extra=0){
    if(!inBounds(x,z,radius))return false;
    if(routeObstacle(x,z,radius+extra,y))return false;
    const r=radius+extra;stamp++;
    for(let ix=Math.floor((x-r)/indexSize);ix<=Math.floor((x+r)/indexSize);ix++)for(let iz=Math.floor((z-r)/indexSize);iz<=Math.floor((z+r)/indexSize);iz++){
      for(const id of cells.get(`${ix},${iz}`)??[]){
        if(seen[id]===stamp)continue;seen[id]=stamp;
        const t=triangles[id];if(t.maxY<y+.015||t.minY>y+.83+r)continue;
        // A capsule resting on a sloped floor intersects its supporting plane
        // below the feet sphere, including the level landing at a ramp crest.
        // Use the same .55 m footprint grade allowance as dry(); vertical walls
        // and undersides still collide, and canWalk retains its .27 m step limit.
        if(t.up){t.shape.getNormal(normal);const a=t.shape.a,support=a.y-(normal.x*(x-a.x)+normal.z*(z-a.z))/normal.y;if(Math.abs(support-y)<.55)continue;}
        for(const h of [r+.025,.83+extra]){
          probe.set(x,y+h,z);t.shape.closestPointToPoint(probe,closest);
          if(closest.distanceToSquared(probe)<(r-.006)**2)return false;
        }
      }
    }
    return true;
  }
  function dry(x:number,z:number,r:number=radius,reference=Infinity){
    if(!inBounds(x,z,r))return false;
    const y=height(x,z,reference);if(y===undefined||!bodyClear(x,y,z))return false;
    return footingOffsets.every(([dx,dz])=>{
      const edge=height(x+dx*r,z+dz*r,y+.28);return edge!==undefined&&Math.abs(edge-y)<.55;
    });
  }
  function canWalk(from:MeadowPoint,to:MeadowPoint){
    const steps=Math.max(1,Math.ceil(gap(from,to)/.18));let previous=from.y;
    for(let i=0;i<=steps;i++){
      const t=i/steps,x=THREE.MathUtils.lerp(from.x,to.x,t),z=THREE.MathUtils.lerp(from.z,to.z,t);
      const y=height(x,z,previous);
      if(y===undefined||Math.abs(y-previous)>.27||!dry(x,z,radius,y))return false;
      previous=y;
    }
    return Math.abs(previous-to.y)<.25;
  }
  function jump(from:MeadowPoint,to:MeadowPoint):1|2|3|undefined{
    const rise=to.y-from.y,run=gap(from,to);
    if(run<.3||run>4.2||rise>6.05||rise< -6.24)return;
    const tier=rise<.92?1:rise<2.55?2:3;
    const velocity=PLATFORM_MOTION.jump[tier-1],discriminant=velocity*velocity-2*PLATFORM_MOTION.gravity*rise;
    if(discriminant<=0)return;
    const duration=(velocity+Math.sqrt(discriminant))/PLATFORM_MOTION.gravity;
    if(run/duration>PLATFORM_MOTION.run*.92)return;
    const steps=Math.max(16,Math.ceil(duration*120));
    let previousY=from.y;
    for(let i=1;i<steps;i++){
      const t=i/steps,seconds=t*duration;
      const x=THREE.MathUtils.lerp(from.x,to.x,t),z=THREE.MathUtils.lerp(from.z,to.z,t);
      const y=from.y+velocity*seconds-PLATFORM_MOTION.gravity*seconds*seconds/2;
      if(!bodyClear(x,y,z,.025))return;
      // A downward arc can otherwise land back on its launch platform (or an
      // intermediate shelf) before it reaches the intended lower destination.
      const support=height(x,z,previousY);
      if(seconds>velocity/PLATFORM_MOTION.gravity&&support!==undefined&&y<=support&&support>to.y+.15)return;
      previousY=y;
    }
    return tier;
  }
  return {triangles,layers,height,dry,bodyClear,canWalk,jump,inBounds,bounds,setRouteObstacle(test:typeof routeObstacle){routeObstacle=test;}};
}

export function createMeadowSurface(terrain:ReturnType<typeof createMeadowTerrain>,baseHeight=(x:number,z:number)=>terrain.height(x,z)):PlatformSurface{
  const height=(x:number,z:number,referenceY?:number)=>terrain.height(x,z,referenceY??baseHeight(x,z)??Infinity)??-.8;
  return {
    height,
    move(x,z,dx,dz,y,grounded){
      const steps=Math.max(1,Math.ceil(Math.hypot(dx,dz)/.12));
      for(let i=0;i<steps;i++){
        const current=height(x,z,y);
        ({x,z}=resolveMove(x,z,dx/steps,dz/steps,(tx,tz)=>{
          if(!grounded)return terrain.bodyClear(tx,y,tz);
          const next=terrain.height(tx,tz,y);
          return next!==undefined&&Math.abs(next-current)<=.27&&terrain.dry(tx,tz,radius,next);
        }));
      }
      return {x,z};
    },
    wall:(x,z,y)=>!terrain.bodyClear(x,y??height(x,z),z),
  };
}

class Frontier{
  private items:{id:number;score:number}[]=[];
  push(id:number,score:number){const h=this.items;let i=h.length;while(i){const p=(i-1)>>1;if(h[p].score<=score)break;h[i]=h[p];i=p;}h[i]={id,score};}
  pop(){const h=this.items,root=h[0],last=h.pop();if(last&&h.length){let i=0;while(i*2+1<h.length){let j=i*2+1;if(j+1<h.length&&h[j+1].score<h[j].score)j++;if(h[j].score>=last.score)break;h[i]=h[j];i=j;}h[i]=last;}return root;}
}

export function createMeadowNavigation(terrain:ReturnType<typeof createMeadowTerrain>,options:{spacing?:number;triangleCenters?:boolean}={}){
  const spacing=options.spacing??.6,walkReach=Math.max(1.05,spacing*1.5),connectReach=Math.max(1.6,spacing*1.6);
  const nodes:MeadowPoint[]=[],byCell=new Map<string,number[]>(),edges=new Map<string,0|1|2|3|4>();
  const ledges=new Map<number,boolean>();
  let built=false,route:Waypoint[]=[],target:MeadowPoint|undefined,lastClick:MeadowPoint|undefined;
  let result='idle',stalled=0,best=Infinity,airborne=false;
  function add(x:number,z:number,y:number){
    if(!terrain.dry(x,z,radius,y))return;
    const k=key(x,z,spacing),ids=byCell.get(k)??[];
    if(ids.some(i=>distance(nodes[i],{x,y,z})<.20))return;
    const id=nodes.length;nodes.push({x,y,z});ids.push(id);byCell.set(k,ids);
  }
  function build(){
    if(built)return;built=true;
    const b=terrain.bounds;
    for(let x=b.minX+radius;x<b.maxX-radius;x+=spacing)for(let z=b.minZ+radius;z<b.maxZ-radius;z+=spacing){
      for(const y of terrain.layers(x,z))add(x,z,y);
    }
    // Triangle bounds add centers of narrow architectural tops the grid may miss.
    for(const t of terrain.triangles)if(options.triangleCenters!==false&&t.up){
      const box=new THREE.Box3().setFromPoints([t.shape.a,t.shape.b,t.shape.c]);
      const x=(box.min.x+box.max.x)/2,z=(box.min.z+box.max.z)/2;
      for(const y of terrain.layers(x,z))if(y>=t.minY-.05&&y<=t.maxY+.05)add(x,z,y);
    }
  }
  function nearby(p:MeadowPoint,reach:number){
    const ids:number[]=[];
    for(let x=Math.floor((p.x-reach)/spacing);x<=Math.floor((p.x+reach)/spacing);x++)for(let z=Math.floor((p.z-reach)/spacing);z<=Math.floor((p.z+reach)/spacing);z++){
      for(const id of byCell.get(`${x},${z}`)??[])if(gap(nodes[id],p)<=reach)ids.push(id);
    }
    return ids;
  }
  function connection(a:number,b:number){
    const k=`${a}:${b}`,cached=edges.get(k);if(cached!==undefined)return cached;
    const from=nodes[a],to=nodes[b],d=gap(from,to);
    if(d>=walkReach&&Math.abs(to.y-from.y)<=.3){
      if(!ledges.has(a))ledges.set(a,[[spacing,0],[-spacing,0],[0,spacing],[0,-spacing]].some(([dx,dz])=>!terrain.dry(from.x+dx,from.z+dz,radius,from.y)));
      if(!ledges.get(a))return 0;
    }
    let value:0|1|2|3|4=0;
    if(d<walkReach&&terrain.canWalk(from,to))value=4;
    else if(Math.abs(to.y-from.y)>.3||d>1.2)value=terrain.jump(from,to)??0;
    edges.set(k,value);return value;
  }
  function plan(from:MeadowPoint,to:MeadowPoint,goals:MeadowPoint[]=[to]){
    const direct=goals.find(goal=>terrain.canWalk(from,goal));if(direct)return [direct] as Waypoint[];
    const starts=nearby(from,connectReach).filter(i=>terrain.canWalk(from,nodes[i]));
    const ends=new Map<number,MeadowPoint>();
    for(const goal of goals)for(const i of nearby(goal,connectReach))if(!ends.has(i)&&terrain.canWalk(nodes[i],goal))ends.set(i,goal);
    if(!starts.length||!ends.size)return;
    const cost=new Float64Array(nodes.length).fill(Infinity),previous=new Int32Array(nodes.length).fill(-1),moves=new Uint8Array(nodes.length),closed=new Uint8Array(nodes.length);
    const open=new Frontier();
    for(const i of starts){cost[i]=distance(from,nodes[i]);open.push(i,cost[i]+distance(nodes[i],to));}
    for(let entry=open.pop();entry;entry=open.pop()){
      const i=entry.id;if(closed[i])continue;closed[i]=1;
      if(ends.has(i)){
        const chain:Waypoint[]=[ends.get(i)!];
        for(let j=i;j!==-1;j=previous[j])chain.push({...nodes[j],...(moves[j]&&moves[j]<4?{jumpTier:moves[j] as 1|2|3}:{})});
        chain.reverse();
        const simplified:Waypoint[]=[];let anchor=from;
        for(let j=0;j<chain.length;j++){
          if(!chain[j].jumpTier)while(j+1<chain.length&&!chain[j+1].jumpTier&&terrain.canWalk(anchor,chain[j+1]))j++;
          anchor=chain[j];simplified.push(anchor);
        }
        return simplified;
      }
      for(const j of nearby(nodes[i],Math.max(4.2,spacing*1.5))){
        if(j===i||closed[j])continue;
        const d=distance(nodes[i],nodes[j]);
        if(cost[i]+d>=cost[j])continue;
        const move=connection(i,j);if(!move)continue;
        const next=cost[i]+d+(move<4?2+move*1.7:0);
        if(next>=cost[j])continue;
        cost[j]=next;previous[j]=i;moves[j]=move;open.push(j,next+distance(nodes[j],to));
      }
    }
  }
  return {
    invalidate(){built=false;nodes.length=0;byCell.clear();edges.clear();ledges.clear();},
    clear(){route=[];target=undefined;airborne=false;},
    setAdjacentDestination(hero:MeadowPoint,object:ApproachTarget){
      build();lastClick={x:object.x,y:hero.y,z:object.z};
      const y=terrain.height(hero.x,hero.z,hero.y);if(y===undefined){result='no footing';return false;}
      const from={x:hero.x,y,z:hero.z};
      const candidates=approachCandidates(from,object,(x,z)=>terrain.layers(x,z).filter(y=>terrain.dry(x,z,radius,y)).map(y=>({x,y,z})),8);
      // One multi-goal search per proximity band avoids repeating a full search
      // for every point around a wall, and can reach another side if needed.
      for(let first=0;first<candidates.length;){
        let end=first+1;while(end<candidates.length&&candidates[end].score<candidates[first].score+.22)end++;
        const planned=plan(from,candidates[first],candidates.slice(first,end));
        if(planned){route=planned;const end=planned[planned.length-1];target={x:end.x,y:end.y,z:end.z};stalled=0;best=Infinity;airborne=false;result='travelling';return true;}
        first=end;
      }
      result='no reachable approach';return false;
    },
    setDestination(hero:MeadowPoint,click:MeadowPoint){
      build();lastClick={...click};
      const y=terrain.height(hero.x,hero.z,hero.y);if(y===undefined){result='no footing';return false;}
      const from={x:hero.x,y,z:hero.z};
      const clickedY=terrain.height(click.x,click.z,click.y+.03);
      let goal:MeadowPoint|undefined;
      if(clickedY!==undefined&&Math.abs(clickedY-click.y)<.3&&terrain.dry(click.x,click.z,radius,clickedY))goal={x:click.x,y:clickedY,z:click.z};
      else{
        const candidates=nearby(click,3).map(i=>nodes[i]);
        const above=candidates.filter(p=>p.y>=click.y-.3);
        goal=(above.length?above:candidates).sort((a,b)=>(gap(a,click)+Math.abs(a.y-click.y)*.45)-(gap(b,click)+Math.abs(b.y-click.y)*.45))[0];
      }
      if(!goal){result='no landing';return false;}
      const planned=plan(from,goal);
      if(!planned){result='unreachable';return false;}
      route=planned;target={...goal};stalled=0;best=Infinity;airborne=false;result='travelling';return true;
    },
    steer(hero:CastlePlatformMotion,dt:number):MeadowTravelIntent|undefined{
      if(!route.length)return;
      let next=route[0],d=gap(hero,next);
      if(airborne){
        if(!hero.grounded)return {x:0,z:0,run:true,jump:false};
        airborne=false;
        if(d>.65||Math.abs(hero.y-next.y)>.35){route=[];target=undefined;result='landing blocked';return;}
        route.shift();best=Infinity;stalled=0;next=route[0];if(!next){target=undefined;result='arrived';return;}d=gap(hero,next);
      }
      const liningUp=!!route[1]?.jumpTier;
      if(!next.jumpTier&&d<(liningUp ? .025 : .18)&&Math.abs(hero.y-next.y)<.35){
        if(hero.speed>(liningUp ? .18 : .4)&&(liningUp||route.length===1))return {x:0,z:0,run:false,jump:false};
        route.shift();best=Infinity;stalled=0;next=route[0];
        if(!next){target=undefined;result='arrived';return;}d=gap(hero,next);
      }
      if(next.jumpTier&&hero.grounded){
        const tier=terrain.jump({x:hero.x,y:hero.y,z:hero.z},next);
        if(!tier){route=[];target=undefined;result='launch blocked';return;}
        airborne=true;return {x:0,z:0,run:true,jump:true,jumpTier:tier,jumpLanding:{...next}};
      }
      if(d<best-.03){best=d;stalled=0;}else if(hero.grounded)stalled+=dt;
      if(stalled>1.3){route=[];target=undefined;result='blocked';return;}
      const pace=liningUp?Math.min(1,Math.max(.04,(d-.01)*1.2)):Math.min(1,Math.max(.12,(d-.1)*.95));
      return {x:(next.x-hero.x)/Math.max(.001,d)*pace,z:(next.z-hero.z)/Math.max(.001,d)*pace,run:d>8,jump:false};
    },
    get destination(){return target;},
    get cameraRoute():readonly Waypoint[]{return route;},
    get diagnostics(){return {nodes:nodes.length,triangles:terrain.triangles.length,result,clicked:lastClick,target,route:route.map(p=>({...p}))};},
  };
}
