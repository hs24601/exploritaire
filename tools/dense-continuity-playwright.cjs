const {chromium}=require('playwright'),assert=require('node:assert/strict'),fs=require('node:fs');
(async()=>{const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'});fs.mkdirSync('artifacts/dense-continuity',{recursive:true});try{
 for(const [width,height] of [[1280,720],[1912,914],[390,844],[844,390]]){
  const page=await browser.newPage({viewport:{width,height},reducedMotion:'reduce'});
  await page.goto('http://127.0.0.1:5178/tools/fixtures/dense-berry.html?approach');
  await page.locator('.travel-dense-bush').first().waitFor();
  const bushes=()=>page.locator('.travel-dense-bush').evaluateAll(ns=>ns.map(n=>({style:n.style.cssText,fruit:n.dataset.berryCount,sprite:n.querySelector('img').getAttribute('src')})));
  const incoming=await bushes();assert.equal(incoming.length,3);assert.deepEqual(incoming.map(b=>b.fruit),['2','2','1']);
  assert.equal(await page.locator('[data-travel-card]').count(),6);
  await page.screenshot({path:`artifacts/dense-continuity/${width}-approach.png`});
  await page.waitForFunction(()=>document.querySelectorAll('[data-arrival-face="up"]').length===6);
  for(let i=0;i<6;i++)await page.getByRole('button',{name:'Auto-M',exact:true}).click();
  await page.waitForFunction(()=>document.querySelectorAll('[data-travel-card]').length===12);
  await page.waitForFunction(()=>document.querySelectorAll('[data-arrival-face="up"]').length===12);
  assert.deepEqual(await bushes(),incoming,'same crowns, placement, fruit and art at gathering');
  assert.equal(await page.locator('[data-fixture-mana]').getAttribute('data-fixture-mana'),'1','approach earns no berries');
  assert.equal(await page.locator('.travel-scenery-camera canvas').count(),0,'no generic berry landscape');
  await page.screenshot({path:`artifacts/dense-continuity/${width}-gather.png`});
  console.log(width,'six approach cards, same three bushes and five fruit at gathering');await page.close();
 }
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exit(1)});
