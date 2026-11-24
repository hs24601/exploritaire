const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
(async () => {
 fs.mkdirSync('artifacts/party-system', {recursive:true});
 const browser = await chromium.launch({headless:true});
 try {
 for (const [width,height] of [[1280,720],[390,844]]) {
  const context = await browser.newContext({viewport:{width,height},hasTouch:width<500});
  const page = await context.newPage(); const errors=[]; page.on('pageerror',e=>errors.push(e.message));
  await page.goto('http://localhost:5178/proto.html');
  await page.getByRole('button',{name:'Add playtest companion'}).click();
  await page.getByRole('button',{name:'Join Hero · Glacia'}).click();
  await page.getByRole('button',{name:'Leave party · Glacia'}).waitFor();
  await page.getByRole('button',{name:'Add playtest companion'}).click();
  await page.getByRole('button',{name:'Join Hero · Jimothy'}).click();
  assert.match(await page.getByLabel('Party controls').textContent(), /Hero, Glacia, Jimothy/);
  if (width === 1280) {
   await page.getByRole('checkbox',{name:'Follow traveling actor'}).uncheck();
   const actor = await page.locator('[data-cell-grip="actor-hero"]').boundingBox();
   const berry = await page.locator('[data-board-piece="tile"][data-tile-type="berry-patch"]').boundingBox();
   await page.mouse.move(actor.x+actor.width/2,actor.y+actor.height/2); await page.mouse.down();
   await page.mouse.move(berry.x+berry.width/2,berry.y+berry.height/2,{steps:12}); await page.mouse.up();
   await page.getByRole('button',{name:'Confirm travel',exact:true}).click();
   const field = page.getByRole('region',{name:'Travel tableau'}); await field.waitFor();
   assert.equal(await field.locator('[data-actor-holocard]').count(),3);
   await field.getByRole('button',{name:'Play to Glacia',exact:true}).click();
   await field.getByRole('button',{name:'Best Move',exact:true}).click();
   await field.getByRole('button',{name:'Auto-Solve',exact:true}).waitFor();
   await page.screenshot({path:'artifacts/party-system/travel-1280.png'});
   await field.getByRole('button',{name:'Auto-Solve',exact:true}).click();
   await field.waitFor({state:'hidden',timeout:30000});
   assert.equal(await page.locator('.proto-foundation-assembly [data-actor-holocard]').count(), 3);
   assert.deepEqual(errors,[]); console.log('PASS party travel foundations');
   await context.close(); continue;
  }
  await page.getByRole('button',{name:'Leave party · Jimothy'}).click();
  await page.getByRole('button',{name:'Join Hero · Jimothy'}).waitFor();
  await page.screenshot({path:`artifacts/party-system/map-${width}.png`});
  assert.deepEqual(errors,[]);
  console.log('PASS party controls',width);
  await context.close();
 }
 } finally { await browser.close(); }
})().catch(e=>{console.error(e);process.exit(1)});

