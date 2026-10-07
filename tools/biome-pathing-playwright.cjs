const {chromium}=require('playwright');const assert=require('node:assert/strict');
// Biome flags and pathing. Every biome starts unexplored: a tap on one opens
// no tableau, only a note that an actor has to go there first. Routes are the
// fastest legal ones on the grid: never through an unexplored biome (or the
// terrain), diagonal where open, never cutting a blocked corner. Dragging the
// Hero previews the route as a line on the table that follows those cells;
// the Hero walks it, the line shrinks behind it and is gone on arrival. The
// screenshot case: from beside the pond to a cell beyond it. Desktop sizes,
// flat and tilted, at 0 and 90 degrees.
const URL=process.env.PROTO_URL||'http://localhost:5178/proto.html';
const CELL=48;
const centre=r=>({x:r.x+r.width/2,y:r.y+r.height/2});
const rect=(p,sel)=>p.evaluate(s=>{const e=document.querySelector(s);if(!e)return null;const r=e.getBoundingClientRect();return {x:r.x,y:r.y,width:r.width,height:r.height};},sel);
const cellOf=ref=>ref.split(':')[1].split(',').map(Number);
// The starting layout's unexplored biomes, which no route may cross.
const FOG=new Set(['-1,-1','0,-1','1,-1']);
/** The fastest legal route time (in cells) by Dijkstra, 8-way, no corner
 * cutting, over the clear 15x15 table less the fog; start and goal allowed. */
const fastest=(from,to)=>{
  const open=(c,r)=>(c===from[0]&&r===from[1])||(c===to[0]&&r===to[1])||(Math.abs(c)<=7&&Math.abs(r)<=7&&!FOG.has(`${c},${r}`));
  const dist=new Map([[from.join(','),0]]);const queue=[[0,...from]];
  while(queue.length){queue.sort((a,b)=>a[0]-b[0]);const [d,c,r]=queue.shift();if(c===to[0]&&r===to[1])return d;if(d>(dist.get(`${c},${r}`)??Infinity))continue;
    for(let dx=-1;dx<=1;dx++)for(let dy=-1;dy<=1;dy++){if(!dx&&!dy)continue;const nc=c+dx,nr=r+dy;if(!open(nc,nr))continue;if(dx&&dy&&(!open(c+dx,r)||!open(c,r+dy)))continue;
      const nd=d+(dx&&dy?Math.SQRT2:1);if(nd<(dist.get(`${nc},${nr}`)??Infinity)){dist.set(`${nc},${nr}`,nd);queue.push([nd,nc,nr]);}}}
  return Infinity;};
/** Route points (table px) from the drawn line, and its drawn length. */
const routeOf=p=>p.evaluate(()=>{const svg=document.querySelector('[data-route-line]');if(!svg)return null;
  const points=svg.dataset.routePoints.split(' ').map(s=>s.split(',').map(Number));
  // The line's box starts 12 table px before its leftmost and topmost points (RouteLine).
  const path=svg.querySelector('.proto-route__dash');const box={x:Math.min(...points.map(q=>q[0]))-12,y:Math.min(...points.map(q=>q[1]))-12};
  const total=path.getTotalLength();const samples=[];for(let i=0;i<=40;i++){const q=path.getPointAtLength(total*i/40);samples.push([q.x+box.x,q.y+box.y]);}
  return {points,samples,total,masks:svg.querySelectorAll('mask polygon').length};});
