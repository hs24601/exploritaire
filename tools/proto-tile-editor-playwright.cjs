const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const base = process.env.TILE_EDITOR_URL || 'http://127.0.0.1:5221';
const file = path.resolve(__dirname, '../src/data/protoTiles.json');
const original = fs.readFileSync(file, 'utf8');
const artifacts = path.resolve(__dirname, '../artifacts/tile-editor');
fs.mkdirSync(artifacts, { recursive: true });

(async () => {
  const browser = await chromium.launch({ headless: true });
  const errors = [];
  try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 900 }, reducedMotion: 'reduce' });
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(`${base}/proto.html`);
    await page.getByRole('button', { name: 'Edit tiles', exact: true }).waitFor({ timeout: 60000 });
    await page.getByRole('button', { name: 'Edit tiles', exact: true }).click();
    const panel = page.getByRole('complementary', { name: 'Developer tile editor' });
    await panel.waitFor();
    assert.equal(await page.locator('[data-editor-cell="table:0,2"]').count(), 1);
    const pickCell = async (targetPage, column, row, touch = false) => {
      await targetPage.evaluate(({ column, row }) => {
        window.document.querySelector('#tile-editor-test-cell')?.remove();
        const marker = window.document.createElement('i'); marker.id = 'tile-editor-test-cell';
        marker.style.cssText = `position:absolute;left:${column * 48}px;top:${row * 48}px;width:1px;height:1px;pointer-events:none`;
        window.document.querySelector('[data-physical-world]').append(marker);
      }, { column, row });
      const box = await targetPage.locator('#tile-editor-test-cell').boundingBox();
      if (touch) await targetPage.touchscreen.tap(box.x + box.width / 2, box.y + box.height / 2);
      else await targetPage.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
      assert.equal(await targetPage.locator(`[data-editor-cell="table:${column},${row}"]`).count(), 1);
    };
    await pickCell(page, 1, 0);
    assert.equal(await panel.getByLabel('Tile ID', { exact: true }).inputValue(), 'day-one-tree');
    await page.getByRole('button', { name: 'Turn table right', exact: true }).click();
    await page.waitForTimeout(600);
    await pickCell(page, 0, 2);
    assert.equal(await panel.getByLabel('Tile ID', { exact: true }).inputValue(), 'hero-den');
    await page.getByRole('button', { name: 'Tilt camera view', exact: true }).click();
    await page.waitForTimeout(600);
    await pickCell(page, 0, 1);
    assert.equal(await panel.getByLabel('Tile ID', { exact: true }).inputValue(), 'dirt-0-1');
    await page.getByRole('button', { name: 'Flat camera view', exact: true }).click();
    await page.getByRole('button', { name: 'Reset View', exact: true }).click();
    await page.waitForTimeout(600);
    await panel.getByLabel('Choose tile').selectOption('curious-sapling');
    await panel.getByLabel('Title', { exact: true }).fill('Curious Sapling draft');
    await panel.getByRole('button', { name: 'Update tile / move', exact: true }).click();
    assert.equal(await panel.getByRole('alert').count(), 0, await panel.innerText());
    await panel.getByRole('button', { name: 'Undo edit', exact: true }).click();
    await panel.getByLabel('Title', { exact: true }).evaluate(el => { if (el.value !== 'Curious Sapling') throw new Error('Undo did not restore title'); });
    await panel.getByRole('button', { name: 'Redo edit', exact: true }).click();
    assert.equal(await panel.getByLabel('Title', { exact: true }).inputValue(), 'Curious Sapling draft');
    await panel.getByRole('button', { name: 'Close · discard unapplied draft', exact: true }).click();
    await page.getByRole('button', { name: 'Edit tiles', exact: true }).click();
    await panel.getByLabel('Choose tile').selectOption('curious-sapling');
    assert.equal(await panel.getByLabel('Title', { exact: true }).inputValue(), 'Curious Sapling');

    await panel.getByLabel('Select column', { exact: true }).fill('4');
    await panel.getByLabel('Select row', { exact: true }).fill('-2');
    await panel.getByRole('button', { name: 'Add tile', exact: true }).click();
    await panel.getByLabel('Title', { exact: true }).fill('Editor Test Woods');
    await panel.getByLabel('STA per orthogonal cell override').fill('2.5');
    await panel.getByRole('button', { name: 'Update tile / move', exact: true }).click();
    await panel.getByLabel('Tile column', { exact: true }).fill('5');
    await panel.getByRole('button', { name: 'Update tile / move', exact: true }).click();
    await panel.getByLabel('Choose tile').selectOption('tile-woods-4--2');
    await panel.getByLabel('Tile column', { exact: true }).fill('6');
    await panel.getByRole('button', { name: 'Duplicate at destination', exact: true }).click();
    assert.equal(await panel.getByLabel('Tile ID', { exact: true }).inputValue(), 'tile-woods-4--2-copy');
    await panel.getByRole('button', { name: 'Remove tile', exact: true }).click();
    await panel.getByRole('button', { name: 'Undo edit', exact: true }).click();
    await panel.getByLabel('Choose tile').selectOption('tile-woods-4--2-copy');
    await panel.getByLabel('Tile column', { exact: true }).fill('5');
    await panel.getByRole('button', { name: 'Update tile / move', exact: true }).click();
    assert.match(await panel.getByRole('alert').innerText(), /overlap/);
    await panel.getByLabel('Tile column', { exact: true }).fill('6');
    await panel.getByRole('button', { name: 'Update tile / move', exact: true }).click();

    await panel.getByLabel('Terrain defaults', { exact: true }).selectOption('woods');
    await panel.getByLabel('Default STA', { exact: true }).fill('4');
    await panel.getByRole('button', { name: 'Update terrain defaults', exact: true }).click();
    await panel.getByRole('button', { name: 'Apply to playtest', exact: true }).click();
    assert.match(await panel.getByRole('status').innerText(), /Applied/);
    assert.equal(fs.readFileSync(file, 'utf8'), original, 'Apply must not write disk');
    await page.screenshot({ path: path.join(artifacts, 'desktop-ott.png') });
    await page.getByRole('button', { name: 'Tilt camera view', exact: true }).click();
    await page.locator('[data-camera-view="immersive"]').waitFor();
    await page.screenshot({ path: path.join(artifacts, 'desktop-immersion.png') });
    await panel.getByRole('button', { name: 'Close · discard unapplied draft', exact: true }).click();
    await page.getByRole('button', { name: 'Edit tiles', exact: true }).click();
    await panel.getByLabel('Choose tile').selectOption('tile-woods-4--2');
    assert.equal(await panel.getByLabel('STA per orthogonal cell override').inputValue(), '2.5');

    // Save through the UI and verify a fresh document loads the authored data.
    const savedResponse = page.waitForResponse(response => response.url().endsWith('/__proto-deprecated/pixel/tiles/save'));
    savedResponse.catch(() => {});
    await panel.getByRole('button', { name: 'Save authored data', exact: true }).click();
    assert.equal((await savedResponse).status(), 200);
    const saved = JSON.parse(fs.readFileSync(file, 'utf8'));
    assert.equal(saved.defaults.woods.traversalDifficulty, 4);
    assert.equal(saved.tiles.find(tile => tile.id === 'tile-woods-4--2').column, 5);
    assert.equal(saved.tiles.find(tile => tile.id === 'tile-woods-4--2').traversalDifficulty, 2.5);
    for (const tile of saved.tiles) for (const forbidden of ['tableau', 'stock', 'seed', 'traversalProgress', 'clearedDay']) assert.ok(!(forbidden in tile));
    await page.waitForTimeout(1500);
    await page.goto(`${base}/proto.html`);
    await page.getByRole('button', { name: 'Edit tiles', exact: true }).waitFor({ timeout: 60000 });
    await page.getByRole('button', { name: 'Edit tiles', exact: true }).click();
    await panel.getByLabel('Choose tile').selectOption('tile-woods-4--2');
    assert.equal(await panel.getByLabel('Title', { exact: true }).inputValue(), 'Editor Test Woods');
    assert.equal(await panel.getByLabel('Tile column', { exact: true }).inputValue(), '5');

    // Server-side rejection leaves the saved file intact.
    const invalid = await page.request.post(`${base}/__proto-deprecated/pixel/tiles/save`, { data: { ...saved, tiles: [...saved.tiles, saved.tiles[0]] } });
    assert.equal(invalid.status(), 400);
    assert.deepEqual(JSON.parse(fs.readFileSync(file, 'utf8')), saved);
    const publicTunnel = await page.request.post(`${base}/__proto-deprecated/pixel/tiles/save`, { headers: { 'cf-connecting-ip': '8.8.8.8' }, data: saved });
    assert.equal(publicTunnel.status(), 403);
    await panel.getByRole('button', { name: 'Close · discard unapplied draft', exact: true }).click();

    const touch = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, reducedMotion: 'reduce' });
    await touch.goto(`${base}/proto.html`);
    await touch.getByRole('button', { name: 'Edit tiles', exact: true }).waitFor({ timeout: 60000 });
    await touch.getByRole('button', { name: 'Edit tiles', exact: true }).tap();
    const touchPanel = touch.getByRole('complementary', { name: 'Developer tile editor' });
    await touchPanel.waitFor();
    await pickCell(touch, 0, 1, true);
    assert.equal(await touchPanel.getByLabel('Tile ID', { exact: true }).inputValue(), 'dirt-0-1');
    const bounds = await touchPanel.boundingBox();
    assert.ok(bounds.x >= 0 && bounds.x + bounds.width <= 390 && bounds.y + bounds.height <= 844);
    await touch.screenshot({ path: path.join(artifacts, 'mobile-editor.png') });
    assert.deepEqual(errors, []);
    console.log('PASS: draft discard, add/move/duplicate/remove, undo/redo, overlap validation, defaults/overrides, playtest apply, disk save/reload, server rejection, OTT/immersion and mobile layout');
  } catch (error) {
    for (const page of browser.contexts().flatMap(context => context.pages())) {
      try { await page.screenshot({ path: path.join(artifacts, 'failure.png') }); console.error((await page.locator('body').innerText()).slice(-6500)); } catch {}
    }
    throw error;
  } finally {
    fs.writeFileSync(file, original, 'utf8');
    await browser.close();
  }
})().catch(error => { console.error(error); process.exit(1); });
