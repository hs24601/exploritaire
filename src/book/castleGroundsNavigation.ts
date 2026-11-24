import {CASTLE} from './castleLayout';
import {groundsHeight, groundsWalkable} from './castleGroundsLayout';
import {PLATFORM_MOTION, type CastlePlatformMotion} from './castlePlatformMotion';
import {approachCandidates,type ApproachTarget} from './pointApproach';

type Point = {x: number; z: number};
type TravelIntent = Point & {run: boolean; jump: boolean};
const distance = (a: Point,b: Point) => Math.hypot(a.x-b.x,a.z-b.z);
const step = 2, extent = 140, side = 2*extent/step+1;
const clearance = CASTLE.heroRadius+.18;
const node = (i: number): Point => ({x:i%side*step-extent,z:Math.floor(i/side)*step-extent});
const offsets = [-1,0,1].flatMap(z => [-1,0,1].map(x => [x,z] as const)).filter(([x,z]) => x||z);
const dry = new Int8Array(side*side);
type Walkable=typeof groundsWalkable;

export function groundsSegmentClear(a: Point,b: Point,radius = clearance,canWalk:Walkable=groundsWalkable) {
  const samples = Math.max(1,Math.ceil(distance(a,b)/.27));
  for (let i=0;i<=samples;i++) {
    const t = i/samples;
    if (!canWalk(a.x+(b.x-a.x)*t,a.z+(b.z-a.z)*t,radius)) return false;
  }
  return true;
}

function nearby(p: Point,canWalk:Walkable) {
  const x = Math.round((p.x+extent)/step), z = Math.round((p.z+extent)/step);
  const result: number[] = [];
  for (let dz=-2;dz<=2;dz++) for (let dx=-2;dx<=2;dx++) {
    if (x+dx<0||x+dx>=side||z+dz<0||z+dz>=side) continue;
    const i = (z+dz)*side+x+dx, q = node(i);
    // Exact clicked points may be closer to a shoreline than grid nodes.
    if (walkableNode(i,q,canWalk) && groundsSegmentClear(p,q,CASTLE.heroRadius,canWalk)) result.push(i);
  }
  return result;
}

function walkableNode(i: number,p: Point,canWalk:Walkable) {
  if(canWalk!==groundsWalkable)return canWalk(p.x,p.z,clearance);
  if (!dry[i]) dry[i] = groundsWalkable(p.x,p.z,clearance) ? 1 : -1;
  return dry[i]===1;
}

type Entry = {index: number; score: number};
class Frontier {
  private heap: Entry[] = [];
  push(entry: Entry) {
    const heap = this.heap;
    let i = heap.length;
    while (i>0) {
      const parent = (i-1)>>1;
      if (heap[parent].score<=entry.score) break;
      heap[i] = heap[parent]; i = parent;
    }
    heap[i] = entry;
  }
  pop(): Entry | undefined {
    const heap = this.heap, root = heap[0], last = heap.pop();
    if (last && heap.length) {
      let i = 0;
      while (i*2+1<heap.length) {
        let child = i*2+1;
        if (child+1<heap.length && heap[child+1].score<heap[child].score) child++;
        if (heap[child].score>=last.score) break;
        heap[i] = heap[child]; i = child;
      }
      heap[i] = last;
    }
    return root;
  }
}

/** Search the same dry footprint used by movement, then remove grid corners
 * that Hero can walk straight through with clearance for her paws. */
