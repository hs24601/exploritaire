const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const out = 'artifacts/night-haze';
fs.mkdirSync(out, { recursive: true });
(async () => {
  const browser = await chromium.launch({ headless: true, channel: 'chrome' });
  try {
    for (const mode of ['fx=high', 'atmosphere=canvas', 'fx=low']) {
      const page = await browser.newPage({ viewport: { width: 1716, height: 914 }, reducedMotion: 'reduce' });
      const errors = []; page.on('pageerror', e => errors.push(e.message));
      await page.goto(`http://127.0.0.1:5178/proto.html?${mode}`);
      await page.getByRole('button', { name: 'Tilt camera view', exact: true }).click();
      await page.getByRole('button', { name: 'Reset View', exact: true }).click();
      const slider = page.getByRole('slider', { name: 'Table time of day' });
      const setHour = async hour => {
        await slider.evaluate((el, value) => {
          Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(el, String(value));
          el.dispatchEvent(new Event('input', { bubbles: true }));
        }, hour);
        await page.waitForTimeout(1000);
      };
      const tag = mode.replace('=', '-');
      await setHour(0);
      const volume = page.locator('[data-atmosphere="volume"]');
      assert.equal(await volume.getAttribute('data-renderer'), mode.includes('canvas') ? 'canvas' : 'webgl');
      assert.equal(await volume.evaluate(el => getComputedStyle(el).pointerEvents), 'none');
      await page.screenshot({ path: `${out}/${tag}-midnight.png` });
      if (mode === 'fx=high') {
        for (let i=0;i<4;i++) await page.keyboard.press('q');
        const box=await page.locator('.proto-map-viewport').boundingBox();
        await page.mouse.move(box.x+box.width/2,box.y+box.height/2);
        await page.mouse.wheel(0,-1000); await page.waitForTimeout(1200);
        await page.screenshot({path:`${out}/midnight-closer.png`});
      }
      await page.getByRole('checkbox', { name: 'Table lights', exact: true }).uncheck();
      await page.waitForTimeout(700);
      await page.screenshot({ path: `${out}/${tag}-unlit.png` });
      await page.getByRole('checkbox', { name: 'Table lights', exact: true }).check();
      await setHour(12);
      await page.screenshot({ path: `${out}/${tag}-noon.png` });
      await setHour(17.8); await setHour(6.1);
      await slider.focus(); await page.keyboard.down('w'); await page.waitForTimeout(200); await page.keyboard.up('w');
      assert.deepEqual(errors, []);
      await page.close();
    }
    const page = await browser.newPage(); await page.goto('http://127.0.0.1:5178/proto.html');
    const report = await page.evaluate(async () => {
      const { createAtmosphereRenderer } = await import('/src/proto/components/atmosphereRenderer.ts');
      const { getTableLighting } = await import('/src/proto/protoLighting.ts');
      const results = [];
      for (const fallback of [false, true]) {
        const canvas = document.createElement('canvas'), renderer = createAtmosphereRenderer(canvas, fallback);
        const input = { width: 400, height: 300, scale: .25, camera: { x: 0, y: 0, scale: 1, yaw: 0 }, tilt: { angle: 0, perspective: 800 }, frame: getTableLighting(0), lights: [], time: 0, guards: [], scene: { patches: [], canopies: [], concealed: [] } };
        const read = () => {
          if (fallback) return canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height).data;
          const gl = canvas.getContext('webgl'), data = new Uint8Array(canvas.width * canvas.height * 4);
          gl.readPixels(0, 0, canvas.width, canvas.height, gl.RGBA, gl.UNSIGNED_BYTE, data); return data;
        };
        const alpha = () => { const p = read(); return p[(Math.floor(canvas.height/2)*canvas.width+Math.floor(canvas.width/2))*4+3]; };
        renderer.draw(input); const dark = alpha();
        input.scene.concealed = [{ x: 0, y: 0, width: 96, height: 96 }]; renderer.draw(input); const concealed = alpha();
        input.scene.canopies = [{ id: 'rock', x: 48, y: 0, width: 46, height: 46, trimmed: true, sprite: '/assets/runtime/environment/watercolor/v1/mountain-peak-sprite-v1.png' }];
        renderer.draw(input); await new Promise(r => setTimeout(r, 500)); renderer.draw(input); const relief = alpha();
        input.scene = { patches: [], canopies: [], concealed: [] };
        input.lights = [{ id: 'lamp', position: { x: 0, y: 0 }, strength: .85, radius: 2 }]; renderer.draw(input); const lit = alpha();
        input.lights[0].position.x=96;input.lights[0].radius=4;renderer.draw(input);const clearPath=alpha();
        input.scene.canopies=[{id:'wall',x:48,y:0,width:96,height:96,worldHeading:0,
          sprite:'data:image/svg+xml,'+encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64"><rect width="64" height="64" fill="white"/></svg>')}];
        renderer.draw(input);await new Promise(r=>setTimeout(r,300));renderer.draw(input);const blocked=alpha();
        results.push({ fallback, dark, concealed, relief, lit, clearPath, blocked }); renderer.dispose();
      }
      return results;
    });
    for (const r of report) {
      assert.ok(r.dark > 225, 'unlit night is heavy');
      assert.ok(r.concealed > r.dark, 'concealed fog is denser');
      assert.ok(r.relief > r.concealed, 'relief adds density');
      assert.ok(r.lit < 40, 'light opens a visible pocket');
      assert.ok(r.blocked > r.clearPath+80, 'relief blocks local light from opening fog behind it');
    }
    console.log(JSON.stringify(report)); await page.close();
    console.log('PASS night haze GPU/Canvas/low effects, noon and horizon updates, controls and reduced motion');
  } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exit(1); });
