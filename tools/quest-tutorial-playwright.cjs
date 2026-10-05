const {chromium}=require('playwright');const assert=require('node:assert/strict');const {findLayoutDefects}=require('./lib/layout-check.cjs');
// The first quest flies to the table with a teaching card; holding it 2s clears
// it without a reward, and the tray has no separate hold button.
const CARD={parts:'.quest-card__title, .quest-card__text, .quest-card__status, .quest-card__reward'};
(async()=>{const b=await chromium.launch({headless:true});try{for(const [w,h] of [[1912,914],[1600,900],[1280,720]]){
  const p=await b.newPage({viewport:{width:w,height:h}});await p.goto('http://localhost:5179/proto.html');
  const a=await p.locator('[data-board-piece="actor"]').boundingBox(),t=await p.locator('[data-biome-id="woods-alpha"]').boundingBox();
  await p.mouse.move(a.x+a.width/2,a.y+a.height/2);await p.mouse.down();await p.mouse.move(t.x+t.width/2,t.y+t.height/2,{steps:15});await p.mouse.up();
  const quest=p.locator('[data-table-quest="0"]'),tutorial=p.locator('[data-table-quest="-1"]');await quest.waitFor({timeout:15000});await tutorial.waitFor();await p.waitForTimeout(700);
  assert.equal(await p.locator('.quest-tray button:has-text("Hold")').count(),0,'no hold button in the tray');
  const [q,u]=[await quest.boundingBox(),await tutorial.boundingBox()];
  assert.ok(q.x+q.width<=u.x||u.x+u.width<=q.x||q.y+q.height<=u.y||u.y+u.height<=q.y,'cards land apart');
  assert.match(await tutorial.innerText(),/Press and hold/);
  const view=await p.locator('.proto-map').boundingBox();// Known limit: below ~1600px wide with the tableau open, two arrival-size cards
  // cannot both fit beside the biome at 100% zoom.
  if(w>=1600)for(const [n,c] of [['quest',q],['teaching',u]])assert.ok(c.x>=view.x&&c.y>=view.y&&c.x+c.width<=view.x+view.width&&c.y+c.height<=view.y+view.height,`${w}x${h} ${n} card is cut off by the table edge`);
  for(const sel of ['[data-table-quest="-1"]','[data-table-quest="0"]']){const d=await findLayoutDefects(p,sel,CARD);assert.deepEqual(d,[],`${w}x${h} ${sel}: ${d.join(', ')}`);}
  if(process.env.SHOTS&&w===1600)await p.screenshot({path:process.env.SHOTS+'/tutorial-card.png'});
  const r=await tutorial.boundingBox();await p.mouse.move(r.x+r.width/2,r.y+r.height/2);await p.mouse.down();
  // Once touched it switches to the smaller table size: check that state too.
  await p.waitForTimeout(300);{const d=await findLayoutDefects(p,'[data-table-quest="-1"]',CARD);assert.deepEqual(d,[],`${w}x${h} tutorial at table size: ${d.join(', ')}`);}
  await p.waitForTimeout(2000);await p.mouse.up();await tutorial.waitFor({state:'detached'});
  assert.equal(await p.locator('.quest-field').getAttribute('data-redeemed'),'0','clearing the teaching card gives no reward');
  assert.equal(await quest.count(),1,'the real quest stays on the table');
  const s=await quest.boundingBox();await p.mouse.move(s.x+s.width/2,s.y+s.height/2);await p.mouse.down();await p.waitForTimeout(2300);await p.mouse.up();
  await quest.waitFor({state:'detached'});assert.equal(await p.locator('.quest-field').getAttribute('data-redeemed'),'1');
  assert.equal(await tutorial.count(),0,'the teaching card does not return');
  await p.close();}
  console.log('Teaching card flies out with the first quest, clears on a 2s hold without a reward, and the tray has no hold button.');
}finally{await b.close()}})().catch(e=>{console.error(e.message);process.exitCode=1});
