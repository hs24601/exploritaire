export type WorldPoint = { x: number; y: number };
export type PathObstacle = { id: string; left: number; top: number; right: number; bottom: number };
const distance = (a: WorldPoint, b: WorldPoint) => Math.hypot(a.x - b.x, a.y - b.y);
const inside = (p: WorldPoint, r: PathObstacle) => p.x > r.left && p.x < r.right && p.y > r.top && p.y < r.bottom;

/** Segment vs open rectangle: boundary tangencies are safe, interiors are not. */
export function crossesObstacle(a: WorldPoint, b: WorldPoint, r: PathObstacle) {
  let low = 0, high = 1;
  for (const [origin, delta, min, max] of [[a.x,b.x-a.x,r.left,r.right],[a.y,b.y-a.y,r.top,r.bottom]]) {
    if (Math.abs(delta) < 1e-9) { if (origin <= min || origin >= max) return false; continue; }
    const t1 = (min-origin)/delta, t2 = (max-origin)/delta;
    low = Math.max(low, Math.min(t1,t2)); high = Math.min(high, Math.max(t1,t2));
  }
  return high - low > 1e-8;
}

const portal = (p: WorldPoint, toward: WorldPoint, r: PathObstacle, obstacles: PathObstacle[]) => {
  const clamp = (v: number, min: number, max: number) => Math.max(min,Math.min(v,max));
  return [{x:r.left-1,y:clamp(p.y,r.top,r.bottom)}, {x:r.right+1,y:clamp(p.y,r.top,r.bottom)},
    {x:clamp(p.x,r.left,r.right),y:r.top-1}, {x:clamp(p.x,r.left,r.right),y:r.bottom+1}]
    .filter(candidate => !obstacles.some(other => other.id !== r.id && (inside(candidate,other) || crossesObstacle(p,candidate,other))))
    .sort((a,b)=>distance(p,a)+distance(a,toward)-distance(p,b)-distance(b,toward))[0];
};

/** Continuous visibility-graph routing. Inflate solids by actor radius before routing. */
export function findWorldPath(start: WorldPoint, target: WorldPoint, solids: PathObstacle[], enterId?: string, clearance = 28): WorldPoint[] | null {
  if (![start.x,start.y,target.x,target.y].every(Number.isFinite)) return null;
  const obstacles = solids.map(r=>({...r,left:r.left-clearance,top:r.top-clearance,right:r.right+clearance,bottom:r.bottom+clearance}));
  const exit = obstacles.find(r=>inside(start,r));
  const entry = obstacles.find(r=>r.id===enterId && inside(target,r));
  const a = exit ? portal(start,target,exit,obstacles) : {...start};
  if (!a) return null;
  const b = entry ? portal(target,a,entry,obstacles) : {...target};
  if (!a || !b || obstacles.some(r=>inside(a,r)||inside(b,r))) return null;
  const nodes = [a,b,...obstacles.flatMap(r=>[{x:r.left-1,y:r.top-1},{x:r.right+1,y:r.top-1},{x:r.right+1,y:r.bottom+1},{x:r.left-1,y:r.bottom+1}]).filter(p=>!obstacles.some(r=>inside(p,r)))];
  const cost = nodes.map(()=>Infinity), prev=nodes.map(()=>-1), visited=new Set<number>(); cost[0]=0;
  while (visited.size<nodes.length) {
    let current=-1;
    for(let i=0;i<nodes.length;i++) if(!visited.has(i) && (current<0 || cost[i]<cost[current])) current=i;
    if(current<0 || !Number.isFinite(cost[current])) return null;
    if(current===1) break;
    visited.add(current);
    for(let i=0;i<nodes.length;i++) {
      if(visited.has(i)||obstacles.some(r=>crossesObstacle(nodes[current],nodes[i],r))) continue;
      const next=cost[current]+distance(nodes[current],nodes[i]);
      if(next<cost[i]) {cost[i]=next;prev[i]=current;}
    }
  }
  const path:WorldPoint[]=[];
  for(let i=1;i>=0;i=prev[i]) path.unshift({...nodes[i]});
  if(exit) path.unshift({...start}); if(entry) path.push({...target});
  return path.filter((p,i)=>i===0||distance(p,path[i-1])>1e-6);
}

export const worldPathLength = (path: WorldPoint[]) => path.slice(1).reduce((sum,p,i)=>sum+distance(path[i],p),0);
export function pointAlongWorldPath(path: WorldPoint[], progress: number): WorldPoint {
  let remaining=worldPathLength(path)*Math.max(0,Math.min(1,progress));
  for(let i=1;i<path.length;i++) {
    const segment=distance(path[i-1],path[i]);
    if(remaining<=segment && segment>0) {const t=remaining/segment;return{x:path[i-1].x+(path[i].x-path[i-1].x)*t,y:path[i-1].y+(path[i].y-path[i-1].y)*t};}
    remaining-=segment;
  }
  return path[path.length-1] ?? {x:0,y:0};
}