export function planGroundsRoute(start: Point,goal: Point,canWalk:Walkable=groundsWalkable): Point[] | undefined {
  if (!canWalk(goal.x,goal.z)) return;
  if (groundsSegmentClear(start,goal,clearance,canWalk)) return [goal];
  const ends = new Set(nearby(goal,canWalk));
  if (!ends.size) return;
  const cost = new Float64Array(side*side).fill(Infinity);
  const previous = new Int32Array(side*side).fill(-1);
  const closed = new Uint8Array(side*side);
  const open = new Frontier();
  for (const i of nearby(start,canWalk)) {
    const p = node(i);
    cost[i] = distance(start,p); open.push({index:i,score:cost[i]+distance(p,goal)});
  }
  for (let entry=open.pop();entry;entry=open.pop()) {
    const i = entry.index;
    if (closed[i]) continue;
    closed[i] = 1;
    if (ends.has(i)) {
      const chain = [goal];
      for (let j=i;j!==-1;j=previous[j]) chain.push(node(j));
      chain.reverse();
      const result: Point[] = [];
      let anchor = start;
      for (let j=0;j<chain.length;j++) {
        while (j+1<chain.length && groundsSegmentClear(anchor,chain[j+1],clearance,canWalk)) j++;
        anchor = chain[j]; result.push(anchor);
      }
      return result;
    }
    const a = node(i), x = i%side, z = Math.floor(i/side);
    for (const [dx,dz] of offsets) {
      if (x+dx<0||x+dx>=side||z+dz<0||z+dz>=side) continue;
      const j = i+dz*side+dx;
      const b = node(j), next = cost[i]+Math.hypot(dx,dz)*step;
      if (closed[j] || next>=cost[j] || !walkableNode(j,b,canWalk) || !groundsSegmentClear(a,b,clearance,canWalk)) continue;
      cost[j] = next; previous[j] = i;
      open.push({index:j,score:next+distance(b,goal)});
    }
  }
}

export class CastleGroundsNavigation {
  constructor(private readonly canWalk:Walkable=groundsWalkable){}
  private route: Point[] = [];
  private target?: Point;
  private progress = 0;
  private closest = Infinity;
  private replanned = false;

  get destination() { return this.target; }
  get cameraRoute():readonly Point[] { return this.route; }

  clear() { this.route = []; this.target = undefined; }

  setDestination(from: Point,to: Point) {
    const route = planGroundsRoute(from,to,this.canWalk);
    if (!route) return false;
    this.target = to; this.route = route;
    this.progress = 0; this.closest = Infinity; this.replanned = false;
    return true;
  }

  setAdjacentDestination(from:Point&{y:number},object:ApproachTarget,maxReach=object.radius===undefined?32:8){
    const candidates=approachCandidates(from,object,(x,z)=>this.canWalk(x,z)?[{x,y:groundsHeight(x,z),z}]:[],maxReach);
    for(const candidate of candidates)if(this.setDestination(from,candidate))return true;
    return false;
  }

  steer(hero: CastlePlatformMotion,dt: number): TravelIntent | undefined {
    if (!this.target) return;
    let next = this.route[0];
    let gap = distance(hero,next);
    // The exact clicked endpoint can sit closer to masonry than a grid node.
    const nextClearance = this.route.length===2 ? CASTLE.heroRadius : clearance;
    if (this.route.length>1 && gap<.65 && groundsSegmentClear(hero,this.route[1],nextClearance,this.canWalk)) {
      this.route.shift(); next = this.route[0]; gap = distance(hero,next);
      this.closest = Infinity;
    }
    if (this.route.length===1 && gap<.22) {
      if (hero.grounded && hero.speed<.45) this.clear();
      return {x:0,z:0,run:false,jump:false};
    }
    if (gap<this.closest-.08) { this.closest = gap; this.progress = 0; }
    else if (hero.grounded) this.progress += dt;
    if (this.progress>1) {
      const route = !this.replanned && planGroundsRoute(hero,this.target,this.canWalk);
      if (!route) { this.clear(); return; }
      this.route = route; this.replanned = true; this.progress = 0; this.closest = Infinity;
      return this.steer(hero,0);
    }

    if (gap<.001) return {x:0,z:0,run:false,jump:false};
    const x = (next.x-hero.x)/gap, z = (next.z-hero.z)/gap;
    const run = gap>8;
    const pace = run ? 1 : Math.min(1,Math.max(.13,(gap-.1)*.95));
    return {x:x*pace,z:z*pace,run,jump:this.crossingJump(hero,next,x,z,gap)};
  }

  private crossingJump(hero: CastlePlatformMotion,next: Point,x: number,z: number,gap: number) {
    if (!hero.grounded || hero.speed<1.1 || (hero.vx*x+hero.vz*z)/hero.speed<.94) return false;
    const look = Math.min(1.15,hero.speed*.22);
    const from = groundsHeight(hero.x,hero.z);
    if (groundsHeight(hero.x+x*look,hero.z+z*look)<from+.14) return false;
    const flight = 2*PLATFORM_MOTION.jump[0]/PLATFORM_MOTION.gravity;
    const travel = Math.max(hero.speed,PLATFORM_MOTION.walk)*flight+1;
    return gap>travel+1 && groundsSegmentClear(hero,next,clearance,this.canWalk);
  }
}
