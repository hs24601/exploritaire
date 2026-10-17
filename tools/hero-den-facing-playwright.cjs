const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const {findLayoutDefects}=require('./lib/layout-check.cjs');
(async()=>{const browser=await chromium.launch({headless:true});try{
  for(const width of [1280,1912]){
    const context=await browser.newContext({viewport:{width,height:width===1280?720:914},hasTouch:true,deviceScaleFactor:3,reducedMotion:'reduce'});
    const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
    assert.equal((await page.goto(process.env.PROTO_URL||'http://localhost:5178/proto.html')).status(),200);
    await page.getByRole('button',{name:'Tilt camera view',exact:true}).click();await page.waitForTimeout(1000);
    const hero=page.locator('[data-board-piece="actor"][data-actor-id="hero"]');
    for(let i=0;i<=8;i++){
      if(i){const turn=page.getByRole('button',{name:'Turn table right',exact:true});if(i%2)await turn.click();else await turn.tap();await page.waitForTimeout(250);}
      assert.equal(await hero.getAttribute('data-grid-reference'),'table:0,2');
      assert.equal(Number(await hero.getAttribute('data-actor-heading')),Math.PI);
      assert.equal(Number(await hero.locator('canvas[data-world-heading]').getAttribute('data-world-heading')),Math.PI);
      if([0,4].includes(i))await page.screenshot({path:`artifacts/hero-den-facing-${width}-${i*45}-3x.png`});
    }
    assert.deepEqual(await findLayoutDefects(page,'.proto-map-footer',{parts:'.proto-map-toolbar,.proto-map-camera-button,.table-grid-reference'}),[]);
    assert.deepEqual(errors,[]);console.log('PASS Hero north in den through mouse/touch orbit',width);await context.close();
  }
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exit(1);});
