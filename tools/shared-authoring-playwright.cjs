const { chromium } = require('playwright');
const fs = require('node:fs');
const assert = require('node:assert/strict');
const file = 'src/data/sharedAuthoring.json';

(async () => {
  const original = fs.readFileSync(file, 'utf8');
  const browser = await chromium.launch();
  try {
    const first = await browser.newContext();
    const second = await browser.newContext();
    const a = await first.newPage(), b = await second.newPage();
    for (const page of [a, b]) {
      await page.route('**/authoring-fixture', route => route.fulfill({ contentType: 'text/html', body: '<p>Authoring persistence test</p>' }));
      await page.goto('http://localhost:5178/authoring-fixture');
    }
    const save = (page, kind, id, value) => page.evaluate(async ({ kind, id, value }) => {
      const module = await import('/src/proto/sharedAuthoring.ts');
      await module.saveAuthored(kind, id, value);
    }, { kind, id, value });
    await save(a, 'callouts', 'test.shared-callout', { text: 'Shared breakfast test', marks: [] });
    await save(b, 'emotions', 'sandbox', 'curious');
    const disk = JSON.parse(fs.readFileSync(file, 'utf8'));
    assert.equal(disk.callouts['test.shared-callout'].text, 'Shared breakfast test');
    assert.equal(disk.emotions.sandbox, 'curious');
    await b.reload();
    const shared = await b.evaluate(async () => (await import('/src/proto/sharedAuthoring.ts')).authored);
    assert.equal(shared.callouts['test.shared-callout'].text, 'Shared breakfast test');
    await save(a, 'callouts', 'test.shared-callout', null);
    assert.equal(JSON.parse(fs.readFileSync(file, 'utf8')).callouts['test.shared-callout'], null);
    const beforeInvalid = fs.readFileSync(file, 'utf8');
    const invalid = await first.request.post('http://localhost:5178/__authoring/save', { data: { kind: 'cameras', id: 'bad', value: {} } });
    assert.equal(invalid.status(), 400);
    assert.equal(fs.readFileSync(file, 'utf8'), beforeInvalid);
    const publicRequest = await first.request.post('http://localhost:5178/__authoring/save', { headers: { 'tailscale-funnel-request': 'true' }, data: { kind: 'emotions', id: 'sandbox', value: 'sad' } });
    assert.equal(publicRequest.status(), 403);
    console.log('PASS: disk persistence, independent browser contexts, unrelated saves retained, persistent reset, invalid payload rejection, public tunnel rejection.');
  } finally {
    fs.writeFileSync(file, original);
    await browser.close();
  }
})().catch(error => { console.error(error); process.exit(1); });
