/** Grown Khad Roots geometry (khad-geometry-v2). Vines are grown rather than
 * drawn through fixed points: each one is a walker steering loosely toward a
 * few seeded waypoints, with a wandering heading, occasional kinks and girth
 * that bulges and pinches as it tapers. Route topology, sides and loose ends
 * also vary per card, so cards never share one stamped silhouette. The frozen
 * first version is `khadRootGeometryBaseline.ts`. Card space is 100 × 140. */
type Point = { x:number; y:number };
type Random = () => number;
type Rect = { x:number; y:number; w:number; h:number };
/** One centreline sample: position, half-width and unit tangent. */
export type KhadSpinePoint = { x:number; y:number; w:number; tx:number; ty:number };
/** A thorn as two quadratic curves: base a, control c1, tip, control c2, base b. */
export type KhadThornShape = { a:Point; c1:Point; tip:Point; c2:Point; b:Point };
const point = (p:Point) => `${p.x.toFixed(2)} ${p.y.toFixed(2)}`;
const clamp = (n:number, lo:number, hi:number) => Math.max(lo, Math.min(hi, n));

export const KHAD_GEOMETRY_VERSION = 'khad-geometry-v2';
/** Paint and particles never cover these, matching the KhadRoots mask. */
export const KHAD_REWARD_CLEARANCE: Rect = { x: 65, y: 0, w: 33, h: 36 };
export const KHAD_VALUE_CLEARANCE: Rect = { x: 17, y: 39, w: 66, h: 67 };

/** Mandatory Khad Roots structure (Eric, 2026-10-20). Each rule is measured on
 * the generated geometry by `khadRootStructure` and enforced in tests. */
export const KHAD_ROOT_RULES = Object.freeze({
  /** Longest nearly straight run of a vine, in card units: vines wind. */
  maxStraightRun: 16,
  /** Girth must visibly vary along a vine body (coefficient of variation). */
  minGirthVariation: .1,
  /** Vine ends taper to at most this fraction of the vine's median girth. */
  maxTipGirth: .45,
  /** Silhouette overlap (intersection over union of coarse vine occupancy)
   * between cards: the average pair, the 99th percentile, and a ceiling no pair
   * may reach (where two cards would read as the same). Over 150 cards the
   * frozen v1 measured .49 / .63 / .71; v2 measures about .36 / .49 / .56. */
  maxMeanSilhouetteOverlap: .4,
  maxP99SilhouetteOverlap: .5,
  /** A vine may cross itself only across a wide loop: never where the two
   * crossing points are closer than this along the vine (a tight knot). */
  minLoopLength: 40,
  maxSilhouetteOverlap: .6,
});

function seeded(id:string):Random {
  let seed=2166136261;
  for(const c of id) seed=Math.imul(seed^c.charCodeAt(0),16777619);
  return ()=>{ seed^=seed<<13; seed^=seed>>>17; seed^=seed<<5; return (seed>>>0)/4294967296; };
}
/** Smooth 1D value noise in [0,1]. `swing` alternates each control value
 * above and below the middle, so the signal never goes flat for a whole cell. */
function noise1(random:Random, cells=24, swing=false) {
  const v=Array.from({length:cells+1},(_,i)=>swing ? .5+(i%2?1:-1)*(.12+random()*.38) : random());
  return (t:number)=>{ const p=clamp(t,0,1)*cells,i=Math.min(cells-1,Math.floor(p)),f=p-i,s=f*f*(3-2*f); return v[i]*(1-s)+v[i+1]*s; };
}
const inside = (p:Point, r:Rect, pad=0) => p.x>r.x-pad && p.x<r.x+r.w+pad && p.y>r.y-pad && p.y<r.y+r.h+pad;

/** Grows one vine: steering toward each waypoint in turn with a wandering
 * heading and kinks, repelled from protected windows. The final waypoint is
 * reached exactly when `exactEnd` is set (group links attach precisely). */
