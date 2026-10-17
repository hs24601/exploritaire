const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const {findLayoutDefects}=require('./lib/layout-check.cjs');
(async()=>{
 fs.mkdirSync('artifacts/jumbo-actor-abilities',{recursive:true});
 const browser=await chromium.launch({headless:true});
 try { for(const [width,height] of [[1912,914],[1280,720],[700,720]].filter(size=>!process.env.JUMBO_WIDTH||size[0]===Number(process.env.JUMBO_WIDTH))) {
  const page=await browser.newPage({viewport:{width,height},hasTouch:true,deviceScaleFactor:3});
  const errors=[];page.on('pageerror',error=>errors.push(error.message));
  await page.goto('http://127.0.0.1:5178/proto.html');
  await page.locator('[data-board-piece="actor"]').first().focus();await page.keyboard.press('Enter');
  const viewer=page.locator('[data-inspection-id="hero"]');await viewer.waitFor();await viewer.focus();await page.keyboard.press('Enter');
  await page.waitForFunction(()=>{
   const viewer=document.querySelector('[data-inspection-id="hero"]');
   const expected=Math.min(innerHeight*.82*63/88,(innerHeight-164)*63/88,innerWidth*.82);
   return viewer&&Math.abs(viewer.getBoundingClientRect().width-expected)<1;
  });
  const actor=viewer.locator('[data-object-id="hero"]');
  const rows=actor.locator('.trading-card__abilities button');assert.equal(await rows.count(),4);
  assert.equal((await rows.first().innerText()).replace(/\s/g,''),'⚔Nip');
  assert.deepEqual(await findLayoutDefects(page,'[data-inspection-id="hero"] [data-object-id="hero"]',{parts:'.trading-card__header,.trading-card__body,.trading-card__abilities,.trading-card__abilities button,.trading-card__full-description,.trading-card__chips,.trading-card__footer'}),[]);
  const descriptionBox=await actor.locator('.trading-card__full-description').boundingBox();
  const abilityBox=await rows.first().boundingBox();
  assert.ok(descriptionBox.y+descriptionBox.height<abilityBox.y,'Description precedes abilities');
  const cardBox=await actor.boundingBox();
  const below=viewer.locator('.trading-card__below');
  const chipBox=await below.locator('.trading-card__chips').boundingBox();
  const editBox=await below.getByRole('button',{name:'Playtest values'}).boundingBox();
  assert.ok(chipBox.y>=cardBox.y+cardBox.height,'Stats float beneath card');
  assert.ok(editBox.y>chipBox.y+chipBox.height,'Playtest action follows stats');
  assert.ok(editBox.y+editBox.height<=height-16,'External controls fit viewport');
  assert.deepEqual(await findLayoutDefects(page,'.trading-card__below',{parts:'.trading-card__chips,.trading-card__chip,.trading-card__below-action,.tile-card-action'}),[]);
  const bubbleStyles=await rows.first().evaluate(el=>{const style=getComputedStyle(el);return {radius:parseFloat(style.borderRadius),alpha:style.backgroundColor};});
  assert.ok(bubbleStyles.radius>=10);assert.match(bubbleStyles.alpha,/0\.6\)/);
  const overlayPlane=actor.locator('[data-card-layer="overlay"]');
  const restingTransform=await overlayPlane.evaluate(el=>getComputedStyle(el).transform);
  await page.mouse.move(cardBox.x+cardBox.width*.8,cardBox.y+cardBox.height*.25);await page.waitForTimeout(700);
  assert.notEqual(await overlayPlane.evaluate(el=>getComputedStyle(el).transform),restingTransform,'Overlay plane follows parallax');
  await page.mouse.move(1,1);await page.waitForTimeout(700);
  for(const input of ['mouse','touch','keyboard']) {
   const row=rows.nth(1);
   if(input==='mouse')await row.click();else if(input==='touch')await row.tap();else {await row.focus();await page.keyboard.press('Enter');}
    const ability=viewer.locator('.trading-card-ability-view');await ability.waitFor();await page.waitForTimeout(100);
   assert.equal(await actor.isVisible(),false,'Actor hides while its ability is open');
   assert.equal(await below.isVisible(),false,'Actor controls hide with the actor');
   assert.equal(await viewer.locator('.trading-card__available').isVisible(),false,'Available tray hides with the actor');
   assert.equal(await actor.evaluate(el=>el.inert),true);
   assert.equal(await viewer.evaluate(el=>getComputedStyle(el).boxShadow),'none','Hidden actor leaves no frame shadow');
   const bounds=await ability.boundingBox();assert.ok(bounds.x>=0&&bounds.x+bounds.width<=width);
   assert.ok(Math.abs(bounds.x+bounds.width/2-width/2)<1,'Ability card is centered');
   assert.deepEqual(await findLayoutDefects(page,'.trading-card-ability-view',{parts:'.trading-card__header,.trading-card__body,.trading-card__full-description,.trading-card__footer'}),[]);
   assert.equal(await actor.evaluate(el=>getComputedStyle(el).transform),'none');
   await page.keyboard.press('Tab');assert.equal(await ability.getByRole('button',{name:'Close ability card'}).evaluate(el=>el===document.activeElement),true,'Tab stays on the ability close control');
   await page.keyboard.press('Shift+Tab');assert.equal(await ability.getByRole('button',{name:'Close ability card'}).evaluate(el=>el===document.activeElement),true);
   if(input==='mouse')await page.screenshot({path:`artifacts/jumbo-actor-abilities/${width}-3x.png`});
   if(input==='mouse')await ability.getByRole('button',{name:'Close ability card'}).click();else if(input==='touch')await ability.getByRole('button',{name:'Close ability card'}).tap();else await page.keyboard.press('Escape');
   assert.equal(await ability.count(),0);assert.ok(await actor.isVisible());assert.ok(await below.isVisible());assert.ok(await viewer.locator('.trading-card__available').isVisible());
   assert.equal(await row.evaluate(el=>el===document.activeElement),true);
  }
  const availableRow=viewer.locator('.trading-card__available button').first();
  await availableRow.click();assert.equal(await actor.isVisible(),false);await page.keyboard.press('Escape');
  assert.ok(await actor.isVisible());assert.equal(await availableRow.evaluate(el=>el===document.activeElement),true,'Available ability restores focus');
  await rows.first().click();await page.locator('.details-card-jumbo__backdrop').click({position:{x:8,y:8}});
  assert.equal(await viewer.locator('.trading-card-ability-view').count(),0);assert.ok(await actor.isVisible());
  await page.screenshot({path:`artifacts/jumbo-actor-abilities/${width}-actor-3x.png`});
  await below.getByRole('button',{name:'Playtest values'}).click();
  await viewer.locator('.actor-playtest-panel').waitFor();
  await viewer.getByRole('button',{name:'Back to card'}).click();assert.ok(await rows.first().isVisible());
  assert.deepEqual(errors,[]);console.log(width,'ability rows, actor hide/restore, centered layout, mouse/touch/keyboard, animation freeze, parallax, external stats, playtest editor and focus passed');await page.close();
 }
 // Exercise the other shared jumbo host without adding a production route.
 const shared=await browser.newPage({viewport:{width:1280,height:720}});
 shared.on('pageerror',error=>console.error('Shared fixture:',error.message));
 await shared.route('**/__actor-ability-test',route=>route.fulfill({contentType:'text/html',body:`<div id="root"></div><script type="module">
 import RefreshRuntime from '/@react-refresh';
 RefreshRuntime.injectIntoGlobalHook(window);window.$RefreshReg$=()=>{};window.$RefreshSig$=()=>type=>type;window.__vite_plugin_react_preamble_installed__=true;
 await import('/tools/actor-ability-jumbo-fixture.tsx');
 </script>`}));
 await shared.goto('http://127.0.0.1:5178/__actor-ability-test');
 await shared.getByRole('button').click();
 const host=shared.locator('.card-jumbo'),actor=host.locator('[data-object-id="hero"]');
 const row=actor.locator('[data-loadout-move="Nip"]');await row.click();
 assert.equal(await actor.isVisible(),false);assert.equal(await host.locator('.card-jumbo__close').isVisible(),false);
 await shared.keyboard.press('Tab');assert.equal(await host.getByRole('button',{name:'Close ability card'}).evaluate(el=>el===document.activeElement),true);
 await shared.locator('.card-jumbo-backdrop').click({position:{x:8,y:8}});
 assert.ok(await actor.isVisible());assert.equal(await row.evaluate(el=>el===document.activeElement),true);
 await shared.keyboard.press('Escape');assert.equal(await host.count(),0);
 console.log('Shared jumbo host ability hide/restore, close control, focus and backdrop passed');await shared.close();
 } finally {await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});

