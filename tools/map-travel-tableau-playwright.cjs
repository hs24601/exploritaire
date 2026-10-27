const {chromium}=require('playwright');const assert=require('node:assert/strict');const fs=require('fs');const {findLayoutDefects}=require('./lib/layout-check.cjs');
(async()=>{const browser=await chromium.launch({headless:true});fs.mkdirSync('artifacts/world-travel',{recursive:true});try{
for(const [width,height] of [[1280,720],[1912,914]]){
 const context=await browser.newContext({viewport:{width,height},hasTouch:width===1912,deviceScaleFactor:1});const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://localhost:5178/proto.html');await page.waitForTimeout(1200);
 if(width===1912){await page.getByRole('button',{name:'Game settings',exact:true}).click();for(const name of ['Glacia','Jimothy']){await page.getByRole('button',{name:'Add playtest companion',exact:true}).click();await page.getByRole('button',{name:'Join Hero · '+name,exact:true}).click();}await page.getByRole('button',{name:'Game settings',exact:true}).click();}
 const a=await page.locator('[data-cell-grip="actor-hero"]').boundingBox(),b=await page.locator('[data-board-piece="tile"][data-tile-type="berry-patch"]').boundingBox();await page.mouse.move(a.x+a.width/2,a.y+a.height/2);await page.mouse.down();await page.mouse.move(b.x+b.width/2,b.y+b.height/2,{steps:12});await page.mouse.up();await page.getByRole('button',{name:'Confirm travel',exact:true}).click();await page.waitForTimeout(5000);
 assert.equal(await page.locator('[data-physical-world] [data-travel-world]').count(),1);assert.equal(await page.locator('[data-world-column]').count(),7);assert.equal(await page.locator('[data-exposed="true"]').count(),7);assert.equal(await page.locator('.travel-tableau--world .playing-card').count(),0,'no tableau cards in HUD');
 assert.equal(await page.locator('[data-world-card]:not([data-exposed="true"]) button:enabled').count(),0);
 const hiddenRanks=await page.locator('[data-exposed="true"]').evaluateAll(cards=>cards.filter(card=>{
 const rank=card.querySelector('.proto-card-center-rank'),r=rank.getBoundingClientRect(),hit=document.elementFromPoint(r.x+r.width/2,r.y+r.height/2);
 return hit?.closest('[data-world-card]')!==card;
 }).map(card=>card.dataset.worldCard));assert.deepEqual(hiddenRanks,[],'exposed ranks stay visible and hit-testable in the cinematic shot');
 const coords=()=>page.locator('.travel-world-station').evaluateAll(els=>els.map(el=>[el.dataset.worldX,el.dataset.worldY,el.dataset.worldHeading,el.style.transform]));
 const before=await coords(),box=await page.locator('.travel-world-station').first().boundingBox();await page.waitForTimeout(750);assert.deepEqual(await coords(),before,'sweep does not move world stations');
 await page.getByRole('button',{name:'Pause journey',exact:true}).click();await page.keyboard.press('KeyE');await page.waitForTimeout(750);assert.deepEqual(await coords(),before,'manual orbit does not move or billboard stations');assert.notDeepEqual(await page.locator('.travel-world-station').first().boundingBox(),box,'perspective follows the real camera');await page.keyboard.press('KeyQ');await page.waitForTimeout(750);
 await page.getByRole('button',{name:'Resume journey',exact:true}).click();
 const card=page.locator('[data-exposed="true"] button:enabled').first();assert(await card.count());if(width===1912)await card.tap();else await card.click();await page.waitForTimeout(250);assert.match(await page.locator('.travel-summary').textContent(),/1\/15/);
 const next=page.locator('[data-exposed="true"] button:enabled').first();await next.focus();await page.keyboard.press('Enter');await page.waitForTimeout(250);assert.match(await page.locator('.travel-summary').textContent(),/2\/15/);
 const defects=await findLayoutDefects(page,'.travel-tableau--world',{parts:'.travel-world-hud,.travel-actor-popup,.travel-foundation,.travel-toolbar,.actor-holocard .trading-card__header h2',minFontSize:16});assert.deepEqual(defects,[]);
 await page.screenshot({path:`artifacts/world-travel/${width}-night.png`});
 await page.getByRole('button',{name:'Game settings',exact:true}).click();await page.getByRole('checkbox',{name:'Map tableau (test)',exact:true}).uncheck();await page.locator('.proto-tableau-field .travel-tableau').waitFor({state:'visible'});assert.equal(await page.locator('[data-travel-world]').count(),0);await page.getByRole('checkbox',{name:'Map tableau (test)',exact:true}).check();await page.getByRole('button',{name:'Game settings',exact:true}).click();await page.locator('[data-travel-world]').waitFor({state:'attached'});
 await page.getByRole('button',{name:'Auto-Solve',exact:true}).click();await page.locator('[data-travel-world]').waitFor({state:'detached',timeout:30000});assert.deepEqual(errors,[]);console.log('PASS',width,'world anchors, perspective, seven columns, mouse/touch/keyboard play, HUD layout, toggle and arrival');await context.close();
}
}finally{await browser.close()}})().catch(e=>{console.error(e);process.exit(1)});
