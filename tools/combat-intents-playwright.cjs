const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const fs=require('fs');
(async()=>{
 fs.mkdirSync('artifacts/combat-intents',{recursive:true});
 const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'});
 try {for(const width of [1280,390]){
  const page=await browser.newPage({viewport:{width,height:844},hasTouch:width===390,isMobile:width===390,reducedMotion:'reduce'});
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto('http://127.0.0.1:5178/proto.html?combatsbx');
  const intent=page.locator('.combat-sandbox .battle-enemy-intent');await intent.waitFor();
  const foundation=await page.locator('.battle-foe').boundingBox(),icon=await intent.boundingBox();
  assert.ok(icon.y>=foundation.y+foundation.height,'intent is below foundation');
  assert.equal(await page.locator('.battle-foe .battle-enemy-intent').count(),0);
  assert.match(await intent.innerText(),/No target/);
  if(width===390)await intent.tap();else await intent.hover();
  const tip=page.getByRole('tooltip');await tip.waitFor();assert.match(await tip.innerText(),/takes no action/);
  assert.ok(await intent.getAttribute('aria-describedby'));
  await page.screenshot({path:`artifacts/combat-intents/${width}-dormant.png`});
  if(width===390){await intent.tap();await tip.waitFor({state:'hidden'});}else{await page.keyboard.press('Escape');await tip.waitFor({state:'hidden'});}
  await page.getByRole('combobox',{name:'Combat scenario',exact:true}).selectOption('002');
  if(width===390)await intent.tap();else {await page.mouse.move(1,1);await intent.hover();}
  await tip.waitFor();assert.match(await tip.innerText(),/Thorns is passive.*including the killing blow/);
  await page.keyboard.press('Escape');
  // Exercise all presentations using the real FoeCard, independent of current dummy catalog.
  await page.evaluate(async()=>{
   const React=(await import('/node_modules/.vite/deps/react.js')).default;
   const {createRoot}=(await import('/node_modules/.vite/deps/react-dom_client.js')).default;
   const {FoeCard}=await import('/src/proto/components/BattleUnits.tsx');
   const {createStaggerSandbox}=await import('/src/proto/rules/battle.ts');
   const holder=document.createElement('div');holder.id='intent-fixture';holder.style.cssText='position:fixed;left:30px;top:200px;width:220px;z-index:1000';document.body.append(holder);
   const root=createRoot(holder),foe=createStaggerSandbox().foes[0];
   window.renderIntent=(kind,target='hero',hidden=false)=>root.render(React.createElement(FoeCard,{
    foe:{...foe,intent:kind,intentHidden:hidden,fed:2},target:target==='hero'?'Hero':'Mochi',targetId:target,
    preview:null,focus:false,events:[],sprite:null,aiming:false,interaction:{},targeters:[]
   }));window.renderIntent('attack');
  });
  const fixture=page.locator('#intent-fixture .battle-enemy-intent');await fixture.waitFor();
  assert.match(await fixture.innerText(),/Hero/);assert.equal(await fixture.locator('img').count(),1);
  assert.equal(await fixture.getAttribute('data-intent-target'),'hero');
  if(width===390)await fixture.tap();else await fixture.hover();
  await tip.waitFor();assert.match(await tip.innerText(),/Strike Hero.*including 2 bonus damage.*most AP/);
  await page.screenshot({path:`artifacts/combat-intents/${width}-attack.png`});
  await page.evaluate(()=>window.renderIntent('attack','mochi'));
  await page.waitForFunction(()=>document.querySelector('#intent-fixture .battle-enemy-intent').textContent.includes('Mochi'));
  assert.match(await tip.innerText(),/Strike Mochi/);
  await page.evaluate(()=>window.renderIntent('withdraw'));
  await page.waitForFunction(()=>document.querySelector('#intent-fixture .battle-enemy-intent').textContent.includes('Tableau'));
  assert.equal(await fixture.locator('img').count(),0);assert.match(await tip.innerText(),/entire tableau.*Momentum to interrupt/);
  await page.evaluate(()=>window.renderIntent('attack','hero',true));
  await page.waitForFunction(()=>document.querySelector('#intent-fixture .battle-enemy-intent').textContent.includes('Unknown'));
  assert.equal(await fixture.locator('img').count(),0);assert.equal(await fixture.getAttribute('data-intent-target'),null);
  assert.doesNotMatch(await fixture.getAttribute('aria-label'),/Hero/);
  await page.keyboard.press('Escape');await fixture.focus();await page.keyboard.press('Enter');await tip.waitFor();
  assert.match(await tip.innerText(),/concealed/);
  await page.evaluate(()=>document.querySelector('#intent-fixture').remove());await tip.waitFor({state:'hidden'});
  assert.deepEqual(errors,[]);console.log(width,'intent placement, hover/tap, passive explanation, target portraits/updates, Withdraw, hidden intent, keyboard and cleanup OK');
  await page.close();
 }}finally{await browser.close();}
})().catch(e=>{console.error(e);process.exit(1)});
