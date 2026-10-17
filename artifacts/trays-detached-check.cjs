const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const { findLayoutDefects } = require('../tools/lib/layout-check.cjs');

(async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    for (const [width, height] of [[1912, 914], [1280, 720]]) {
      const page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: 3 });
      const errors = [], modules = [];
      page.on('pageerror', error => errors.push(error.message));
      page.on('request', request => modules.push(request.url()));
      for (const scenario of ['', '?combatdemo']) {
        await page.goto('http://localhost:5178/proto.html' + scenario);
        await page.locator('.proto-build-label').waitFor();
        await page.waitForTimeout(1200);
        assert.equal(await page.locator('.quest-tray, .supply-tray, .tray-restore').count(), 0);
        assert.deepEqual(await page.locator('.proto-mobile-nav button').allTextContents(), ['Table', 'Tableau']);
        assert.ok(!modules.some(url => /\/(QuestField|SettlementSupplyTray|TrayRestoreHandle)\.tsx/.test(url)), 'Detached tray modules must not load');
        const layout = await page.locator('.proto-main-layout').evaluate(el => ({
          areas: getComputedStyle(el).gridTemplateAreas,
          columns: getComputedStyle(el).gridTemplateColumns,
          scrolls: document.documentElement.scrollWidth > innerWidth || document.documentElement.scrollHeight > innerHeight,
        }));
        assert.ok(!/quest|supply/.test(layout.areas));
        assert.equal(layout.columns.split(' ').length, scenario ? 2 : 1);
        assert.equal(layout.scrolls, false);
        const defects = await findLayoutDefects(page, '.proto-main-layout', { parts: ':scope > .proto-main-header, :scope > .proto-map, :scope > .proto-tableau-field, :scope > .combat-demo' });
        // The map deliberately clips its camera world; tile titles have an
        // explicit compact-fit exception to the 16px floor in GAME.md.
        assert.deepEqual(defects.filter(defect => defect !== '.proto-map clips its content' && !defect.startsWith('.proto-tile-title__line text ')), []);
        const name = `${width}-${scenario ? 'combat' : 'table'}`;
        await page.screenshot({ path: `artifacts/trays-detached-${name}-3x.png` });
        console.log(name, layout, await page.locator('.proto-build-label').textContent());
      }
      assert.deepEqual(errors, []);
      await page.close();
    }
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
