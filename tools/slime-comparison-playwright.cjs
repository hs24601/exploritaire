const { chromium } = require('playwright');
const { findLayoutDefects } = require('./lib/layout-check.cjs');
const assert = require('node:assert/strict');
const fs = require('node:fs');
(async () => {
  fs.mkdirSync('artifacts/slime-comparison', { recursive: true });
  const browser = await chromium.launch({ headless: true });
  try {
    for (const [width, height] of [[1280,720],[1912,914]]) {
      const reduced = width === 1912;
      const page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: 3, reducedMotion: reduced ? 'reduce' : 'no-preference' });
      const errors = []; page.on('pageerror', error => errors.push(error.message));
      page.on('console', message => { if(message.type()==='error' && /shader|WebGLProgram/i.test(message.text())) errors.push(message.text()); });
      await page.goto((process.env.PROTO_URL || 'http://127.0.0.1:5197/proto.html') + '?woods-combat');
      await page.waitForFunction(() => {
        const actors = JSON.parse(document.querySelector('.banks-rescue-cinema .combat-demo__arena')?.dataset.actors || '[]');
        return ['dark-slime','rear-slime'].every(id => actors.some(a => a.id === id && a.visible));
      }, { timeout: 60000 });
      const inkTime = () => page.locator('.banks-rescue-cinema .combat-demo__arena').evaluate(el => JSON.parse(el.dataset.actors).find(a=>a.id==='rear-slime').shadowInkTime);
      const before = await inkTime(); await page.waitForTimeout(450);
      if (reduced) assert.equal(await inkTime(), 0, 'reduced motion keeps a settled ink form');
      else assert.ok((await inkTime()) > before, 'ink boundary clock advances');
      await page.getByRole('button', { name: 'Pause cinema', exact: true }).click();
      await page.waitForTimeout(600);
      const frozen = await inkTime(); await page.waitForTimeout(300);
      assert.equal(await inkTime(), frozen, 'local pause freezes ink spreading');
      for (const id of ['dark-slime','rear-slime']) {
        const target = page.locator(`.banks-rescue-cinema [data-scene-target="${id}"]`);
        assert.ok(await target.isVisible(), id + ' visible in camera');
      }
      const defects = await findLayoutDefects(page, '.slime-comparison-caption', { parts: '*' });
      assert.deepEqual(defects, []);
      await page.screenshot({ path: `artifacts/slime-comparison/${width}.png` });
      const stage = page.locator('.banks-rescue-cinema__stage');
      await stage.screenshot({ path: `artifacts/slime-comparison/${width}-stage.png`, scale: 'device' });
      const arena=page.locator('.banks-rescue-cinema .combat-demo__arena');
      const cameraBefore=await arena.getAttribute('data-camera-position');
      const facingBefore=await arena.evaluate(el=>JSON.parse(el.dataset.actors).find(a=>a.id==='rear-slime').billboardYaw);
      const box=await arena.boundingBox();
      await page.mouse.move(box.x+box.width*.60,box.y+box.height*.70);
      await page.mouse.down();
      await page.mouse.move(box.x+box.width*.60+240,box.y+box.height*.70-30,{steps:16});
      await page.mouse.up(); await page.waitForTimeout(150);
      assert.notEqual(await arena.getAttribute('data-camera-position'),cameraBefore,'camera actually orbits');
      assert.equal(await arena.evaluate(el=>JSON.parse(el.dataset.actors).find(a=>a.id==='rear-slime').billboardYaw),facingBefore,'shadow eyes retain world facing while camera orbits');
      await stage.screenshot({path:`artifacts/slime-comparison/${width}-orbit.png`,scale:'device'});
      assert.deepEqual(errors, []);
      console.log(`PASS ${width}: visible volume, world-facing eyes under orbit, ink ${reduced?'reduced motion':'animation'}, pause, layout, no shader/browser errors`);
      await page.close();
    }
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exit(1); });
