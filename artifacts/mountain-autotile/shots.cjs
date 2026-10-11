const { chromium } = require('playwright');
const URL = process.env.PROTO_URL || 'http://localhost:5178/proto.html';
const tag = process.argv[2] || 'before';
(async () => {
  const browser = await chromium.launch({ headless: true });
  for (const [width, height] of [[1912, 914], [1280, 720]]) {
    const page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: 2 });
    const errors = []; page.on('pageerror', e => errors.push(e.message));
    await page.goto(URL); await page.locator('[data-biome-id="hero-den"]').waitFor(); await page.waitForTimeout(800);
    const den = await page.locator('[data-biome-id="mountain-0-3"]').boundingBox();
    const cx = den.x + den.width / 2, cy = den.y;
    await page.mouse.move(cx, cy); await page.mouse.wheel(0, -500); await page.waitForTimeout(500); await page.mouse.move(5, 5);
    const map = await page.locator('.proto-map-viewport').boundingBox();
    const clip = { x: map.x, y: map.y, width: map.width, height: map.height };
    await page.screenshot({ path: `artifacts/mountain-autotile/${tag}-${width}-flat.png`, clip });
    await page.keyboard.press('Space'); await page.waitForTimeout(1500);
    await page.screenshot({ path: `artifacts/mountain-autotile/${tag}-${width}-tilt.png`, clip });
    await page.keyboard.press('e'); await page.waitForTimeout(800);
    await page.screenshot({ path: `artifacts/mountain-autotile/${tag}-${width}-tilt-spin.png`, clip });
    console.log(width, 'errors:', errors);
    await page.close();
  }
  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
