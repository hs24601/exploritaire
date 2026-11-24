const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { findLayoutDefects } = require('./lib/layout-check.cjs');
const out = 'artifacts/biome-card-backgrounds';
const url = process.env.PROTO_URL || 'http://127.0.0.1:5178/proto.html?atmosphere=off';

async function enter(page, scene) {
  await page.waitForSelector('.proto-game-root');
  await page.evaluate(async scene => {
    const { arriveActorAtBiome } = await import('/src/proto/biomeArrival.ts');
    let fiber = document.querySelector('.proto-game-root');
    fiber = fiber[Object.keys(fiber).find(k => k.startsWith('__reactFiber'))];
    while (fiber && fiber.type?.name !== 'ProtoVariant') fiber = fiber.return;
    fiber.memoizedState.queue.dispatch(state => {
      const id = scene === 'rest' ? 'hero-den' : scene === 'berries' ? 'day-one-berries' : 'day-one-tree';
      const tile = state.biomeTiles.find(t => t.id === id);
      return arriveActorAtBiome(scene === 'rest' ? { ...state, ordinaryDay: { ...state.ordinaryDay, bedtime: true, supper: true } } : state, 'hero', id, tile.position);
    });
  }, scene);
}

(async () => {
  fs.mkdirSync(out, { recursive: true });
  const browser = await chromium.launch({ headless: true });
  try {
    const gallery = await browser.newPage({ viewport: { width: 1912, height: 1200 }, deviceScaleFactor: 1 });
    await gallery.goto(url);
    const compositions = await gallery.evaluate(async () => {
      const art = await import('/src/proto/biomeCardArt.ts');
      const assets = [...new Set(Object.keys(art.BIOME_CARD_RECIPES).flatMap(kind => ['paint', 'pixel'].flatMap(style => Object.values(art.biomeCardSources(kind, style)).filter(Boolean))))];
      const missing = (await Promise.all(assets.map(async src => [src, (await fetch(src)).status]))).filter(([, status]) => status !== 200);
      const backgrounds = [];
      for (const kind of Object.keys(art.BIOME_CARD_RECIPES)) for (const style of ['paint', 'pixel']) {
        const pending = art.loadBiomeCardBackground(kind, style);
        if (pending !== art.loadBiomeCardBackground(kind, style)) throw new Error('Composition is not cached');
        const background = await pending;
        backgrounds.push(background);
      }
      return { missing, backgrounds };
    });
    assert.deepEqual(compositions.missing, [], 'All registered tile and immersive assets must load');
    assert.equal(new Set(compositions.backgrounds.map(b => b.src)).size, compositions.backgrounds.length, 'All biome/style compositions are distinct');
    await gallery.evaluate(backgrounds => {
      document.body.innerHTML = '';
      Object.assign(document.body.style, { background: '#090d17', margin: '24px', display: 'grid', gridTemplateColumns: 'repeat(8, 189px)', gap: '22px', color: 'white', font: '16px sans-serif' });
      for (const b of backgrounds) {
        const item = document.createElement('div');
        const image = document.createElement('img'); image.src = b.src; image.style.cssText = `width:189px;height:264px;display:block;border-radius:9px;image-rendering:${b.artStyle === 'pixel' ? 'pixelated' : 'auto'}`;
        item.append(image, document.createTextNode(`${b.kind} · ${b.artStyle}`)); document.body.append(item);
      }
    }, compositions.backgrounds);
    await gallery.screenshot({ path: `${out}/gallery-3x.png` });
    await gallery.close();

    for (const [width, height] of [[1280, 720], [1912, 914]]) for (const touch of [false, true]) for (const scene of ['rest', 'berries', 'woods', 'combat']) {
      if (process.env.CARD_CHECK_WIDTH && width !== Number(process.env.CARD_CHECK_WIDTH)) continue;
      if (process.env.CARD_CHECK_TOUCH && touch !== (process.env.CARD_CHECK_TOUCH === 'true')) continue;
      const page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: 3, hasTouch: touch, reducedMotion: touch ? 'reduce' : 'no-preference' });
      const errors = []; page.on('pageerror', e => errors.push(e.message));
      await page.goto(url + (scene === 'combat' ? '&combatdemo' : ''));
      if (scene !== 'combat') await enter(page, scene);
      const kind = { rest: 'hero-den', berries: 'berry-patch', woods: 'woods', combat: 'dark-woods' }[scene];
      const cards = scene === 'combat' ? '.battle-field__column .playing-card' : '.proto-tableau-stage .playing-card';
      const selector = `${cards} [data-biome-card="${kind}"][data-card-art-ready="true"] img`;
      await page.waitForSelector(selector);
      const original = await page.locator(selector).first().getAttribute('src');
      const check = async style => {
        const data = await page.locator(cards).evaluateAll(cards => cards.map(card => {
          const bg = card.querySelector('[data-biome-card]'), img = bg.querySelector('img');
          return { kind: bg.dataset.biomeCard, style: bg.dataset.cardArtStyle, ready: img?.complete && img.naturalWidth > 0, src: img?.src,
            w: card.offsetWidth, h: card.offsetHeight, events: getComputedStyle(bg).pointerEvents,
            buried: Boolean(card.dataset.buried), veil: Boolean(card.querySelector('.proto-card-veil')) };
        }));
        assert.ok(data.length);
        assert.ok(new Set(data.map(b => b.src)).size > 1, 'Cards use varied cached compositions');
        for (const b of data) {
          assert.equal(b.kind, kind); assert.equal(b.style, style); assert.ok(b.ready); assert.equal(b.events, 'none');
          assert.ok(Math.abs(b.w / b.h - 63 / 88) < .025);
          if (b.buried) assert.ok(b.veil, 'Buried face must retain silhouette');
        }
      };
      await page.waitForTimeout(600);
      await check('paint');
      await page.screenshot({ path: `${out}/${width}-${touch ? 'touch' : 'mouse'}-${scene}.png` });
      const front = page.locator(`${cards}:not([data-buried])`).first();
      const frontBox = await front.boundingBox();
      // The center-rank positioning box covers the full card; compare its ink
      // range, not that transparent box, with the resource/index row.
      const defects = await findLayoutDefects(page, `${cards}:not([data-buried])`, { parts: '.proto-card-header' });
      assert.deepEqual(defects, [], `${width}/${scene}: card layout`);
      const ink = await front.evaluate(card => {
        const rank = card.querySelector('.proto-card-center-rank'), icon = card.querySelector('.proto-card-icon');
        if (!rank || !icon) return null;
        const range = document.createRange(); range.selectNodeContents(rank);
        return { rank: range.getBoundingClientRect().toJSON(), icon: icon.getBoundingClientRect().toJSON() };
      });
      assert.ok(!ink || ink.rank.top + .5 >= ink.icon.bottom, `Center value ink must clear the resource icon: ${JSON.stringify(ink)}`);
      const clip = { x: Math.max(0, frontBox.x), y: Math.max(0, frontBox.y), width: frontBox.width, height: frontBox.height };
      await page.screenshot({ path: `${out}/${width}-${touch ? 'touch' : 'mouse'}-${scene}-card-3x.png`, clip });
      await page.evaluate(async () => { const { setArtStyle } = await import('/src/proto/artStyle.ts'); setArtStyle('pixel'); });
      await page.waitForSelector(`${cards} [data-card-art-style="pixel"][data-card-art-ready="true"] img`);
      await page.waitForTimeout(600);
      await check('pixel');
      assert.notEqual(await page.locator(selector).first().getAttribute('src'), original, 'Style changes update artwork');
      await page.keyboard.press('Space'); await check('pixel');
      if (scene === 'berries') {
        const playable = page.locator(`${cards}:not([data-gameplay-disabled="true"]):not([data-buried])`).first();
        const appearance = await playable.locator('[data-biome-card] img').getAttribute('src');
        await page.evaluate(() => {
          window.__flightArt = null;
          const observer = new MutationObserver(() => {
            const flight = document.querySelector('[data-proto-card-flight]');
            if (flight) { window.__flightArt = flight.querySelector('[data-biome-card] img')?.src; observer.disconnect(); }
          }); observer.observe(document.body, { childList: true, subtree: true });
        });
        if (touch) { const b = await playable.boundingBox(); await page.touchscreen.tap(b.x + b.width / 2, b.y + b.height / 2); } else await playable.click();
        await page.waitForFunction(() => window.__flightArt !== null);
        assert.equal(await page.evaluate(() => window.__flightArt), appearance, 'Flights keep the displayed biome background');
        await page.waitForTimeout(1100);
        assert.equal(await page.locator('.proto-card-jumbo').count(), 0);
      }
      assert.deepEqual(errors, []);
      console.log(`PASS ${width} ${touch ? 'touch/reduced' : 'mouse'} ${scene}: Paint/Pixel, silhouette, layout, immersion${scene === 'berries' ? ', flight' : ''}`);
      await page.close();
    }
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
