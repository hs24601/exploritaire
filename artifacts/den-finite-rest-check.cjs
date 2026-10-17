const { chromium } = require('playwright');
const assert = require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch();
 try{
  for(const [width,height] of [[1912,914],[1280,720],[390,844],[844,390]]){
   const page=await browser.newPage({viewport:{width,height},hasTouch:width<900});
   const errors=[];page.on('pageerror',e=>errors.push(e.message));
   await page.addInitScript(()=>{let seed=123456;Math.random=()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296;};});
   await page.goto('http://localhost:5178/proto.html');
   await page.getByLabel('Den rest status').waitFor();
   assert.match(await page.getByLabel('Den rest status').textContent(),/STA 0\/6/);
   assert.equal(await page.locator('[data-foundation-index]').count(),1);
   assert.equal(await page.locator('.actor-holocard__rank-bubble').count(),0);
   assert.equal(await page.locator('.proto-tableau-stage .playing-card').count(),30);
   assert.equal(await page.locator('.proto-tableau-stage [data-component="tableau"] > div').count(),6);
   assert.equal(await page.locator('.proto-tableau-stage .playing-card:not([data-buried])').count(),6);
   const receiver=page.locator('.proto-rest-receiver');
   assert.match(await receiver.getAttribute('aria-label'),/^Receiving card (A|[2-9]|10|J|Q|K) · Draw stock · 21 cards remaining$/);
   await page.screenshot({path:`artifacts/den-finite-initial-${width}.png`});
   if(width<900)await receiver.tap();else{await receiver.focus();await page.keyboard.press('Enter');}
   await page.waitForFunction(()=>document.querySelector('.proto-rest-stock')?.textContent.includes('Stock 20'));
   assert.match(await page.getByLabel('Den rest status').textContent(),/STA 0\/6/);
   const playable=page.locator('.proto-tableau-stage .playing-card:not([data-buried]):not(:disabled)');
   let drawn=0;
   while(!await playable.count()&&drawn<20){if(width<900)await receiver.tap();else await receiver.click();drawn++;}
   assert.ok(await playable.count()>0);
   const card=playable.first();
   const rank=await card.locator('.proto-card-rank').textContent();
   if(width<900)await card.tap();else await card.click();
   await page.waitForFunction(()=>document.querySelector('[aria-label="Den rest status"]')?.textContent.includes('STA 1/6'));
   assert.equal(await page.locator('.proto-tableau-stage .playing-card').count(),29);
   assert.equal((await receiver.locator('span').first().textContent()).trim(),rank.trim());
   assert.deepEqual(errors,[]);
   const overflow=await page.evaluate(()=>({x:document.documentElement.scrollWidth>innerWidth,y:document.documentElement.scrollHeight>innerHeight}));assert.deepEqual(overflow,{x:false,y:false});
   const clip=await receiver.evaluate(el=>{const r=el.getBoundingClientRect(),p=el.closest('.proto-main-foundations').getBoundingClientRect();return r.left<p.left||r.right>p.right||r.top<p.top||r.bottom>p.bottom;});assert.equal(clip,false);
   await page.screenshot({path:`artifacts/den-finite-rest-${width}.png`});
   console.log(width,height,'revealed receiver, no Hero rank, stock draw, finite play, stamina, no clipping/errors');
   await page.close();
  }
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