function growPath(start:Point, targets:Point[], random:Random, avoid:Rect[], exactEnd=false):Point[] {
  // A waypoint inside a protected window can never be reached, and circling it
  // makes a knot: move it to just outside the window's nearest edge.
  const waypoints=targets.map((w,i)=>{
    if(exactEnd && i===targets.length-1) return w;
    let q={...w};
    for(const r of avoid) if(inside(q,r,6)) {
      const exits=[{x:r.x-7,y:q.y},{x:r.x+r.w+7,y:q.y},{x:q.x,y:r.y-7},{x:q.x,y:r.y+r.h+7}];
      q=exits.reduce((best,e)=>Math.hypot(e.x-q.x,e.y-q.y)<Math.hypot(best.x-q.x,best.y-q.y)?e:best);
    }
    return q;
  });
  const step=1.6, samples:Point[]=[{...start}];
  const total=waypoints.reduce((sum,w,i)=>sum+Math.hypot(w.x-(i?waypoints[i-1]:start).x,w.y-(i?waypoints[i-1]:start).y),0);
  // Deviation from the course, not cumulative turning: a slow sway with a
  // wavelength of a few card widths' worth of vine and a quicker small one.
  // Indexed over twice the planned length: a winding vine travels further than
  // planned, and a saturated index would freeze the sway into a straight tail.
  const reach=total*2, sway=noise1(random,Math.max(12,Math.round(reach/16)),true), ripple=noise1(random,Math.max(20,Math.round(reach/6)),true);
  const kinks=Array.from({length:2+Math.floor(random()*3)},()=>({at:random(),turn:(random()-.5)*.8}));
  let prev=NaN, p={...start}, target=0, course=Math.atan2(waypoints[0].y-start.y,waypoints[0].x-start.x)+(random()-.5)*.6, kink=0;
  // A waypoint the walker misses is abandoned after a step budget, so a vine
  // never circles or escapes; exact ends keep steering until they arrive.
  let budget=0;
  for(let n=0, travelled=0; n<700 && target<waypoints.length; n++) {
    const w=waypoints[target], dx=w.x-p.x, dy=w.y-p.y, d=Math.hypot(dx,dy);
    const last=target===waypoints.length-1;
    if(!budget) budget=Math.ceil(d/step*1.9)+8;
    // A waypoint behind the vine and close by has been passed: the curvature
    // limit cannot turn tighter than about 8 units, so chasing it would orbit.
    let behind=Math.atan2(dy,dx)-(Number.isNaN(prev)?course:prev); behind=Math.abs(Math.atan2(Math.sin(behind),Math.cos(behind)));
    const passed=!(exactEnd&&last) && d<16 && behind>1.3;
    if(d<(last?(exactEnd?2.2:3):5.5) || passed || (--budget<=0 && !(exactEnd&&last))) { target++; budget=0; continue; }
    const t=Math.min(1,travelled/Math.max(1,total)), along=Math.min(1,travelled/Math.max(1,reach));
    // The course turns toward the waypoint; it tightens near an exact end.
    let diff=Math.atan2(dy,dx)-course; diff=Math.atan2(Math.sin(diff),Math.cos(diff));
    course+=diff*(exactEnd&&last&&d<14 ? .5 : .2);
    // Kinks bend the vine sharply, then relax back onto the course.
    for(const k of kinks) if(Math.abs(t-k.at)<step/(2*Math.max(1,total))) kink+=k.turn;
    kink*=.93;
    const settle=exactEnd&&last ? smoothstep(4,16,d) : 1;
    // The course turns away from protected windows before entering them and
    // skirts their edge; the sway is added afterwards (a little calmer close to
    // a window), so a vine passing a window still winds instead of ruling a line.
    let near=0;
    for(const r of avoid) {
      const ahead={x:p.x+Math.cos(course)*7,y:p.y+Math.sin(course)*7};
      if(inside({x:p.x,y:p.y},r,9)) near=1;
      if(!inside(ahead,r,4)) continue;
      const cx=r.x+r.w/2,cy=r.y+r.h/2,away=Math.atan2(p.y-cy,p.x-cx);
      let turn=away-course; turn=Math.atan2(Math.sin(turn),Math.cos(turn));
      course+=Math.sign(turn||1)*Math.min(Math.abs(turn),.6);
    }
    let h=course+((sway(along)-.5)*1.5+(ripple(along)-.5)*.5+kink)*settle*(near?.6:1);
    // Stay around the card: the closer to the edge of the space around it, the
    // harder the vine curls back, so it bends away rather than sliding along it.
    // Only a vine heading outward is turned; one already heading in runs free.
    const walls=[{d:p.x+14,nx:-1,ny:0},{d:114-p.x,nx:1,ny:0},{d:p.y+18,nx:0,ny:-1},{d:156-p.y,nx:0,ny:1}];
    for(const wall of walls) if(wall.d<8 && Math.cos(h)*wall.nx+Math.sin(h)*wall.ny>0) {
      const along=Math.atan2(-wall.ny,-wall.nx); let back=along-h; back=Math.atan2(Math.sin(back),Math.cos(back));
      const push=back*(.05+.35*smoothstep(8,0,wall.d)); course+=push; h+=push;
    }
    // Curvature limit: a vine bends, it never knots on itself (KHAD_ROOT_RULES).
    if(!Number.isNaN(prev)) { let turn=h-prev; turn=Math.atan2(Math.sin(turn),Math.cos(turn)); h=prev+clamp(turn,-.2,.2); }
    // Hard guard: a step never enters a protected window. Rotate the heading by
    // the smallest amount, either way, that keeps the next step clear.
    const blocked=(a:number)=>avoid.some(r=>inside({x:p.x+Math.cos(a)*step*2,y:p.y+Math.sin(a)*step*2},r,1));
    if(blocked(h)) for(let k=1;k<=12;k++) { const turn=k*.16; if(!blocked(h+turn)){h+=turn;course+=turn;break;} if(!blocked(h-turn)){h-=turn;course-=turn;break;} }
    p={x:p.x+Math.cos(h)*step,y:p.y+Math.sin(h)*step}; prev=h;
    travelled+=step; samples.push(p);
  }
  if(exactEnd) samples.push({...waypoints[waypoints.length-1]});
  return samples;
}

