const { chromium } = require('playwright');
const assert = require('node:assert/strict');

(async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 720 }, reducedMotion: 'reduce' });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(process.env.PROTO_URL || 'http://localhost:5178/proto.html?cinema=off');
    const actor = page.locator('[data-board-piece="actor"][data-actor-id="hero"]');
    await actor.press('Enter');
    const card = page.locator('[data-inspection-id="hero"]');
    await card.waitFor();
    const camera = () => page.locator('.proto-map-viewport').evaluate(el =>
      ['--camera-x', '--camera-y'].map(key => el.style.getPropertyValue(key)));
    const heldKey = async (key = 'w') => {
      await page.keyboard.down(key);
      await page.waitForTimeout(180);
      await page.keyboard.up(key);
      await page.waitForTimeout(80);
    };
    const check = async (target, moves, label) => {
      await target.focus();
      const before = await camera();
      await heldKey();
      if (moves) assert.notDeepEqual(await camera(), before, label);
      else assert.deepEqual(await camera(), before, label);
      console.log('PASS', label);
    };
    await check(card, true, 'compact card preview keeps WASD on the map');
    await card.press('Enter');
    await page.locator('.details-card-viewer--jumbo').waitFor();
    await check(page.getByRole('button', { name: 'Close jumbo card', exact: true }), true, 'jumbo dialog button keeps WASD on the map');

    // Exercise native controls within the real preview, including nested editors.
    await card.evaluate(el => {
      const host = document.createElement('div'); host.id = 'keyboard-fixture';
      host.innerHTML = '<input id="text"><textarea id="area"></textarea><input id="number" type="number"><input id="readonly" readonly><input id="range" type="range"><input id="checkbox" type="checkbox"><select id="select"><option>A</option><option>W</option></select><div id="editable" contenteditable><span id="nested" tabindex="0">edit</span><span id="noneditable" contenteditable="false" tabindex="0">static</span></div>';
      el.append(host);
    });
    for (const id of ['text', 'area', 'number', 'editable', 'nested']) {
      await check(page.locator('#' + id), false, id + ' protects text/data entry');
    }
    assert.match(await page.locator('#text').inputValue(), /w/);
    assert.match(await page.locator('#area').inputValue(), /w/);
    for (const id of ['readonly', 'range', 'checkbox', 'select', 'noneditable']) {
      await check(page.locator('#' + id), true, id + ' keeps WASD on the map');
    }
    await card.focus();
    await page.keyboard.down('d'); await page.waitForTimeout(100);
    await page.locator('#text').focus(); await page.waitForTimeout(80);
    const stopped = await camera(); await page.waitForTimeout(200);
    assert.deepEqual(await camera(), stopped, 'focusing an editor releases held movement');
    await page.keyboard.up('d');
    await card.focus();
    const beforeModified = await camera();
    await page.keyboard.down('Control'); await heldKey('a'); await page.keyboard.up('Control');
    assert.deepEqual(await camera(), beforeModified, 'modified shortcuts retain their behavior');

    // Use the same module URL as the app so the director singleton is shared.
    await page.evaluate(async () => {
      const source = await (await fetch('/src/proto/components/CameraChoreographyTools.tsx')).text();
      window.keyboardDirector = await import(source.match(/from ["']([^"']*cameraDirector[^"']*)["']/)[1]);
    });
    const play = () => page.evaluate(() => {
      const d = window.keyboardDirector;
      d.playCameraSteps([{ id: 'keyboard-test', name: 'Keyboard test', shot: d.captureCameraShot(), durationMs: 0, holdMs: 10000, easing: 'cut' }]);
    });
    await page.locator('#text').focus(); await play(); await heldKey();
    assert.equal(await page.evaluate(() => window.keyboardDirector.getCameraPlayback().playing), true, 'typing preserves choreography');
    await page.locator('#range').focus(); await heldKey();
    assert.equal(await page.evaluate(() => window.keyboardDirector.getCameraPlayback().playing), false, 'WASD on a non-text control interrupts choreography');
    await page.locator('#keyboard-fixture').evaluate(el => el.remove());
    assert.deepEqual(errors, []);
    console.log('PASS held-key release, modified shortcuts, choreography ownership and page errors');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exit(1); });
