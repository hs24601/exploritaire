const { chromium } = require('playwright');
const assert = require('node:assert/strict');

(async () => {
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage();
    // Exercise the real dev-only module without loading the game or editing data.
    await page.route('**/freshness-fixture', route => route.fulfill({
      contentType: 'text/html', body: '<script type="module" src="/src/devFreshness.ts"></script>',
    }));
    let stale = false;
    let checks = 0;
    await page.route('**/__playtest-revision?*', async route => {
      checks++;
      if (stale) return route.fulfill({ json: { revision: 'changed-source' } });
      await route.continue();
    });
    let navigations = 0;
    page.on('framenavigated', frame => { if (frame === page.mainFrame()) navigations++; });
    await page.goto('http://localhost:5178/freshness-fixture');
    await page.waitForFunction(() => performance.getEntriesByType('resource').some(r => r.name.includes('__playtest-revision')));
    assert.equal(navigations, 1);
    stale = true;
    const navigation = page.waitForEvent('framenavigated');
    await page.evaluate(() => window.dispatchEvent(new Event('pageshow')));
    await navigation;
    assert.ok(checks >= 2);
    await page.close();
    const response = await browser.newPage();
    const html = await response.goto('http://localhost:5178/proto.html');
    assert.equal(html.status(), 200);
    assert.equal(html.headers()['cache-control'], 'no-store');
    assert.ok((await html.text()).includes('/src/devFreshness.ts'));
    console.log('PASS: current revision stays loaded; resumed stale page reloads; Proto serves no-store with freshness check.');
  } finally {
    await browser.close();
  }
})().catch(error => { console.error(error); process.exit(1); });
