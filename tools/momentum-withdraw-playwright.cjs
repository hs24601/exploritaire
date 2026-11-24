const {chromium}=require('playwright');const fs=require('fs');const assert=require('node:assert/strict');
(async()=>{fs.mkdirSync('artifacts/momentum-engine',{recursive:true});const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'});try{
 for(const [width,height] of [[1280,800],[390,844],[844,740]]){
  const touch=width===390,page=await browser.newPage({viewport:{width,height},hasTouch:touch,isMobile:touch,reducedMotion:touch?'reduce':'no-preference'}),errors=[];
  page.on('pageerror',e=>errors.push(e.message));await page.addInitScript(()=>{let seed=5150;Math.random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};});
  await page.goto('http://127.0.0.1:5178/proto.html?combatsbx');await page.waitForSelector('.momentum-engine');assert.equal(await page.getByRole('checkbox',{name:'Decay',exact:true}).isChecked(),true);await page.getByRole('checkbox',{name:'Decay',exact:true}).uncheck();
  const press=async locator=>touch?locator.tap():locator.click();
  const value=async()=>Number((await page.locator('.momentum-engine__value').innerText()).replace(/\D/g,''));
  const board=()=>page.locator('.battle-field__column button').evaluateAll(els=>els.map(el=>el.textContent));
  assert.equal(await value(),0);assert.match(await page.locator('.battle-enemy-intent').innerText(),/Withdraw/);
  await page.screenshot({path:`artifacts/momentum-engine/${width}-idle.png`});
  let turns=0;
  for(let i=0;i<60 && await value()<4;i++){
   const legal=page.locator('.battle-field__column button:not([data-gameplay-disabled])');
   if(await legal.count()){
    const before=await value();await press(legal.first());const choosing=page.locator('[data-battle-actor][data-targetable="true"]');if(await choosing.count())await press(choosing.first());
    assert.equal(await value(),before+1,'one Momentum per card');
   }else{
    const before=await value();await press(page.getByRole('button',{name:'↶ Withdraw',exact:true}));assert.equal(await value(),before,'withdraw earns nothing');
    assert.equal(await page.locator('.battle-field').getAttribute('data-team-turn'),'enemy');await press(page.getByRole('button',{name:'Allow Withdraw',exact:true}));turns++;
   }
  }
  assert.ok(await value()>=4,'build enough shared Momentum for a meaningful interrupt');
  await page.waitForTimeout(700);await page.screenshot({path:`artifacts/momentum-engine/${width}-charged.png`});
  const bank=await value();await press(page.getByRole('button',{name:'↶ Withdraw',exact:true}));
  assert.equal(await value(),bank);assert.equal(await page.locator('.battle-field').getAttribute('data-team-turn'),'enemy');
  const heldBoard=await board();await page.waitForTimeout(400);assert.deepEqual(await board(),heldBoard,'enemy withdraw waits for response');
  await page.screenshot({path:`artifacts/momentum-engine/${width}-reaction.png`});
  await press(page.getByRole('button',{name:'Pause',exact:true}));assert.equal(await page.getByRole('button',{name:'Interrupt · 3 Momentum',exact:true}).isDisabled(),true);await press(page.getByRole('button',{name:'Resume',exact:true}));
  await press(page.getByRole('button',{name:'Interrupt · 3 Momentum',exact:true}));
  assert.equal(await value(),bank-3);assert.deepEqual(await board(),heldBoard,'interrupt preserves the entire tableau');
  assert.equal(await page.locator('.battle-field').getAttribute('data-team-turn'),'party');
  await press(page.getByRole('button',{name:'↶ Withdraw',exact:true}));assert.equal(await page.getByRole('button',{name:'Interrupt · 3 Momentum',exact:true}).isDisabled(),true);
  const before=await board();await press(page.getByRole('button',{name:'Allow Withdraw',exact:true}));assert.notDeepEqual(await board(),before,'allowed enemy withdraw shifts frontier');
  assert.equal(await page.locator('.battle-field').getAttribute('data-team-turn'),'party');
  await press(page.getByRole('button',{name:'Restart',exact:true}));assert.equal(await value(),0);assert.equal(await page.locator('.battle-withdraw-reaction').count(),0);
  assert.deepEqual(errors,[]);console.log(width,'Momentum earning/visuals, Withdraw, paid interruption, pause, enemy resolution, restart OK; recovery turns',turns);
  await page.close();
 }
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exit(1)});
