const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const { findLayoutDefects } = require('./lib/layout-check.cjs');
const fs = require('node:fs');
(async () => {
  const browser = await chromium.launch({ headless: true });
  fs.mkdirSync('artifacts/table-card-world', { recursive: true });
  try {
    for (const [width, height] of [[1280,720],[390,844],[844,390]]) for (const touch of [false,true]) {
      const context = await browser.newContext({viewport:{width,height},hasTouch:true,deviceScaleFactor:3,reducedMotion:'reduce'});
      const page = await context.newPage();
      await page.goto(process.env.PROTO_URL || 'http://localhost:5178/proto.html');
      const card = page.locator('.proto-story-card:not([data-held-visual])');
      await card.waitFor();
      const before = await card.boundingBox();
      await card.screenshot({path:`artifacts/table-card-world/${width}-${touch}-3x.png`,scale:'device'});
      const viewport = page.locator('.proto-map-viewport');
      const view = await viewport.boundingBox();
      await page.mouse.move(view.x+view.width/2,view.y+view.height/2);
      await page.mouse.wheel(0,2200);
      await page.waitForTimeout(700);
      const after = await card.boundingBox();
      assert.ok(after.width < before.width*.85, 'card shrinks with zoom');
      assert.deepEqual(await findLayoutDefects(page,'.proto-story-card',{parts:'.proto-ordinary-day__heading, .proto-ordinary-day__thought, .proto-ordinary-day__actions'}), []);
      const start = await card.evaluate(el=>{const r=el.getBoundingClientRect(); return {x:r.x+r.width/2,y:r.y+r.height*.2};});
      const end = {x:view.x+view.width*.85,y:view.y+view.height*.35};
      const camera = await viewport.evaluate(el=>el.style.cssText);
      if(touch){const cdp=await context.newCDPSession(page);for(const [type,points] of [['touchStart',[start]],['touchMove',[end]],['touchEnd',[]]])await cdp.send('Input.dispatchTouchEvent',{type,touchPoints:points});}
      else {await page.mouse.move(start.x,start.y);await page.mouse.down();await page.mouse.move(end.x,end.y,{steps:8});await page.mouse.up();}
      await page.waitForTimeout(100);
      const position = await card.evaluate(el=>({x:parseFloat(getComputedStyle(el).left)-el.parentElement.clientWidth/2,y:parseFloat(getComputedStyle(el).top)-el.parentElement.clientHeight/2}));
      if(width>=1280) assert.ok(Math.abs(position.x)>360 || Math.abs(position.y)>360,'drop beyond actor boundary'); else assert.ok(position.x > -100,'phone drag changes world position');
      assert.equal(await viewport.evaluate(el=>el.style.cssText),camera,'drag preserves camera');
      assert.equal(await page.locator('[data-held-visual]').count(),0);
      await card.screenshot({path:`artifacts/table-card-world/${width}-${touch}.png`,scale:'css'});
      console.log('PASS',width,height,touch?'touch':'mouse',position);
      await context.close();
    }
  } finally {await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});




