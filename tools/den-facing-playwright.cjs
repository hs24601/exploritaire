const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const { findLayoutDefects } = require('./lib/layout-check.cjs');
(async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    for (const width of [1280, 1912]) for (const renderer of ['webgl', 'canvas']) {
      const context = await browser.newContext({ viewport: { width, height: width === 1280 ? 720 : 914 }, hasTouch: true, deviceScaleFactor: 3, reducedMotion: 'reduce' });
      const page = await context.newPage(), errors = [];
      page.on('pageerror', e => errors.push(e.message));
      assert.equal((await page.goto(`${process.env.PROTO_URL || 'http://localhost:5178/proto.html'}?propRenderer=${renderer}`)).status(), 200);
      await page.waitForTimeout(1000);
      assert.equal(await page.locator('[data-den-overhead]').evaluate(el=>el.style.transform),'rotate(180deg)');
      assert.ok((await page.locator('[data-den-roof]').evaluate(el=>el.style.transform)).includes('rotate(180deg)'));
      const joins=await page.locator('[data-den-overhead]').evaluate(async image=>{
        await image.decode();const canvas=document.createElement('canvas');canvas.width=image.naturalWidth;canvas.height=image.naturalHeight;
        const ctx=canvas.getContext('2d');ctx.drawImage(image,0,0);const data=ctx.getImageData(0,0,canvas.width,canvas.height).data;
        const opaque=(x,y)=>data[(y*canvas.width+x)*4+3]>=240;
        // Runtime half-turn maps the source's top edge to the southern mountain join.
        return{square:canvas.width===canvas.height,edgeAlpha:[0,12,24,36,47].map(y=>[data[(y*canvas.width)*4+3],data[(y*canvas.width+canvas.width-1)*4+3]]),south:Array.from({length:canvas.width},(_,x)=>opaque(x,0)).filter(Boolean).length/canvas.width,
          left:Array.from({length:48},(_,y)=>opaque(0,y)).filter(Boolean).length/48,
          right:Array.from({length:48},(_,y)=>opaque(canvas.width-1,y)).filter(Boolean).length/48};
      });
      assert.equal(joins.square,true,'Square den print reaches tile edges without contain padding');
      assert.ok(joins.south>.95&&joins.left>.95&&joins.right>.95,'Opaque rock at every mountain join: '+JSON.stringify(joins));
      assert.equal(Number(await page.locator('[data-actor-id="hero"][data-board-piece="actor"]').getAttribute('data-actor-heading')),Math.PI);
      await page.screenshot({path:`artifacts/den-away-ott-${width}-${renderer}-3x.png`});
      // Move Hero away so her occlusion outline cannot hide the entrance.
      const grip = await page.locator('[data-cell-grip="actor-hero"]').boundingBox();
      const from = { x: grip.x + grip.width / 2, y: grip.y + grip.height / 2 };
      await page.mouse.move(from.x, from.y); await page.mouse.down();
      await page.mouse.move(from.x + 130, from.y - 90, { steps: 10 }); await page.mouse.up();
      await page.waitForTimeout(1800);
      if (await page.getByRole('button', { name: 'Tilt camera view', exact: true }).count()) await page.getByRole('button', { name: 'Tilt camera view', exact: true }).click();
      await page.waitForTimeout(1000);
      const den = page.locator('[data-biome-popup="hero-den"]');
      const canvas = den.locator('[data-prop-volume]').first();
      await canvas.waitFor();
      const sample = () => canvas.evaluate(el => {
        const data = el.getContext('2d').getImageData(0, 0, el.width, el.height).data;
        let count = 0, dark = 0;
        for (let i = 0; i < data.length; i += 4) if (data[i + 3]) { count++; if ((data[i] + data[i + 1] + data[i + 2]) / 3 < 30) dark++; }
        return { fraction: dark / count, yaw: Number(el.dataset.volumeYaw), engine: el.dataset.volumeEngine };
      });
      const back = await sample();
      assert.equal(back.yaw, 0);
      const placement = await den.evaluate(el => [el.style.left, el.style.top, el.style.width, el.style.height]);
      for (let i = 0; i < 8; i++) {
        const turn = page.getByRole('button', { name: 'Turn table right', exact: true });
        if (i % 2) await turn.tap(); else await turn.click();
        await page.waitForTimeout(300);
        assert.equal(await den.getAttribute('data-scenery-symmetry'), 'asymmetric');
        assert.equal(await den.getAttribute('data-scenery-facing'), 'north');
        assert.equal(await den.getAttribute('data-scenery-heading'), '180');
        assert.deepEqual(await den.evaluate(el => [el.style.left, el.style.top, el.style.width, el.style.height]), placement);
        if (i === 3) {
          const front = await sample();
          assert.equal(front.yaw, 180);
          // The shorter v3 cave exposes less interior; geometry tests also pin its world heading.
          assert.ok(front.fraction > back.fraction + .01, JSON.stringify({ front, back }));
          await canvas.screenshot({ path: `artifacts/den-away-mouth-${width}-${renderer}-3x.png` });
        }
      }
      const again = await sample();
      assert.equal(again.fraction, back.fraction);
      assert.deepEqual(await findLayoutDefects(page, '.proto-map-footer', { parts: '.proto-map-toolbar,.proto-map-camera-button,.table-grid-reference' }), []);
      assert.deepEqual(errors, []);
      await canvas.screenshot({ path: `artifacts/den-away-rear-${width}-${renderer}-3x.png` });
      console.log('PASS fixed mouth away from mountains', width, renderer);
      await context.close();
    }
  } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exit(1); });
