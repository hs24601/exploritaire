const {chromium} = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const {findLayoutDefects} = require('./lib/layout-check.cjs');
fs.mkdirSync('artifacts/battle-cards',{recursive:true});
(async () => {
  const browser = await chromium.launch({headless:true});
  try {
    for (const mode of ['mouse','touch','keyboard','reduced']) {
      // Desktop-only layout focus (GAME.md): touch and reduced motion run at desktop sizes.
      const viewport = mode === 'touch' ? {width:1280,height:720} : mode === 'reduced' ? {width:1600,height:900} : {width:1280,height:720};
      const context = await browser.newContext({viewport,hasTouch:mode==='touch',reducedMotion:mode==='reduced'?'reduce':'no-preference',deviceScaleFactor:3});
      const page = await context.newPage(), errors=[];
      page.on('pageerror',error=>errors.push(error.message));
      await page.goto('http://127.0.0.1:5178/proto.html?combatdemo');
      await page.locator('[data-view="party"]:not(:disabled)').waitFor();
      const four=page.locator('.battle-field__column').nth(1).locator('button').last();
      const mochi=page.locator('[data-battle-actor="mochi"]');
      assert.equal(await four.isEnabled(),true);
      assert.equal(await page.locator('.battle-field__column').nth(1).locator('button').first().isDisabled(),true,'Buried J cannot play');
      assert.equal(await page.locator('.battle-field__column').nth(6).locator('button').isDisabled(),true,'Enemy adjacency alone does not enable 9');
      if(mode==='mouse') {
        // Inspect synchronously before the short solver-speed flight lands.
        const flight=await four.evaluate(el=>{el.click(); const ghost=document.querySelector('.battle-card-flight');return {target:ghost?.dataset.targetActor,width:ghost?.getBoundingClientRect().width,height:ghost?.getBoundingClientRect().height};});
        assert.equal(flight.target,'mochi');
        assert.ok(Math.abs(flight.height/flight.width-74/56)<.02);
      } else if(mode==='touch') await four.tap();
      else if(mode==='keyboard') {await four.focus();await page.keyboard.press('Enter');}
      else await four.click();
      await page.waitForFunction(()=>document.querySelector('[data-battle-slot="mochi"] [aria-label="Collected cards 1"]'));
      assert.equal(await mochi.locator('.battle-field__rank').textContent(),'4');
      assert.equal(await page.locator('.battle-field__column').nth(1).locator('button').count(),1);
      // The play lands at once; the flight is only the card's journey.
      await page.waitForFunction(()=>!document.querySelector('.battle-card-flight'));
      // With Mochi at 4, the exposed 5 becomes playable; only one count per landing.
      const five=page.locator('.battle-field__column').nth(2).locator('button').last();
      assert.equal(await five.isEnabled(),true);
      await five.click();
      await page.waitForFunction(()=>document.querySelector('[data-battle-slot="mochi"] [aria-label="Collected cards 2"]'));
      assert.equal(await mochi.locator('.battle-field__rank').textContent(),'5');
      assert.equal(await page.locator('[data-battle-actor="hero"] .battle-field__rank').textContent(),'2');
      assert.deepEqual(await findLayoutDefects(page,'.battle-field',{parts:'.battle-field__header,.battle-field__board,.battle-field__team,.battle-field__team h3,.battle-field__foundation,.battle-field__pile,.battle-field__counters,.battle-field__actor-card,.battle-field__name,.battle-field__tableau,.battle-field__column,.battle-field__footer,.battle-field__footer button'}),[], 'Played cards preserve layout');
      if(mode==='mouse') await page.locator('.battle-field').screenshot({path:'artifacts/battle-cards/played-3x.png',scale:'device'});
      await page.reload();
      await page.locator('[data-view="party"]:not(:disabled)').waitFor();
      const press = async locator => {
        if(mode==='touch') await locator.tap();
        else if(mode==='keyboard') {await locator.focus();await page.keyboard.press('Enter');}
        else await locator.click();
      };
      await press(page.locator('.battle-field__column').nth(0).locator('button').last());
      await page.waitForFunction(()=>document.querySelector('[data-battle-slot="hero"] [aria-label="Collected cards 1"]'));
      await press(four);
      assert.equal(await four.getAttribute('data-highlight'),'true');
      assert.equal(await page.locator('.battle-field__foundation[data-targetable="true"]').count(),2);
      assert.equal(await page.locator('.battle-card-flight').count(),0,'Ambiguous 4 waits for player choice');
      assert.equal(await mochi.locator('.battle-field__rank').textContent(),'5');
      assert.equal(await page.locator('[data-battle-actor="hero"] .battle-field__rank').textContent(),'3');
      if(mode==='mouse') await page.locator('.battle-field').screenshot({path:'artifacts/battle-cards/choice-3x.png',scale:'device'});
      await press(four);
      assert.equal(await page.locator('.battle-field__foundation[data-targetable="true"]').count(),0,'Second click cancels selection');
      await press(four);
      await press(mochi);
      await page.waitForFunction(()=>document.querySelector('[data-battle-slot="mochi"] [aria-label="Collected cards 1"]'));
      assert.equal(await mochi.locator('.battle-field__rank').textContent(),'4');
      assert.equal(await page.locator('[data-battle-actor="hero"] .battle-field__rank').textContent(),'3','Only the chosen actor receives 4');
      assert.equal(await page.locator('.battle-field__foundation[data-targetable="true"]').count(),0);
      assert.deepEqual(errors,[]);
      await context.close();console.log(`${mode}: unique targets fly, ambiguous 4 highlights and waits, selection cancels, chosen foundation receives card`);
    }
  } finally {await browser.close();}
})().catch(error=>{console.error(error);process.exit(1);});
