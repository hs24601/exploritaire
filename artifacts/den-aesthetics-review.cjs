const { chromium } = require('playwright');
const assert = require('node:assert/strict');
(async () => {
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage({ viewport: { width: 1912, height: 914 }, deviceScaleFactor: 3, ignoreHTTPSErrors: true });
    const response = await page.goto('http://localhost:5178/proto.html');
    assert.equal(response.status(), 200);
    await page.waitForTimeout(1200);
    const denTile = page.locator('[data-biome-id="hero-den"]');
    await denTile.screenshot({ path: 'artifacts/heros-den/roof-contour-closeup-3x.png' });
    await page.getByRole('button', { name: 'Turn table right', exact: true }).click();
    await page.waitForTimeout(600);
    await denTile.screenshot({ path: 'artifacts/heros-den/roof-contour-45-closeup-3x.png' });
    await page.getByRole('button', { name: 'Reset View', exact: true }).click();
    await page.waitForTimeout(700);
    const center = async locator => { const r = await locator.boundingBox(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; };
    const from = await center(page.locator('[data-cell-grip="actor-hero"]'));
    const to = await center(page.locator('[data-biome-id="road-east"]'));
    await page.mouse.move(from.x, from.y); await page.mouse.down();
    await page.mouse.move(to.x, to.y, { steps: 15 }); await page.mouse.up();
    await page.waitForTimeout(2200);
    const tilt = page.getByRole('button', { name: 'Tilt camera view', exact: true });
    if (await tilt.count()) await tilt.click();
    await page.waitForTimeout(1000);
    const popup = page.locator('[data-biome-popup="hero-den"]');
    const tileBox = await denTile.boundingBox(), popupBox = await popup.boundingBox();
    const left = Math.max(0, Math.min(tileBox.x, popupBox.x) - 100), top = Math.max(0, Math.min(tileBox.y, popupBox.y) - 60);
    await page.screenshot({ path: 'artifacts/heros-den/empty-front-closeup-3x.png', clip: { x: left, y: top, width: Math.min(600, 1912 - left), height: Math.min(420, 914 - top) } });
    console.log(await page.locator('.proto-build').allTextContents());
    const tailnet = await page.request.get('https://zenduo.tail867eff.ts.net/proto.html');
    assert.equal(tailnet.status(), 200);
    console.log('Local Proto and tailnet HTTPS return 200. Close-up OTT and empty immersive screenshots saved.');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
