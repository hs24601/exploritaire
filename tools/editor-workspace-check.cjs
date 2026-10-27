const { chromium } = require('playwright');
const assert = require('node:assert/strict');
(async () => {
  const browser = await chromium.launch({ headless: true, channel: 'msedge' });
  try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 720 }, reducedMotion: 'reduce' });
    const errors = []; page.on('pageerror', e => errors.push(e.message));
    await page.goto('http://127.0.0.1:5231/proto.html');
    await page.getByRole('button', { name: 'Edit tiles', exact: true }).click();
    const panel = page.locator('.tile-editor');
    await panel.getByRole('button', { name: 'Apply to playtest', exact: true }).waitFor();
    for (const name of ['Selection', 'Identity', 'Travel', 'Resources', 'Rules', 'Lighting']) {
      await panel.getByRole('tab', { name, exact: true }).click();
      const size = await panel.evaluate(el => ({ scroll: el.scrollHeight, client: el.clientHeight }));
      assert(size.scroll <= size.client + 2, `${name} needs scrolling: ${JSON.stringify(size)}`);
    }
    const before = await panel.boundingBox(); const header = await panel.locator('.tile-editor-heading').boundingBox();
    await page.mouse.move(header.x + 50, header.y + 20); await page.mouse.down();
    await page.mouse.move(header.x - 130, header.y + 80, { steps: 8 }); await page.mouse.up();
    const after = await panel.boundingBox(); assert(after.x < before.x - 100); assert(after.y > before.y + 40);
    await panel.getByRole('tab', { name: 'Tools', exact: true }).click();
    await panel.getByRole('button', { name: 'Camera choreography', exact: true }).click();
    await page.getByRole('tab', { name: 'Shots', exact: true }).click();
    await page.getByRole('button', { name: 'Close camera choreography', exact: true }).click();
    await page.goto('http://127.0.0.1:5231/tools/callout-editor-preview.html');
    await page.getByRole('button', { name: 'Edit callout', exact: true }).click();
    const dialog = page.locator('.callout-editor');
    await dialog.getByLabel('Callout text', { exact: true }).fill('A retained draft.');
    for (const name of ['Expression', 'Camera', 'Preview', 'Text & effects']) {
      await dialog.getByRole('tab', { name, exact: true }).click();
      assert(await dialog.evaluate(el => el.scrollHeight <= el.clientHeight + 2), `${name} needs scrolling`);
    }
    await dialog.getByRole('tab', { name: 'Camera', exact: true }).click();
    await dialog.getByLabel('Camera preset', { exact: true }).selectOption('shot');
    await page.screenshot({path:'artifacts/editor-camera-workspace.png'});
    console.log(await dialog.evaluate(el => ({height:el.clientHeight, scroll:el.scrollHeight})));
    assert(await dialog.evaluate(el => el.scrollHeight <= el.clientHeight + 2), 'Custom camera needs scrolling');
    await dialog.getByRole('tab', { name: 'Text & effects', exact: true }).click();
    assert.equal(await dialog.getByLabel('Callout text', { exact: true }).inputValue(), 'A retained draft.');
    // A native cancelable wheel must reach the panel without the window camera consuming it.
    assert(await dialog.evaluate(el => el.dispatchEvent(new WheelEvent('wheel', { bubbles: true, cancelable: true, clientX: el.getBoundingClientRect().x + 50, clientY: el.getBoundingClientRect().y + 150, deltaY: 200 }))));
    await page.screenshot({ path: 'artifacts/editor-workspace.png' });
    await dialog.getByRole('button', { name: 'Save callout', exact: true }).click();
    assert.equal(await page.locator('.proto-callout-text').innerText(), 'A retained draft.');
    assert.deepEqual(errors, []); console.log('Editor tabs, desktop fit, dragging, wheel ownership and callout saving passed.');
  } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });

