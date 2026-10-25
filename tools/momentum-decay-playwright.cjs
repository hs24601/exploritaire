const {chromium}=require('playwright');const fs=require('fs');const assert=require('node:assert/strict');
(async()=>{fs.mkdirSync('artifacts/momentum-decay',{recursive:true});const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'});try{
 for(const [width,height] of [[1280,800],[390,844],[844,740]]){
  const page=await browser.newPage({viewport:{width,height},reducedMotion:width===390?'reduce':'no-preference'}),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.addInitScript(()=>{let seed=5150;Math.random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};});
  await page.goto('http://127.0.0.1:5178/proto.html?combatsbx');await page.waitForSelector('.momentum-engine__decay');
  const toggle=page.getByRole('checkbox',{name:'Decay',exact:true}),value=async()=>Number((await page.locator('.momentum-engine__value').textContent()).replace(/[^\d.]/g,''));
  assert.equal(await toggle.isChecked(),true);assert.equal(await page.locator('.battle-target-badge').count(),2);assert.equal(await page.locator('.battle-foe .battle-target-link').count(),0);
  const placement=await page.evaluate(()=>{
   const foe=document.querySelector('.battle-foe').getBoundingClientRect();
   return Array.from(document.querySelectorAll('.battle-target-badge')).map(b=>{const r=b.getBoundingClientRect();return {actor:b.dataset.actor,clear:b.dataset.actor==='hero'?r.right<=foe.left:r.left>=foe.right};});
  });assert.ok(placement.every(p=>p.clear),'badges sit outside the enemy on incoming paths');
  await toggle.uncheck();
  for(let i=0;i<4;i++){const legal=page.locator('.battle-field__column button:not([data-gameplay-disabled])');await legal.first().click();const choose=page.locator('[data-battle-actor][data-targetable="true"]');if(await choose.count())await choose.first().click();}
  assert.equal(await value(),4);await toggle.check();await page.waitForTimeout(1300);assert.ok(await value()<4 && await value()>=3.5,'default slow decay');
  await toggle.uncheck();const frozen=await value();await page.waitForTimeout(500);assert.equal(await value(),frozen);
  await page.getByRole('button',{name:'Pause',exact:true}).click();await toggle.check();const local=await value();await page.waitForTimeout(500);assert.equal(await value(),local,'local pause freezes decay');await page.getByRole('button',{name:'Resume',exact:true}).click();
  await page.mouse.click(1,1);await page.keyboard.press('Space');const global=await value();await page.waitForTimeout(500);assert.equal(await value(),global,'global pause freezes decay');await page.keyboard.press('Space');
  await page.screenshot({path:`artifacts/momentum-decay/${width}-player.png`});
  await page.getByRole('button',{name:'↶ Withdraw',exact:true}).click();const held=await value();await page.waitForTimeout(600);assert.equal(await value(),held,'enemy response has no decay deadline');
  await page.screenshot({path:`artifacts/momentum-decay/${width}-response.png`});
  assert.deepEqual(errors,[]);console.log(width,'default toggle, drain/off, local/global pause, response freeze and line badges OK');await page.close();
 }
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exit(1)});
