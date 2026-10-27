const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const { findLayoutDefects } = require('./lib/layout-check.cjs');
const url = process.env.PROTO_URL || 'http://localhost:5178/proto.html';

(async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    for (const [width, height] of [[1280, 720], [1912, 914]]) {
      const page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: 3 });
      await page.goto(url);
      await page.locator('.proto-ordinary-day').waitFor();
      await page.evaluate(() => document.fonts.ready);
      assert.deepEqual(await findLayoutDefects(page, '.proto-ordinary-day', {
        parts: '.proto-ordinary-day__heading, .proto-ordinary-day__heading strong, .proto-ordinary-day__heading span, .quest-emblem, .quest-artwork, .proto-ordinary-day__thought, .proto-ordinary-day__actions, .proto-ordinary-day__actions > span, button',
      }), []);
      await page.locator('.proto-story-card').screenshot({ path: `artifacts/quest-art-day-${width}-3x.png` });
      // Exercise the reusable tray with real React components, independently of
      // Day 1's intentionally empty quest chain. Long titles must still fit.
      await page.evaluate(async () => {
        const React = (await import('/node_modules/.vite/deps/react.js')).default;
        const ReactDOM = (await import('/node_modules/.vite/deps/react-dom_client.js')).default;
        const { QuestField } = await import('/src/proto/components/QuestField.tsx');
        document.querySelector('#root').style.display = 'none';
        const fixture = document.createElement('div');
        fixture.className = 'proto-game-root';
        fixture.style.cssText = 'position:fixed;inset:0;display:block;height:100vh;';
        document.body.append(fixture);
        window.questArtRoot = ReactDOM.createRoot(fixture);
        window.questArtRender = (title, status = 'incomplete') => window.questArtRoot.render(React.createElement(QuestField, {
          quests: [{ id: 'art-fixture', title, text: 'Return Hero to the city with the resources collected in Small Woods.', status, rewards: [{ kind: 'energy' }] }],
          onRedeem() {},
        }));
        window.questArtRender('Rest');
      });
      await page.locator('.quest-card').waitFor();
      await page.locator('.quest-tray').evaluate(el => { el.style.cssText = 'position:absolute;top:24px;right:24px;height:calc(100vh - 48px);display:flex;flex-direction:column;'; });
      await page.locator('.quest-tray__well').evaluate(el => { el.style.flex = '1'; });
      await page.waitForTimeout(300);
      const check = async () => {
        assert.deepEqual(await findLayoutDefects(page, '.quest-card', { parts: '.quest-card__title, .quest-card__text, .quest-artwork, .quest-card__reward' }), []);
        assert.ok(await page.locator('.quest-card').evaluate(el => el.scrollHeight <= el.clientHeight + 1));
        const box = await page.locator('.quest-card').boundingBox();
        assert.ok(Math.abs(box.width / box.height - 63 / 88) < .001);
      };
      await check();
      await page.locator('.quest-card').screenshot({ path: `artifacts/quest-art-tray-${width}-3x.png` });
      await page.evaluate(() => window.questArtRender('Use the Day 2 ration for the Deep Woods round trip', 'complete'));
      await page.waitForTimeout(300);
      await page.locator('.quest-card').screenshot({ path: `artifacts/quest-art-tray-long-${width}-3x.png` });
      await check();
      assert.ok(await page.locator('.quest-card__title').evaluate(el => !el.hasAttribute('title')));
      await page.close();
      console.log(`PASS quest artwork and layout ${width}x${height}`);
    }
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
