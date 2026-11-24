const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const center = r => ({ x: r.x + r.width / 2, y: r.y + r.height / 2 });
(async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    for (const width of [1280, 1912]) for (const touch of [false, true]) {
      const context = await browser.newContext({ viewport: { width, height: width === 1280 ? 720 : 914 }, hasTouch: true, reducedMotion: 'reduce' });
      const page = await context.newPage();
      const errors = [];
      page.on('pageerror', e => errors.push(e.message));
      await page.goto(process.env.PROTO_URL || 'http://127.0.0.1:5180/proto.html');
      await page.locator('.proto-story-card').waitFor();
      const cdp = touch ? await context.newCDPSession(page) : null;
      const input = async (type, p) => {
        if (touch) await cdp.send('Input.dispatchTouchEvent', { type, touchPoints: ['touchEnd', 'touchCancel'].includes(type) ? [] : [p] });
        else if (type === 'touchStart') { await page.mouse.move(p.x, p.y); await page.mouse.down(); }
        else if (type === 'touchMove') await page.mouse.move(p.x, p.y, { steps: 5 });
        else await page.mouse.up();
      };
      for (const immersive of [false, true]) for (const yaw of [0, 45]) {
        await page.goto(process.env.PROTO_URL || 'http://127.0.0.1:5180/proto.html');
        await page.locator('.proto-story-card').waitFor();
        await page.waitForTimeout(700);
        console.log('Checking', width, touch, immersive, yaw);
        if (immersive) await page.keyboard.press('Space');
        if (yaw) await page.keyboard.press('e');
        await page.waitForTimeout(650);
        assert.equal((await page.locator('.proto-table-stage--tilted').count()) > 0, immersive);
        // Open the floating mountain inspector, then drag the quest across scenery.
        const mountain = page.locator('[data-biome-id][title^="Impassable mountain"]').first();
        await mountain.click({ force: true });
        const target = center(await page.locator('[data-biome-id="hero-den"]').boundingBox());
        await page.locator('.details-card-viewer--floating').evaluateAll((elements, p) => {
          for (const el of elements) { el.style.left = `${p.x}px`; el.style.top = `${p.y - 150}px`; }
        }, target);
        const camera = await page.locator('.proto-map-viewport').evaluate(el => ['--camera-x', '--camera-y', '--camera-scale', '--camera-yaw'].map(k => getComputedStyle(el).getPropertyValue(k)));
        const card = page.locator('.proto-story-card:not([data-held-visual])');
        const start = await card.evaluate(el => {
          const box = el.getBoundingClientRect();
          for (const y of [0.15, 0.3, 0.5, 0.7]) for (const x of [0.5, 0.3, 0.7]) {
            const p = { x: box.x + box.width * x, y: box.y + box.height * y };
            const hit = document.elementFromPoint(p.x, p.y);
            if (hit && el.contains(hit) && !hit.closest('button')) return p;
          }
          throw Error('No accessible pickup point');
        });
        await input('touchStart', start);
        await input('touchMove', target);
        const face = page.locator('[data-held-visual]');
        await face.waitFor();
        assert.match(await face.innerText(), /An ordinary day/);
        assert.equal(await card.evaluate(el => el.style.opacity), '0');
        assert.deepEqual(await page.locator('.proto-map-viewport').evaluate(el => ['--camera-x', '--camera-y', '--camera-scale', '--camera-yaw'].map(k => getComputedStyle(el).getPropertyValue(k))), camera);
        await face.evaluate(el => {
          const r = el.getBoundingClientRect();
          if (r.left < 0 || r.top < 0 || r.right > innerWidth || r.bottom > innerHeight) throw Error('Held face is clipped by the screen');
          if (Math.abs(r.width / r.height - 63 / 88) > 0.01) throw Error('Held portrait ratio changed');
          if (el.parentElement !== document.body) throw Error('Held face remains in the camera');
          el.inert = false; el.style.pointerEvents = 'auto';
          for (const x of [0.1, 0.5, 0.9]) for (const y of [0.1, 0.5, 0.9]) {
            const px = r.left + r.width * x, py = r.top + r.height * y;
            if (px < 0 || py < 0 || px >= innerWidth || py >= innerHeight) continue;
            const hit = document.elementFromPoint(px, py);
            if (hit !== el && !el.contains(hit)) throw Error('Table item covers held face');
          }
          el.inert = true; el.style.pointerEvents = 'none';
        });
        if (immersive && yaw) await page.screenshot({ path: `artifacts/held-layer-${width}-${touch ? 'touch' : 'mouse'}.png` });
        await input(yaw ? 'touchCancel' : 'touchEnd', target);
        await page.waitForTimeout(100);
        assert.equal(await face.count(), 0);
        assert.equal(await card.evaluate(el => el.style.opacity), '');
      }
      assert.deepEqual(errors, []);
      console.log('PASS held layers', width, touch ? 'touch' : 'mouse');
      await context.close();
    }
  } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exit(1); });
