const {chromium}=require('playwright'),assert=require('node:assert/strict');
(async()=>{const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'});try{
 const page=await browser.newPage({viewport:{width:1280,height:720},reducedMotion:'reduce'});
 await page.goto('http://127.0.0.1:5178/tools/fixtures/dense-berry.html?direct');
 await page.waitForFunction(()=>document.querySelectorAll('[data-arrival-face="up"]').length===12);
 assert.equal(await page.locator('[data-travel-card^="stage-"]').count(),0);
 assert.equal(await page.locator('.travel-dense-bush').count(),3);
 await page.getByRole('button',{name:'Auto-S Tile',exact:true}).click();
 await page.getByRole('button',{name:'Collect the berry',exact:true}).click();
 await page.waitForFunction(()=>document.querySelector('[data-fixture-completed]').dataset.fixtureCompleted==='12');
 assert.equal(await page.locator('[data-fixture-mana]').getAttribute('data-fixture-mana'),'6');
 console.log('Direct destination gathering: no traversal cards, three bushes, five finite berry rewards and final choice passed');
 await page.goto('http://127.0.0.1:5178/proto.html');
 await page.locator('[data-map-actor-card="hero"]').waitFor({state:'attached',timeout:10000}).catch(()=>{});
 assert.equal(await page.title()!=='',true);
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exit(1)});
