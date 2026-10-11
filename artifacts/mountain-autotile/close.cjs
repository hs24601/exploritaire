const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch(); const page = await b.newPage({ viewport: { width: 1912, height: 914 }, deviceScaleFactor: 2 });
  await page.goto('http://localhost:5178/proto.html'); await page.locator('[data-biome-id="hero-den"]').waitFor(); await page.waitForTimeout(800);
  await page.keyboard.press('Space'); await page.waitForTimeout(1500);
  const t = await page.locator('[data-biome-id="mountain-0-3"]').boundingBox();
  await page.mouse.move(t.x + t.width / 2, t.y); await page.mouse.wheel(0, -900); await page.waitForTimeout(700); await page.mouse.move(5, 5); await page.waitForTimeout(500);
  const map = await page.locator('.proto-map-viewport').boundingBox();
  console.log('seams', await page.locator('[data-biome-edge*=">"]').count());
  for (let i = 0; i < 3; i++) { await page.screenshot({ path: `artifacts/mountain-autotile/close-${i}.png`, clip: map }); await page.keyboard.press('e'); await page.keyboard.press('e'); await page.waitForTimeout(900); }
  await b.close();
})();
