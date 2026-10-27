const {chromium}=require('playwright');const fs=require('fs');const assert=require('node:assert/strict');
(async()=>{fs.mkdirSync('artifacts/combat-scenarios',{recursive:true});const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'});try{
 for(const [width,height] of [[1280,800],[390,844],[844,740]]){
  const page=await browser.newPage({viewport:{width,height},reducedMotion:width===390?'reduce':'no-preference'}),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto('http://127.0.0.1:5178/proto.html?combatsbx');const selector=page.getByRole('combobox',{name:'Combat scenario',exact:true});await selector.waitFor();
  assert.equal(await selector.inputValue(),'001');assert.equal(await selector.locator('option').count(),5);
  const box=await selector.boundingBox();assert.ok(box.x<40 && box.y<50,'upper-left scenario control');
  assert.equal(await page.locator('.battle-foe [data-bar="hp"]').getAttribute('aria-valuenow'),'10');assert.match(await page.locator('.battle-enemy-intent').innerText(),/No target/);
  assert.equal(await page.locator('.battle-field__khad-root').evaluate(el=>el.complete && el.naturalWidth>0),true);
  await page.screenshot({path:`artifacts/combat-scenarios/${width}-001.png`});
  await selector.selectOption('002');assert.equal(await page.locator('.battle-foe [data-bar="hp"]').getAttribute('aria-valuenow'),'4');assert.match(await page.locator('[data-buff="thorns"]').getAttribute('aria-label'),/Thorns 1/);
  const play=async()=>{const card=page.locator('.battle-field__column button:not([data-gameplay-disabled])').first();await card.click();const actors=page.locator('[data-battle-actor][data-targetable="true"]');if(await actors.count())await actors.first().click();};
  for(let i=0;i<4;i++)await play();
  assert.equal(await page.locator('.battle-field').getAttribute('data-result'),'won');
  const health=await page.locator('.battle-vitals [data-bar="hp"]').evaluateAll(els=>els.reduce((sum,el)=>sum+Number(el.getAttribute('aria-valuenow')),0));assert.equal(health,18,'one reflection per hit, including final hit');
  const modal=page.getByRole('dialog',{name:'Scenario complete'});await modal.waitFor();
  const modalBox=await modal.boundingBox();assert.ok(Math.abs(modalBox.x+modalBox.width/2-width/2)<2 && Math.abs(modalBox.y+modalBox.height/2-height/2)<2,'centered modal fits viewport');
  assert.match(await modal.innerText(),/002: Thorns Khad Root/);
  assert.equal(await modal.getByRole('button',{name:'Replay scenario',exact:true}).evaluate(el=>el===document.activeElement),true);
  await page.keyboard.press('Escape');assert.equal(await modal.isVisible(),true);
  await page.screenshot({path:`artifacts/combat-scenarios/${width}-complete.png`});
  await modal.getByRole('button',{name:'Replay scenario',exact:true}).click();assert.equal(await selector.inputValue(),'002');
  assert.equal(await page.getByRole('dialog').count(),0);assert.equal(await page.locator('.battle-foe [data-bar="hp"]').getAttribute('aria-valuenow'),'4');
  for(let i=0;i<4;i++)await play();
  await modal.getByRole('button',{name:'Next scenario',exact:true}).click();assert.equal(await selector.inputValue(),'003');assert.equal(await page.locator('.battle-field__column button:not([data-gameplay-disabled])').count(),0);assert.equal(await page.getByRole('button',{name:'END TURN',exact:true}).isDisabled(),true);
  await page.screenshot({path:`artifacts/combat-scenarios/${width}-003-blocked.png`});
  await page.getByRole('button',{name:'↶ Withdraw',exact:true}).click();assert.equal(await page.locator('.battle-withdraw-reaction').count(),0);assert.equal(await page.locator('.battle-field').getAttribute('data-team-turn'),'party');
  assert.equal(await page.locator('.battle-field__rack .battle-field__column button').count(),28);assert.ok(await page.locator('.battle-field__column button:not([data-gameplay-disabled])').count()>0);
  await page.waitForTimeout(400);await page.screenshot({path:`artifacts/combat-scenarios/${width}-003-redeal.png`});
  for(let i=0;i<12 && await page.locator('.battle-field').getAttribute('data-result')!=='won';i++)await play();
  assert.equal(await page.locator('.battle-field').getAttribute('data-result'),'won');
  const hp=await page.locator('.battle-vitals [data-bar="hp"]').evaluateAll(els=>els.map(el=>Number(el.getAttribute('aria-valuenow'))));assert.deepEqual(hp,[12,10],'dormant dummy never retaliates');
  await modal.getByRole('button',{name:'Replay scenario',exact:true}).click();assert.equal(await selector.inputValue(),'003');assert.equal(await page.locator('.battle-field__column button:not([data-gameplay-disabled])').count(),0);
  await page.getByRole('button',{name:'↶ Withdraw',exact:true}).click();
  for(let i=0;i<12 && await page.locator('.battle-field').getAttribute('data-result')!=='won';i++)await play();
  await modal.getByRole('button',{name:'Next scenario',exact:true}).click();assert.equal(await selector.inputValue(),'004');
  for(const column of [0,0,0,0,1,1,1,1,2,2,2]){await page.locator('.battle-field__rack .battle-field__column').nth(column).locator('button').last().click();const actors=page.locator('[data-battle-actor][data-targetable="true"]');if(await actors.count())await page.locator('[data-battle-actor="hero"]').click();}
  await modal.getByRole('button',{name:'Next scenario',exact:true}).click();assert.equal(await selector.inputValue(),'005');assert.equal(await page.locator('[data-skill]').count(),2);await selector.selectOption('001');assert.equal(await selector.inputValue(),'001');
  assert.equal(await page.getByRole('dialog').count(),0);assert.equal(await page.locator('.battle-foe [data-bar="hp"]').getAttribute('aria-valuenow'),'10');
  assert.deepEqual(errors,[]);console.log(width,'selector, HP/intents, Thorns reflection, blocked deal, Withdraw recovery to victory, restart OK');await page.close();
 }
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exit(1)});
