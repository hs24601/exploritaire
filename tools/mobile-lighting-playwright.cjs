const { chromium, devices } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const base = process.env.MOBILE_LIGHT_URL || 'http://127.0.0.1:5196/proto.html';
const out = 'artifacts/mobile-lighting'; fs.mkdirSync(out, { recursive: true });
(async () => {
  const browser = await chromium.launch({ headless: true, channel: 'chrome' });
  try {
    const page = await browser.newPage({ ...devices['Pixel 7'], reducedMotion: 'reduce' });
    const errors = []; page.on('pageerror', e => errors.push(e.message));
    await page.addInitScript(() => { localStorage.setItem('exploritaire-global-lights', 'on'); });
    await page.goto(`${base}?scene=day02.woods`, { waitUntil: 'networkidle' });
    const light = page.locator('[data-lighting-renderer="mobile"]'); await light.waitFor();
    const stats = () => light.evaluate(c => {
      const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
      let alpha = 0, hash = 0; for (let i = 0; i < d.length; i++) { hash = (hash * 31 + d[i]) >>> 0; if (i % 4 === 3) alpha += d[i]; }
      return { w: c.width, h: c.height, alpha, hash };
    });
    let s = await stats(); assert.ok(s.w <= 256 && s.h <= 192 && s.alpha > 0);
    assert.equal(await page.locator('.proto-volumetrics,.proto-table-air,.proto-shafts,[data-ground-light="bounded"]').count(), 0);
    await page.screenshot({ path: `${out}/phone-night.png` });
    const settings = page.getByRole('button', { name: 'Game settings', exact: true });
    await settings.click();
    const global = page.getByRole('checkbox', { name: 'Global lights', exact: true });
    const local = page.getByRole('checkbox', { name: 'Table lights', exact: true });
    await local.uncheck(); await global.uncheck(); await page.waitForTimeout(150);
    assert.equal((await stats()).alpha, 0, 'both off clears overlay');
    await local.check(); await page.waitForTimeout(150);
    assert.ok((await stats()).alpha > 0, 'local light stays independent of global bypass');
    await local.uncheck(); await global.check();
    const night = await stats();
    const hour = page.getByRole('slider', { name: 'Table time of day' });
    await hour.fill('12'); await page.waitForTimeout(200);
    const day = await stats(); assert.notEqual(day.hash, night.hash); assert.ok(day.alpha < night.alpha);
    await local.check(); await settings.click();
    await page.getByRole('button', { name: 'Tilt camera view', exact: true }).click(); await page.waitForTimeout(650);
    const tilted = await stats(); assert.notEqual(tilted.hash, day.hash);
    await page.screenshot({ path: `${out}/phone-tilted-day.png` });
    await page.setViewportSize({ width: 844, height: 390 }); await page.waitForTimeout(400);
    s = await stats(); assert.ok(s.w <= 256 && s.h <= 192 && s.alpha > 0);
    await page.screenshot({ path: `${out}/landscape.png` });
    await page.getByRole('button', { name: 'Flat camera view', exact: true }).click(); await page.waitForTimeout(650);
    assert.ok((await stats()).alpha > 0);
    assert.deepEqual(errors, []); await page.close();
    for (const [query, mobile] of [['lightingRenderer=mobile', true], ['lightingRenderer=desktop', false]]) {
      const p = await browser.newPage({ viewport: { width: 1280, height: 800 }, reducedMotion: 'reduce' });
      p.on('pageerror', e => errors.push(e.message));
      await p.goto(`${base}?scene=day01.home&${query}`, { waitUntil: 'networkidle' });
      assert.equal(await p.locator('[data-lighting-renderer="mobile"]').count(), mobile ? 1 : 0);
      assert.equal(await p.locator('.proto-volumetrics').count(), mobile ? 0 : 1);
      await p.screenshot({ path: `${out}/${mobile ? 'forced-mobile' : 'desktop'}.png` }); await p.close();
    }
    assert.deepEqual(errors, []);
    console.log('PASS phone detection, bounded 2D output, global/local independence, day/night, tilt/flat, rotation, desktop path and A/B overrides.');
  } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
