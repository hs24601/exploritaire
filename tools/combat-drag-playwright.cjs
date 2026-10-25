const {chromium}=require('playwright');const assert=require('node:assert/strict');
(async()=>{const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'});try{
for(const touch of [false,true]){
 const page=await browser.newPage({viewport:touch?{width:390,height:844}:{width:1280,height:800},hasTouch:touch,isMobile:touch});
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.addInitScript(()=>{let seed=5150;Math.random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};});
 await page.goto('http://127.0.0.1:5178/proto.html?combatsbx');await page.waitForSelector('.battle-field__rack');
 const source=page.locator('.battle-field__rack .battle-field__column').first().locator('button').last();
 assert.equal(await source.getAttribute('data-gameplay-disabled'),null);
 const cdp=touch?await page.context().newCDPSession(page):null;
 const drag=async actor=>{
  const from=await source.boundingBox(),to=await page.locator('[data-battle-actor="'+actor+'"] .battle-field__actor-card').boundingBox();
  const sx=from.x+from.width/2,sy=from.y+from.height/2,tx=to.x+to.width/2,ty=to.y+to.height/2;
  if(touch){
   await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:sx,y:sy}]});
   for(let i=1;i<=10;i++)await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:sx+(tx-sx)*i/10,y:sy+(ty-sy)*i/10}]});
   await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
  }else{await page.mouse.move(sx,sy);await page.mouse.down();await page.mouse.move(tx,ty,{steps:12});await page.mouse.up();}
 };
 await drag('mochi');assert.equal(await page.locator('.battle-foe [data-bar="hp"]').getAttribute('aria-valuenow'),'10','illegal receiving actor does not play card');
 await page.keyboard.press('Space');await drag('hero');assert.equal(await page.locator('.battle-foe [data-bar="hp"]').getAttribute('aria-valuenow'),'10','pause blocks dragging');await page.keyboard.press('Space');
 await drag('hero');await page.waitForFunction(()=>document.querySelector('.battle-foe [data-bar="hp"]')?.getAttribute('aria-valuenow')==='9');
 assert.equal(await page.locator('.battle-field__rack .battle-field__column').first().locator('button').count(),4,'infinifill preserved');
 assert.equal(await page.locator('[data-battle-slot="hero"] .proto-foundation-count-token').innerText(),'▤1','drop plays once');
 assert.equal(await page.locator('.battle-field').getAttribute('data-team-turn'),'party');assert.deepEqual(errors,[]);
 console.log(touch?'Touch':'Mouse','legal drag, illegal target rejection, pause, one default hit, and backfill passed');await page.close();
}
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exit(1)});
