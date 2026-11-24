const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');

(async () => {
  const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe' });
  try {
    const width = Number(process.env.TEST_WIDTH || 1912);
    const reducedMotion = process.env.TEST_MOTION || 'no-preference';
    const page = await browser.newPage({ viewport: { width, height: width === 1280 ? 720 : 914 }, reducedMotion });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    const instrument = async (pattern, from, to) => page.route(pattern, async route => {
      const response = await route.fetch(), source = await response.text();
      assert(source.includes(from), `Instrumentation point: ${from}`);
      await route.fulfill({ response, body: source.replace(from, to) });
    });
    await instrument('**/src/proto/components/ProtoMap.tsx*', 'const volumeCamera =', 'window.__testCamera = camera; const volumeCamera =');
    await instrument('**/src/proto/components/GroundLightCanvas.tsx*', 'gl2.drawArrays(gl2.TRIANGLES, 0, 6);', 'gl2.drawArrays(gl2.TRIANGLES, 0, 6); window.__groundCamera = {...live}; window.__groundPaints = (window.__groundPaints || 0) + Number(repaint);');
    await instrument('**/src/proto/components/VolumetricAtmosphere.tsx*', 'renderer.draw({', 'window.__airCamera = {...camera}; renderer.draw({');
    await page.goto('http://127.0.0.1:5178/proto.html?scene=day01.sparse-patch');
    await page.waitForFunction(() => !document.querySelector('.ink-loader'), { timeout: 60000 });
    await page.waitForFunction(() => window.__groundCamera && window.__airCamera);
    await page.waitForTimeout(1200);
    const result = await page.evaluate(async () => {
      const { stopCameraPlayback } = await import('/src/proto/cameraDirector.ts');
      stopCameraPlayback();
      const start = { ...window.__testCamera.getLiveCamera() };
      const result = { samples: 0, groundStale: 0, airStale: 0, fps: 0, groundPaints: 0, retainedPixels: 0 };
      const before = performance.now(), paints = window.__groundPaints;
      for (let i = 0; i < 90; i++) {
        await new Promise(requestAnimationFrame);
        const live = { ...start, x: start.x + Math.sin(i / 15) * 80, y: start.y + Math.cos(i / 15) * 30,
          scale: start.scale * (1 + Math.sin(i / 30) * .06), pitch: 60 + Math.sin(i / 20) * 4, yaw: (start.yaw || 0) + i / 3 };
        window.__testCamera.setCameraFrame(live, false);
        for (const [name, drawn] of [['groundStale', window.__groundCamera], ['airStale', window.__airCamera]]) {
          if (['x', 'y', 'scale', 'yaw', 'pitch', 'aimY'].some(key => Math.abs((drawn[key] || 0) - (live[key] || 0)) > .001)) result[name]++;
        }
        result.samples++;
      }
      result.fps = Math.round(result.samples * 1000 / (performance.now() - before));
      result.groundPaints = window.__groundPaints - paints;
      // Read after compositing, so a discarded backing buffer cannot pass.
      await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      for (const canvas of document.querySelectorAll('[data-ground-light="bounded"], [data-atmosphere="volume"]')) {
        const gl = canvas.getContext('webgl');
        const pixels = new Uint8Array(canvas.width * canvas.height * 4);
        gl.readPixels(0, 0, canvas.width, canvas.height, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
        const retained = gl.getContextAttributes().preserveDrawingBuffer;
        if (retained && pixels.some((v, i) => i % 4 === 3 && v > 0)) result.retainedPixels++;
      }
      return result;
    });
    fs.mkdirSync('artifacts/camera-light-sync', { recursive: true });
    await page.screenshot({ path: `artifacts/camera-light-sync/pan-${width}-${reducedMotion}.png` });
    console.log(JSON.stringify({ width, reducedMotion, ...result }));
    assert.deepEqual(errors, []);
    assert.equal(result.groundStale, 0, 'Ground lighting must follow every camera frame');
    assert.equal(result.airStale, 0, 'Atmosphere masks must follow every camera frame');
    assert.equal(result.retainedPixels, 2, 'Both lighting buffers survive compositing');
    await page.locator('[data-ground-light="bounded"]').evaluate(canvas => canvas.dispatchEvent(new Event('webglcontextlost', { cancelable: true })));
    await page.waitForSelector('.proto-ground-light canvas');
    assert.equal(await page.locator('[data-ground-light="bounded"]').count(), 0, 'Ground context loss selects the CPU fallback');
    await page.locator('[data-atmosphere="volume"]').evaluate(canvas => canvas.dispatchEvent(new Event('webglcontextlost', { cancelable: true })));
    await page.waitForSelector('[data-atmosphere="volume"][data-renderer="canvas"]');
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });

