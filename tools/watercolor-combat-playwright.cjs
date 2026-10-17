const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const url = process.env.PROTO_URL || 'http://127.0.0.1:5192/proto.html';
(async () => {
  fs.mkdirSync('artifacts/actor-watercolor-v1', { recursive: true });
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 2 });
    const errors = [], assets = new Set();
    page.on('pageerror', e => errors.push(e.message));
    page.on('response', response => {
      if (/\/(watercolor-v1|bobtail-v2)\//.test(response.url())) {
        assert.ok([200,304].includes(response.status())); assets.add(response.url());
      }
    });
    await page.goto(url + '?combatdemo');
    await page.waitForFunction(() => JSON.parse(document.querySelector('.combat-demo__arena')?.dataset.actors || '[]').some(a => a.id === 'hero'));
    const snapshot = () => page.locator('.combat-demo__arena').evaluate(el => JSON.parse(el.dataset.actors));
    assert.ok((await snapshot()).some(a => a.id.startsWith('enemy')) || (await snapshot()).length >= 4);
    await page.locator('.combat-demo__tools > summary').click();
    await page.getByRole('button', { name: 'Cinematic', exact: true }).click();
    await page.waitForFunction(() => JSON.parse(document.querySelector('.combat-demo__arena')?.dataset.actors || '[]').find(a => a.id === 'hero')?.pose === 'walking');
    const phases = new Set();
    for (let i = 0; i < 16; i++) {
      const hero = (await snapshot()).find(a => a.id === 'hero');
      if (hero.pose === 'walking') phases.add(hero.animationFrame);
      await page.waitForTimeout(80);
    }
    assert.ok(phases.size >= 2, 'combat gait advances');
    await page.screenshot({ path: 'artifacts/actor-watercolor-v1/combat-cinematic.png' });
    await page.locator('[data-view="overview"]').click();
    await page.waitForTimeout(900);
    await page.screenshot({ path: 'artifacts/actor-watercolor-v1/combat-overhead.png' });
    assert.equal([...assets].filter(src=>src.includes('/assets/actors/battle/')).length, 10, 'all body atlases and the independent flame atlas load');
    assert.ok([...assets].some(src=>src.endsWith('/biomes/watercolor-v1/woods-cluster-sprite-v1.png')), 'approved painted woods load');
    assert.deepEqual(errors, []);
    console.log('PASS ten painted body/effect atlases, combat gait, camera views, no browser errors');
  } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exit(1); });
