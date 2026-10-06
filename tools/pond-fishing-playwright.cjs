// Pond fishing (Go Fish for one): the Hero walks to the pond, casts bait cards,
// the fourth fish caught is the glowfish, the catch reaches the supplies when the
// Hero leaves, a glowfish on the table glows, and eating it raises max stamina
// and the Hero's light until the day ends.
const {chromium}=require('playwright');const assert=require('node:assert/strict');const {findLayoutDefects}=require('./lib/layout-check.cjs');
// Cast like a player: a fish a nibble showed, else bait whose ripple size has the most hidden fish.
const pickBait=page=>page.evaluate(()=>{
  const hand=[...document.querySelectorAll('.proto-pond__bait')].map(el=>({rank:+el.dataset.baitRank,missed:!!el.dataset.missed}));
  const water=[...document.querySelectorAll('.proto-pond__fish')].map(el=>({ripple:el.dataset.ripple,rank:el.dataset.revealed?el.querySelector('.proto-pond__rank').textContent:null}));
  const label=r=>({1:'A',11:'J',12:'Q',13:'K'}[r]??String(r)),size=r=>r<=4?'small':r<=9?'medium':'large';
  const score=c=>c.missed?-1:water.some(f=>f.rank===label(c.rank))?10:water.filter(f=>!f.rank&&f.ripple===size(c.rank)).length/(size(c.rank)==='medium'?5:4);
  return hand.map((c,i)=>({i,s:score(c)})).sort((x,y)=>y.s-x.s)[0].i;
});
const seeded=()=>{let s=20261006;Math.random=()=>{s=(s*16807)%2147483647;return s/2147483647;};};
(async()=>{const b=await chromium.launch({headless:true});try{
  const p=await (await b.newContext({viewport:{width:1912,height:914}})).newPage();
  await p.addInitScript(seeded);
  await p.goto('http://localhost:5179/proto.html');
  const stamina=async()=>{const m=(await p.locator('body').innerText()).match(/STAMINA (\d+)\/(\d+)/);return {now:+m[1],max:+m[2]};};
  const before=await stamina();
  const drag=async(from,to)=>{const a=await from.boundingBox(),t=await to.boundingBox();await p.mouse.move(a.x+a.width/2,a.y+a.height/2);await p.mouse.down();await p.mouse.move(t.x+t.width/2,t.y+t.height/2,{steps:15});await p.mouse.up();};
  await drag(p.locator('[data-board-piece="actor"]'),p.locator('[data-biome-id="pond"]'));
  await p.locator('.proto-pond[data-angler]').waitFor({timeout:15000});
  assert.equal((await stamina()).now,before.now,'walking to the pond costs no stamina');
  assert.equal(await p.locator('.proto-pond__fish').count(),6,'six fish ripple in the water');
  assert.equal(await p.locator('.proto-pond__bait').count(),4,'the angler holds four bait cards');
  const landed=async()=>{const m=(await p.locator('.proto-pond__header [aria-label^="Landed"]').getAttribute('aria-label')).match(/Landed (\d+) fish and (\d+) glowfish/);return {fish:+m[1],glow:+m[2]};};
  let casts=0,sawGlowMessage=false;
  while((await p.locator('.proto-pond__bait button:not([disabled])').count())>0){
    const pick=await pickBait(p);
    const was=await landed();
    await p.locator('.proto-pond__bait').nth(pick).locator('button').click();casts++;
    const now=await landed();const total=now.fish+now.glow;
    assert.equal(now.glow,total>=4?1:0,`after ${total} catches there is ${total>=4?'one glowfish':'no glowfish yet'}`);
    if(now.glow>was.glow){const msg=await p.locator('.proto-pond__message').innerText();assert.match(msg,/glowfish/i,'the catch says it is a glowfish');sawGlowMessage=true;}
    if(total>=4)break;
  }
  assert.ok(sawGlowMessage,`the glowfish was caught within ${casts} casts`);
  const caught=await landed();
  await p.getByRole('button',{name:'Leave Pond'}).click();await p.waitForTimeout(600);
  assert.equal(await p.locator('.proto-pond[data-angler]').count(),0,'the Hero has left the pond');
  assert.equal(Number(await p.locator('[data-supply="fish"]').getAttribute('data-count')),caught.fish,'caught fish reach the supplies');
  assert.equal(Number(await p.locator('[data-supply="glowfish"]').getAttribute('data-count')),1,'the glowfish reaches the supplies');
  // At midnight a glowfish on the table lights its spot; a plain fish does not.
  await p.evaluate(()=>{const i=document.querySelector('[aria-label="Table time of day"]');Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(i,'0');i.dispatchEvent(new Event('input',{bubbles:true}));});
  await p.waitForTimeout(400);
  for(const id of ['glowfish','fish']){await p.locator(`[data-supply="${id}"]`).click();await p.getByRole('button',{name:'Place 1 on table'}).click();await p.keyboard.press('Escape');await p.waitForTimeout(300);}
  const glowLight=Number(await p.locator('[data-board-piece="resource"][data-resource="glowfish"]').getAttribute('data-light-percent'));
  const fishLight=Number(await p.locator('[data-board-piece="resource"][data-resource="fish"]').getAttribute('data-light-percent'));
  assert.ok(glowLight>=30,`the glowfish lights its spot to at least dim (${glowLight}%)`);
  assert.ok(glowLight>fishLight,`the glowfish is brighter than a plain fish (${glowLight}% vs ${fishLight}%)`);
  const heroLightBefore=Number(await p.locator('[data-board-piece="actor"]').getAttribute('data-light-percent'));
  const fed=await stamina();
  await drag(p.locator('[data-board-piece="resource"][data-resource="glowfish"]'),p.locator('[data-board-piece="actor"]'));
  await p.waitForTimeout(500);
  assert.equal(await p.locator('[data-board-piece="resource"][data-resource="glowfish"]').count(),0,'the glowfish is eaten');
  const glowing=await stamina();
  assert.equal(glowing.max,fed.max+2,'eating the glowfish raises max stamina by 2');
  assert.equal(glowing.now,Math.min(glowing.max,fed.now+3),'and restores 3 stamina');
  const heroLight=Number(await p.locator('[data-board-piece="actor"]').getAttribute('data-light-percent'));
  assert.ok(heroLight>heroLightBefore+15,`the Hero glows brighter (${heroLightBefore}% → ${heroLight}%)`);
  console.log(`Pond: glowfish on catch 4 after ${casts} casts (${caught.fish} fish); glowfish on the table ${glowLight}% light vs fish ${fishLight}%; eating it took stamina ${fed.now}/${fed.max} → ${glowing.now}/${glowing.max} and the Hero's light ${heroLightBefore}% → ${heroLight}%.`);
  // The pond panel fits at desktop and phone sizes, wide and tall.
  const PARTS='.proto-pond__header, .proto-pond__header > span, .proto-pond__water, .proto-pond__fish, .proto-pond__message, .proto-pond__hand, .proto-pond__bait, .proto-pond__bait button, .proto-pond__footer, .proto-pond__legend, .proto-pond__leave';
  const defects=[];
  for(const [w,h] of [[1912,914],[1280,720],[390,844],[844,390]]){
    // Phone landscape shows only a sliver of the table (the Hero is cut off too), so
    // that size walks to the pond in portrait and then turns the phone.
    const landscape=w>h&&h<500,[sw,sh]=landscape?[h,w]:[w,h];
    const q=await (await b.newContext({viewport:{width:sw,height:sh}})).newPage();await q.addInitScript(seeded);await q.goto('http://localhost:5179/proto.html');
    if(sw<900)await q.getByRole('button',{name:'Table',exact:true}).click();
    const pond=await q.locator('[data-biome-id="pond"]').boundingBox(),view=await q.locator('.proto-map-viewport').boundingBox();
    if(!pond||pond.x<view.x||pond.x+pond.width>view.x+view.width||pond.y<view.y||pond.y+pond.height>view.y+view.height)defects.push(`${sw}x${sh}: the pond is not in the starting view`);
    const a=await q.locator('[data-board-piece="actor"]').boundingBox();await q.mouse.move(a.x+a.width/2,a.y+a.height/2);await q.mouse.down();await q.mouse.move(pond.x+pond.width/2,pond.y+pond.height/2,{steps:15});await q.mouse.up();
    await q.locator('.proto-pond[data-angler]').waitFor({timeout:15000});
    if(landscape){await q.setViewportSize({width:w,height:h});await q.waitForTimeout(300);}
    await q.locator('.proto-pond__bait button').first().click();await q.mouse.move(2,2);await q.waitForTimeout(300);
    for(const d of await findLayoutDefects(q,'.proto-pond',{parts:PARTS}))defects.push(`${w}x${h}: ${d}`);
    const water=await q.locator('.proto-pond__water').boundingBox();
    for(const f of await q.locator('.proto-pond__fish').all()){const r=await f.boundingBox();
      if(Math.abs(r.width-r.height)>1)defects.push(`${w}x${h}: a ripple is not round (${r.width.toFixed(0)}x${r.height.toFixed(0)})`);
      // Inside the pond's oval bank, not just its bounding box.
      const nx=(Math.max(Math.abs(r.x-water.x-water.width/2),Math.abs(r.x+r.width-water.x-water.width/2)))/(water.width/2),ny=(Math.max(Math.abs(r.y-water.y-water.height/2),Math.abs(r.y+r.height-water.y-water.height/2)))/(water.height/2);
      if(nx>1||ny>1)defects.push(`${w}x${h}: a ripple leaves the water`);}
    // Fish the day out, go home, and check the supplies tray with the catch in it.
    while((await q.locator('.proto-pond__bait button:not([disabled])').count())>0)await q.locator('.proto-pond__bait').nth(await pickBait(q)).locator('button').click();
    await q.getByRole('button',{name:'Leave Pond'}).click();await q.waitForTimeout(800);
    if(w<900)await q.getByRole('button',{name:'Supplies',exact:true}).click();
    if(!(await q.locator('[data-supply="glowfish"]').count()))defects.push(`${w}x${h}: no glowfish in the supplies after a day's fishing`);
    for(const d of await findLayoutDefects(q,'.supply-tray',{parts:'.supply-tray__toggle, .supply-tray__well, .supply-row, .supply-row__token, .supply-row__count',cornerInset:12}))defects.push(`${w}x${h} supplies: ${d}`);
    await q.context().close();
  }
  assert.deepEqual(defects,[],'pond layout defects:\n'+defects.join('\n'));
  console.log('Pond panel and the supplies tray holding the catch: no collisions, overflow or small text at 1912x914, 1280x720, 390x844 and 844x390; ripples stay round and inside the water.');
}finally{await b.close()}})().catch(e=>{console.error(e);process.exitCode=1});
