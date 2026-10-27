/** FROZEN first Khad Roots geometry (khad-geometry-v1), kept for the
 * ?khad-compare view and as the structural-rule baseline. Do not edit. */
type Point = { x:number; y:number };
type Random = () => number;
const point = (p:Point) => `${p.x.toFixed(2)} ${p.y.toFixed(2)}`;

function seeded(id:string):Random {
  let seed=2166136261;
  for(const c of id) seed=Math.imul(seed^c.charCodeAt(0),16777619);
  return ()=>{ seed^=seed<<13; seed^=seed>>>17; seed^=seed<<5; return (seed>>>0)/4294967296; };
}

/** Shared centerline keeps the wood, thorn shoulders and group joins connected. */
function sampleRoute(nodes:Point[]):Point[] {
  const samples:Point[]=[];
  for(let i=0;i<nodes.length-1;i++) {
    const p0=nodes[Math.max(0,i-1)],p1=nodes[i],p2=nodes[i+1],p3=nodes[Math.min(nodes.length-1,i+2)];
    const steps=Math.max(4,Math.ceil(Math.hypot(p2.x-p1.x,p2.y-p1.y)/2));
    for(let n=0;n<steps;n++) {
      const t=n/steps,t2=t*t,t3=t2*t;
      const coord=(key:'x'|'y')=>.5*((2*p1[key])+(-p0[key]+p2[key])*t+(2*p0[key]-5*p1[key]+4*p2[key]-p3[key])*t2+(-p0[key]+3*p1[key]-3*p2[key]+p3[key])*t3);
      samples.push({x:coord('x'),y:coord('y')});
    }
  }
  return [...samples,nodes[nodes.length-1]];
}

/** Filled tapered wood replaces constant-width luminous bands. */
function growStem(samples:Point[],random:Random,radius:number,spacing:number,cardClearance:boolean) {
  const left:Point[]=[],right:Point[]=[],thorns:string[]=[],scars:string[]=[],ridges:string[]=[],moonEdges:string[]=[];
  let distance=0,nextThorn=7+random()*6;
  samples.forEach((p,i)=>{
    const prior=samples[Math.max(0,i-1)],next=samples[Math.min(samples.length-1,i+1)];
    const length=Math.hypot(next.x-prior.x,next.y-prior.y)||1;
    const tx=(next.x-prior.x)/length,ty=(next.y-prior.y)/length,nx=-ty,ny=tx;
    const t=i/(samples.length-1);
    const taper=Math.min(1,.12+t*8,.06+(1-t)*9);
    // Broad horizontal trunks carry the painted vine's weight; upright shoots
    // stay slimmer. Squared tangent weighting blends girth smoothly at bends.
    const girth=1.2+.75*tx*tx;
    const width=radius*girth*taper*(.85+.17*Math.sin(i*.39)+.1*Math.sin(i*.91));
    left.push({x:p.x+nx*width,y:p.y+ny*width});
    right.push({x:p.x-nx*width,y:p.y-ny*width});
    distance+=Math.hypot(p.x-prior.x,p.y-prior.y);
    if(i>2 && i<samples.length-3 && distance>=nextThorn) {
      nextThorn=distance+spacing*(.75+random()*.6);
      // Point away from the value window so the hooks survive clearance.
      const preferred=p.x<20?{x:-1,y:-.2}:p.x>80?{x:1,y:-.2}:{x:0,y:p.y<39?-1:p.y>120&&random()>.55?-1:1};
      const side=cardClearance?(nx*preferred.x+ny*preferred.y>=0?1:-1):(random()>.5?1:-1);
      const ox=nx*side,oy=ny*side;
      const height=10+random()*9,base=2.8+random()*2.2,hook=(4+random()*5)*(random()>.5?1:-1);
      const tip={x:p.x+ox*height+tx*hook,y:p.y+oy*height+ty*hook};
      const a={x:p.x-tx*base,y:p.y-ty*base},b={x:p.x+tx*base,y:p.y+ty*base};
      thorns.push(`M${point(a)} Q${p.x+ox*height*.4-tx*base} ${p.y+oy*height*.4-ty*base} ${point(tip)} Q${p.x+ox*height*.18+tx*base} ${p.y+oy*height*.18+ty*base} ${point(b)} Z`);
    }
    // Only upward-facing bark catches moonlight; underside stays dark.
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
    center:`M${samples.map(point).join(' L')}`,thorns,scars,ridges,moonEdges };
}

/** Stable per-card growth, independent of rank, render order and animation time. */
export function khadRootGeometry(cardId:string,obscureValue=false) {
  const random=seeded(cardId),between=(a:number,b:number)=>a+(b-a)*random();
  const leftTop=between(43,76),rightTop=between(46,85);
  const leftY=between(108,125),rightY=between(103,125);
  const routes:Point[][]=[
    [{x:between(-3,10),y:leftTop},{x:between(-6,4),y:leftTop+15},
      {x:between(3,10),y:94},{x:between(-5,3),y:leftY},
      {x:between(24,38),y:between(113,124)},{x:between(61,79),y:between(126,135)},
      {x:96,y:rightY},{x:between(99,108),y:between(81,95)},
      {x:between(90,99),y:rightTop},{x:between(96,105),y:rightTop-7}],
    [{x:between(-9,0),y:between(123,137)},{x:between(18,34),y:between(114,129)},
      {x:between(62,77),y:between(111,126)},{x:between(99,105),y:between(119,133)},
      {x:between(85,98),y:between(139,147)}],
  ];
  // Opposing curls across the crown break the old one-way wind silhouette.
  routes.push([{x:-3,y:between(67,83)},{x:8,y:between(24,34)},
    {x:between(24,37),y:between(2,10)},{x:between(48,62),y:between(-4,5)},
    {x:between(72,85),y:between(10,22)},{x:104,y:between(42,59)}]);
  if(obscureValue)routes.push([{x:-2,y:98},{x:27,y:67},{x:52,y:78},{x:78,y:59},{x:103,y:77}]);
  const stems=routes.map((route,i)=>growStem(sampleRoute(route),random,i===0?3.5:i===2?2.7:2.2,i===0?10:13,true));
  return { stems,strands:stems.map(s=>s.center),thorns:stems.flatMap(s=>s.thorns),anchor:{x:96,y:rightY},
    motes:Array.from({length:7},(_,i)=>({x:i%2?between(96,106):between(-5,5),y:between(55,130),r:between(1.6,2.8),delay:-between(0,6)})) };
}

/** Group links use the same tapered thorn-bearing wood as the card wraps. */
export function khadBridgeGeometry(a:Point,b:Point,id:string) {
  const random=seeded(id),side=random()>.5?1:-1;
  const bow1=(a.x+b.x)/2+side*(18+random()*20),bow2=(a.x+b.x)/2-side*(10+random()*18);
  const samples=Array.from({length:61},(_,i)=>{
    const t=i/60,u=1-t;
    return {x:u*u*u*a.x+3*u*u*t*bow1+3*u*t*t*bow2+t*t*t*b.x,
      y:u*u*u*a.y+3*u*u*t*(a.y-18)+3*u*t*t*(b.y+22)+t*t*t*b.y};
  });
  return growStem(samples,random,2.8,13,false);
}
