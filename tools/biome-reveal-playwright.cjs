const {chromium}=require('playwright');const assert=require('node:assert/strict');
// Exploration reveal. At the start every biome is unexplored: its label reads
// "???" and its props (pop-up, edge scenery, flat board) are all silhouette.
// An actor arriving at the pond explores it fully: its props go to full
// colour. Arriving at Small Woods gives a first look (10%); solving its
// tableau colours in that share of each prop behind a slanted edge (about
// half at 50%). Desktop sizes; tilted at 0 and 90 degrees, and flat.
const URL=process.env.PROTO_URL||'http://localhost:5178/proto.html';
const centre=r=>({x:r.x+r.width/2,y:r.y+r.height/2});
const props=(p,id)=>p.evaluate(id=>[...document.querySelectorAll(`[data-biome-popup="${id}"], [data-biome-edge="${id}"]`)].map(e=>{const r=e.querySelector('.proto-reveal');return r?Number(r.dataset.reveal):1;}),id);
/** Drag the Hero onto a tile and wait until it's there. */
const visit=async(p,id)=>{const a=await p.locator('[data-board-piece="actor"]').boundingBox(),t=centre(await p.locator(`button[data-biome-id="${id}"]`).boundingBox());
  await p.mouse.move(a.x+a.width/2,a.y+a.height/2);await p.mouse.down();await p.mouse.move(t.x,t.y,{steps:16});await p.mouse.up();
  await p.waitForFunction(id=>!document.querySelector(`button[data-biome-id="${id}"]`).dataset.unexplored,id,{timeout:15000});await p.waitForTimeout(1300);};
const leave=async p=>{const exit=p.getByRole('button',{name:/^Exit tableau/}).first();if(await exit.count()){await exit.click();await p.waitForTimeout(2200);}else{const leaveButton=p.getByRole('button',{name:/Leave/}).first();if(await leaveButton.count()){await leaveButton.click();await p.waitForTimeout(2200);}}};
(async()=>{const b=await chromium.launch({headless:true});const problems=[];try{
  for(const [w,h] of [[1912,914],[1280,720]])for(const [view,yaw] of [['tilt',0],['tilt',90],['flat',0]]){
    const tag=`${w}x${h} ${view} ${yaw}°`;
    const p=await b.newPage({viewport:{width:w,height:h}});await p.goto(URL);await p.waitForTimeout(500);
    if(view==='tilt'){await p.getByRole('button',{name:'Tilt camera view'}).click();await p.waitForTimeout(1200);}
    if(yaw){await p.keyboard.press('e');await p.waitForTimeout(450);await p.keyboard.press('e');await p.waitForTimeout(600);}
    // Everything starts unexplored and silhouetted.
    for(const id of ['pond','woods-alpha','woods-east','woods-danger']){
      const tile=p.locator(`button[data-biome-id="${id}"]`);
      if(await tile.getAttribute('data-explored')!=='0.00')problems.push(`${tag}: ${id} starts ${await tile.getAttribute('data-explored')} explored`);
      if((await tile.locator('.board-object-label__text').textContent())!=='???')problems.push(`${tag}: ${id} shows its name before anyone has been there`);
      const shown=await props(p,id);if(!shown.length)problems.push(`${tag}: ${id} has no props to check`);
      if(shown.some(v=>v!==0))problems.push(`${tag}: ${id} props aren't all silhouette (${shown.join(',')})`);
    }
    // The pond is fully explored on arrival.
    await visit(p,'pond');
    if(await p.locator('button[data-biome-id="pond"]').getAttribute('data-explored')!=='1.00')problems.push(`${tag}: the pond isn't fully explored on arrival`);
    const pond=await props(p,'pond');if(pond.some(v=>v!==1))problems.push(`${tag}: the pond's props aren't in full colour (${pond.join(',')})`);
    if((await p.locator('button[data-biome-id="pond"] .board-object-label__text').textContent())==='???')problems.push(`${tag}: the pond still reads ??? after a visit`);
    await leave(p);
    // Small Woods: a first look, then half its tableau gives half its colour.
    await visit(p,'woods-alpha');
    const first=Number(await p.locator('button[data-biome-id="woods-alpha"]').getAttribute('data-explored'));
    if(Math.abs(first-0.1)>0.02)problems.push(`${tag}: Small Woods is ${first} explored on arrival, not 0.10`);
    await p.getByLabel('Divine Intervention').check().catch(()=>{});
    const explored=()=>p.locator('button[data-biome-id="woods-alpha"]').getAttribute('data-explored').then(Number);
    for(let i=0;i<40&&await explored()<0.5;i++){await p.getByRole('button',{name:'Best Move'}).click();await p.waitForTimeout(400);}
    await p.waitForTimeout(1100);
    const half=await explored();const woods=await props(p,'woods-alpha');
    if(!(half>=0.5&&half<0.9))problems.push(`${tag}: Small Woods didn't reach about half explored (${half})`);
    if(woods.some(v=>Math.abs(v-half)>0.011))problems.push(`${tag}: Small Woods props don't show ${half} in colour (${woods.join(',')})`);
    // The coloured share sits behind a slanted, stepped edge mid-box.
    const edge=await p.evaluate(()=>{const lit=document.querySelector('[data-biome-popup="woods-alpha"] .proto-reveal__lit, [data-biome-edge="woods-alpha"] .proto-reveal__lit');if(!lit)return null;const s=getComputedStyle(lit);return {image:(s.maskImage||s.webkitMaskImage).length,position:s.maskPosition||s.webkitMaskPosition};});
    if(!edge||edge.image<50)problems.push(`${tag}: no slanted reveal edge on the Small Woods props`);
    await p.close();
  }
  assert.deepEqual(problems,[],'reveal defects:\n'+problems.join('\n'));
  console.log('Biome reveal: every biome starts unexplored with ??? and silhouette props; the pond goes to full colour on arrival; Small Woods gets a 10% first look and its props colour in by the explored share behind a slanted edge; tilted at 0 and 90 degrees and flat, 1912x914 and 1280x720.');
}finally{await b.close()}})().catch(e=>{console.error(e.message);process.exitCode=1});
