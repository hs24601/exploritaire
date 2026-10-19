const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const { findLayoutDefects } = require('./lib/layout-check.cjs');
(async () => {
  const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe' });
  try {
    for (const [width, height] of [[1280, 720], [390, 844], [844, 390]]) {
      if (process.argv.length > 2 && !process.argv.slice(2).includes(String(width))) continue;
      const page = await browser.newPage({ viewport: { width, height }, reducedMotion: 'reduce', deviceScaleFactor: 3 });
      page.setDefaultTimeout(60000);
      const errors = [];
      page.on('pageerror', e => errors.push(e.message));
      await page.goto('http://127.0.0.1:5189/proto.html');
      const tree = page.getByRole('complementary', { name: 'Tutorial scene tree' });
      const toggle = tree.getByRole('button', { name: /Scenes/ });
      await toggle.click();
      assert(await tree.locator('li button').count() >= 16);
      assert.deepEqual(await findLayoutDefects(page, '#tutorial-scenes', { parts: 'header,nav > p,summary,li button', minFontSize: 16 }), []);
      const names = process.argv.includes('--readouts') ? ['Home with Banks'] : ['Opening conversation', 'Clear the den exit', 'Pick the first berry', 'Reach the denser patch', 'Have supper', 'Finish resting', 'Reach the darker woods', 'Home with Banks'];
      for (const name of names) {
        await tree.getByRole('button', { name: new RegExp(name) }).click();
        await page.waitForTimeout(250);
        assert.equal(await tree.locator('[role="alert"]').count(), 0, `checkpoint ${name}`);
        await page.waitForFunction(() => document.querySelector('.scene-tree [aria-current="step"]'));
        assert.equal(await tree.locator('[aria-current="step"]').count(), 1, `${width}: ${name}`);
        const scene = page.getByLabel('Scene ID', { exact: true });
        const coordinate = page.getByLabel('Table grid coordinate', { exact: true });
        const sceneBox = await scene.boundingBox(), coordinateBox = await coordinate.boundingBox();
        assert(sceneBox.y + sceneBox.height <= coordinateBox.y + 1, 'scene ID sits above table coordinates');
        const debug = page.getByLabel('Hero current grid location', { exact: true });
        assert.match(await debug.innerText(), /table:-?\d+,-?\d+/);
        const debugBox = await debug.boundingBox();
        const trackerBox = await page.locator('.day-objective__tracker').boundingBox();
        if (trackerBox) assert(Math.min(debugBox.x + debugBox.width, trackerBox.x + trackerBox.width) <= Math.max(debugBox.x, trackerBox.x) || Math.min(debugBox.y + debugBox.height, trackerBox.y + trackerBox.height) <= Math.max(debugBox.y, trackerBox.y), `${width} ${name}: actor coordinates ${JSON.stringify(debugBox)} do not overlap quest tracker ${JSON.stringify(trackerBox)}`);
        assert.deepEqual(await findLayoutDefects(page, '.proto-map-location-readouts', { parts: '.proto-map-scene-id,.table-grid-reference', minFontSize: 16 }), []);
        assert.deepEqual(await findLayoutDefects(page, '.actor-map-card__debug', { parts: 'output', minFontSize: 16 }), []);
        if (name === 'Opening conversation' && !process.argv.includes('--readouts')) {
          await page.waitForFunction(async () => {
            const { captureCameraShot } = await import('/src/proto/cameraDirector.ts');
            return Math.abs((captureCameraShot()?.scale ?? 0) - 10.469) < .01;
          });
          assert.equal(await page.locator('.proto-map[data-opening-cards="pending"]').count(), 0);
        }
      }
      const bounds = await tree.locator('nav').boundingBox();
      assert(bounds.x >= 0 && bounds.y >= 0 && bounds.x + bounds.width <= width && bounds.y + bounds.height <= height);
      await page.screenshot({ path: `artifacts/scene-tree-${width}.png` });
      await tree.getByRole('button', { name: 'Close scene tree' }).click();
      const debugBounds = await page.locator('.actor-map-card__debug').boundingBox(), tabBounds = await toggle.boundingBox();
      assert(Math.min(debugBounds.x + debugBounds.width, tabBounds.x + tabBounds.width) <= Math.max(debugBounds.x, tabBounds.x) || Math.min(debugBounds.y + debugBounds.height, tabBounds.y + tabBounds.height) <= Math.max(debugBounds.y, tabBounds.y), 'collapsed Scenes tab does not obscure actor coordinates');
      await page.locator('.proto-map').screenshot({ path: `artifacts/scene-debug-${width}-3x.png` });
      await toggle.click();
      await tree.locator('nav').evaluate(n => { n.scrollTop = 0; });
      await tree.locator('nav').screenshot({ path: `artifacts/scene-tree-${width}-3x.png` });
      await tree.getByRole('button', { name: 'Close scene tree' }).click();
      assert.equal(await toggle.getAttribute('aria-expanded'), 'false');
      assert.deepEqual(errors, []);
      await page.close();
    }
    console.log('Scene tree: desktop, portrait and landscape checkpoint navigation passed.');
  } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
