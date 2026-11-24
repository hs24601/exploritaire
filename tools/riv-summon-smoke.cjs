const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const fs=require('node:fs');
(async()=>{
 const browser=await chromium.launch({headless:true,executablePath:'C:/Users/ericm/AppData/Local/ms-playwright/chromium-1208/chrome-win64/chrome.exe'});
 try{
  const page=await browser.newPage({viewport:{width:1600,height:1000}}),errors=[];
  page.on('pageerror',e=>errors.push(e.stack));
  await page.goto('http://127.0.0.1:5202/proto.html?combatsbx&scenario=1001');
  await page.locator('[data-battle-actor="hero"]').click();
  const card=page.locator('.ability-fan [data-skill="summon-riv"]');await card.waitFor();
  await card.click();
  const slot=page.locator('[data-foundation-summon-slot]');await slot.waitFor();
  assert.equal(await page.locator('.ability-fan__target[data-skill-target="hero"]').count(),0);
  await page.locator('.ability-fan__target[data-skill-target="new-foundation"]').click();
  await page.mouse.move(3,3);
  const riv=page.locator('[data-battle-slot="riv"]');await riv.waitFor();
  await page.locator('.ability-cast').waitFor({state:'detached'});
  assert.equal(await riv.locator('.battle-foundation__value').textContent(),'★');
  assert.equal(await riv.locator('img').count(),0,'no art for Riv');
  assert.equal(await page.locator('[data-battle-slot="hero"] .battle-foundation__ap-pips i[data-on]').count(),2);
  assert.equal(await slot.count(),0,'summon slot disappears on landing');
  const starter=page.locator('[data-lane="party-rear"] [data-battle-card]').first();
  const id=await starter.getAttribute('data-battle-card'),rank=await starter.getAttribute('data-battle-rank');
  const from=await starter.boundingBox(),to=await page.locator('[data-battle-actor="riv"]').boundingBox();
  await page.mouse.move(from.x+from.width/2,from.y+from.height*.8);await page.mouse.down();
  await page.mouse.move(to.x+to.width/2,to.y+to.height/2,{steps:10});await page.waitForTimeout(100);await page.mouse.up();await page.mouse.move(3,3);
  await page.waitForFunction(id=>!document.querySelector(`[data-battle-card="${id}"]`),id);
  assert.notEqual(await riv.locator('.battle-foundation__value').textContent(),'★');
  assert.equal(await riv.locator('[data-status="wild"]').count(),0);
  fs.mkdirSync('artifacts/riv',{recursive:true});await page.screenshot({path:'artifacts/riv/starter.png'});
  assert.deepEqual(errors,[]);console.log('PASS: adjacent slot summon, no existing-foundation target, 1 AP, no art, wildcard starter consumed');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exit(1)});
