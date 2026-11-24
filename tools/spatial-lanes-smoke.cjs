const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
(async()=>{
 const browser=await chromium.launch({headless:true,executablePath:'C:/Users/ericm/AppData/Local/ms-playwright/chromium-1208/chrome-win64/chrome.exe'});
 try {
  const page=await browser.newPage({viewport:{width:1440,height:1000}});
  const errors=[];page.on('pageerror',e=>errors.push(e.stack));
  await page.addInitScript(()=>Object.defineProperty(navigator,'clipboard',{value:{writeText:async text=>{window.copiedCamera=text;}}}));
  await page.goto((process.env.PROTO_URL??'http://127.0.0.1:5202/proto.html')+'?combatsbx&scenario=1000');
  await page.locator('.battle-spatial-lane').first().waitFor();
  assert.equal(await page.locator('.battle-spatial-lane').count(),3);
  assert.equal(await page.locator('.battle-spatial-lane [data-battle-card]').count(),18);
  assert.equal(await page.locator('[data-lane="enemy-rear"] button:not(:disabled)').count(),0);
  const gaps=await page.locator('[data-lane="frontier"] [data-battle-card]').evaluateAll(nodes=>nodes.slice(1).map((node,i)=>node.getBoundingClientRect().left-nodes[i].getBoundingClientRect().right));
  assert.ok(gaps.every(gap=>gap>=0&&gap<=10),'columns remain compactly adjacent');
  const layers=await page.evaluate(()=>{
   const hero=document.querySelector('[data-battle-actor="hero"]').getBoundingClientRect();
   const foe=document.querySelector('.battle-foe').getBoundingClientRect();
   const overlap=(a,b)=>Math.min(a.right,b.right)>Math.max(a.left,b.left)?Math.max(0,Math.min(a.bottom,b.bottom)-Math.max(a.top,b.top))/a.height:0;
   const ratios=['enemy-rear','frontier','party-rear'].map(lane=>Math.max(...Array.from(document.querySelectorAll('[data-lane="'+lane+'"] [data-battle-card]')).map(card=>overlap(card.getBoundingClientRect(),lane==='enemy-rear'?foe:hero))));
   const card=Array.from(document.querySelectorAll('[data-lane="frontier"] [data-battle-card]')).find(card=>overlap(card.getBoundingClientRect(),hero)>0);
   const r=card.getBoundingClientRect(),x=(Math.max(r.left,hero.left)+Math.min(r.right,hero.right))/2,y=(Math.max(r.top,hero.top)+Math.min(r.bottom,hero.bottom))/2;
   return {ratios,foundationOwnsOverlap:!!document.elementFromPoint(x,y)?.closest('[data-battle-actor="hero"]')};
  });
  assert.ok(layers.ratios.every(ratio=>ratio>.28&&ratio<.36),'one-third card underlap on all three lanes');
  assert.ok(layers.foundationOwnsOverlap,'foundation receives input above underlapping cards');
  fs.mkdirSync('artifacts/spatial-lanes',{recursive:true});
  await page.mouse.move(3,3);
  await page.screenshot({path:'artifacts/spatial-lanes/1440.png'});
  for (const [width,height] of [[1280,720],[1977,914]]) {
   await page.setViewportSize({width,height});await page.waitForTimeout(250);
   const boxes=await page.locator('.battle-spatial-lane [data-battle-card], .battle-field__team').evaluateAll(nodes=>nodes.map(node=>{const r=node.getBoundingClientRect();return {x:r.x,y:r.y,right:r.right,bottom:r.bottom,width:r.width,height:r.height};}));
   assert.ok(boxes.every(r=>r.width>0&&r.height>0&&r.x>=0&&r.y>=0&&r.right<=width+1&&r.bottom<=height+1),'pieces fit viewport');
   await page.screenshot({path:`artifacts/spatial-lanes/${width}.png`});
  }
  const legal=page.locator('[data-lane="frontier"] button:not(:disabled),[data-lane="party-rear"] button:not(:disabled)').first();
  if(await legal.count()) {
   const id=await legal.getAttribute('data-battle-card');
   const cell=await legal.evaluate(node=>({lane:node.closest('[data-lane]').dataset.lane,column:Array.from(node.closest('.battle-field__rack').children).filter(el=>el.classList.contains('battle-field__column')).indexOf(node.closest('.battle-field__column'))}));
   const rearBefore=await page.locator('[data-lane="party-rear"] [data-battle-card]').nth(cell.column).getAttribute('data-battle-card');
   const enemyBefore=await page.locator('[data-lane="enemy-rear"] [data-battle-card]').nth(cell.column).getAttribute('data-battle-card');
   await legal.click();await page.mouse.move(3,3);
   await page.waitForFunction(id=>!document.querySelector(`[data-battle-card="${id}"]`),id);
   assert.equal(await page.locator('.battle-spatial-lane [data-battle-card]').count(),18);
   if(cell.lane==='frontier')assert.equal(await page.locator('[data-lane="frontier"] [data-battle-card]').nth(cell.column).getAttribute('data-battle-card'),rearBefore,'party rear flows into the frontier');
   assert.equal(await page.locator('[data-lane="enemy-rear"] [data-battle-card]').nth(cell.column).getAttribute('data-battle-card'),enemyBefore,'opposing rear stays intact');
  }
  await page.locator('.battle-end-turn').click();await page.mouse.move(3,3);
  await page.locator('.battle-intent-slot').waitFor();
  await page.waitForFunction(()=>document.querySelector('.battle-field')?.getAttribute('data-team-turn')==='party');
  await page.locator('.battle-withdraw-button').click();await page.mouse.move(3,3);
  await page.waitForFunction(()=>document.querySelector('.battle-field')?.getAttribute('data-team-turn')==='party');
  assert.equal(await page.locator('.battle-spatial-lane [data-battle-card]').count(),18);
  await page.getByRole('button',{name:'Load battle camera',exact:true}).click();
  await page.locator('[data-scene-target="hero"]:not([hidden])').waitFor({timeout:60000});
  const clear=await page.locator('.battle-spatial-lane [data-battle-card]').evaluateAll(nodes=>{const note=document.querySelector('.scenario-notes').getBoundingClientRect();return nodes.every(node=>{const r=node.getBoundingClientRect();return Math.min(r.right,note.right)-Math.max(r.left,note.left)<=0 || Math.min(r.bottom,note.bottom)-Math.max(r.top,note.top)<=0;});});
  assert.ok(clear,'scenario notes do not obscure lane cards');
  await page.getByRole('button',{name:'Copy camera data',exact:true}).click();
  const cue=JSON.parse(await page.evaluate(()=>window.copiedCamera));assert.ok(cue);
  await page.screenshot({path:'artifacts/spatial-lanes/camera.png'});
  assert.deepEqual(errors,[]);
  console.log('PASS: 3 lanes/18 cards, enemy rear locked, inward backfill, enemy turn, Withdraw, viewport sizes');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exit(1)});