/** Filled tapered wood with organic girth and varied, hooked thorns. */
function growStem(samples:Point[],random:Random,radius:number,spacing:number,clear:Rect[]) {
  const left:Point[]=[],right:Point[]=[],thorns:string[]=[],scars:string[]=[],ridges:string[]=[],moonEdges:string[]=[],widths:number[]=[];
  // Raw shape data for the raster painter; the SVG strings above are unchanged.
  const spine:KhadSpinePoint[]=[],thornShapes:KhadThornShape[]=[];
  const girthNoise=noise1(random,Math.max(6,Math.round(samples.length/9)),true), pinch=noise1(random,Math.max(4,Math.round(samples.length/22)));
  let distance=0,nextThorn=5+random()*7;
  samples.forEach((p,i)=>{
    const prior=samples[Math.max(0,i-1)],next=samples[Math.min(samples.length-1,i+1)];
    const length=Math.hypot(next.x-prior.x,next.y-prior.y)||1;
    const tx=(next.x-prior.x)/length,ty=(next.y-prior.y)/length,nx=-ty,ny=tx;
    const t=i/(samples.length-1);
    const taper=Math.min(1,.1+t*7,.05+(1-t)*7.5);
    // Broad horizontal runs carry the vine's weight (trunk girth contract);
    // noise bulges and pinches it irregularly instead of a sine rhythm.
    const girth=(1.2+.75*tx*tx)*(.6+girthNoise(t)*.75)*(.64+smoothstep(.3,.75,pinch(t))*.58);
    const width=radius*girth*taper;
    widths.push(width); spine.push({x:p.x,y:p.y,w:width,tx,ty});
    left.push({x:p.x+nx*width,y:p.y+ny*width});
    right.push({x:p.x-nx*width,y:p.y-ny*width});
    distance+=Math.hypot(p.x-prior.x,p.y-prior.y);
    if(i>3 && i<samples.length-4 && distance>=nextThorn) {
      nextThorn=distance+spacing*(.55+random()*.9);
      // Varied size and hook; try the preferred side, then the other, and skip
      // a thorn rather than let a clearance window cut its tip off.
      const height=(6+random()*13)*Math.min(1.25,.65+width/radius*.35),base=2.2+random()*2.8,hook=(3+random()*6)*(random()>.5?1:-1);
      const first=random()>.5?1:-1;
      for(const side of [first,-first]) {
        const ox=nx*side,oy=ny*side;
        const tip={x:p.x+ox*(width+height)+tx*hook,y:p.y+oy*(width+height)+ty*hook};
        if(clear.some(r=>inside(tip,r,1.5))) continue;
        const a={x:p.x-tx*base+ox*width*.6,y:p.y-ty*base+oy*width*.6},b={x:p.x+tx*base+ox*width*.6,y:p.y+ty*base+oy*width*.6};
        // Broad concave shoulders: the curve bows toward the hook side.
        thornShapes.push({a,c1:{x:p.x+ox*(width+height*.45)-tx*base*.6,y:p.y+oy*(width+height*.45)-ty*base*.6},tip,c2:{x:p.x+ox*(width+height*.2)+tx*base*.9,y:p.y+oy*(width+height*.2)+ty*base*.9},b});
        thorns.push(`M${point(a)} Q${p.x+ox*(width+height*.45)-tx*base*.6} ${p.y+oy*(width+height*.45)-ty*base*.6} ${point(tip)} Q${p.x+ox*(width+height*.2)+tx*base*.9} ${p.y+oy*(width+height*.2)+ty*base*.9} ${point(b)} Z`);
        break;
      }
    }
    // Only upward-facing bark catches moonlight; undersides stay dark.
    if(i%6===0 && Math.abs(ny)>.3 && width>radius*.4) {
      const side=ny<0?1:-1, end=samples[Math.min(samples.length-1,i+3)];
      moonEdges.push(`M${point({x:p.x+nx*width*side,y:p.y+ny*width*side})} L${point({x:end.x+nx*width*side,y:end.y+ny*width*side})}`);
    }
    // Broken side-lit bark follows the local twist instead of a flat outline.
    if(i%10===3 && width>radius*.65) {
      const end=samples[Math.min(samples.length-1,i+6)], offset=width*.5;
      ridges.push(`M${point({x:p.x+nx*offset,y:p.y+ny*offset})} Q${p.x+tx*4+nx*width*.8} ${p.y+ty*4+ny*width*.8} ${point({x:end.x+nx*offset,y:end.y+ny*offset})}`);
    }
    // Hot red seams break across the dark, rounded woody body.
    if(i%12===5 && width>radius*.7) {
      const end=samples[Math.min(samples.length-1,i+4)];
      scars.push(`M${point(p)} Q${p.x+tx*3+nx*.3} ${p.y+ty*3+ny*.3} ${point(end)}`);
    }
  });
  return { ribbon:`M${left.map(point).join(' L')} L${right.reverse().map(point).join(' L')} Z`,
    center:`M${samples.map(point).join(' L')}`,thorns,scars,ridges,moonEdges,spine,thornShapes };
}
function smoothstep(a:number,b:number,x:number){ const t=clamp((x-a)/(b-a),0,1); return t*t*(3-2*t); }

