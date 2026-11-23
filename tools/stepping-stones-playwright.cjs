// Scenario 223 Stepping Stones: Hero reaches 14 cards, steps onto played cards, arena shows reach rings.
const { chromium } = require('playwright');
const assert = require('node:assert/strict');
(async () => {
 const browser = await chromium.launch({ headless:true, executablePath:'C:/Users/ericm/AppData/Local/ms-playwright/chromium-1208/chrome-win64/chrome.exe', args:['--use-angle=swiftshader','--enable-unsafe-swiftshader'] });
 const out='artifacts/stepping-stones';require('node:fs').mkdirSync(out,{recursive:true});
 try {
  for (const [width,height] of [[1912,914],[1280,720]]) {
   const page = await browser.newPage({viewport:{width,height}});
   const errors=[];page.on('pageerror', e => errors.push(e.stack));
   await page.goto((process.env.PROTO_URL ?? 'http://localhost:5178/proto.html')+'?combatsbx&scenario=223');
   await page.locator('.battle-field[data-vertical-columns] [data-battle-card]').first().waitFor();
   const reach=()=>page.locator('.battle-field[data-vertical-columns] [data-battle-card]:not([data-row-inaccessible])').count();
   assert.equal(await reach(),14,'Hero reaches 14 cards');
   await page.waitForTimeout(6000);
   await page.screenshot({path:`${out}/start-${width}.png`});
   // Play legal cards; Hero should stand on the last one's spot.
   let played=0;
   for(let i=0;i<3;i++){
    const legal=page.locator('.battle-field[data-vertical-columns] [data-battle-card]:not([data-row-inaccessible]):not([disabled])');
    if(!await legal.count())break;
    await legal.first().hover();await page.waitForTimeout(400);
    if(i===0)await page.screenshot({path:`${out}/hover-${width}.png`});
    await legal.first().click();await page.mouse.move(3,3);await page.waitForTimeout(900);played++;
   }
   assert.equal(await reach(),14,'still 14 after moving');
   if(played)assert.equal(await page.locator('[data-stepping-stand]').count(),1,'one card marks where Hero stands');
   await page.waitForTimeout(2500);
   await page.screenshot({path:`${out}/after-${played}-plays-${width}.png`});
   // Overflow and collision check of the flat field against the viewport.
   const overflow=await page.evaluate(()=>[...document.querySelectorAll('.battle-field[data-vertical-columns] [data-battle-card]')].filter(n=>{const r=n.getBoundingClientRect();return r.right>innerWidth+1||r.bottom>innerHeight+1||r.left<-1||r.top<-1;}).length);
   assert.equal(overflow,0,'no card outside the viewport');
   assert.deepEqual(errors,[],'no page errors');
   console.log(`PASS ${width}x${height}: 14 reachable, played ${played}, stand marked, no overflow`);
   await page.close();
  }
 } finally {await browser.close();}
})().catch(e=>{console.error(e);process.exit(1)});
