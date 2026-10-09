const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 3 });
    page.on('pageerror', error => console.error(error.message));
    await page.goto(process.env.PROTO_URL || 'http://localhost:5178/proto.html'); await page.waitForTimeout(1500);
    await page.screenshot({ path: 'artifacts/heros-den/topdown-3x.png' });
    let box = await page.locator('[data-board-piece="actor"]').boundingBox();
    await page.screenshot({ path: 'artifacts/heros-den/topdown-closeup.png', clip: { x: box.x + box.width / 2 - 170, y: box.y + box.height - 100, width: 340, height: 190 } });
    await page.getByRole('button', { name: 'Tilt camera view' }).click(); await page.waitForTimeout(1600);
    await page.screenshot({ path: 'artifacts/heros-den/immersion-3x.png' });
    box = await page.locator('[data-board-piece="actor"]').boundingBox();
    await page.screenshot({ path: 'artifacts/heros-den/immersion-closeup.png', clip: { x: box.x + box.width / 2 - 170, y: box.y + box.height - 100, width: 340, height: 190 } });
    console.log(await page.locator('[data-board-piece="actor"]').evaluateAll(nodes => nodes.map(el => ({ ...el.dataset, box: el.getBoundingClientRect().toJSON() }))));
    console.log(await page.locator('[data-environment-prop]').evaluateAll(nodes => nodes.map(el => ({ ...el.dataset, opacity: getComputedStyle(el).opacity }))));
    console.log(await page.locator('[data-actor-ghost]').evaluateAll(nodes => nodes.map(el => ({ display: getComputedStyle(el).display, children: el.children.length }))));
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exit(1); });
