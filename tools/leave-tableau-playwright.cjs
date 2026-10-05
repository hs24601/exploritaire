// Quest rewards reach the actors (energy and actor stamina), and Leave Tableau
// steps the actor out onto a table cell touching the biome tile.
const {chromium}=require('playwright');const assert=require('node:assert/strict');
(async()=>{const b=await chromium.launch({headless:true});try{
  const p=await (await b.newContext({viewport:{width:1912,height:914}})).newPage();
  await p.goto('http://localhost:5179/proto.html');
  const a=await p.locator('[data-board-piece="actor"]').boundingBox(),t=await p.locator('[data-biome-id="woods-alpha"]').boundingBox();
  await p.mouse.move(a.x+a.width/2,a.y+a.height/2);await p.mouse.down();await p.mouse.move(t.x+t.width/2,t.y+t.height/2,{steps:15});await p.mouse.up();
  const card=p.locator('[data-table-quest="0"]');await card.waitFor({timeout:20000});await p.waitForTimeout(1200);
  const energy=async()=>Number(await p.locator('.proto-actor-energy').first().innerText().then(s=>s.replace(/\D/g,'')));
  const before=await energy();
  const c=await card.boundingBox();await p.mouse.move(c.x+c.width/2,c.y+c.height/2);await p.mouse.down();await p.waitForTimeout(2300);await p.mouse.up();
  assert.equal(await p.locator('.quest-field').getAttribute('data-redeemed'),'1','the first quest redeems');
  assert.equal(await energy(),before+1,'the quest reward adds energy the actor can spend');
  await p.getByRole('button',{name:'Leave Tableau'}).click();await p.waitForTimeout(400);
  const cell=(await p.locator('.table-grid-origin').boundingBox()).width;
  const tile=await p.locator('[data-biome-id="woods-alpha"]').boundingBox();
  const base=await p.locator('[data-board-piece="actor"]').boundingBox();
  const x=base.x+base.width/2,y=base.y+base.height/2;
  const dx=Math.max(tile.x-x,0,x-(tile.x+tile.width)),dy=Math.max(tile.y-y,0,y-(tile.y+tile.height));
  const gap=Math.hypot(dx,dy);
  assert.ok(gap>0,'the actor stands off the tile, not on it');
  assert.ok(gap<=cell*0.75,`the actor stands on a cell touching the tile (gap ${gap.toFixed(1)}px, cell ${cell.toFixed(1)}px)`);
  console.log(`Leave Tableau: actor ${gap.toFixed(0)}px from the tile edge (one cell is ${cell.toFixed(0)}px); quest reward added energy ${before}→${before+1}.`);
}finally{await b.close()}})().catch(e=>{console.error(e);process.exitCode=1});
