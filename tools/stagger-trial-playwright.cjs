const {chromium}=require('playwright');const fs=require('fs');const assert=require('node:assert/strict');
(async()=>{fs.mkdirSync('artifacts/combat-turns',{recursive:true});const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'});try{
for(const [width,height] of [[1280,800],[390,844],[844,740]]){
 const page=await browser.newPage({viewport:{width,height},reducedMotion:width===390?'reduce':'no-preference'});const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.addInitScript(()=>{let calls=0;Math.random=()=>{calls++;return calls%2?.65:calls/10000;};});
 await page.goto('http://127.0.0.1:5178/proto.html?combatsbx');await page.waitForSelector('.battle-end-turn');
 assert.equal(await page.locator('.battle-field').getAttribute('data-team-turn'),'party');
 assert.equal(await page.locator('.combat-sandbox__header').count(),0);
 assert.equal(await page.getByText('Turn-based combat',{exact:true}).count(),0);
 const solverBounds=await page.getByRole('button',{name:'Auto-Solve',exact:true}).boundingBox();
 assert.ok(solverBounds.x<40 && solverBounds.y>height-100,'solver controls are lower left');
 assert.equal(await page.locator('.battle-field__rack .battle-field__column button').count(),28);
 assert.equal(await page.locator('.slime-inspection,.slime-consumption,.slime-inspection__eye').count(),0);
 assert.equal(await page.locator('.battle-target-arrows > path').count(),2);
 const hp=await page.locator('.battle-vitals [data-bar="hp"]').evaluateAll(els=>els.map(el=>el.getAttribute('aria-valuenow')));
 await page.waitForTimeout(1200);assert.deepEqual(await page.locator('.battle-vitals [data-bar="hp"]').evaluateAll(els=>els.map(el=>el.getAttribute('aria-valuenow'))),hp);
 assert.equal(await page.getByRole('button',{name:'END TURN',exact:true}).isEnabled(),true);
 await page.screenshot({path:`artifacts/combat-turns/${width}-player.png`});
 await page.getByRole('button',{name:'END TURN',exact:true}).click();
 assert.equal(await page.locator('.battle-field').getAttribute('data-team-turn'),'enemy');assert.equal(await page.getByRole('button',{name:'END TURN',exact:true}).isDisabled(),true);
 assert.equal(await page.locator('[data-redraw-actor]').count(),0);assert.equal(await page.locator('.battle-field__slot > .battle-target-link').count(),0);assert.equal(await page.getByRole('button',{name:'Best Move',exact:true}).isDisabled(),true);
 await page.waitForTimeout(250);assert.deepEqual(await page.locator('.battle-vitals [data-bar="hp"]').evaluateAll(els=>els.map(el=>el.getAttribute('aria-valuenow'))),hp);
 await page.screenshot({path:`artifacts/combat-turns/${width}-enemy.png`});
 await page.getByRole('button',{name:'Restart',exact:true}).click();assert.equal(await page.locator('.battle-field').getAttribute('data-team-turn'),'party');assert.deepEqual(errors,[]);
 console.log(width,'blocked-tableau END TURN, enemy input lock, no timed attacks, restart OK');await page.close();
}
const page=await browser.newPage({viewport:{width:1280,height:800}});await page.addInitScript(()=>{let seed=5150;Math.random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};});
await page.goto('http://127.0.0.1:5178/proto.html?combatsbx');await page.waitForSelector('.battle-end-turn');assert.equal(await page.getByRole('button',{name:'END TURN',exact:true}).isDisabled(),true);
const card=page.locator('.battle-field__column button:not([data-gameplay-disabled])').first();await card.click();const choosing=page.locator('[data-battle-actor][data-targetable="true"]');if(await choosing.count())await choosing.first().click();
assert.equal(await page.locator('.battle-foe [data-bar="hp"]').getAttribute('aria-valuenow'),'49');assert.equal(await page.locator('.battle-field').getAttribute('data-team-turn'),'party');console.log('legal player sequence retains automatic default hit and blocks early END TURN');
await page.close();
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exit(1)});
