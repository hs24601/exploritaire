const {chromium}=require('playwright');const assert=require('node:assert/strict');const fs=require('node:fs');
(async()=>{const b=await chromium.launch({headless:true,executablePath:'C:/Users/ericm/AppData/Local/ms-playwright/chromium-1208/chrome-win64/chrome.exe'});try{
 const p=await b.newPage(),errors=[];p.on('pageerror',e=>errors.push(e.message));fs.mkdirSync('artifacts/ability-hand',{recursive:true});
 for(const [width,height,rows] of [[1977,914,1],[900,700,2],[390,844,2]]){
  await p.setViewportSize({width,height});await p.goto('http://127.0.0.1:5202/proto.html?combatsbx&scenario=1002');
  await p.locator('[data-battle-actor="hero"]').click();await p.locator('.ability-fan [data-faux-card]').first().waitFor();
  assert.equal(await p.locator('.ability-fan [data-skill]').count(),6);
  assert.equal(await p.locator('.ability-fan').getAttribute('data-hand-rows'),String(rows));
  assert.equal(await p.locator('.ability-fan__scroll').evaluate(node=>getComputedStyle(node).scrollbarWidth),'none');
  assert.equal(await p.locator('.ability-fan__scroll').evaluate(node=>getComputedStyle(node,'::-webkit-scrollbar').display),'none');
  const fan=await p.locator('.ability-fan').boundingBox(),hero=await p.locator('[data-foundation-focus="hero"]').boundingBox();
  assert.ok(Math.abs(fan.x+fan.width/2-hero.x-hero.width/2)<3,'foundation center');
  const before=await p.locator('[data-foundation-focus="hero"]').innerText();
  await p.locator('[data-faux-card]').first().click();assert.equal(await p.locator('[data-foundation-focus="hero"]').innerText(),before);await p.keyboard.press('Escape');
  assert.equal(await p.locator('[data-skill-target]').count(),0,'faux cards never arm a cast');
  await p.screenshot({path:`artifacts/ability-hand/${width}.png`});
  // Focus must reveal the final card even when two rows need horizontal panning.
  await p.locator('[data-faux-card]').last().focus();
  await p.waitForTimeout(250);
  const last=await p.locator('[data-faux-card]').last().boundingBox();assert.ok(last.x>=0 && last.x+last.width<=width+2);
  await p.keyboard.press('Escape');assert.equal(await p.locator('.ability-fan-overlay').count(),0);
 }
 await p.setViewportSize({width:1440,height:1000});await p.goto('http://127.0.0.1:5202/proto.html?combatsbx&scenario=1001');
 for(const id of ['tutorial-1001-0-2','tutorial-1001-4-2','tutorial-1001-4-1']){
  await p.locator(`[data-battle-card="${id}"]`).click();await p.mouse.move(3,3);await p.waitForTimeout(200);
 }
 await p.locator('[data-battle-actor="hero"]').click();await p.locator('.ability-fan [data-skill="hold"]').click();await p.getByRole('button',{name:'Choose target',exact:true}).click();
 await p.locator('[data-skill-target="new-foundation"]').click();await p.locator('[data-battle-slot="dem"]').waitFor();
 assert.equal(await p.locator('[data-battle-slot="dem"] .battle-foundation__value').textContent(),'A');
 assert.deepEqual(errors,[]);console.log('PASS: six-card hand, foundation centering, two-row overflow, inert mocks, keyboard reveal, Escape and real Dem summon');
}finally{await b.close();}})().catch(e=>{console.error(e);process.exit(1)});
