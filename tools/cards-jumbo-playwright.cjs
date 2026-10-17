const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const {findLayoutDefects}=require('./lib/layout-check.cjs');
async function press(el,touch){if(touch)await el.tap();else await el.click();}
async function drag(page,from,to,touch){const cdp=touch?await page.context().newCDPSession(page):null;const send=(type,p)=>cdp.send('Input.dispatchTouchEvent',{type,touchPoints:type==='touchEnd'?[]:[p]});if(touch)await send('touchStart',from);else{await page.mouse.move(from.x,from.y);await page.mouse.down();}for(let i=1;i<=12;i++){const p={x:from.x+(to.x-from.x)*i/12,y:from.y+(to.y-from.y)*i/12};if(touch)await send('touchMove',p);else await page.mouse.move(p.x,p.y);await page.waitForTimeout(20);}if(touch)await send('touchEnd',to);else await page.mouse.up();await cdp?.detach();}
async function center(el){const b=await el.boundingBox();return{x:b.x+b.width/2,y:b.y+b.height/2};}
(async()=>{const browser=await chromium.launch({headless:true});try{
  for(const width of [1280,1912])for(const touch of [false,true]){
    const context=await browser.newContext({viewport:{width,height:width===1280?720:914},hasTouch:true,deviceScaleFactor:3,reducedMotion:'reduce'});
    const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
    assert.equal((await page.goto(process.env.PROTO_URL||'http://localhost:5178/proto.html')).status(),200);await page.waitForTimeout(900);
    const story=page.locator('.proto-story-card');await press(story.locator('.quest-artwork'),touch);
    const modal=page.locator('.card-jumbo');await modal.waitFor();
    assert.match(await modal.innerText(),/Breakfast first.*northwest of home/s);
    assert.equal(await page.locator('#root').evaluate(el=>el.inert),true);
    const face=await modal.locator('.card-jumbo__face').boundingBox();assert.ok(face.height>500);assert.ok(Math.abs(face.width/face.height-63/88)<.01);
    assert.deepEqual(await findLayoutDefects(page,'.card-jumbo .proto-ordinary-day',{parts:'.proto-ordinary-day__heading,.quest-artwork,.proto-ordinary-day__thought,.proto-ordinary-day__actions'}),[]);
    await modal.screenshot({path:`artifacts/cards-jumbo-${width}-${touch?'touch':'mouse'}-story-3x.png`});
    await page.keyboard.press('Escape');assert.equal(await modal.count(),0);assert.equal(await page.locator('#root').evaluate(el=>el.inert),false);
    const from=await center(story.locator('.proto-ordinary-day__heading'));await drag(page,from,{x:from.x+45,y:from.y+30},touch);assert.equal(await modal.count(),0,'Drag does not inspect');
    const quest=page.locator('.quest-tray .quest-card').first();
    if(await quest.count()){await press(quest,touch);await modal.waitFor();await modal.screenshot({path:`artifacts/cards-jumbo-${width}-${touch?'touch':'mouse'}-quest-3x.png`});await press(modal.locator('.card-jumbo__close'),touch);}
    await drag(page,await center(page.locator('[data-cell-grip="actor-hero"]')),await center(page.locator('[data-biome-id="day-one-berries"]')),touch);await page.waitForTimeout(2400);
    const foundation=page.locator('[data-actor-holocard="hero"]').first();
    if(await foundation.count()){await press(foundation,touch);const actorModal=page.locator('.card-jumbo,.details-card-viewer--jumbo');await actorModal.waitFor();await actorModal.screenshot({path:`artifacts/cards-jumbo-${width}-${touch?'touch':'mouse'}-foundation-3x.png`});await page.keyboard.press('Escape');}
    const cards=page.locator('.proto-main-tableau .playing-card');const before=await cards.count();
    await press(cards.filter({has:page.locator('[aria-label="BERRY"]')}).first().or(cards.first()).first(),touch);
    assert.equal(await modal.count(),0,'Tableau activation bypasses jumbo');
    await page.waitForTimeout(600);
    assert.equal(await cards.count(),before-1);assert.match(await page.locator('.proto-ordinary-day').innerText(),/Berries 1/);
    assert.deepEqual(errors,[]);console.log('PASS card jumbo mouse/touch, portrait, full copy, drag separation, foundation, direct tableau play',width,touch);await context.close();
  }
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exit(1);});
