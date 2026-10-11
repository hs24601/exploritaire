const {chromium}=require('playwright');
const assert=require('node:assert/strict');
(async()=>{
  const browser=await chromium.launch({headless:true});
  try{
    const page=await browser.newPage({viewport:{width:1280,height:720},reducedMotion:'reduce'});
    await page.goto('http://localhost:5178/proto.html');
    const tile=page.locator('[data-biome-id="woods-danger"]');
    await tile.waitFor();
    assert.equal(await tile.getAttribute('data-grid-reference'),'table:-2,2');
    const center=async locator=>{const r=await locator.boundingBox();return {x:r.x+r.width/2,y:r.y+r.height/2};};
    const from=await center(page.locator('[data-cell-grip="actor-hero"]')),to=await center(tile);
    await page.mouse.move(from.x,from.y);await page.mouse.down();await page.mouse.move(to.x,to.y,{steps:15});await page.mouse.up();
    await page.locator('.battle-field').waitFor({timeout:20000});
    assert.equal(await page.locator('.battle-field__column').count(),7);
    await page.screenshot({path:'artifacts/combat-tile-placement.png'});
    console.log('PASS combat tile at table:-2,2, reachable from home, opens battle tableau');
  }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exit(1);});
