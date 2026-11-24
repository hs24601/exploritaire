const { chromium } = require('playwright');
const assert = require('node:assert/strict');
(async () => {
 const browser = await chromium.launch({headless:true,executablePath:'C:/Users/ericm/AppData/Local/ms-playwright/chromium-1208/chrome-win64/chrome.exe'});
 try {
  const page = await browser.newPage({viewport:{width:1440,height:1000}});
  await page.goto((process.env.PROTO_URL ?? 'http://127.0.0.1:5201/proto.html')+'?combatsbx&scenario=1000');
  await page.locator('.battle-end-turn').click();
  await page.mouse.move(3,3);
  const card = page.locator('.battle-intent-slot__card');
  await card.waitFor();
  await page.waitForTimeout(1400);
  await card.hover();
  const tip = page.locator('#combat-inspection-tooltip');
  await tip.waitFor();
  assert.equal(await tip.locator('strong').textContent(),'Deep Breath');
  assert.ok((await tip.locator('.game-tooltip__details').textContent()).length>30);
  assert.equal(await page.locator('.battle-intent-slot').getAttribute('data-combat-inspected'),'true');
  require('node:fs').mkdirSync('artifacts/ability-tooltip',{recursive:true});
  await page.screenshot({path:'artifacts/ability-tooltip/card-hover.png'});
  await page.mouse.move(3,3);
  await tip.waitFor({state:'detached'});
  console.log('PASS: ability card center hover, title and details, inspection pause and dismissal');
 } finally { await browser.close(); }
})().catch(error=>{console.error(error);process.exit(1)});
