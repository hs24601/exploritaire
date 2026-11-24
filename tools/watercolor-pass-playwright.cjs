const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { findLayoutDefects } = require('./lib/layout-check.cjs');
const base = process.env.PROTO_URL || 'http://127.0.0.1:5178';
const out = 'artifacts/watercolor-pass';
(async () => {
  fs.mkdirSync(out, { recursive: true });
  const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe' });
  const report = { errors: [], timings: [], checks: [] };
  try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1, reducedMotion: 'reduce' });
    page.on('pageerror', e => report.errors.push(e.message));
    await page.goto(`${base}/tools/watercolor-lab.html`);
    await page.waitForFunction(() => document.querySelector('[aria-label="Paint comparison"]')?.getAttribute('aria-busy') === 'false');
    assert.equal(await page.getByRole('alert').count(), 0);
    const raster = await page.evaluate(async () => {
      const wash = await import('/src/proto/watercolorWash.ts');
      const dabs = await import('/src/proto/radialDabs.ts');
      const art = await import('/src/proto/biomeCardArt.ts');
      const THREE = await import('/node_modules/.vite/deps/three.js');
      const { createTableauGroundCover } = await import('/src/proto/tableauGroundCover.ts');
      const generated = [], times = [];
      for (const palette of ['woodland', 'dirt']) {
        const t = performance.now(); const texture = dabs.radialDabCanvas(palette, dabs.DEFAULT_DABS, 47);
        times.push({ palette, size: 256, ms: performance.now() - t });
        if (texture !== dabs.radialDabCanvas(palette, dabs.DEFAULT_DABS, 47)) throw new Error('CPU canvas cache missed');
        const root = new THREE.Group(), cover = createTableauGroundCover(root, false, palette);
        const mesh = root.children[0].children[0];
        const src = mesh.material.map.image.toDataURL();
        const anchors = root.children[0].children.map(m => m.position.toArray());
        cover.dispose(); if (root.children.length) throw new Error('Ground cover teardown retained scene objects');
        const original = createTableauGroundCover(root, false, palette, false);
        const originalImage = root.children[0].children[0].material.map.image;
        if (src !== originalImage.toDataURL()) throw new Error('Default radial atlas differs from the original');
        if (JSON.stringify(anchors) !== JSON.stringify(root.children[0].children.map(m => m.position.toArray()))) throw new Error('Ground anchors changed');
        original.dispose();
        const changed = createTableauGroundCover(root, false, palette, { ...dabs.DEFAULT_DABS, count: 256, spreadX: 80, seed: 53 });
        if (JSON.stringify(anchors) !== JSON.stringify(root.children[0].children.map(m => m.position.toArray()))) throw new Error('Dab tuning moved scenery');
        changed.dispose(); generated.push({ name: palette, src });
      }
      const all = [];
      for (const kind of ['hero-den', 'berry-patch-sparse', 'woods', 'dark-woods', 'water', 'unexplored']) {
        for (let view = 0; view < 12; view++) {
          const t = performance.now(), pending = art.loadBiomeCardBackground(kind, 'paint', view);
          if (pending !== art.loadBiomeCardBackground(kind, 'paint', view)) throw new Error('Card cache missed');
          const current = await pending;
          times.push({ kind, view, ms: performance.now() - t });
          if (!current.src) throw new Error(`Missing ${kind} background`);
          all.push(current);
          if (view === 3) {
            const original = await art.loadBiomeCardBackground(kind, 'paint', view, false);
            if ((kind === 'unexplored') !== (current.src === original.src)) throw new Error('Wash failed or unknown terrain changed');
            generated.push({ name: kind, src: current.src });
          }
        }
      }
      // Unavailable wash Canvas retains the original scene; it must not replace
      // valid ImageGen scenery with a blank/solid fallback card.
      const before = HTMLCanvasElement.prototype.getContext;
      HTMLCanvasElement.prototype.getContext = function(...args) { return this.width === 128 && this.height === 128 ? null : before.apply(this, args); };
      try {
        const fallback = await art.loadBiomeCardBackground('hero-den', 'paint', 5, { ...wash.DEFAULT_WASH, seed: 'no-wash-context' });
        const original = await art.loadBiomeCardBackground('hero-den', 'paint', 5, false);
        if (!fallback.src || fallback.src !== original.src) throw new Error('Wash failure discarded original card art');
      } finally { HTMLCanvasElement.prototype.getContext = before; }
      return { generated, times, uniqueViews: new Set(all.filter(a => a.kind === 'woods').map(a => a.src)).size };
    });
    assert.equal(raster.uniqueViews, 12);
    for (const { name, src } of raster.generated) fs.writeFileSync(`${out}/after-${name}.png`, Buffer.from(src.split(',')[1], 'base64'));
    report.timings = raster.times; report.checks.push('Seed/cache/12 views/unknown concealment/anchors/disposal/Canvas fallback');
    assert.equal(await page.getByLabel('Paint method', { exact: true }).inputValue(), 'radial');
    const before = await page.getByAltText('Tuned woodland ground atlas').getAttribute('src');
    assert.equal(before, await page.getByAltText('Original woodland ground atlas').getAttribute('src'));
    await page.getByRole('slider', { name: 'Dab count', exact: true }).focus();
    await page.keyboard.press('End');
    await page.waitForFunction(src => document.querySelector('img[alt="Tuned woodland ground atlas"]')?.src !== src, before);
    assert.notEqual(await page.getByAltText('Tuned woodland ground atlas').getAttribute('src'), before);
    await page.getByRole('button', { name: 'Reset paint', exact: true }).click();
    await page.waitForFunction(src => document.querySelector('img[alt="Tuned woodland ground atlas"]')?.src === src, before);
    await page.getByLabel('Base pigment', { exact: true }).fill('#aabbcc');
    await page.waitForFunction(src => document.querySelector('img[alt="Tuned woodland ground atlas"]')?.src !== src, before);
    await page.getByLabel('Paint method', { exact: true }).selectOption('pigment');
    await page.getByRole('slider', { name: 'Pooled edges', exact: true }).waitFor();
    await page.getByLabel('Paint method', { exact: true }).selectOption('radial');
    assert.equal(await page.getByLabel('Base pigment', { exact: true }).inputValue(), '#aabbcc', 'Switching methods retains each draft');
    await page.waitForFunction(() => JSON.parse(localStorage.getItem('exploritaire.watercolor-lab.draft.v2')).colors.woodland[0] === '#aabbcc');
    await page.reload();
    await page.waitForFunction(() => document.querySelector('[aria-label="Paint comparison"]')?.getAttribute('aria-busy') === 'false');
    assert.equal(await page.getByLabel('Base pigment', { exact: true }).inputValue(), '#aabbcc', 'Reload restores the selected paint draft');
    await page.getByRole('button', { name: 'Reset paint', exact: true }).click();
    await page.getByLabel('Import preset', { exact: true }).setInputFiles({ name: 'bad.json', mimeType: 'application/json', buffer: Buffer.from('{"mana":999}') });
    await page.getByRole('alert').waitFor();
    await page.getByLabel('Import preset', { exact: true }).setInputFiles('src/data/radialDabPresets.json');
    await page.waitForFunction(() => !document.querySelector('[role="alert"]'));
    const download = page.waitForEvent('download'); await page.getByRole('button', { name: 'Export preset', exact: true }).click();
    const file = await download; await file.saveAs(`${out}/exported-preset.json`);
    assert.deepEqual(JSON.parse(fs.readFileSync(`${out}/exported-preset.json`)), JSON.parse(fs.readFileSync('src/data/radialDabPresets.json')));
    report.checks.push('Radial default is pixel-identical to original, cached, tunable without moving scenery; both method drafts retained');
    for (const [width, height] of [[1280, 720], [1912, 914], [390, 844]]) {
      await page.setViewportSize({ width, height });
      await page.locator('aside').evaluate(el => { el.scrollTop = 0; });
      for (const [root, parts] of [['.watercolor-lab', 'header,aside,.watercolor-lab__preview,footer'], ['.watercolor-lab aside', 'label,.watercolor-lab__commands button'], ['.watercolor-lab__preview', 'h2,.watercolor-lab__preview-heading label,figure']]) {
        assert.deepEqual(await findLayoutDefects(page, root, { parts }), [], `${width}: ${root}`);
      }
      await page.screenshot({ path: `${out}/lab-${width}.png` });
    }
    await page.close();
    const tooling = await browser.newPage({ viewport: { width: 1280, height: 720 } });
    tooling.on('pageerror', e => report.errors.push(e.message));
    await tooling.goto(`${base}/tooling.html`);
    const openLab = tooling.getByRole('button', { name: 'Watercolor lab', exact: true });
    await openLab.waitFor();
    assert.deepEqual(await findLayoutDefects(tooling, '.editor-command-bar', { parts: ':scope > button,:scope > label' }), []);
    const popup = tooling.waitForEvent('popup'); await openLab.click();
    const lab = await popup; await lab.waitForURL('**/tools/watercolor-lab.html'); await lab.getByRole('heading', { name: 'Watercolor lab', exact: true }).waitFor();
    await lab.close(); await tooling.close();
    for (const [width, height] of [[1280, 720], [1912, 914]]) {
      const game = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: 3, reducedMotion: 'reduce' });
      game.on('pageerror', e => report.errors.push(e.message));
      for (const scene of ['day01.khad-roots-exposed', 'day01.leave-den']) {
        await game.goto(`${base}/proto.html?scene=${scene}`);
        await game.waitForSelector('[data-card-art-ready="true"]');
        await game.waitForTimeout(1200);
        assert.deepEqual(await findLayoutDefects(game, '.playing-card:not([data-buried])', { parts: '.proto-card-header', minFontSize: 0 }), []);
        await game.screenshot({ path: `${out}/${scene}-${width}-3x.png` });
        if (scene === 'day01.khad-roots-exposed' && width === 1280) {
          const playable = game.locator('[data-travel-card]:not([data-buried]):not([data-gameplay-disabled])').first();
          const source = await playable.locator('[data-biome-card] img').getAttribute('src');
          await game.keyboard.press('Space');
          assert.equal(await playable.locator('[data-biome-card] img').getAttribute('src'), source, 'Pause does not regenerate pigment');
          await game.keyboard.press('Space');
          await game.evaluate(() => {
            window.__watercolorFlight = null;
            const observer = new MutationObserver(() => {
              const flight = document.querySelector('[data-proto-card-flight] [data-biome-card] img');
              if (flight) { window.__watercolorFlight = flight.src; observer.disconnect(); }
            });
            observer.observe(document.body, { childList: true, subtree: true });
          });
          await playable.click();
          await game.waitForFunction(() => window.__watercolorFlight !== null);
          assert.equal(await game.evaluate(() => window.__watercolorFlight), source, 'Delivery flight preserves the exact painted face');
          await game.waitForFunction(() => document.querySelector('.travel-tableau')?.textContent.includes('11/12 cards'));
          report.checks.push('Real legal play advances 10/12 to 11/12; exact art retained through pause and delivery');
        }
      }
      await game.close();
    }
    report.checks.push('Live slider/reset, invalid/valid import, preset round trip, authoring launcher, shared layout checks at 1280/1912/390, game scenes at 3x');
    assert.deepEqual(report.errors, []);
    console.log('PASS', report.checks);
    console.log('256px cold bake:', report.timings.filter(t => t.palette));
  } finally { fs.writeFileSync(`${out}/validation.json`, JSON.stringify(report, null, 2)); await browser.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
