const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const { findLayoutDefects } = require('./lib/layout-check.cjs');
const fs = require('node:fs');
const url = 'http://localhost:5178/proto.html';
(async()=>{
 fs.mkdirSync('artifacts/travel-journey',{recursive:true});
 const browser=await chromium.launch({headless:true});
 try {
  for(const [width,height,touch] of [[1280,720,false],[390,844,true],[844,390,true]]) {
   const context=await browser.newContext({viewport:{width,height},hasTouch:touch,deviceScaleFactor:3});
   const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
   await page.goto(url);await page.waitForTimeout(1500);
   await page.getByRole('checkbox',{name:'Follow traveling actor'}).uncheck();
   if(height<500){await page.mouse.move(width-120,200);await page.mouse.down();await page.mouse.move(width-120,110,{steps:8});await page.mouse.up();}
   const actor=page.locator('[data-cell-grip="actor-hero"]');const berry=page.locator('[data-board-piece="tile"][data-tile-type="berry-patch"]');
   const a=await actor.boundingBox();const b=await berry.boundingBox(); assert(a&&b,'actor and berry visible');
   const from={x:a.x+a.width/2,y:a.y+a.height/2},to={x:b.x+b.width/2,y:b.y+b.height/2};
   await page.screenshot({path:`artifacts/travel-journey/map-${width}.png`});
   if(touch){const c=await context.newCDPSession(page);await c.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[from]});for(let i=1;i<=12;i++)await c.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:from.x+(to.x-from.x)*i/12,y:from.y+(to.y-from.y)*i/12}]});await c.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await c.detach();}
   else {await page.mouse.move(from.x,from.y);await page.mouse.down();await page.mouse.move(to.x,to.y,{steps:12});await page.mouse.up();}
   await page.getByRole('group',{name:'Travel destination',exact:true}).waitFor();
   assert.equal(await page.locator('.travel-confirm').count(),0);
   assert.deepEqual(await findLayoutDefects(page,'.travel-target-actions',{parts:'.travel-target-summary,.travel-target-buttons,button'}),[]);
   await page.locator('.travel-target-actions').screenshot({path:`artifacts/travel-journey/target-${width}-3x.png`});
   await page.getByRole('button',{name:'Confirm travel',exact:true}).click();
   if(touch) {const tab=page.getByRole('button',{name:'Tableau',exact:true});if(await tab.count())await tab.click();}
   const field=page.getByRole('region',{name:'Travel tableau'});await field.waitFor({state:'visible'});
   await field.locator('[data-actor-holocard="hero"]').waitFor();assert.equal(await field.getByRole('img',{name:'Hero foundation rank 2',exact:true}).count(),1);
   await field.getByRole('button',{name:'Inspect Hero',exact:true}).click();await page.keyboard.press('Escape');await field.waitFor({state:'visible'});
   await page.getByRole('button',{name:'Pause journey',exact:true}).click();assert.equal(await page.locator('.travel-card-grid button:enabled').count(),0);await page.getByRole('button',{name:'Resume journey',exact:true}).click();
   await field.screenshot({path:`artifacts/travel-journey/tableau-${width}-3x.png`});
   assert.deepEqual(await findLayoutDefects(page,'.travel-tableau',{parts:'.travel-summary,p,.travel-card-grid,.travel-receiver,button,.travel-foundation'}),[]);
   const total=Number((await field.locator('strong').textContent()).match(/\/(\d+)/)[1]);
   for(let i=0;i<total;i++){const legal=page.locator('.travel-card-grid button:enabled').first();const playedRank=(await legal.locator('.proto-card-rank').textContent()).trim();await legal.click();if(i<total-1)assert.equal((await field.locator('.actor-holocard__rank-bubble').textContent()).trim(),playedRank,'actor foundation rank follows the played card');if(i===total-6){await page.getByText('7 card streak bonus: 3 berries',{exact:true}).waitFor();const before=await page.locator('[data-discovery-tile][data-traversal-progress]:not([data-traversal-progress="0"])').evaluateAll(nodes=>nodes.map(n=>n.getAttribute('data-traversal-progress')));await page.waitForTimeout(900);assert.deepEqual(await page.locator('[data-discovery-tile][data-traversal-progress]:not([data-traversal-progress="0"])').evaluateAll(nodes=>nodes.map(n=>n.getAttribute('data-traversal-progress'))),before,'waiting does not fill tile');await field.screenshot({path:`artifacts/travel-journey/combo-${width}-3x.png`});}}
   await page.waitForTimeout(1800);assert.equal(await field.count(),0,'arrival ends journey');assert.deepEqual(errors,[]);
   console.log('PASS travel journey',width,height,touch);await context.close();
  }
 } finally {await browser.close();}
})().catch(e=>{console.error(e);process.exit(1)});
