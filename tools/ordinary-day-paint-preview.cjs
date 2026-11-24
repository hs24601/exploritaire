const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const { findLayoutDefects } = require('./lib/layout-check.cjs');
(async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    for (const width of [1280, 1912]) {
      const page = await browser.newPage({ viewport: { width, height: width === 1280 ? 720 : 914 }, deviceScaleFactor: 3 });
      await page.goto(process.env.PROTO_URL || 'http://127.0.0.1:5186/proto.html');
      const card = page.locator('.proto-story-card:not([data-held-visual])');
      await card.waitFor();
      const checkArt = async (name) => {
        await page.waitForFunction(name => [...document.querySelectorAll('.proto-ordinary-day .quest-artwork img')].every(img => img.complete && img.naturalWidth > 0 && img.src.endsWith(name)), name);
      };
      await checkArt('hero-snuffling-berries-paint-bobtail-v2.png');
      await card.screenshot({ path: `artifacts/ordinary-day-paint-${width}-3x.png` });
      await card.click();
      await page.locator('.card-jumbo').waitFor();
      assert.deepEqual(await findLayoutDefects(page, '.card-jumbo .proto-ordinary-day', { parts: '.proto-ordinary-day__heading,.quest-artwork,.proto-ordinary-day__thought,.proto-ordinary-day__actions' }), []);
      await page.locator('.card-jumbo').screenshot({ path: `artifacts/ordinary-day-paint-jumbo-${width}-3x.png` });
      await page.keyboard.press('Escape');
      await page.evaluate(async () => (await import('/src/proto/artStyle.ts')).setArtStyle('pixel'));
      await checkArt('hero-snuffling-berries-v1.png');
      await page.evaluate(async () => (await import('/src/proto/artStyle.ts')).setArtStyle('paint'));
      await checkArt('hero-snuffling-berries-paint-bobtail-v2.png');
      console.log(`PASS painted quest, jumbo layout and live style switching ${width}`);
      await page.close();
    }
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