/** Stable per-card growth, independent of rank, render order and animation time. */
export function khadRootGeometry(cardId:string,obscureValue=false) {
  const random=seeded(cardId),between=(a:number,b:number)=>a+(b-a)*random();
  // Every vine keeps full clearance. obscureValue only adds the one vine that
  // crosses the face, so the card's other growth is identical either way.
  const clear=[KHAD_REWARD_CLEARANCE,KHAD_VALUE_CLEARANCE];
  // Vines steer around the narrow corridor between the reward and value windows
  // as if it were solid: squeezing into it only ever produced a knot.
  const steer=[...clear,{x:KHAD_REWARD_CLEARANCE.x,y:KHAD_REWARD_CLEARANCE.y+KHAD_REWARD_CLEARANCE.h-2,w:KHAD_REWARD_CLEARANCE.w,h:KHAD_VALUE_CLEARANCE.y-KHAD_REWARD_CLEARANCE.y-KHAD_REWARD_CLEARANCE.h+4}];
  // The base wrap starts high on one side, crosses under the card and climbs
  // the other side. Which side leads, and how high each climb goes, vary.
  const lead=random()<.5?-1:1, sideX=(s:number)=>s<0?between(-5,7):between(93,105);
  const leadTop=between(40,78),tailTop=between(44,88),baseY=between(108,126);
  const anchorTarget={x:between(92,99),y:between(102,124)};
  const wrapPoints=[
    {x:sideX(lead),y:leadTop+between(10,22)},{x:sideX(lead),y:between(86,100)},
    {x:50+lead*between(18,30),y:baseY+between(-4,8)},{x:50-lead*between(5,22),y:between(118,134)},
    lead<0?anchorTarget:{x:between(1,8),y:between(102,122)},
    {x:sideX(-lead),y:between(80,96)},{x:sideX(-lead)+lead*between(2,8),y:tailTop},
  ];
  type Route={path:{start:Point;waypoints:Point[];avoid:Rect[]};radius:number;spacing:number;crossesValue?:boolean};
  const plan=(start:Point,waypoints:Point[],avoid:Rect[]=steer)=>({start,waypoints,avoid});
  const routes:Route[]=[{path:plan({x:sideX(lead),y:leadTop},wrapPoints),radius:3.6,spacing:9}];
  // A low run, dipping along under the card in either direction.
  const runDir=random()<.5?1:-1;
  routes.push({path:plan({x:50-runDir*between(52,60),y:between(122,138)},
    [{x:50-runDir*between(15,30),y:between(112,128)},{x:50+runDir*between(5,25),y:between(118,136)},{x:50+runDir*between(48,56),y:between(124,140)}]),radius:2.3,spacing:12});
  // The crown curl arcs over the top, either way round, skirting the reward.
  const crownDir=random()<.5?1:-1;
  // Only a curl heading left may ride lower; one heading right stays high so it
  // clears the reward window instead of meeting its edge and knotting.
  const crownLift=crownDir<0?between(-8,12):between(-8,-2);
  routes.push({path:plan({x:50-crownDir*53,y:between(56,90)},
    [{x:50-crownDir*between(38,50),y:between(18,40)},{x:50-crownDir*between(10,30),y:between(-6,6)+crownLift},
      {x:50+crownDir*between(4,24),y:between(-10,-2)+crownLift*.6},
      // Heading right, the curl passes above the reward window, not through it.
      ...(crownDir>0?[{x:between(78,88),y:between(-12,-7)},{x:between(102,108),y:between(4,14)}]:[]),
      {x:50+crownDir*between(42,56),y:between(30,64)}]),radius:2.7,spacing:12});
  // An occasional short loose tendril curling off one side.
  if(random()<.45) {
    const s=random()<.5?-1:1, from={x:s<0?between(-6,4):between(96,106),y:between(30,110)};
    const rise=random()<.5?-1:1;
    routes.push({path:plan(from,[{x:from.x+s*between(8,14),y:from.y+rise*between(10,18)},{x:from.x+s*between(4,10),y:from.y+rise*between(24,34)}]),radius:1.6,spacing:9});
  }
  // Optional climbing shoot with a loose curled end.
  if(random()<.6) {
    const s=random()<.5?-1:1, foot={x:s<0?between(-2,10):between(90,102),y:between(118,132)};
    routes.push({path:plan(foot,[{x:foot.x+s*between(2,6),y:between(90,104)},{x:foot.x-s*between(-2,4),y:between(58,76)},{x:foot.x+s*between(4,10),y:between(46,62)}]),radius:1.9,spacing:11});
  }
  if(obscureValue) routes.push({path:plan({x:-2,y:between(92,102)},[{x:between(24,32),y:between(62,72)},{x:between(48,56),y:between(74,84)},{x:between(74,82),y:between(55,64)},{x:103,y:between(72,82)}],[KHAD_REWARD_CLEARANCE]),radius:2.2,spacing:13,crossesValue:true});
  // Each vine is grown, then checked against KHAD_ROOT_RULES; a vine that fails
  // is regrown from its next sub-seed, so output stays stable per card.
  const grown=routes.map((route,k)=>{
    let best:{samples:Point[];stem:ReturnType<typeof growStem>}|undefined, bestScore=Infinity;
    for(let attempt=0;attempt<6;attempt++) {
      const sub=seeded(`${cardId}#${k}#${attempt}`), samples=growPath(route.path.start,route.path.waypoints,sub,route.path.avoid);
      const own=route.crossesValue?[KHAD_REWARD_CLEARANCE]:clear;
      const stem=growStem(samples,sub,route.radius,route.spacing,own), score=ruleViolations(khadRootStructure({stems:[stem]},Boolean(route.crossesValue)));
      if(score<bestScore){best={samples,stem};bestScore=score;}
      if(!score) break;
    }
    return best!;
  });
  const stems=grown.map(g=>g.stem), wrap=grown[0].samples;
  // Group links attach at the base wrap sample nearest the seeded anchor.
  const anchor=wrap.reduce((best,p)=>Math.hypot(p.x-anchorTarget.x,p.y-anchorTarget.y)<Math.hypot(best.x-anchorTarget.x,best.y-anchorTarget.y)?p:best,wrap[0]);
  return { stems,strands:stems.map(s=>s.center),thorns:stems.flatMap(s=>s.thorns),anchor:{x:Number(anchor.x.toFixed(2)),y:Number(anchor.y.toFixed(2))},
    motes:Array.from({length:7},(_,i)=>({x:i%2?between(96,106):between(-5,5),y:between(55,130),r:between(1.6,2.8),delay:-between(0,6)})) };
}

