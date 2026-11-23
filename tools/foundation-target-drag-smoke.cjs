const { chromium } = require('playwright');
const assert = require('node:assert/strict');
(async()=>{const browser=await chromium.launch({headless:true});try{
 const page=await browser.newPage({viewport:{width:1500,height:900}});const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://127.0.0.1:5178/proto.html?combatsbx&scenario=101',{waitUntil:'domcontentloaded'});
 const hero=page.locator('[data-battle-actor="hero"]'),foes=page.locator('.battle-foe');await hero.waitFor({timeout:60000});await foes.nth(1).waitFor();
 const start=await hero.boundingBox(), end=await foes.nth(1).boundingBox();assert.ok(start&&end);
 const from={x:start.x+30,y:start.y+start.height/2},to={x:end.x+end.width/2,y:end.y+end.height/2};
 await page.mouse.move(from.x,from.y);await page.mouse.down();await page.mouse.move(from.x,from.y-12);await page.locator('.battle-target-ghost').waitFor();
 await page.mouse.move(to.x,to.y,{steps:30});await page.waitForTimeout(80);
 const ghost=await page.locator('.battle-target-ghost').boundingBox();assert.ok(ghost && Math.abs(ghost.x+ghost.width/2-to.x)<12 && Math.abs(ghost.y+ghost.height/2-to.y)<12);
 assert.equal(await page.locator('.battle-field').getAttribute('data-target-drag'),await foes.nth(1).getAttribute('data-battle-target'));
 await page.mouse.up();await page.waitForTimeout(100);
 assert.equal(await page.locator('.battle-target-ghost').count(),0);assert.equal(await page.locator('.battle-field').getAttribute('data-target-drag'),null);
 assert.match(await foes.nth(1).getAttribute('aria-label'),/Targeted by Hero/);assert.deepEqual(errors,[]);console.log('Drag ghost follows pointer and assigns second Mote; no page errors.');
 }finally{await browser.close()}})().catch(e=>{console.error(e);process.exitCode=1});
