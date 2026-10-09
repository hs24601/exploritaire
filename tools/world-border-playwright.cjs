// The clear 15x15 area around True Center is open; everything outside it is
// black impassable terrain that actors can't enter, that table lights never
// reach, and that still follows the sun and moon.
const {chromium}=require('playwright');const assert=require('node:assert/strict');
const setHours=(p,h)=>p.evaluate(h=>{const i=document.querySelector('[aria-label="Table time of day"]');const set=Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set;set.call(i,String(h));i.dispatchEvent(new Event('input',{bubbles:true}));},h);
(async()=>{const b=await chromium.launch({headless:true});try{
  const p=await (await b.newContext({viewport:{width:1912,height:914}})).newPage();
  await p.goto('http://localhost:5178/proto.html');await p.waitForTimeout(500);
  const origin=await p.locator('.table-grid-origin').boundingBox();const cell=origin.width;
  const at=(column,row)=>({x:origin.x+cell/2+column*cell,y:origin.y+cell/2+row*cell});
  // The open square is 15 cells across, framed on all four sides.
  const east=await p.locator('[data-blocked-region="blocked-east"]').boundingBox(),west=await p.locator('[data-blocked-region="blocked-west"]').boundingBox();
  assert.ok(Math.abs((east.x-(west.x+west.width))/cell-15)<0.05,`clear area is 15 cells wide (${((east.x-(west.x+west.width))/cell).toFixed(2)})`);
  for(const id of ['north','south','east','west'])assert.equal(await p.locator(`[data-blocked-region="blocked-${id}"]`).count(),1,`${id} terrain present`);
  const actor=p.locator('[data-board-piece="actor"]');
  const drag=async(to)=>{const a=await actor.boundingBox();await p.mouse.move(a.x+a.width/2,a.y+a.height/2);await p.mouse.down();await p.mouse.move(to.x,to.y,{steps:12});await p.mouse.up();await p.waitForTimeout(1600);const r=await actor.boundingBox();return {x:r.x+r.width/2,y:r.y+r.height/2};};
  // Step onto the outermost open cell, then try the blocked cell beyond it.
  let pos=await drag(at(7,1));
  assert.ok(Math.abs(pos.x-at(7,1).x)<cell/2,'the actor can stand on the outermost open cell');
  pos=await drag(at(8,1));
  assert.ok(pos.x<east.x,'the actor never enters impassable terrain');
  assert.equal(await p.getByText('No clear route').count(),1,'a blocked destination says so');
  // At night the Hero's candle lights the open edge cell but not the terrain beside it.
  await setHours(p,23);await p.waitForTimeout(500);
  const sample=async(point)=>p.evaluate(({x,y})=>{const c=document.querySelector('.proto-table-light canvas')||document.querySelector('canvas');const r=c.getBoundingClientRect();const ctx=c.getContext('2d');const px=ctx.getImageData(Math.floor((x-r.left)*c.width/r.width),Math.floor((y-r.top)*c.height/r.height),1,1).data;return [...px];},point);
  const near=await sample({x:east.x+cell*0.5,y:at(7,1).y}),far=await sample({x:east.x+cell*0.5,y:at(7,-2).y}),lit=await sample(at(7,1));
  assert.ok(near.every((v,i)=>Math.abs(v-far[i])<=6),`terrain beside the candle gets only sky light (${near} vs ${far} away from it)`);
  assert.ok(lit[0]>near[0]+10,`the open cell under the candle is lit (${lit} vs ${near})`);
  // Terrain bevels follow the sun and moon.
  const sky=async()=>Number(await p.locator('[data-blocked-region="blocked-east"]').evaluate(el=>el.style.getPropertyValue('--terrain-sky')));
  const night=await sky();await setHours(p,12);await p.waitForTimeout(300);const day=await sky();
  assert.ok(day>night,`terrain catches more sky light by day (${day} vs ${night})`);
  console.log(`World border: 15x15 open area, actors stop at the edge, table light stays off terrain (terrain ${near} beside the candle, ${far} away; open cell ${lit}), sky light ${night}→${day}.`);
}finally{await b.close()}})().catch(e=>{console.error(e);process.exitCode=1});