/** Group links use the same grown, thorn-bearing wood as the card wraps. */
export function khadBridgeGeometry(a:Point,b:Point,id:string) {
  const random=seeded(id),side=random()>.5?1:-1,dx=b.x-a.x,dy=b.y-a.y,len=Math.hypot(dx,dy)||1,nx=-dy/len,ny=dx/len;
  // Two loose bows to either side of the straight line, then the exact end.
  const bow=(t:number,amount:number)=>({x:a.x+dx*t+nx*amount,y:a.y+dy*t+ny*amount});
  const waypoints=[bow(.32,side*len*(.12+random()*.14)),bow(.7,-side*len*(.06+random()*.12)),b];
  let best:ReturnType<typeof growStem>|undefined, bestScore=Infinity;
  for(let attempt=0;attempt<6;attempt++) {
    const sub=seeded(`${id}#${attempt}`), stem=growStem(growPath(a,waypoints,sub,[],true),sub,2.8,12,[]);
    // Links carry no clearance windows; the remaining rules still apply.
    const score=ruleViolations({...khadRootStructure({stems:[stem]},true),thornTipsClipped:0});
    if(score<bestScore){best=stem;bestScore=score;}
    if(!score) break;
  }
  return best!;
}

/** How many KHAD_ROOT_RULES a measured growth breaks (silhouette overlap is
 * between cards, so it is checked separately). */
