const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const { findLayoutDefects } = require('./lib/layout-check.cjs');
(async () => {
  const browser = await chromium.launch({ headless: true, executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe' });
  try {
    for (const width of [1280, 1912]) {
      const page = await browser.newPage({ viewport: { width, height: 914 }, deviceScaleFactor: 3 });
      await page.goto('http://127.0.0.1:5178/proto.html?cinema=on');
      await page.locator('.proto-callout-text').waitFor({ state: 'visible', timeout: 90000 });
      await page.locator('[data-media-loading]').waitFor({ state: 'hidden', timeout: 90000 });
      await page.waitForFunction(() => document.querySelector('.proto-callout-text')?.textContent === '...breakfast!');
      const inspect = () => page.locator('.proto-callout-content').evaluate(el => ({
        opacity: getComputedStyle(el).opacity,
        animations: el.getAnimations().map(a => ({ state: a.playState, time: a.currentTime })),
      }));
      assert.equal((await inspect()).opacity, '1', 'The bubble must be painted, not merely DOM-visible');
      assert.deepEqual(await findLayoutDefects(page, '.proto-callout-content', { parts: '.proto-callout-text, .proto-callout-edit' }), []);
      await page.evaluate(async () => { const { gameTime } = await import('/src/gameTime.ts'); gameTime.setPaused(true); });
      assert.equal((await inspect()).opacity, '1', 'Pausing never hides the dialogue');
      await page.evaluate(async () => { const { gameTime } = await import('/src/gameTime.ts'); gameTime.setPaused(false); });
      await page.waitForTimeout(300);
      assert.equal((await inspect()).opacity, '1');
      assert.ok((await inspect()).animations.every(a => a.state !== 'paused'), 'CSS entrance resumes after pause');
      await page.screenshot({ path: `artifacts/opening-callout-visible-${width}.png` });
      await page.locator('.proto-callout-content').screenshot({ path: `artifacts/opening-callout-detail-${width}.png`, scale: 'device' });
      console.log(`${width}: painted breakfast callout, layout, pause and resume passed`);
      await page.close();
    }
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exit(1); });

