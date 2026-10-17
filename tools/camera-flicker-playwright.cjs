const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
(async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 720 }, hasTouch: true });
    await page.goto('http://127.0.0.1:5178/proto.html?atmosphere=off');
    await page.getByRole('button', { name: 'Tilt camera view', exact: true }).click();
    await page.waitForTimeout(1500);
    await page.evaluate(() => {
      const root = document.querySelector('.proto-game-root');
      let fiber = root[Object.keys(root).find(k => k.startsWith('__reactFiber'))];
      while (fiber && fiber.type?.name !== 'ProtoVariant') fiber = fiber.return;
      fiber.memoizedState.queue.dispatch(state => ({ ...state, worldActors: state.worldActors.map((actor, i) => i ? actor : { ...actor, location: 'table', position: { x: 0, y: 0 }, biomeId: undefined }) }));
    });
    await page.waitForSelector('[data-table-sectional-sprite] canvas');
    await page.evaluate(async () => {
      const { tableCameraTilt, tableTiltTransform } = await import('/src/proto/tableTilt.ts');
      const viewport = document.querySelector('.proto-map-viewport');
      const world = viewport.querySelector('[data-physical-world]');
      let fiber = world[Object.keys(world).find(k => k.startsWith('__reactFiber'))];
      while (fiber && fiber.type?.name !== 'ProtoMap') fiber = fiber.return;
      const refs = []; for (let h = fiber.memoizedState; h; h = h.next) if (h.memoizedState?.current) refs.push(h.memoizedState);
      // Live camera and zoom target share a shape. The camera ref is the one
      // whose scale matches the published viewport on each sampled frame.
      const cameraRefs = refs.filter(r => typeof r.current.scale === 'number' && typeof r.current.x === 'number');
      window.flicker = { samples: 0, stale: [], blank: [], removed: 0 };
      const observer = new MutationObserver(records => records.forEach(r => r.removedNodes.forEach(node => {
        if (node.nodeType === 1 && (node.matches('[data-environment-prop], [data-table-sectional-sprite]') || node.querySelector('[data-environment-prop], [data-table-sectional-sprite]'))) window.flicker.removed++;
      })));
      observer.observe(world, { subtree: true, childList: true });
      let active = true;
      const sample = () => {
        if (!active) return;
        const scale = Number(viewport.style.getPropertyValue('--camera-scale'));
        const live = cameraRefs[1]?.current;
        if (live) {
          const expected = tableTiltTransform(tableCameraTilt(viewport.clientHeight, live.scale, live.pitch));
          for (const stage of viewport.querySelectorAll('.proto-table-stage')) {
            const numbers = value => (value.match(/-?[\d.]+/g) || []).map(Number);
            const actualNumbers = numbers(stage.style.transform), expectedNumbers = numbers(expected);
            if (actualNumbers.length !== expectedNumbers.length || actualNumbers.some((v, i) => Math.abs(v - expectedNumbers[i]) > .001)) window.flicker.stale.push({ actual: stage.style.transform, expected });
          }
        }
        for (const prop of world.querySelectorAll('[data-biome-popup]')) if (!prop.querySelector('.proto-sprite-standee__art, [data-prop-volume]')) window.flicker.blank.push(prop.dataset.biomePopup);
        window.flicker.samples++;
        requestAnimationFrame(sample);
      };
      sample(); window.stopFlicker = () => { active = false; observer.disconnect(); };
    });
    const viewport = await page.locator('.proto-map-viewport').boundingBox();
    await page.mouse.move(viewport.x + viewport.width * .8, viewport.y + viewport.height * .5);
    await page.mouse.wheel(0, -650);
    await page.waitForTimeout(1100);
    await page.mouse.down({ button: 'middle' });
    await page.mouse.move(viewport.x + viewport.width * .6, viewport.y + viewport.height * .2, { steps: 30 });
    await page.mouse.up({ button: 'middle' });
    await page.waitForTimeout(300);
    for (let i = 0; i < 8; i++) {
      await page.getByRole('button', { name: 'Turn table right', exact: true }).click();
      await page.waitForTimeout(360);
    }
    await page.mouse.wheel(0, 350); await page.waitForTimeout(800);
    const cdp = await page.context().newCDPSession(page);
    const fingers = [{ x: viewport.x + viewport.width * .65, y: viewport.y + 230 }, { x: viewport.x + viewport.width * .65 + 40, y: viewport.y + 230 }, { x: viewport.x + viewport.width * .65 + 20, y: viewport.y + 270 }];
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: fingers });
    for (let step = 1; step <= 12; step++) await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: fingers.map((p, i) => ({ x: p.x + step * (i - 1), y: p.y + step * 2 })) });
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await cdp.detach(); await page.waitForTimeout(300);
    const buffers = await page.evaluate(async () => {
      // Read after two compositing frames, not directly after renderer.draw().
      await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      return [...document.querySelectorAll('[data-ground-light="bounded"], [data-table-sectional-sprite] canvas')].map(canvas => {
        const gl = canvas.getContext('webgl2') || canvas.getContext('webgl');
        const pixels = new Uint8Array(canvas.width * canvas.height * 4);
        gl.readPixels(0, 0, canvas.width, canvas.height, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
        return { kind: canvas.dataset.groundLight || 'actor', retained: gl.getContextAttributes().preserveDrawingBuffer,
          opaque: pixels.reduce((sum, value, i) => sum + (i % 4 === 3 && value > 0 ? 1 : 0), 0) };
      });
    });
    assert.ok(buffers.length >= 2, 'Actor and ground-light canvases exist');
    assert.ok(buffers.every(buffer => buffer.retained && buffer.opaque > 0), JSON.stringify(buffers));
    const result = await page.evaluate(() => { window.stopFlicker(); return window.flicker; });
    fs.mkdirSync('artifacts/camera-flicker', { recursive: true });
    fs.writeFileSync('artifacts/camera-flicker/frames.json', JSON.stringify(result, null, 2));
    await page.screenshot({ path: 'artifacts/camera-flicker/orbit.png' });
    console.log(JSON.stringify({ samples: result.samples, stale: result.stale.length, first: result.stale[0], blank: result.blank, removed: result.removed, buffers }));
    assert.equal(result.stale.length, 0, 'React commits must not rewind live camera tilt');
    assert.equal(result.blank.length, 0, 'Scenery must remain present during orbit');
    assert.equal(result.removed, 0, 'Camera movement must not remount scenery');
    await page.locator('[data-ground-light="bounded"]').evaluate(canvas => canvas.dispatchEvent(new Event('webglcontextlost', { cancelable: true })));
    await page.waitForSelector('.proto-ground-light canvas');
    assert.equal(await page.locator('[data-ground-light="bounded"]').count(), 0, 'Context loss restores the CPU light fallback');
  } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