export function ruleViolations(m:ReturnType<typeof khadRootStructure>) {
  const R=KHAD_ROOT_RULES;
  return Number(m.straightRun>R.maxStraightRun)+Number(m.minGirthVariation<R.minGirthVariation)+Number(m.maxTipGirth>R.maxTipGirth)
    +Number(m.thornTipsClipped>0)+Number(m.valueCrossings>0)+Number(m.undersideGlow>0)+Number(m.tightLoops>0);
}

/** Structural measures for KHAD_ROOT_RULES, read from the rendered paths so
 * the frozen baseline can be measured the same way. */
export function khadRootStructure(growth:{stems:{ribbon:string;center:string;thorns:string[];moonEdges:string[]}[]},obscureValue=false) {
  const numbers=(d:string)=>d.match(/-?\d+(?:\.\d+)?/g)!.map(Number);
  const pairs=(d:string)=>{ const n=numbers(d),out:Point[]=[]; for(let i=0;i+1<n.length;i+=2) out.push({x:n[i],y:n[i+1]}); return out; };
  let tightLoops=0,straightRun=0,minGirthVariation=Infinity,maxTipGirth=0,thornTipsClipped=0,valueCrossings=0,undersideGlow=0;
  for(const stem of growth.stems) {
    const c=pairs(stem.center),ribbon=pairs(stem.ribbon.replace(/ Z$/,''));
    const n=c.length,widths=c.map((_,i)=>Math.hypot(ribbon[i].x-ribbon[2*n-1-i].x,ribbon[i].y-ribbon[2*n-1-i].y)/2);
    // Tight loops: two non-adjacent segments crossing within minLoopLength of vine.
    const along=[0]; for(let i=1;i<n;i++) along.push(along[i-1]+Math.hypot(c[i].x-c[i-1].x,c[i].y-c[i-1].y));
    const cross=(a:Point,b:Point,p:Point,q:Point)=>{ const d=(b.x-a.x)*(q.y-p.y)-(b.y-a.y)*(q.x-p.x); if(!d) return false; const u=((p.x-a.x)*(q.y-p.y)-(p.y-a.y)*(q.x-p.x))/d,v=((p.x-a.x)*(b.y-a.y)-(p.y-a.y)*(b.x-a.x))/d; return u>0&&u<1&&v>0&&v<1; };
    for(let i=1;i<n;i++) for(let j=i+2;j<n && along[j]-along[i]<KHAD_ROOT_RULES.minLoopLength;j++) if(cross(c[i-1],c[i],c[j-1],c[j])) tightLoops++;
    // Straight runs: distance travelled while the heading stays within ±0.06 rad of where the run began.
    for(let i=1,start=0;i<n;i++) {
      const h0=Math.atan2(c[start+1].y-c[start].y,c[start+1].x-c[start].x),h=Math.atan2(c[i].y-c[i-1].y,c[i].x-c[i-1].x);
      if(Math.abs(Math.atan2(Math.sin(h-h0),Math.cos(h-h0)))>.06) start=i-1;
      else straightRun=Math.max(straightRun,Math.hypot(c[i].x-c[start].x,c[i].y-c[start].y));
    }
    const body=widths.slice(Math.floor(n*.2),Math.ceil(n*.8)),mean=body.reduce((s,w)=>s+w,0)/body.length;
    const sd=Math.sqrt(body.reduce((s,w)=>s+(w-mean)**2,0)/body.length);
    minGirthVariation=Math.min(minGirthVariation,sd/mean);
    const median=[...widths].sort((p,q)=>p-q)[Math.floor(n/2)];
    maxTipGirth=Math.max(maxTipGirth,widths[0]/median,widths[n-1]/median);
    const clear=obscureValue?[KHAD_REWARD_CLEARANCE]:[KHAD_REWARD_CLEARANCE,KHAD_VALUE_CLEARANCE];
    // Thorn path: M base Q control tip Q control base Z, so the tip is the third point.
    for(const thorn of stem.thorns) { const tip=pairs(thorn)[2]; if(tip && clear.some(r=>inside(tip,r))) thornTipsClipped++; }
    if(!obscureValue) valueCrossings+=c.filter(p=>inside(p,KHAD_VALUE_CLEARANCE,-2)).length;
    // A glow edge sits on the upper side when it lies above the nearest centre point.
    // A glow edge starts one half-width from the sample that produced it,
    // perpendicular to the vine; find that sample, then check the edge is above it.
    for(const edge of stem.moonEdges) {
      const e=pairs(edge)[0]; let best=Infinity,source=c[0];
      for(let i=0;i<n;i++){ const p=c[i],q=c[Math.min(n-1,i+1)],o=c[Math.max(0,i-1)],tx=q.x-o.x,ty=q.y-o.y,tl=Math.hypot(tx,ty)||1,dx=e.x-p.x,dy=e.y-p.y;
        const score=Math.abs(Math.hypot(dx,dy)-widths[i])+Math.abs((dx*tx+dy*ty)/tl); if(score<best){best=score;source=p;} }
      if(e.y>source.y+.05) undersideGlow++;
    }
  }
  return { tightLoops,straightRun,minGirthVariation,maxTipGirth,thornTipsClipped,valueCrossings,undersideGlow };
}

