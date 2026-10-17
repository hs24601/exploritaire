const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const { findLayoutDefects } = require('../tools/lib/layout-check.cjs');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const before = process.argv.includes('--before');
  try {
    for (const [width, height] of [[1912, 914], [1280, 720]]) {
      for (const tilted of [false, true]) {
        const page = await browser.newPage({ viewport: { width, height }, hasTouch: width === 1280 });
        await page.goto('http://localhost:5178/proto.html?fx=high');
        await page.locator('button[data-biome-id="pond"]').waitFor();
        if (tilted) await page.getByRole('button', { name: 'Tilt camera view', exact: true }).click();
        await page.waitForTimeout(1100);
        const tag = `${width}-${tilted ? 'tilt' : 'flat'}-${before ? 'before' : 'after'}`;
        const tiles = page.locator('button[data-board-piece="tile"]');
        const styles = await tiles.evaluateAll(elements => elements.map(el => {
          const style = getComputedStyle(el);
          return { id: el.dataset.biomeId, shadow: style.boxShadow, radius: style.borderRadius,
            transform: style.transform, width: el.offsetWidth, height: el.offsetHeight, border: style.borderWidth };
        }));
        console.log(tag, JSON.stringify(styles));
        if (!before) {
          for (const tile of styles) {
            assert.equal(tile.shadow, 'none', `${tag}: ${tile.id} casts a ground shadow`);
            assert.equal(tile.radius, '0px', `${tag}: ${tile.id} has rounded ground corners`);
            assert.equal(tile.border, '0px');
            if (tile.transform.startsWith('matrix3d')) assert.equal(Number(tile.transform.slice(9, -1).split(',')[14]), 0, 'Ground must be at sea level');
            const defects = await findLayoutDefects(page, `button[data-biome-id="${tile.id}"]`, { parts: '.board-object-label' });
            assert.deepEqual(defects, [], `${tag}: ${tile.id} layout`);
          }
        }
        await page.screenshot({ path: `artifacts/tile-${tag}.png` });
        // Capture the changed ground and labels at 3x camera zoom, as required by GAME.md.
        const viewport = await page.locator('.proto-map-viewport').boundingBox();
        await page.mouse.move(viewport.x + viewport.width / 2, viewport.y + viewport.height / 2);
        await page.mouse.wheel(0, -910);
        await page.waitForTimeout(700);
        const rects = await tiles.evaluateAll(elements => elements.map(el => el.getBoundingClientRect().toJSON()));
        const left = Math.max(0, Math.min(...rects.map(r => r.left)) - 15);
        const top = Math.max(0, Math.min(...rects.map(r => r.top)) - 30);
        const right = Math.min(width, Math.max(...rects.map(r => r.right)) + 15);
        const bottom = Math.min(height, Math.max(...rects.map(r => r.bottom)) + 15);
        await page.screenshot({ path: `artifacts/tile-${tag}-close.png`, clip: { x: left, y: top, width: right-left, height: bottom-top } });
        if (!before) {
          const hero = await page.locator('[data-board-piece="actor"]').boundingBox();
          const pond = page.locator('button[data-biome-id="pond"]');
          const pondBox = await pond.boundingBox();
          const start = { x: hero.x + hero.width / 2, y: hero.y + hero.height * .7 };
          const end = { x: pondBox.x + pondBox.width / 2, y: pondBox.y + pondBox.height * .6 };
          const cdp = width === 1280 ? await page.context().newCDPSession(page) : null;
          const touch = (type, point) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [point] });
          if (cdp) await touch('touchStart', start);
          else { await page.mouse.move(start.x, start.y); await page.mouse.down(); }
          for (let i = 1; i <= 16; i++) {
            const point = { x: start.x + (end.x-start.x)*i/16, y: start.y + (end.y-start.y)*i/16 };
            if (cdp) await touch('touchMove', point); else await page.mouse.move(point.x, point.y);
            await page.waitForTimeout(16);
          }
          assert.equal(await pond.getAttribute('data-drop-target'), 'true', `${tag}: missing drop cue`);
          if (cdp) await touch('touchEnd', end); else await page.mouse.up();
          await page.waitForFunction(() => document.querySelector('button[data-biome-id="pond"]').dataset.explored === '1.00', null, { timeout: 15000 });
          await page.waitForTimeout(500);
          assert.equal(await pond.getAttribute('data-drop-target'), null);
          assert.equal(await pond.evaluate(el => getComputedStyle(el).boxShadow), 'none');
          assert.equal(await pond.evaluate(el => getComputedStyle(el).outlineStyle), 'solid', 'Selected ground retains its outline');
          assert.deepEqual(await findLayoutDefects(page, 'button[data-biome-id="pond"]', { parts: '.board-object-label' }), []);
          console.log(`${tag}: ${cdp ? 'touch' : 'mouse'} drop, exploration, selection and label layout passed`);
        }
        await page.close();
      }
    }
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
