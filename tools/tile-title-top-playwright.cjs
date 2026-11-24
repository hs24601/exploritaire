const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { findLayoutDefects } = require('./lib/layout-check.cjs');
const URL = process.env.PROTO_URL || 'http://localhost:5178/proto.html';
(async () => {
  fs.mkdirSync('artifacts/title-top', { recursive: true });
  const browser = await chromium.launch({ headless: true });
  try {
    for (const width of [1280, 1912]) {
      const page = await browser.newPage({ viewport: { width, height: width === 1280 ? 720 : 914 }, deviceScaleFactor: 3, reducedMotion: 'reduce' });
      const errors = [];
      page.on('pageerror', error => errors.push(error.message));
      await page.goto(URL);
      const mountainTitle = page.locator('[data-connected-label] .proto-tile-title[aria-label="Impassable Mountains"]');
      assert.equal(await mountainTitle.count(), 1, 'Connected mountains share one label around the den');
      assert.equal(await page.locator('[data-den-title] .proto-tile-title').count(), 1, 'The den keeps its own name');
      assert.equal(await mountainTitle.locator('..').getAttribute('data-region-tile-count'), '5');
      // Bring the whole range above the overlay toolbar for visual review.
      const viewport = await page.locator('.proto-map-viewport').boundingBox();
      await page.mouse.move(viewport.x + viewport.width * .75, viewport.y + viewport.height * .5);
      await page.mouse.down({ button: 'right' });
      await page.mouse.move(viewport.x + viewport.width * .75, viewport.y + viewport.height * .5 - 120, { steps: 8 });
      await page.mouse.up({ button: 'right' });
      await page.waitForTimeout(200);
      await page.locator('[data-connected-terrain]').screenshot({ path: `artifacts/title-top/${width}-connected-mountains-3x.png` });
      // A fresh page keeps movement checks independent of screenshot framing.
      await page.reload();
      await page.locator('[data-cell-grip="actor-hero"]').waitFor();
      await page.waitForTimeout(400);
      const grip = await page.locator('[data-cell-grip="actor-hero"]').boundingBox();
      const road = await page.locator('button[data-biome-id="road-center"]').boundingBox();
      await page.mouse.move(grip.x + grip.width / 2, grip.y + grip.height / 2);
      await page.mouse.down();
      for (let step = 1; step <= 12; step++) {
        await page.mouse.move(grip.x + grip.width / 2 + (road.x + road.width / 2 - grip.x - grip.width / 2) * step / 12,
          grip.y + grip.height / 2 + (road.y + road.height / 2 - grip.y - grip.height / 2) * step / 12);
        await page.waitForTimeout(20);
      }
      await page.mouse.up();
      await page.waitForFunction(() => document.querySelector('[data-actor-id="hero"]')?.dataset.gridReference === 'table:0,0');
      await page.waitForTimeout(800);
      if (await page.locator('[data-camera-view="immersive"]').count()) { await page.keyboard.press('Space'); await page.waitForTimeout(650); }
      await page.getByRole('button', { name: 'Reset View', exact: true }).click();
      await page.waitForTimeout(400);
      for (let turn = 0; turn < 8; turn++) {
        if (turn) { await page.getByRole('button', { name: 'Turn table right', exact: true }).click(); await page.waitForTimeout(400); }
        const result = await page.locator('.proto-tile-title').evaluateAll(frames => frames.map((frame, index) => {
          const host = frame.closest('[data-biome-id],[data-connected-label],[data-den-title],[data-biome-title]');
          host.dataset.titleCheck = String(index);
          const lines = [...frame.children];
          return { index, den: host.hasAttribute('data-den-title'), lineCount: lines.length, align: frame.dataset.titleAlign, overflow: frame.dataset.labelOverflow,
            title: frame.getAttribute('aria-label').toUpperCase().replace(/\s/g, ''),
            value: lines.map(line => line.textContent).join('').replace(/\s/g, ''),
            top: parseFloat(lines[0].style.top), bottom: parseFloat(lines.at(-1).style.top) + parseFloat(lines.at(-1).style.lineHeight), expectedTop: -(parseFloat(host.style.height) - 8) / 2 };
        }));
        assert.ok(result.length >= 6, 'Discovered woods, pond, road, den and mountains have titles');
        assert.equal(await page.locator('.proto-tile-title[aria-label="Small Woods"]').count(), 1, 'Adjacent discovered woods also share one label');
        assert.equal(await mountainTitle.count(), 1, 'Rotation keeps one label for the mountain group');
        for (const title of result) {
          assert.equal(title.align, title.den ? 'bottom' : 'top');
          if (title.den) assert.equal(title.lineCount, 1, 'Den title stays on one row');
          assert.equal(title.overflow, 'false');
          assert.equal(title.value, title.title);
          if (turn === 0 || turn === 4) assert.ok(Math.abs(title.den ? title.bottom + title.expectedTop : title.top - title.expectedTop) < .1, 'Title touches its padded edge');
          // Tile-title compact fitting explicitly takes priority over the text floor.
          assert.deepEqual(await findLayoutDefects(page, `[data-title-check="${title.index}"]`, { parts: '.proto-tile-title__line', minFontSize: 0 }), [], `${width} angle ${turn * 45} ${title.title}`);
        }
        if (turn < 2) await page.locator('.proto-map-viewport').screenshot({ path: `artifacts/title-top/${width}-ott-${turn * 45}.png` });
      }
      await page.getByRole('button', { name: 'Tilt camera view', exact: true }).click();
      await page.waitForTimeout(650);
      assert.ok(await page.locator('.proto-tile-title').count());
      assert.equal(await page.locator('.proto-tile-title[data-title-align="top"]').count(), 0, 'Immersion retains centred fitting');
      assert.equal(await mountainTitle.count(), 1, 'Immersion keeps one mountain label');
      assert.equal(await page.locator('.proto-tile-title[aria-label="Small Woods"]').count(), 1, 'Immersion keeps one woods label');
      await page.locator('.proto-map-viewport').screenshot({ path: `artifacts/title-top/${width}-connected-immersion-3x.png` });
      assert.deepEqual(errors, []);
      console.log(`${width}: OTT titles at top, single-row den title at bottom, 8 spins, shared layout checks and unchanged immersion passed; ${await page.locator('.proto-build-label').textContent()}`);
      await page.close();
    }
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
