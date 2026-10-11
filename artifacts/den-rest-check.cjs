const { chromium } = require('playwright');
const assert = require('node:assert/strict');
(async () => {
  const browser = await chromium.launch();
  try {
    for (const [width,height] of [[1280,720],[390,844],[844,390]]) {
      const page = await browser.newPage({viewport:{width,height},hasTouch:width<900});
      const errors = [];
      page.on('pageerror', e => errors.push(e.message));
      await page.addInitScript(() => { let seed=123456; Math.random=()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296;}; });
      await page.goto('http://localhost:5178/proto.html');
      await page.getByLabel('Den rest status').waitFor();
      assert.match(await page.getByLabel('Den rest status').textContent(), /STA 0\/6/);
      assert.equal(await page.locator('[data-foundation-index]').count(),1);
      assert.equal(await page.locator('.proto-tableau-stage .playing-card').count(),7);
      const card = page.locator('.proto-tableau-stage .playing-card').filter({has:page.getByRole('img',{name:'Rest · +1 stamina',exact:true})}).first();
      if(width<900) await card.tap(); else await card.click();
      await page.waitForFunction(()=>document.querySelector('[aria-label="Den rest status"]')?.textContent.includes('STA 1/6'));
      assert.equal(await page.locator('.proto-tableau-stage .playing-card').count(),7);
      assert.deepEqual(errors,[]);
      const overflow=await page.evaluate(()=>({x:document.documentElement.scrollWidth>innerWidth,y:document.documentElement.scrollHeight>innerHeight}));
      assert.deepEqual(overflow,{x:false,y:false});
      await page.screenshot({path:`artifacts/den-rest-${width}.png`});
      console.log(width,height,'staffed den, rest recovery, backfill, no overflow or runtime errors');
      await page.close();
    }
  } finally {await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