(async()=>{const b=await chromium.launch({headless:true});const problems=[];try{
  for(const [w,h] of [[1912,914],[1280,720]])for(const view of ['flat','tilt'])for(const yaw of [0,90]){
    const tag=`${w}x${h} ${view} ${yaw}°`;
    const p=await b.newPage({viewport:{width:w,height:h}});const errors=[];p.on('pageerror',e=>errors.push(e.message));await p.goto(URL);await p.waitForTimeout(500);
    if(view==='tilt'){await p.getByRole('button',{name:'Tilt camera view'}).click();await p.waitForTimeout(1200);}
    if(yaw){await p.keyboard.press('e');await p.waitForTimeout(450);await p.keyboard.press('e');await p.waitForTimeout(600);}
    // A tap on an unexplored biome opens no tableau, just the note.
    if(yaw===0){
      for(const id of ['pond','woods-alpha']){
        const tile=p.locator(`button[data-biome-id="${id}"]`);
        if((await tile.locator('.board-object-label__text').textContent())!=='???')problems.push(`${tag}: unexplored ${id} shows its name`);
        await tile.click({position:{x:6,y:6},force:true});await p.waitForTimeout(200);
        if(await p.locator('.proto-tableau-field:not(.hidden)').count())problems.push(`${tag}: tapping unexplored ${id} opened its tableau`);
        const note=p.locator('.biome-closed-note');if(!(await note.count())||!/Unexplored/.test(await note.textContent()))problems.push(`${tag}: no unexplored note for ${id}`);
        await p.keyboard.press('Escape');await p.waitForTimeout(100);
      }
    }
    // The screenshot case: from the Hero's square to a cell beyond the pond.
    const heroRef=await p.locator('[data-board-piece="actor"]').getAttribute('data-grid-reference');const from=cellOf(heroRef);
    const origin=centre(await rect(p,'.table-grid-origin')),square=centre(await rect(p,'[data-cell-grip^="actor-"]'));
    const H={x:square.x-origin.x,y:square.y-origin.y};
    // Steps per row (ey) and per column (ex): a column step is the row step turned a quarter.
    const ey={x:H.x/from[1],y:H.y/from[1]};const flat=view==='flat';
    const ex=flat?{x:ey.y,y:-ey.x}:null;
    let screenOf;
    if(ex)screenOf=(c,r)=>({x:origin.x+c*ex.x+r*ey.x,y:origin.y+c*ex.y+r*ey.y});
    else{const pond=centre(await rect(p,'button[data-biome-id="pond"]'));const P={x:pond.x-origin.x,y:pond.y-origin.y};
      // Pond at (-1,-1): P = -ex - ey.
      const exT={x:-P.x-ey.x,y:-P.y-ey.y};screenOf=(c,r)=>({x:origin.x+c*exT.x+r*ey.x,y:origin.y+c*exT.y+r*ey.y});}
    // Beyond the pond, beside it as the camera sees it (a cell behind its
    // reeds would count as the pond).
    const goal=yaw?[-1,-2]:[-2,-1];const at=screenOf(...goal);
    await p.mouse.move(square.x+4,square.y+10);await p.mouse.down();for(let i=1;i<=14;i++){await p.mouse.move(square.x+4+(at.x-square.x-4)*i/14,square.y+10+(at.y-square.y-10)*i/14);await p.waitForTimeout(16);}
    await p.waitForTimeout(150);
    const cue=await p.locator('[data-cell-cue]').getAttribute('data-cell-cue').catch(()=>null);
    if(cue!==`table:${goal[0]},${goal[1]}`){problems.push(`${tag}: aimed at table:${goal[0]},${goal[1]}, the cue is on ${cue}`);await p.mouse.up();await p.close();continue;}
    const preview=await routeOf(p);
    if(!preview)problems.push(`${tag}: no route line while dragging`);
    else{
      // Never through fog; as fast as the fastest legal route.
      const cells=new Set();for(let i=1;i<preview.points.length;i++)for(let t=0;t<=1;t+=0.02){const x=preview.points[i-1][0]+(preview.points[i][0]-preview.points[i-1][0])*t,y=preview.points[i-1][1]+(preview.points[i][1]-preview.points[i-1][1])*t;
        const fx=((x/CELL+0.5)%1+1)%1,fy=((y/CELL+0.5)%1+1)%1;if((fx<0.03||fx>0.97)&&(fy<0.03||fy>0.97))continue;cells.add(`${Math.floor(x/CELL+0.5)},${Math.floor(y/CELL+0.5)}`);}
      const through=[...cells].filter(c=>FOG.has(c));if(through.length)problems.push(`${tag}: the route crosses unexplored ${through.join(' ')}`);
      let time=0;for(let i=1;i<preview.points.length;i++)time+=Math.hypot(preview.points[i][0]-preview.points[i-1][0],preview.points[i][1]-preview.points[i-1][1])/CELL;
      const best=fastest(from,goal);if(Math.abs(time-best)>0.02)problems.push(`${tag}: the route takes ${time.toFixed(2)} cells, the fastest is ${best.toFixed(2)}`);
      // The drawn line follows the route (rounded corners stay near it).
      const off=preview.samples.map(([x,y])=>Math.min(...preview.points.slice(1).map((q,i)=>{const a=preview.points[i];const dx=q[0]-a[0],dy=q[1]-a[1];const t=Math.max(0,Math.min(1,((x-a[0])*dx+(y-a[1])*dy)/(dx*dx+dy*dy||1)));return Math.hypot(x-a[0]-t*dx,y-a[1]-t*dy);})));
      if(Math.max(...off)>8)problems.push(`${tag}: the drawn line strays ${Math.max(...off).toFixed(1)}px from the route`);
      if(!preview.masks)problems.push(`${tag}: the line isn't cut out under the tile labels`);
    }
    await p.mouse.up();await p.waitForTimeout(250);
    const walking=await routeOf(p);
    if(!walking||!preview||!(walking.total<preview.total))problems.push(`${tag}: the line didn't shrink as the Hero set off (${preview?.total?.toFixed(0)}→${walking?.total?.toFixed(0)})`);
    await p.waitForTimeout(2200);
    if(await p.locator('[data-route-line]').count())problems.push(`${tag}: the line is still there after arrival`);
    const arrived=await p.locator('[data-board-piece="actor"]').getAttribute('data-grid-reference');
    if(arrived!==`table:${goal[0]},${goal[1]}`)problems.push(`${tag}: the Hero ended on ${arrived}`);
    // And back to its starting square.
    const sq=centre(await rect(p,'[data-cell-grip^="actor-"]'));const home=screenOf(...from);
    await p.mouse.move(sq.x+4,sq.y+10);await p.mouse.down();for(let i=1;i<=14;i++){await p.mouse.move(sq.x+4+(home.x-sq.x-4)*i/14,sq.y+10+(home.y-sq.y-10)*i/14);await p.waitForTimeout(16);}await p.mouse.up();await p.waitForTimeout(2600);
    const back=await p.locator('[data-board-piece="actor"]').getAttribute('data-grid-reference');if(back!==heroRef)problems.push(`${tag}: the Hero couldn't walk back to ${heroRef} (on ${back})`);
    if(errors.length)problems.push(`${tag}: page errors ${errors.join('; ')}`);
    await p.close();
  }
  assert.deepEqual(problems,[],'pathing defects:\n'+problems.join('\n'));
  console.log('Biome pathing: unexplored biomes stay closed with a note, routes are the fastest legal ones and never cross unexplored ground, the line follows the route, shrinks as the Hero walks and is gone on arrival, and the Hero walks back to its start; flat and tilted, 0 and 90 degrees, 1912x914 and 1280x720.');
}finally{await b.close()}})().catch(e=>{console.error(e.message);process.exitCode=1});