/** Coarse occupancy grid of a card's vine ribbons, for silhouette comparisons. */
export function khadSilhouette(growth:{stems:{ribbon:string}[]},cols=26,rows=36) {
  const grid=new Uint8Array(cols*rows);
  for(const stem of growth.stems) {
    const n=stem.ribbon.match(/-?\d+(?:\.\d+)?/g)!.map(Number),pts:Point[]=[];
    for(let i=0;i+1<n.length;i+=2) pts.push({x:n[i],y:n[i+1]});
    for(let gy=0;gy<rows;gy++) for(let gx=0;gx<cols;gx++) {
      const x=-15+(gx+.5)*130/cols,y=-15+(gy+.5)*170/rows;
      let hit=false; for(let i=0,j=pts.length-1;i<pts.length;j=i++) if((pts[i].y>y)!==(pts[j].y>y) && x<(pts[j].x-pts[i].x)*(y-pts[i].y)/(pts[j].y-pts[i].y)+pts[i].x) hit=!hit;
      if(hit) grid[gy*cols+gx]=1;
    }
  }
  return grid;
}
export const silhouetteOverlap=(a:Uint8Array,b:Uint8Array)=>{ let both=0,either=0; for(let i=0;i<a.length;i++){ both+=a[i]&b[i]; either+=a[i]|b[i]; } return either?both/either:0; };
