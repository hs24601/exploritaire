// Tableau foundation assembly: inside the foundation border, the energy bubble
// and card count stack left of the actor card; resources are listed underneath.
const {chromium}=require('playwright');const assert=require('node:assert/strict');const {findLayoutDefects}=require('./lib/layout-check.cjs');
const PARTS={minFontSize:0,parts:'.proto-actor-energy, .proto-foundation-card--exploration, .proto-foundation-count-token, .proto-occupied-foundation-face, .proto-foundation-resources, .proto-foundation-resources > li'};
(async()=>{const b=await chromium.launch({headless:true});const problems=[];try{
  for(const [w,h] of [[1912,914],[1280,720],[390,844],[844,390]]){
    const p=await b.newPage({viewport:{width:w,height:h}});await p.goto('http://localhost:5179/proto.html');await p.waitForTimeout(500);
    if(w<900)await p.getByRole('button',{name:'Table',exact:true}).click();
    const a=await p.locator('[data-board-piece="actor"]').boundingBox(),t=await p.locator('[data-biome-id="woods-alpha"]').boundingBox();await p.mouse.move(a.x+a.width/2,a.y+a.height/2);await p.mouse.down();await p.mouse.move(t.x+t.width/2,t.y+t.height/2,{steps:15});await p.mouse.up();
    await p.locator('.proto-actor-energy').waitFor({state:'attached',timeout:15000});if(w<900){await p.getByRole('button',{name:'Tableau',exact:true}).click();}await p.waitForTimeout(400);
    assert.equal(await p.locator('.proto-foundation-count-token--resources').count(),0,'the resources count token is gone');
    assert.equal(await p.locator('.proto-foundation-card--exploration .proto-foundation-count-token').count(),1,'the card count lives inside the foundation');
    assert.match(await p.locator('.proto-actor-energy').getAttribute('aria-label'),/energy \d+ of \d+/);
    assert.equal(await p.locator('.proto-foundation-card--exploration .proto-actor-energy').count(),1,'the energy bubble lives inside the foundation');
    const e=await p.locator('.proto-actor-energy').boundingBox(),c=await p.locator('.proto-foundation-count-token').boundingBox(),actor=await p.locator('.proto-foundation-card--exploration .proto-occupied-foundation-face').boundingBox(),f=await p.locator('.proto-foundation-card--exploration').boundingBox(),r=await p.locator('.proto-foundation-resources').boundingBox();
    assert.ok(e.x+e.width<=actor.x+1&&c.x+c.width<=actor.x+1,`${w}x${h} energy and card count sit left of the actor card`);assert.ok(c.y>=e.y+e.height-1,`${w}x${h} card count sits beneath the energy bubble`);
    assert.ok(r.y>=f.y+f.height-1,`${w}x${h} resources sit beneath the foundation`);
    // New pieces honor the 16px floor (older labels in this panel are tracked separately).
    for(const sel of ['.proto-actor-energy','.proto-foundation-count-token','.proto-foundation-resources > li']){const size=await p.locator(sel).first().evaluate(el=>parseFloat(getComputedStyle(el).fontSize));assert.ok(size>=16,`${w}x${h} ${sel} text is ${size}px`);}
    const at=(label,list)=>list.forEach(d=>problems.push(`${w}x${h} ${label}: ${d}`));
    at('foundation',await findLayoutDefects(p,'.proto-main-foundations',PARTS));
    // Worst case: two-digit counts for every resource and cards.
    await p.evaluate(()=>{document.querySelectorAll('.proto-foundation-resources > li').forEach(li=>{li.dataset.count='12';li.lastElementChild.textContent='12';});document.querySelector('.proto-foundation-count-token').lastElementChild.textContent='24';document.querySelector('.proto-actor-energy').lastElementChild.textContent='15';});
    at('foundation, large counts',await findLayoutDefects(p,'.proto-main-foundations',PARTS));
    if(process.env.SHOTS)await p.locator('.proto-main-foundations').screenshot({path:`${process.env.SHOTS}/foundation-${w}x${h}.png`});
    await p.close();
  }
  assert.deepEqual(problems,[],'layout defects:\n'+problems.join('\n'));
  console.log('Foundation assembly: energy bubble, inner card count and resource summary fit without collisions at desktop and phone sizes.');
}finally{await b.close()}})().catch(e=>{console.error(e.message);process.exitCode=1});
