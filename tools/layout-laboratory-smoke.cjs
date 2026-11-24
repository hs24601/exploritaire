const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const fs=require('node:fs');
(async()=>{
 const browser=await chromium.launch({headless:true,executablePath:'C:/Users/ericm/AppData/Local/ms-playwright/chromium-1208/chrome-win64/chrome.exe'});
 try {
  const page=await browser.newPage({viewport:{width:1600,height:1000}}),errors=[];
  page.on('pageerror',e=>errors.push(e.stack));
  await page.goto((process.env.PROTO_URL??'http://127.0.0.1:5202/proto.html')+'?combatsbx&scenario=1001');
  await page.getByRole('tab',{name:'Two-deep reach',exact:true}).waitFor();
  fs.mkdirSync('artifacts/layout-laboratory',{recursive:true});
  let original;
  for(const name of ['Two-deep reach','Reach by position','Fanned stacks','Contested frontier','Reserve hand','Rotating rows']) {
   await page.getByRole('tab',{name,exact:true}).click();
   await page.mouse.move(3,3);await page.waitForTimeout(200);
   assert.equal(await page.getByRole('tab',{name,exact:true}).getAttribute('aria-selected'),'true');
   const cards=await page.locator('.battle-spatial-lane [data-battle-card]').evaluateAll(nodes=>nodes.map(node=>[node.dataset.battleCard,node.dataset.battleRank]).sort());
   if(!original)original=cards;else assert.deepEqual(cards,original,'same opening cards in '+name);
   if(name==='Reach by position'){
    await page.getByRole('button',{name:'1 column →',exact:true}).click();
    assert.ok((await page.locator('.layout-position-controls').textContent()).includes('Hero column 4'));
   }
   if(name==='Fanned stacks') {
    const lower=page.locator('[data-battle-depth="1"][data-battle-rank="1"]');
    const point=await lower.evaluate(el=>{const r=el.getBoundingClientRect();for(let y=r.top+3;y<r.bottom;y+=3)for(let x=r.left+3;x<r.right;x+=3){const hit=document.elementFromPoint(x,y);if(hit&&(hit===el||el.contains(hit)))return {x,y};}return null;});
    assert.ok(point,'lower fanned card has an exposed click area');
    await page.mouse.click(point.x,point.y);await page.mouse.move(3,3);
    await page.waitForFunction(()=>document.querySelector('[data-battle-slot="hero"] .battle-foundation__value')?.textContent==='A');
    assert.equal(await page.locator('[data-battle-slot="hero"] .battle-foundation__ap-pips i[data-on]').count(),3);
   }
   if(name==='Reserve hand'){
    assert.equal(await page.locator('.layout-reserve button').count(),3);
    await page.locator('.layout-reserve button:not(:disabled)').first().click();await page.mouse.move(3,3);
    assert.equal(await page.locator('.layout-reserve button').count(),2);
    await page.locator('.battle-end-turn').click();await page.mouse.move(3,3);
    await page.waitForFunction(()=>document.querySelector('.battle-field')?.getAttribute('data-team-turn')==='party');
    assert.equal(await page.locator('.layout-reserve button').count(),3);
   }
   if(name==='Rotating rows'){
    const before=await page.locator('[data-lane="party-rear"] [data-battle-card]').evaluateAll(nodes=>nodes.map(node=>node.dataset.battleCard));
    await page.locator('.battle-end-turn').click();await page.mouse.move(3,3);
    const after=await page.locator('[data-lane="frontier"] [data-battle-card]').evaluateAll(nodes=>nodes.map(node=>node.dataset.battleCard));
    assert.deepEqual(after,before,'party rear visibly becomes frontier');
   }
   await page.screenshot({path:'artifacts/layout-laboratory/'+name.toLowerCase().replaceAll(' ','-')+'.png'});
  }
  await page.getByRole('tab',{name:'Contested frontier',exact:true}).click();
  await page.setViewportSize({width:1280,height:720});await page.waitForTimeout(200);
  const visible=await page.getByRole('tab').evaluateAll(nodes=>nodes.every(node=>{const r=node.getBoundingClientRect();return r.left>=0&&r.top>=0&&r.right<=innerWidth&&r.bottom<=innerHeight;}));
  assert.ok(visible,'tabs fit the viewport');
  await page.screenshot({path:'artifacts/layout-laboratory/1280.png'});
  await page.getByRole('tab',{name:'Two-deep reach',exact:true}).focus();await page.keyboard.press('ArrowRight');
  assert.equal(await page.getByRole('tab',{name:'Reach by position',exact:true}).getAttribute('aria-selected'),'true');
  assert.deepEqual(errors,[]);
  console.log('PASS: six tabs, identical deals, movement, reserve hand, viewport and keyboard tab switching');
 } finally {await browser.close();}
})().catch(e=>{console.error(e);process.exit(1)});
